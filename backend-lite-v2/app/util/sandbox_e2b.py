from __future__ import annotations
import os
from typing import Any, Dict, List, Optional
import base64
import json
import traceback

try:
    # E2B Python SDK (v1) per docs
    from e2b_code_interpreter import Sandbox  # type: ignore
except Exception:  # pragma: no cover
    Sandbox = None  # fallback; we handle at runtime

# NOTE: This is a lightweight scaffold for the E2B sandbox provider.
# Replace the TODOs with real E2B API calls when ready. We keep the interface
# stable so routes can integrate without major refactors.

E2B_API_KEY = os.getenv("E2B_API_KEY")
E2B_ENABLE_MOCK = os.getenv("E2B_ENABLE_MOCK", "false").lower() in ("1", "true", "yes")
E2B_TEMPLATE = os.getenv("E2B_TEMPLATE", "base")
VITE_PORT = int(os.getenv("PREVIEW_VITE_PORT", "5173"))
APP_DIR = "/home/user/app"

# Runtime markers and process/log files
RUNTIME_META = f"{APP_DIR}/.runtime.json"  # { runtime: 'python'|'node'|'vite', port, entry? }
PID_FILE_VITE = f"{APP_DIR}/.vite.pid"
LOG_FILE_VITE = f"{APP_DIR}/.vite.log"
PID_FILE_PY = f"{APP_DIR}/.app.pid"
LOG_FILE_PY = f"{APP_DIR}/.app.log"
PID_FILE_NODE = f"{APP_DIR}/.node.pid"
LOG_FILE_NODE = f"{APP_DIR}/.node.log"
VENV_DIR = f"{APP_DIR}/.venv"


class E2BUnavailable(Exception):
    pass


