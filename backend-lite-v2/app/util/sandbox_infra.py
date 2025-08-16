"""
Infrastructure VM Provider for Kiff Code Execution

This provider creates micro VMs to execute user-generated code from Kiff's LLM,
replacing E2B with a custom VM infrastructure that leverages existing ML services.
"""

from __future__ import annotations
import os
import uuid
import json
import time
import asyncio
import httpx
import base64
import subprocess
import tempfile
import pathlib
from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

# Configuration from environment
INFRA_API_URL = os.getenv("INFRA_API_URL", "http://localhost:8002")  # VM Orchestrator
INFRA_API_KEY = os.getenv("INFRA_API_KEY")
INFRA_TEMPLATE = os.getenv("INFRA_TEMPLATE", "code_execution")
INFRA_ENABLE_MOCK = os.getenv("INFRA_ENABLE_MOCK", "false").lower() in ("1", "true", "yes")

# VM Configuration
VITE_PORT = int(os.getenv("PREVIEW_VITE_PORT", "5173"))
NODE_PORT = int(os.getenv("PREVIEW_NODE_PORT", "3000"))
PYTHON_PORT = int(os.getenv("PREVIEW_PYTHON_PORT", "8000"))
APP_DIR = "/workspace"

# Runtime markers and process/log files (inside VM)
RUNTIME_META = f"{APP_DIR}/.runtime.json"
PID_FILE_VITE = f"{APP_DIR}/.vite.pid"
LOG_FILE_VITE = f"{APP_DIR}/.vite.log"
PID_FILE_PY = f"{APP_DIR}/.app.pid"
LOG_FILE_PY = f"{APP_DIR}/.app.log"
PID_FILE_NODE = f"{APP_DIR}/.node.pid"
LOG_FILE_NODE = f"{APP_DIR}/.node.log"
VENV_DIR = f"{APP_DIR}/.venv"


class InfraVMUnavailable(Exception):
    pass


class InfraVMProvider:
    """Provider for custom micro VM infrastructure"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or INFRA_API_KEY
        self.base_url = INFRA_API_URL.rstrip('/')
        self.client = None
        
        # Allow mock mode for development
        if not self.api_key and not INFRA_ENABLE_MOCK:
            logger.warning("INFRA_API_KEY not configured, using mock mode")
        
        self._init_client()
    
    def _init_client(self):
        """Initialize HTTP client"""
        if INFRA_ENABLE_MOCK:
            return
            
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        self.client = httpx.Client(
            base_url=self.base_url,
            headers=headers,
            timeout=30.0
        )
    
    def create_sandbox(self, *, tenant_id: str, session_id: str) -> Dict[str, Any]:
        """Create a new micro VM sandbox"""
        if INFRA_ENABLE_MOCK:
            sandbox_id = f"mock-vm-{tenant_id[:6]}-{session_id[:6]}"
            return {"sandbox_id": sandbox_id, "preview_url": None}
        
        # First try to hit the VM service to see if it's running
        try:
            health_response = httpx.get(f"{self.base_url}/health", timeout=5.0)
            if health_response.status_code != 200:
                logger.warning("VM service not healthy, falling back to mock mode")
                sandbox_id = f"mock-vm-{tenant_id[:6]}-{session_id[:6]}"
                return {"sandbox_id": sandbox_id, "preview_url": None}
        except Exception as e:
            logger.warning(f"VM service not available: {e}, falling back to mock mode")
            sandbox_id = f"mock-vm-{tenant_id[:6]}-{session_id[:6]}"
            return {"sandbox_id": sandbox_id, "preview_url": None}
        
        try:
            # Create VM through orchestrator
            vm_request = {
                "vm_type": "code_execution",
                "config": {
                    "environment_vars": {
                        "TENANT_ID": tenant_id,
                        "SESSION_ID": session_id,
                        "APP_DIR": APP_DIR
                    },
                    "labels": {
                        "tenant_id": tenant_id,
                        "session_id": session_id,
                        "purpose": "code_execution"
                    }
                },
                "resources": {
                    "cpu": "1",
                    "memory": "1Gi",
                    "storage": "2Gi",
                    "execution_timeout": 300
                },
                "warm_ml_connection": False,  # Not needed for code execution
                "warm_vector_connection": False
            }
            
            response = self.client.post("/vm/create", json=vm_request)
            response.raise_for_status()
            
            result = response.json()
            sandbox_id = result["vm_id"]
            
            logger.info(f"Created VM sandbox {sandbox_id} for tenant {tenant_id}")
            
            # Initialize workspace in VM
            self._execute_in_vm(sandbox_id, f"""
