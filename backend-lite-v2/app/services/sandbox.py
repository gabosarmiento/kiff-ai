import os
import tempfile
import shutil
import subprocess
import time
import uuid
import json
from typing import Dict, Any, List, Optional

# Optional: PreviewStore for persistence (safe fallback if unavailable)
try:
    from ..util.preview_store import PreviewStore  # type: ignore
except Exception:  # pragma: no cover
    PreviewStore = None  # type: ignore


def _env_bool(name: str, default: bool) -> bool:
    try:
        return os.getenv(name, str(default)).lower() in ("1", "true", "yes")
    except Exception:
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except Exception:
        return default


class SandboxManager:
    """Minimal local sandbox manager with whitelisted commands and basic limits.

    Not secure isolation; intended for controlled CI/dev and short-lived tasks.
    """

    def __init__(self) -> None:
        self._sandboxes: Dict[str, Dict[str, Any]] = {}
        # Provider switch: local (default) | e2b
        self._provider: str = os.getenv("SANDBOX_PROVIDER", "local").strip().lower() or "local"
        self._cmd_whitelist: List[str] = [
            s.strip() for s in (os.getenv("SANDBOX_CMD_WHITELIST", "node,npm,pnpm,python,pip,pytest,tsc,next").split(",")) if s.strip()
        ]
        self._allow_network = _env_bool("SANDBOX_ALLOW_NETWORK", False)
        self._max_wall = _env_int("SANDBOX_MAX_WALLTIME_S", 20)
        self._max_cpu = _env_int("SANDBOX_MAX_CPU_SECONDS", 15)
        self._max_mem = _env_int("SANDBOX_MAX_MEM_MB", 512)
        self._stdout_max = _env_int("SANDBOX_STDOUT_MAX", 65536)
        self._stderr_max = _env_int("SANDBOX_STDERR_MAX", 65536)
        self._region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "eu-west-3"
        self._table = os.getenv("DYNAMO_TABLE_PREVIEW_SESSIONS") or "preview_sessions"
        # E2B config
        self._e2b_api_key = os.getenv("E2B_API_KEY")

    def _store(self) -> Optional[Any]:
        if PreviewStore is None:
            return None
        try:
            return PreviewStore(table_name=self._table, region_name=self._region)
        except Exception:
            return None

    def _persist(self, tenant_id: str, session_id: str, field: str, value: Any) -> None:
        store = self._store()
        if not store:
            return
        try:
            store.update_session_fields(tenant_id, session_id, {field: value})
        except Exception:
            pass

    def start(self, tenant_id: str, session_id: str, env: Optional[str] = None) -> Dict[str, Any]:
        if self._provider == "e2b":
            return self._start_e2b(tenant_id, session_id, env)
        # local provider (default)
        sbx_id = f"sbx_{uuid.uuid4().hex[:10]}"
        workdir = tempfile.mkdtemp(prefix="kiff_sbx_")
        meta = {
            "sandbox_id": sbx_id,
            "tenant_id": tenant_id,
            "session_id": session_id,
            "workdir": workdir,
            "env": env or "default",
            "provider": "local",
            "created_at": int(time.time()),
            "artifacts": [],
            "last_exit_code": None,
        }
        self._sandboxes[sbx_id] = meta
        self._persist(tenant_id, session_id, "sandbox_state", meta)
        return {"sandbox_id": sbx_id, "workdir": workdir, "status": "ready"}

    def exec(self, sandbox_id: str, cmd: str, args: Optional[List[str]] = None, timeout_s: Optional[int] = None) -> Dict[str, Any]:
        if sandbox_id not in self._sandboxes:
            return {"error": "sandbox_not_found"}
        meta = self._sandboxes[sandbox_id]
        workdir = meta["workdir"]
        args = args or []

        # Route to provider
        if meta.get("provider") == "e2b" or self._provider == "e2b":
            return self._exec_e2b(meta, cmd, args, timeout_s)

        # Whitelist enforcement
        base = os.path.basename(cmd)
        if base not in self._cmd_whitelist:
            return {"error": "command_not_allowed", "allowed": self._cmd_whitelist}

        # Network policy (best-effort informational)
        if not self._allow_network and base in ("npm", "pnpm", "pip"):
            # Disallow install-like commands
            if any(a in ("install", "ci", "add", "upgrade") for a in args):
                return {"error": "network_disabled", "hint": "Enable SANDBOX_ALLOW_NETWORK=true to allow package installs"}

        t0 = time.perf_counter()
        try:
            # Note: hard isolation (namespaces/cgroups) is not applied here. Keep commands trusted and short.
            proc = subprocess.run(
                [cmd] + list(args),
                cwd=workdir,
                capture_output=True,
                text=True,
                timeout=max(1, int(timeout_s or self._max_wall)),
            )
            exit_code = proc.returncode
            out = proc.stdout or ""
            err = proc.stderr or ""
        except subprocess.TimeoutExpired as e:
            exit_code = 124
            out = (e.stdout or "")
            err = (e.stderr or "") + f"\n[timeout] exceeded {timeout_s or self._max_wall}s"
        except Exception as e:  # pragma: no cover
            exit_code = 1
            out = ""
            err = f"[exec_error] {e}"

        dur_ms = int((time.perf_counter() - t0) * 1000)
        trunc_out = len(out) > self._stdout_max
        trunc_err = len(err) > self._stderr_max
        out = out[: self._stdout_max]
        err = err[: self._stderr_max]

        meta["last_exit_code"] = exit_code
        log_entry = {
            "ts": int(time.time()),
            "cmd": base,
            "args": args,
            "exit_code": exit_code,
            "duration_ms": dur_ms,
            "stdout_snip": out[:2048],
            "stderr_snip": err[:2048],
            "truncated": bool(trunc_out or trunc_err),
        }
        # Append log (keep last 50)
        logs: List[Dict[str, Any]] = meta.get("logs", [])
        logs.append(log_entry)
        meta["logs"] = logs[-50:]
        self._persist(meta["tenant_id"], meta["session_id"], "sandbox_logs", meta["logs"])
        self._persist(meta["tenant_id"], meta["session_id"], "sandbox_state", meta)

        return {
            "exit_code": exit_code,
            "stdout": out,
            "stderr": err,
            "duration_ms": dur_ms,
            "truncated": bool(trunc_out or trunc_err),
        }

    def apply(self, sandbox_id: str) -> Dict[str, Any]:
        if sandbox_id not in self._sandboxes:
            return {"error": "sandbox_not_found"}
        meta = self._sandboxes[sandbox_id]
        workdir = meta["workdir"]

        return self._collect_artifacts_and_proposal(meta, workdir)

    def stop(self, sandbox_id: str) -> Dict[str, Any]:
        if sandbox_id not in self._sandboxes:
            return {"error": "sandbox_not_found"}
        meta = self._sandboxes.pop(sandbox_id, None) or {}
        if meta.get("provider") == "e2b" or self._provider == "e2b":
            return self._stop_e2b(meta)
        workdir = meta.get("workdir")
        try:
            if workdir and os.path.isdir(workdir):
                shutil.rmtree(workdir, ignore_errors=True)
        except Exception:
            pass
        self._persist(meta.get("tenant_id", "default"), meta.get("session_id", "default"), "sandbox_state", {"status": "stopped"})
        return {"status": "stopped"}

    # === E2B provider stubs ===
    def _start_e2b(self, tenant_id: str, session_id: str, env: Optional[str]) -> Dict[str, Any]:
        # Validate configuration
        if not self._e2b_api_key:
            return {"error": "e2b_not_configured", "hint": "Set E2B_API_KEY and SANDBOX_PROVIDER=e2b"}
        try:
            import e2b  # type: ignore
        except Exception:
            return {"error": "e2b_sdk_missing", "hint": "pip install e2b"}
        # For Phase 2 initial stub: create a lightweight local workdir to collect artifacts,
        # and store remote placeholder ID. Full remote exec will be implemented next.
        sbx_id = f"sbx_{uuid.uuid4().hex[:10]}"
        workdir = tempfile.mkdtemp(prefix="kiff_sbx_e2b_")
        meta = {
            "sandbox_id": sbx_id,
            "tenant_id": tenant_id,
            "session_id": session_id,
            "workdir": workdir,
            "env": env or "default",
            "provider": "e2b",
            "created_at": int(time.time()),
            "artifacts": [],
            "last_exit_code": None,
            "remote_id": None,
        }
        # NOTE: Hook real e2b sandbox creation here and set remote_id
        self._sandboxes[sbx_id] = meta
        self._persist(tenant_id, session_id, "sandbox_state", meta)
        return {"sandbox_id": sbx_id, "workdir": workdir, "status": "ready(e2b)"}

    def _exec_e2b(self, meta: Dict[str, Any], cmd: str, args: List[str], timeout_s: Optional[int]) -> Dict[str, Any]:
        if not self._e2b_api_key:
            return {"error": "e2b_not_configured", "hint": "Set E2B_API_KEY and SANDBOX_PROVIDER=e2b"}
        try:
            import e2b  # type: ignore
        except Exception:
            return {"error": "e2b_sdk_missing", "hint": "pip install e2b"}
        # Phase 2 stub: return a clear message; implement remote exec in next iteration
        return {"error": "e2b_exec_not_implemented", "hint": "Provider wired. Implement remote cmd exec next."}

    def _apply_e2b(self, meta: Dict[str, Any]) -> Dict[str, Any]:
        # Phase 2 stub: reuse local artifact collection from workdir (if any files were created)
        # This lets approval flow still work while remote file sync is not implemented.
        workdir = meta.get("workdir") or ""
        return self._collect_artifacts_and_proposal(meta, workdir)

    def _stop_e2b(self, meta: Dict[str, Any]) -> Dict[str, Any]:
        # Best-effort cleanup of local temp workdir and mark stopped; remote teardown TODO
        workdir = meta.get("workdir")
        try:
            if workdir and os.path.isdir(workdir):
                shutil.rmtree(workdir, ignore_errors=True)
        except Exception:
            pass
        self._persist(meta.get("tenant_id", "default"), meta.get("session_id", "default"), "sandbox_state", {"status": "stopped(e2b)"})
        return {"status": "stopped(e2b)"}

    def _collect_artifacts_and_proposal(self, meta: Dict[str, Any], workdir: str) -> Dict[str, Any]:
        changes: List[Dict[str, Any]] = []
        for root, _dirs, files in os.walk(workdir):
            for fname in files:
                path = os.path.join(root, fname)
                rel = os.path.relpath(path, workdir)
                # Only include reasonably small files
                try:
                    size = os.path.getsize(path)
                except Exception:
                    size = 0
                if size > 512 * 1024:
                    continue
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                except Exception:
                    content = ""
                changes.append({
                    "path": rel.replace("\\", "/"),
                    "change_type": "modify" if os.path.exists(path) else "create",
                    "new_content": content,
                    "language": _detect_language(rel),
                })
        proposal = {
            "type": "ProposedFileChanges",
            "proposal_id": f"prop_{uuid.uuid4().hex[:12]}",
            "title": "Apply sandbox artifacts",
            "changes": changes,
            "status": "pending",
        }
        # Persist artifacts metadata
        meta["artifacts"] = [{"path": c["path"], "size": len(c.get("new_content", ""))} for c in changes]
        self._persist(meta.get("tenant_id", "default"), meta.get("session_id", "default"), "sandbox_state", meta)
        return {"proposal": "PROPOSAL:" + json.dumps(proposal)}


# Simple language detector for proposals (keep in sync with launcher_agent)
_DEF_LANG = {
    'py': 'python', 'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
    'html': 'html', 'css': 'css', 'json': 'json', 'md': 'markdown', 'yml': 'yaml', 'yaml': 'yaml',
    'txt': 'text', 'sh': 'bash', 'sql': 'sql', 'go': 'go', 'rs': 'rust', 'java': 'java', 'php': 'php', 'rb': 'ruby'
}


def _detect_language(path: str) -> str:
    ext = path.lower().split('.')[-1] if '.' in path else ''
    return _DEF_LANG.get(ext, 'text')


# Singleton
sandbox_manager = SandboxManager()