class E2BProvider:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or E2B_API_KEY
        # Allow mock mode without API key for local/dev
        if not self.api_key and not E2B_ENABLE_MOCK:
            raise E2BUnavailable("E2B_API_KEY not configured")
        if Sandbox is None and not E2B_ENABLE_MOCK:
            raise E2BUnavailable("e2b-code-interpreter SDK not installed")

    # --- High-level operations ---
    def create_sandbox(self, *, tenant_id: str, session_id: str) -> Dict[str, Any]:
        if E2B_ENABLE_MOCK:
            sandbox_id = f"mock-{tenant_id[:6]}-{session_id[:6]}"
            preview_url = f"https://{session_id}.mock.e2b.app"
            return {"sandbox_id": sandbox_id, "preview_url": preview_url}
        try:
            # Create sandbox; context manager returns object with id and APIs
            sbx = Sandbox()  # type: ignore
            # No hardcoded scaffold - let the agent determine project structure
            # The runtime and server will be determined by the files applied later
            # Get sandbox ID first
            sandbox_id = getattr(sbx, "id", None) or getattr(sbx, "sandbox_id", None) or None
            
            # Don't set preview URL yet - it will be set dynamically based on the project type
            # after files are applied and we know what port to use
            return {"sandbox_id": sandbox_id, "preview_url": None}
        except Exception as e:
            # Surface error up; caller will catch and keep request 200
            raise RuntimeError(f"Failed to create E2B sandbox: {e}\n{traceback.format_exc()}")

    def set_runtime(self, *, sandbox_id: str, runtime: Optional[str] = None, port: Optional[int] = None, entry: Optional[str] = None) -> None:
        """
        Store runtime metadata inside the sandbox so future operations (install/restart/logs)
        can branch accordingly without the HTTP route having to pass it each time.
        entry (python): dotted path for uvicorn, e.g. "app.main:app".
        """
        if E2B_ENABLE_MOCK:
            return
        sbx = self._connect(sandbox_id)
        meta = {"runtime": runtime, "port": port, "entry": entry}
        code = (
            "import json, pathlib\n"
            f"p=pathlib.Path({repr(RUNTIME_META)})\n"
            "p.parent.mkdir(parents=True, exist_ok=True)\n"
            f"p.write_text(json.dumps({repr(meta)}))\n"
        )
        sbx.run_code(code)  # type: ignore

    def apply_files(self, *, sandbox_id: str, files: List[Dict[str, Any]]) -> None:
        if E2B_ENABLE_MOCK:
            return
        sbx = self._connect(sandbox_id)
        # Write files into APP_DIR using base64 to avoid escaping issues
        for f in files:
            path = f.get("path")
            content = f.get("content", "")
            b64 = base64.b64encode(content.encode("utf-8")).decode("ascii")
            code = (
                "import os, pathlib, base64\n"
                f"p = pathlib.Path('{APP_DIR}') / {repr(path)}\n"
                "p.parent.mkdir(parents=True, exist_ok=True)\n"
                f"data = base64.b64decode({repr(b64)})\n"
                "with open(p, 'wb') as f: f.write(data)\n"
            )
            sbx.run_code(code)  # type: ignore

    def apply_patch(self, *, sandbox_id: str, unified_diff: str) -> None:
        """Apply a unified diff inside the sandbox working directory.
        Tries the system 'patch' tool; if missing, tries 'git apply'.
        If both are missing, saves the diff for manual inspection.
        """
        if E2B_ENABLE_MOCK:
            return
        sbx = self._connect(sandbox_id)
        b64 = base64.b64encode(unified_diff.encode("utf-8")).decode("ascii")
        code = (
            "import pathlib, base64, subprocess, tempfile, os\n"
            f"cwd=pathlib.Path({repr(APP_DIR)})\n"
            "cwd.mkdir(parents=True, exist_ok=True)\n"
            "data=base64.b64decode(%r)\n" % b64 +
            "tmp = tempfile.NamedTemporaryFile(delete=False)\n"
            "tmp.write(data); tmp.flush(); tmp.close()\n"
            "# Try GNU patch\n"
            "cmd=f\"bash -lc 'cd {cwd} && patch -p0 -t < {tmp.name}'\"\n"
            "r = subprocess.run(cmd, shell=True)\n"
            "if r.returncode != 0:\n"
            "    # Try git apply as fallback\n"
            "    cmd=f\"bash -lc 'cd {cwd} && git apply --reject --whitespace=nowarn {tmp.name}'\"\n"
            "    r2 = subprocess.run(cmd, shell=True)\n"
            "    if r2.returncode != 0:\n"
            "        # Persist diff for manual application later\n"
            "        (cwd/'.last_patch.diff').write_bytes(data)\n"
        )
        sbx.run_code(code)  # type: ignore

    def set_secrets(self, *, sandbox_id: str, secrets: Dict[str, str]) -> None:
        """Persist secrets in sandbox for later injection at process start."""
        if E2B_ENABLE_MOCK:
            return
        sbx = self._connect(sandbox_id)
        # Store as JSON; injection happens on restart
        code = (
            "import json, pathlib\n"
            f"p=pathlib.Path({repr(APP_DIR)})/'.secrets.json'\n"
            "p.parent.mkdir(parents=True, exist_ok=True)\n"
            f"p.write_text(json.dumps({repr(secrets)}))\n"
        )
        sbx.run_code(code)  # type: ignore

    def install_packages(self, *, sandbox_id: str, packages: List[str]) -> None:
        if E2B_ENABLE_MOCK:
            return
        sbx = self._connect(sandbox_id)
        pkgs = " ".join(packages or [])
        # Detect runtime
        code_detect = (
            "import json, pathlib, sys\n"
            f"meta_p=pathlib.Path({repr(RUNTIME_META)})\n"
            "meta=json.loads(meta_p.read_text()) if meta_p.exists() else {}\n"
            "print(json.dumps(meta))\n"
        )
        res = sbx.run_code(code_detect)  # type: ignore
        meta_text = getattr(res, "text", "{}") or "{}"
        try:
            meta = json.loads(meta_text)
        except Exception:
            meta = {}
        runtime = (meta.get("runtime") or "vite").lower()

        if runtime == "python":
            py = (
                "import subprocess, os, pathlib\n"
                f"cwd={repr(APP_DIR)}\n"
                f"venv={repr(VENV_DIR)}\n"
                f"pkgs={repr(pkgs)}\n"
                "subprocess.run(f\"bash -lc 'python3 -m venv {venv}'\", shell=True, check=False)\n"
                "pip=f\"{venv}/bin/pip\"\n"
                "cmd=f\"bash -lc 'cd {cwd} && {pip} install --upgrade pip && {pip} install {pkgs}'\"\n"
                "subprocess.run(cmd, shell=True, check=False)\n"
            )
            sbx.run_code(py)  # type: ignore
        else:
            # Default to node/vite behavior
            py = (
                "import subprocess, os\n"
                f"cwd={repr(APP_DIR)}\n"
                f"pkgs={repr(pkgs)}\n"
                "cmd = f\"bash -lc 'cd {cwd} && npm i --no-audit --no-fund --loglevel=error {pkgs}'\"\n"
                "subprocess.run(cmd, shell=True, check=False)\n"
            )
            sbx.run_code(py)  # type: ignore
        # Restart appropriate server
        self.restart(sandbox_id=sandbox_id)

    def restart(self, *, sandbox_id: str) -> None:
        if E2B_ENABLE_MOCK:
            return
        sbx = self._connect(sandbox_id)
        # Detect runtime
        code_detect = (
            "import json, pathlib\n"
            f"p=pathlib.Path({repr(RUNTIME_META)})\n"
            "m=json.loads(p.read_text()) if p.exists() else {}\n"
            "print((m.get('runtime') or 'vite').lower())\n"
        )
        res = sbx.run_code(code_detect)  # type: ignore
        runtime = (getattr(res, "text", "vite") or "vite").strip()
        if runtime == "python":
            self._restart_python(sbx)
        elif runtime == "node":
            self._restart_node(sbx)
        else:
            self._restart_vite(sbx)

    def get_preview_url(self, *, sandbox_id: str, port: int) -> Optional[str]:
        """Get the preview URL for a specific port after the server is running."""
        if E2B_ENABLE_MOCK:
            return f"https://{port}-{sandbox_id}.mock.e2b.app"
        
        try:
            sbx = self._connect(sandbox_id)
            # Try multiple methods to get hostname with port
            host = None
            for meth in ("get_hostname", "getHostname", "get_host", "getHost"):
                try:
                    if hasattr(sbx, meth):
                        fn = getattr(sbx, meth)
                        try:
                            host = fn(port)
                        except TypeError:
                            # Some methods don't take port, try getting base host
                            base_host = fn()
                            if base_host and isinstance(base_host, str):
                                # Try to construct URL with port
                                if base_host.startswith("http"):
                                    host = base_host
                                else:
                                    host = f"{port}-{base_host}"
                        if host:
                            break
                except Exception:
                    continue
            
            if not host:
                # Try attributes
                for attr in ("hostname", "host", "url", "endpoint"):
                    try:
                        if hasattr(sbx, attr):
                            val = getattr(sbx, attr)
                            if val:
                                host = f"{port}-{val}" if not str(val).startswith("http") else val
                                break
                    except Exception:
                        continue
                        
            # Normalize to proper URL
            if host:
                h = str(host)
                if h.startswith("http://") or h.startswith("https://"):
                    return h
                else:
                    return f"https://{h}"
            return None
        except Exception as e:
            print(f"Error getting preview URL for sandbox {sandbox_id} on port {port}: {e}")
            return None

    def tail_logs(self, *, sandbox_id: str, limit: int = 2000) -> str:
        if E2B_ENABLE_MOCK:
            return ""
        sbx = self._connect(sandbox_id)
        code = (
            "import json, pathlib\n"
            f"m=pathlib.Path({repr(RUNTIME_META)})\n"
            "meta=json.loads(m.read_text()) if m.exists() else {}\n"
            f"log_vite=pathlib.Path({repr(LOG_FILE_VITE)})\n"
            f"log_py=pathlib.Path({repr(LOG_FILE_PY)})\n"
            "rt=(meta.get('runtime') or 'vite').lower()\n"
            "p=log_py if rt=='python' else log_vite\n"
            "print(p.read_text() if p.exists() else '')\n"
        )
        exec = sbx.run_code(code)  # type: ignore
        return getattr(exec, "text", "")

    # --- Internals ---
    def _connect(self, sandbox_id: Optional[str]):
        if not sandbox_id:
            raise RuntimeError("Sandbox ID is missing; cannot connect")
        try:
            # Newer SDKs provide Sandbox.connect(id) or Sandbox(id=...). Try both.
            if hasattr(Sandbox, "connect"):
                return Sandbox.connect(sandbox_id)  # type: ignore[attr-defined]
            return Sandbox(id=sandbox_id)  # type: ignore[call-arg]
        except Exception as e:
            raise RuntimeError(f"Failed to connect to E2B sandbox {sandbox_id}: {e}")


    # --- Node (non-Vite) app management ---
    def _restart_node(self, sbx: Any) -> None:
        py = (
            "import os, signal, subprocess, pathlib, time, json\n"
            f"pid_file=pathlib.Path({repr(PID_FILE_NODE)})\n"
            f"log_file=pathlib.Path({repr(LOG_FILE_NODE)})\n"
            f"cwd={repr(APP_DIR)}\n"
            f"pkg=pathlib.Path({repr(APP_DIR)})/'package.json'\n"
            f"secrets_file=pathlib.Path({repr(APP_DIR)})/'.secrets.json'\n"
            "env_exports=''\n"
            "try:\n"
            "    import json, shlex\n"
            "    if secrets_file.exists():\n"
            "        sec=json.loads(secrets_file.read_text())\n"
            "        if isinstance(sec, dict):\n"
            "            parts=[f\"{k}={shlex.quote(str(v))}\" for k,v in sec.items() if isinstance(k, str)]\n"
            "            env_exports=' '.join(parts)\n"
            "except Exception: pass\n"
            "# Determine command: npm start if defined; else node server.js; else node index.js; else echo\n"
            "start_cmd=''\n"
            "try:\n"
            "    if pkg.exists():\n"
            "        j=json.loads(pkg.read_text())\n"
            "        scripts=(j.get('scripts') or {}) if isinstance(j, dict) else {}\n"
            "        if isinstance(scripts, dict) and 'start' in scripts:\n"
            "            start_cmd='npm start'\n"
    
            "except Exception: pass\n"
            "if not start_cmd:\n"
            "    for candidate in ['server.js','index.js','app.js']:\n"
            "        if (pathlib.Path(cwd)/candidate).exists():\n"
            "            start_cmd='node '+candidate; break\n"
            "if not start_cmd:\n"
            "    start_cmd='node server.js'\n"
            "# Kill existing\n"
            "log_file.parent.mkdir(parents=True, exist_ok=True)\n"
            "if pid_file.exists():\n"
            "    try:\n"
            "        pid=int(pid_file.read_text().strip()); os.kill(pid, signal.SIGTERM)\n"
            "    except Exception: pass\n"
            "    try: pid_file.unlink()\n"
            "    except Exception: pass\n"
            "cmd = 'bash -lc ' + '\'' + 'cd ' + cwd + ' && ' + env_exports + ' ' + start_cmd + '\''\n"
            "proc = subprocess.Popen(cmd, shell=True, cwd=cwd, stdout=open(log_file,'a'), stderr=subprocess.STDOUT)\n"
            "pid_file.write_text(str(proc.pid))\n"
            "time.sleep(0.8)\n"
        )
        sbx.run_code(py)  # type: ignore
        # Install base deps
        sbx.run_code(
            "import subprocess; subprocess.run(\"bash -lc 'cd %s && npm i --no-audit --no-fund'\", shell=True)" % APP_DIR
        )  # type: ignore

    def _start_vite(self, sbx: Any) -> None:
        # Kill previous if any, then start and record PID with logs redirected
        py = (
            "import os, signal, subprocess, pathlib, time\n"
            f"pid_file=pathlib.Path({repr(PID_FILE_VITE)})\n"
            f"log_file=pathlib.Path({repr(LOG_FILE_VITE)})\n"
            f"cwd={repr(APP_DIR)}\n"
            f"secrets_file=pathlib.Path({repr(APP_DIR)})/'.secrets.json'\n"
            "env_exports=''\n"
            "try:\n"
            "    import json, shlex\n"
            "    if secrets_file.exists():\n"
            "        sec=json.loads(secrets_file.read_text())\n"
            "        if isinstance(sec, dict):\n"
            "            parts=[f\"{k}={shlex.quote(str(v))}\" for k,v in sec.items() if isinstance(k, str)]\n"
            "            env_exports=' '.join(parts)\n"
            "except Exception: pass\n"
            "log_file.parent.mkdir(parents=True, exist_ok=True)\n"
            "# Kill existing\n"
            "if pid_file.exists():\n"
            "    try:\n"
            "        pid=int(pid_file.read_text().strip()); os.kill(pid, signal.SIGTERM)\n"
            "    except Exception: pass\n"
            "    try: pid_file.unlink()\n"
            "    except Exception: pass\n"
            f"cmd = 'bash -lc ' + '\'' + 'cd ' + cwd + ' && ' + env_exports + ' npm run dev -- --host --port {VITE_PORT}' + '\''\n"
            "proc = subprocess.Popen(cmd, shell=True, stdout=open(log_file,'a'), stderr=subprocess.STDOUT)\n"
            "pid_file.write_text(str(proc.pid))\n"
            "time.sleep(0.8)\n"
        )
        sbx.run_code(py)  # type: ignore

    def _restart_vite(self, sbx: Any) -> None:
        # Kill and re-launch
        self._start_vite(sbx)

    # --- Python app management ---
    def _restart_python(self, sbx: Any) -> None:
        py = (
            "import os, signal, subprocess, pathlib, time, json\n"
            f"pid_file=pathlib.Path({repr(PID_FILE_PY)})\n"
            f"log_file=pathlib.Path({repr(LOG_FILE_PY)})\n"
            f"meta_file=pathlib.Path({repr(RUNTIME_META)})\n"
            f"venv={repr(VENV_DIR)}\n"
            f"cwd={repr(APP_DIR)}\n"
            "meta=json.loads(meta_file.read_text()) if meta_file.exists() else {}\n"
            "port=str(meta.get('port') or 8000)\n"
            "entry=meta.get('entry') or 'app.main:app'\n"
            "python=f'{venv}/bin/python' if pathlib.Path(venv).exists() else 'python3'\n"
            f"secrets_file=pathlib.Path({repr(APP_DIR)})/'.secrets.json'\n"
            "env_exports=''\n"
            "try:\n"
            "    import shlex\n"
            "    if secrets_file.exists():\n"
            "        sec=json.loads(secrets_file.read_text())\n"
            "        if isinstance(sec, dict):\n"
            "            parts=[f\"{k}={shlex.quote(str(v))}\" for k,v in sec.items() if isinstance(k, str)]\n"
            "            env_exports=' '.join(parts)\n"
            "except Exception: pass\n"
            "# Kill existing\n"
            "log_file.parent.mkdir(parents=True, exist_ok=True)\n"
            "if pid_file.exists():\n"
            "    try:\n"
            "        pid=int(pid_file.read_text().strip()); os.kill(pid, signal.SIGTERM)\n"
            "    except Exception: pass\n"
            "    try: pid_file.unlink()\n"
            "    except Exception: pass\n"
            "# Detect if it's a Flask app vs FastAPI/ASGI app\n"
            "flask_files=[f for f in ['app.py','main.py','server.py'] if pathlib.Path(cwd, f).exists()]\n"
            "is_flask=False\n"
            "if flask_files:\n"
            "    for flask_file in flask_files:\n"
            "        try:\n"
            "            content=pathlib.Path(cwd, flask_file).read_text()\n"
            "            if 'from flask import' in content or 'import flask' in content:\n"
            "                is_flask=True; entry=flask_file; break\n"
            "        except Exception: pass\n"
            "# Use appropriate server command\n"
            "if is_flask:\n"
            "    cmd = 'bash -lc ' + '\'' + 'cd ' + cwd + ' && ' + env_exports + ' ' + python + ' ' + entry + '\''\n"
            "else:\n"
            "    cmd = 'bash -lc ' + '\'' + 'cd ' + cwd + ' && ' + env_exports + ' ' + python + ' -m uvicorn ' + entry + ' --host 0.0.0.0 --port ' + str(port) + '\''\n"
            "proc = subprocess.Popen(cmd, shell=True, cwd=cwd, stdout=open(log_file,'a'), stderr=subprocess.STDOUT)\n"
            "pid_file.write_text(str(proc.pid))\n"
            "time.sleep(0.8)\n"
        )
        sbx.run_code(py)  # type: ignore