import pathlib
workspace = pathlib.Path("{APP_DIR}")
workspace.mkdir(parents=True, exist_ok=True)
print(f"Initialized workspace at {{workspace}}")
""")
            
            return {"sandbox_id": sandbox_id, "preview_url": None}
            
        except Exception as e:
            logger.error(f"Failed to create VM sandbox: {e}")
            raise RuntimeError(f"Failed to create VM sandbox: {e}")
    
    def set_runtime(self, *, sandbox_id: str, runtime: Optional[str] = None, 
                   port: Optional[int] = None, entry: Optional[str] = None) -> None:
        """Store runtime metadata inside the VM"""
        if INFRA_ENABLE_MOCK:
            return
        
        meta = {"runtime": runtime, "port": port, "entry": entry}
        
        code = f"""
import json
import pathlib

meta = {repr(meta)}
meta_file = pathlib.Path("{RUNTIME_META}")
meta_file.parent.mkdir(parents=True, exist_ok=True)
meta_file.write_text(json.dumps(meta))
print(f"Set runtime metadata: {{meta}}")
"""
        
        self._execute_in_vm(sandbox_id, code)
    
    def apply_files(self, *, sandbox_id: str, files: List[Dict[str, Any]]) -> None:
        """Copy files into the VM workspace"""
        if INFRA_ENABLE_MOCK:
            return
        
        for file_info in files:
            path = file_info.get("path", "")
            content = file_info.get("content", "")
            
            # Encode content to base64 to avoid escaping issues
            b64_content = base64.b64encode(content.encode("utf-8")).decode("ascii")
            
            code = f"""
import pathlib
import base64

file_path = pathlib.Path("{APP_DIR}") / {repr(path)}
file_path.parent.mkdir(parents=True, exist_ok=True)

# Decode and write content
content_bytes = base64.b64decode({repr(b64_content)})
file_path.write_bytes(content_bytes)

print(f"Applied file: {{file_path}} ({{len(content_bytes)}} bytes)")
"""
            
            self._execute_in_vm(sandbox_id, code)
        
        logger.info(f"Applied {len(files)} files to VM {sandbox_id}")
    
    def apply_patch(self, *, sandbox_id: str, unified_diff: str) -> None:
        """Apply a unified diff patch inside the VM"""
        if INFRA_ENABLE_MOCK:
            return
        
        b64_diff = base64.b64encode(unified_diff.encode("utf-8")).decode("ascii")
        
        code = f"""
import pathlib
import base64
import subprocess
import tempfile

# Decode diff
diff_content = base64.b64decode({repr(b64_diff)})

# Create temporary file
with tempfile.NamedTemporaryFile(mode='wb', delete=False) as tmp:
    tmp.write(diff_content)
    tmp_path = tmp.name

