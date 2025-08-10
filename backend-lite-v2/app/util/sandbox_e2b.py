from __future__ import annotations
import os
from typing import Any, Dict, List, Optional
import base64
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
PID_FILE = f"{APP_DIR}/.vite.pid"
LOG_FILE = f"{APP_DIR}/.vite.log"


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
            # Persist minimal scaffold for a Vite app and start server
            self._ensure_scaffold(sbx)
            # Start dev server in background
            self._start_vite(sbx)
            # Expose URL for VITE_PORT
            host = None
            for meth in ("get_hostname", "getHostname"):
                try:
                    if hasattr(sbx, meth):
                        fn = getattr(sbx, meth)
                        try:
                            host = fn(VITE_PORT)
                        except TypeError:
                            host = fn()
                        break
                except Exception:
                    continue
            if not host:
                raise RuntimeError("E2B SDK: could not obtain sandbox hostname")
            preview_url = f"https://{host}"
            sandbox_id = getattr(sbx, "id", None) or getattr(sbx, "sandbox_id", None) or None
            return {"sandbox_id": sandbox_id, "preview_url": preview_url}
        except Exception as e:
            raise RuntimeError(f"Failed to create E2B sandbox: {e}\n{traceback.format_exc()}")

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

    def install_packages(self, *, sandbox_id: str, packages: List[str]) -> None:
        if E2B_ENABLE_MOCK:
            return
        sbx = self._connect(sandbox_id)
        pkgs = " ".join(packages or [])
        # Run npm install and ensure dev server is running
        py = (
            "import subprocess, os\n"
            f"cwd={repr(APP_DIR)}\n"
            f"pkgs={repr(pkgs)}\n"
            "cmd = f\"bash -lc 'cd {cwd} && npm i --no-audit --no-fund --loglevel=error {pkgs}'\"\n"
            "subprocess.run(cmd, shell=True, check=False)\n"
        )
        sbx.run_code(py)  # type: ignore
        # Restart dev server to ensure new pkgs are loaded
        self._restart_vite(sbx)

    def restart(self, *, sandbox_id: str) -> None:
        if E2B_ENABLE_MOCK:
            return
        sbx = self._connect(sandbox_id)
        self._restart_vite(sbx)

    def tail_logs(self, *, sandbox_id: str, limit: int = 2000) -> str:
        if E2B_ENABLE_MOCK:
            return ""
        sbx = self._connect(sandbox_id)
        code = (
            "import os, pathlib\n"
            f"p = pathlib.Path('{LOG_FILE}')\n"
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

    def _ensure_scaffold(self, sbx: Any) -> None:
        # Create minimal Vite React app scaffold
        vite_conf = (
            "import { defineConfig } from 'vite'\n"
            "import react from '@vitejs/plugin-react'\n"
            f"export default defineConfig({{ plugins: [react()], server: {{ host: '0.0.0.0', port: {VITE_PORT}, strictPort: true, hmr: false, allowedHosts: ['.e2b.app','localhost','127.0.0.1'] }} }})\n"
        )
        py = (
            "import os, json, pathlib\n"
            f"base = pathlib.Path({repr(APP_DIR)})\n"
            "(base / 'src').mkdir(parents=True, exist_ok=True)\n"
            "(base / 'src' / 'main.tsx').write_text('''import React from \"react\";import { createRoot } from \"react-dom/client\";const App=()=>React.createElement('div',null,'Hello from E2B');createRoot(document.getElementById('root')!).render(React.createElement(App));''')\n"
            "(base / 'index.html').write_text('''<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/><title>E2B Preview</title></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html>''')\n"
            "package_json = {\n"
            "  'name': 'sandbox-app', 'version': '1.0.0', 'type': 'module',\n"
            "  'scripts': { 'dev': 'vite --host', 'build': 'vite build', 'preview': 'vite preview' },\n"
            "  'dependencies': { 'react': '^18.2.0', 'react-dom': '^18.2.0' },\n"
            "  'devDependencies': { '@vitejs/plugin-react': '^4.0.0', 'vite': '^4.3.9', 'typescript': '^5.3.3' }\n"
            "}\n"
            "(base / 'package.json').write_text(json.dumps(package_json, indent=2))\n"
            f"(base / 'vite.config.js').write_text({repr(vite_conf)})\n"
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
            f"pid_file=pathlib.Path({repr(PID_FILE)})\n"
            f"log_file=pathlib.Path({repr(LOG_FILE)})\n"
            "log_file.parent.mkdir(parents=True, exist_ok=True)\n"
            "# Kill existing\n"
            "if pid_file.exists():\n"
            "    try:\n"
            "        pid=int(pid_file.read_text().strip()); os.kill(pid, signal.SIGTERM)\n"
            "    except Exception: pass\n"
            "    try: pid_file.unlink()\n"
            "    except Exception: pass\n"
            f"cmd = \"bash -lc 'cd {APP_DIR} && npm run dev -- --host --port {VITE_PORT}'\"\n"
            "proc = subprocess.Popen(cmd, shell=True, stdout=open(log_file,'a'), stderr=subprocess.STDOUT)\n"
            "pid_file.write_text(str(proc.pid))\n"
            "time.sleep(0.8)\n"
        )
        sbx.run_code(py)  # type: ignore

    def _restart_vite(self, sbx: Any) -> None:
        # Kill and re-launch
        self._start_vite(sbx)