try:
    # Try to apply patch
    result = subprocess.run(
        ["patch", "-p0", "-t"],
        input=diff_content,
        cwd="{APP_DIR}",
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("Patch applied successfully")
    else:
        # Try git apply as fallback
        result2 = subprocess.run(
            ["git", "apply", "--reject", "--whitespace=nowarn", tmp_path],
            cwd="{APP_DIR}",
            capture_output=True,
            text=True
        )
        
        if result2.returncode == 0:
            print("Patch applied with git apply")
        else:
            # Save diff for manual inspection
            patch_file = pathlib.Path("{APP_DIR}") / ".last_patch.diff"
            patch_file.write_bytes(diff_content)
            print(f"Patch failed, saved to {{patch_file}}")
            
finally:
    pathlib.Path(tmp_path).unlink(missing_ok=True)
"""
        
        self._execute_in_vm(sandbox_id, code)
    
    def set_secrets(self, *, sandbox_id: str, secrets: Dict[str, str]) -> None:
        """Store secrets in VM for later injection"""
        if INFRA_ENABLE_MOCK:
            return
        
        code = f"""
import json
import pathlib

secrets = {repr(secrets)}
secrets_file = pathlib.Path("{APP_DIR}") / ".secrets.json"
secrets_file.parent.mkdir(parents=True, exist_ok=True)
secrets_file.write_text(json.dumps(secrets))

print(f"Stored {{len(secrets)}} secrets")
"""
        
        self._execute_in_vm(sandbox_id, code)
    
    def deploy_files_to_vm(self, *, sandbox_id: str, files: List[Dict[str, str]]) -> None:
        """Deploy files to VM using VM service API"""
        if INFRA_ENABLE_MOCK:
            return
        
        # Use VM service if available
        try:
            health_response = httpx.get(f"{self.base_url}/health", timeout=5.0)
            if health_response.status_code == 200:
                # Use VM service API for file deployment
                response = httpx.post(
                    f"{self.base_url}/vm/{sandbox_id}/files",
                    json={"files": files},
                    timeout=30.0
                )
                response.raise_for_status()
                return
        except Exception as e:
            logger.warning(f"VM service not available for file deployment: {e}")
        
        # Fallback to original apply_files method
        self.apply_files(sandbox_id=sandbox_id, files=files)
    
    def start_dev_server(self, *, sandbox_id: str) -> Optional[str]:
        """Start development server and return preview URL"""
        if INFRA_ENABLE_MOCK:
            return f"https://mock-preview-{sandbox_id}.infra.dev"
        
        # Use VM service if available
        try:
            health_response = httpx.get(f"{self.base_url}/health", timeout=5.0)
            if health_response.status_code == 200:
                # Use VM service API to start server
                response = httpx.post(
                    f"{self.base_url}/vm/{sandbox_id}/start-server",
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()
                return result.get("preview_url")
        except Exception as e:
            logger.warning(f"VM service not available for server start: {e}")
        
        # Fallback to original restart method
        self.restart(sandbox_id=sandbox_id)
        return self.get_preview_url(sandbox_id=sandbox_id, port=5173)
    
    def get_vm_logs(self, *, sandbox_id: str, tail: int = 50) -> Dict[str, Any]:
        """Get VM logs and status"""
        if INFRA_ENABLE_MOCK:
            return {
                "logs": [
                    f"[12:34:56] 🚀 Mock VM {sandbox_id} created",
                    f"[12:34:57] 📁 Files deployed successfully", 
                    f"[12:34:58] 📦 Installing packages...",
                    f"[12:35:01] ✅ npm install completed",
                    f"[12:35:02] 🌐 Server running on http://0.0.0.0:5173",
                    f"[12:35:03] ✅ Preview ready!"
                ],
                "install_status": "ready",
                "server_status": "running"
            }
        
        # Use VM service if available
        try:
            health_response = httpx.get(f"{self.base_url}/health", timeout=5.0)
            if health_response.status_code == 200:
                # Use VM service API to get logs
                response = httpx.get(
                    f"{self.base_url}/vm/{sandbox_id}/logs",
                    params={"tail": tail},
                    timeout=10.0
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.warning(f"VM service not available for logs: {e}")
        
        # Fallback to original tail_logs method
        logs_text = self.tail_logs(sandbox_id=sandbox_id, limit=2000)
        return {
            "logs": logs_text.split('\n') if logs_text else [],
            "install_status": "unknown", 
            "server_status": "unknown"
        }
    
    def install_packages(self, *, sandbox_id: str, packages: List[str]) -> None:
        """Install packages based on detected runtime"""
        if INFRA_ENABLE_MOCK:
            return
        
        if not packages:
            return
        
        # Use VM service if available, otherwise fall back to internal execution
        try:
            health_response = httpx.get(f"{self.base_url}/health", timeout=5.0)
            if health_response.status_code == 200:
                # Use VM service API
                runtime = "npm"  # Default to npm for most generated code
                response = httpx.post(
                    f"{self.base_url}/vm/{sandbox_id}/install",
                    json={"packages": packages, "runtime": runtime},
                    timeout=60.0
                )
                response.raise_for_status()
                return
        except Exception as e:
            logger.warning(f"VM service not available for package install: {e}")
        
        # Fallback to internal execution
        runtime = self._get_runtime(sandbox_id)
        
        if runtime == "python":
            self._install_python_packages(sandbox_id, packages)
        else:
            # Default to npm for node/vite
            self._install_npm_packages(sandbox_id, packages)
        
        # Restart the application after package installation
        self.restart(sandbox_id=sandbox_id)
    
    def restart(self, *, sandbox_id: str) -> None:
        """Restart the application based on runtime"""
        if INFRA_ENABLE_MOCK:
            return
        
        runtime = self._get_runtime(sandbox_id)
        
        if runtime == "python":
            self._restart_python(sandbox_id)
        elif runtime == "node":
            self._restart_node(sandbox_id)
        else:
            # Default to vite
            self._restart_vite(sandbox_id)
    
    def get_preview_url(self, *, sandbox_id: str, port: int) -> Optional[str]:
        """Get preview URL for the VM on specified port"""
        if INFRA_ENABLE_MOCK:
            return f"https://{port}-{sandbox_id}.mock.infra.dev"
        
        try:
            # Get VM status from orchestrator
            response = self.client.get(f"/vm/{sandbox_id}/status")
            response.raise_for_status()
            
            vm_status = response.json()
            
            # Construct preview URL based on VM endpoints
            # This would need to be adapted based on your infrastructure setup
            # For example, if VMs are accessible via a load balancer:
            base_domain = os.getenv("INFRA_PREVIEW_DOMAIN", "preview.kiff.dev")
            return f"https://{sandbox_id}-{port}.{base_domain}"
            
        except Exception as e:
            logger.error(f"Failed to get preview URL for VM {sandbox_id}: {e}")
            return None
    
    def tail_logs(self, *, sandbox_id: str, limit: int = 2000) -> str:
        """Get application logs from the VM"""
        if INFRA_ENABLE_MOCK:
            return "Mock log output\\nApplication started successfully"
        
        runtime = self._get_runtime(sandbox_id)
        
        # Determine log file based on runtime
        log_file = LOG_FILE_VITE
        if runtime == "python":
            log_file = LOG_FILE_PY
        elif runtime == "node":
            log_file = LOG_FILE_NODE
        
        code = f"""
import pathlib

log_file = pathlib.Path("{log_file}")
if log_file.exists():
    content = log_file.read_text()
    # Get last {limit} characters
    if len(content) > {limit}:
        content = "..." + content[-{limit}:]
    print(content)
else:
    print("No logs available yet")
"""
        
        try:
            result = self._execute_in_vm(sandbox_id, code)
            return result.get("output", "")
        except Exception as e:
            return f"Error reading logs: {e}"
    
    # --- Internal helper methods ---
    
    def _execute_in_vm(self, sandbox_id: str, code: str) -> Dict[str, Any]:
        """Execute Python code inside the VM"""
        if INFRA_ENABLE_MOCK:
            return {"success": True, "output": "Mock execution successful"}
        
        try:
            response = self.client.post(
                f"/vm/{sandbox_id}/execute",
                json={"code": code, "language": "python"}
            )
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Failed to execute code in VM {sandbox_id}: {e}")
            raise RuntimeError(f"VM execution failed: {e}")
    
    def _get_runtime(self, sandbox_id: str) -> str:
        """Get the runtime type from VM metadata"""
        code = f"""
import json
import pathlib

meta_file = pathlib.Path("{RUNTIME_META}")
if meta_file.exists():
    meta = json.loads(meta_file.read_text())
    runtime = meta.get("runtime", "vite")
else:
    runtime = "vite"

print(runtime)
"""
        
        try:
            result = self._execute_in_vm(sandbox_id, code)
            output = result.get("output", "vite").strip()
            return output.lower()
        except Exception:
            return "vite"  # Default fallback
    
    def _install_python_packages(self, sandbox_id: str, packages: List[str]) -> None:
        """Install Python packages using pip in virtual environment"""
        pkg_list = " ".join(packages)
        
        code = f"""
import subprocess
import pathlib

# Create virtual environment if it doesn't exist
venv_path = pathlib.Path("{VENV_DIR}")
if not venv_path.exists():
    subprocess.run(["python3", "-m", "venv", str(venv_path)], check=True)
    print("Created virtual environment")

# Install packages
pip_path = venv_path / "bin" / "pip"
cmd = [str(pip_path), "install", "--upgrade", "pip"]
subprocess.run(cmd, check=True)

if "{pkg_list}".strip():
    cmd = [str(pip_path), "install"] + {repr(packages)}
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(f"Package installation result: {{result.returncode}}")
    if result.stdout:
        print(f"STDOUT: {{result.stdout}}")
    if result.stderr:
        print(f"STDERR: {{result.stderr}}")
"""
        
        self._execute_in_vm(sandbox_id, code)
    
    def _install_npm_packages(self, sandbox_id: str, packages: List[str]) -> None:
        """Install npm packages"""
        pkg_list = " ".join(packages)
        
        code = f"""
import subprocess
import os

# Change to app directory
os.chdir("{APP_DIR}")

# Install packages
if "{pkg_list}".strip():
    cmd = ["npm", "install", "--no-audit", "--no-fund", "--loglevel=error"] + {repr(packages)}
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(f"NPM install result: {{result.returncode}}")
    if result.stdout:
        print(f"STDOUT: {{result.stdout}}")
    if result.stderr:
        print(f"STDERR: {{result.stderr}}")
"""
        
        self._execute_in_vm(sandbox_id, code)
    
    def _restart_python(self, sandbox_id: str) -> None:
        """Restart Python application using uvicorn or Flask"""
        code = f"""
import subprocess
import pathlib
import json
import signal
import os
import time

# Get runtime metadata
meta_file = pathlib.Path("{RUNTIME_META}")
meta = json.loads(meta_file.read_text()) if meta_file.exists() else {{}}
port = meta.get("port", {PYTHON_PORT})
entry = meta.get("entry", "app.main:app")

# Kill existing process
pid_file = pathlib.Path("{PID_FILE_PY}")
if pid_file.exists():
    try:
        pid = int(pid_file.read_text().strip())
        os.kill(pid, signal.SIGTERM)
        time.sleep(1)
    except Exception as e:
        print(f"Error killing process: {{e}}")
    finally:
        pid_file.unlink(missing_ok=True)

# Set up environment
venv_python = pathlib.Path("{VENV_DIR}") / "bin" / "python"
python_cmd = str(venv_python) if venv_python.exists() else "python3"

# Load secrets
secrets_file = pathlib.Path("{APP_DIR}") / ".secrets.json"
env = os.environ.copy()
if secrets_file.exists():
    try:
        secrets = json.loads(secrets_file.read_text())
        env.update(secrets)
    except Exception as e:
        print(f"Error loading secrets: {{e}}")

# Detect if it's Flask or FastAPI
is_flask = False
for py_file in ["app.py", "main.py", "server.py"]:
    file_path = pathlib.Path("{APP_DIR}") / py_file
    if file_path.exists():
        try:
            content = file_path.read_text()
            if "from flask import" in content or "import flask" in content:
                is_flask = True
                entry = py_file
                break
        except Exception:
            pass

# Start process
log_file = pathlib.Path("{LOG_FILE_PY}")
log_file.parent.mkdir(parents=True, exist_ok=True)

if is_flask:
    # Flask app
    cmd = [python_cmd, entry]
    env["FLASK_RUN_HOST"] = "0.0.0.0"
    env["FLASK_RUN_PORT"] = str(port)
else:
    # FastAPI/ASGI app
    cmd = [python_cmd, "-m", "uvicorn", entry, "--host", "0.0.0.0", "--port", str(port)]

with open(log_file, "w") as log:
    proc = subprocess.Popen(
        cmd,
        cwd="{APP_DIR}",
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True
    )
    
    pid_file.write_text(str(proc.pid))
    print(f"Started Python app with PID {{proc.pid}} on port {{port}}")

time.sleep(2)  # Give it a moment to start
"""
        
        self._execute_in_vm(sandbox_id, code)
    
    def _restart_node(self, sandbox_id: str) -> None:
        """Restart Node.js application"""
        code = f"""
import subprocess
import pathlib
import json
import signal
import os
import time

# Get runtime metadata
meta_file = pathlib.Path("{RUNTIME_META}")
meta = json.loads(meta_file.read_text()) if meta_file.exists() else {{}}
port = meta.get("port", {NODE_PORT})

# Kill existing process
pid_file = pathlib.Path("{PID_FILE_NODE}")
if pid_file.exists():
    try:
        pid = int(pid_file.read_text().strip())
        os.kill(pid, signal.SIGTERM)
        time.sleep(1)
    except Exception as e:
        print(f"Error killing process: {{e}}")
    finally:
        pid_file.unlink(missing_ok=True)

# Load secrets
secrets_file = pathlib.Path("{APP_DIR}") / ".secrets.json"
env = os.environ.copy()
if secrets_file.exists():
    try:
        secrets = json.loads(secrets_file.read_text())
        env.update(secrets)
    except Exception as e:
        print(f"Error loading secrets: {{e}}")

# Determine start command
start_cmd = ["npm", "start"]
package_json = pathlib.Path("{APP_DIR}") / "package.json"
if package_json.exists():
    try:
        pkg_data = json.loads(package_json.read_text())
        scripts = pkg_data.get("scripts", {{}})
        if "start" not in scripts:
            # Look for entry point
            for candidate in ["server.js", "index.js", "app.js"]:
                if (pathlib.Path("{APP_DIR}") / candidate).exists():
                    start_cmd = ["node", candidate]
                    break
    except Exception:
        pass

# Start process
log_file = pathlib.Path("{LOG_FILE_NODE}")
log_file.parent.mkdir(parents=True, exist_ok=True)

with open(log_file, "w") as log:
    proc = subprocess.Popen(
        start_cmd,
        cwd="{APP_DIR}",
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True
    )
    
    pid_file.write_text(str(proc.pid))
    print(f"Started Node app with PID {{proc.pid}}")

time.sleep(2)  # Give it a moment to start
"""
        
        self._execute_in_vm(sandbox_id, code)
    
    def _restart_vite(self, sandbox_id: str) -> None:
        """Restart Vite development server"""
        code = f"""
import subprocess
import pathlib
import json
import signal
import os
import time

# Kill existing process
pid_file = pathlib.Path("{PID_FILE_VITE}")
if pid_file.exists():
    try:
        pid = int(pid_file.read_text().strip())
        os.kill(pid, signal.SIGTERM)
        time.sleep(1)
    except Exception as e:
        print(f"Error killing process: {{e}}")
    finally:
        pid_file.unlink(missing_ok=True)

# Load secrets
secrets_file = pathlib.Path("{APP_DIR}") / ".secrets.json"
env = os.environ.copy()
if secrets_file.exists():
    try:
        secrets = json.loads(secrets_file.read_text())
        env.update(secrets)
    except Exception as e:
        print(f"Error loading secrets: {{e}}")

# Install dependencies if needed
package_json = pathlib.Path("{APP_DIR}") / "package.json"
node_modules = pathlib.Path("{APP_DIR}") / "node_modules"
if package_json.exists() and not node_modules.exists():
    print("Installing npm dependencies...")
    subprocess.run(["npm", "install", "--no-audit", "--no-fund"], cwd="{APP_DIR}")

# Start Vite dev server
log_file = pathlib.Path("{LOG_FILE_VITE}")
log_file.parent.mkdir(parents=True, exist_ok=True)

cmd = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", str({VITE_PORT})]

with open(log_file, "w") as log:
    proc = subprocess.Popen(
        cmd,
        cwd="{APP_DIR}",
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True
    )
    
    pid_file.write_text(str(proc.pid))
    print(f"Started Vite dev server with PID {{proc.pid}} on port {VITE_PORT}")

time.sleep(3)  # Give Vite time to start
"""
        
        self._execute_in_vm(sandbox_id, code)
    
    def __del__(self):
        """Cleanup HTTP client"""
        if self.client:
            self.client.close()