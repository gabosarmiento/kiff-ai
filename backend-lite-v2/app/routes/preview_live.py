from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException, Body, Query
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Iterator, AsyncIterator
import asyncio
import json
import os
from app.util.preview_store import PreviewStore
from app.util.sandbox_e2b import E2BProvider, E2BUnavailable

router = APIRouter(prefix="/api/preview", tags=["preview"])

# Note: This is a scaffold that is safe to run on App Runner.
# It does not create external sandboxes yet. It streams SSE with heartbeats
# and enforces tenant handling via middleware (request.state.tenant_id).
# Replace the placeholders with calls to your sandbox provider (e.g., E2B) later.

HEARTBEAT_SECONDS = float(os.getenv("PREVIEW_SSE_HEARTBEAT_SECONDS", "25"))


def _store() -> PreviewStore:
    # Lazily construct; avoids using globals for state, client is stateless.
    table = os.getenv("DYNAMO_TABLE_PREVIEW_SESSIONS") or os.getenv("PREVIEW_TABLE") or "preview_sessions"
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
    return PreviewStore(table_name=table, region_name=region)


def _e2b() -> Optional[E2BProvider]:
    try:
        return E2BProvider()
    except E2BUnavailable:
        return None


class SandboxRequest(BaseModel):
    session_id: Optional[str] = None
    runtime: Optional[str] = None  # "python" | "node" | other
    port: Optional[int] = None


class FileSpec(BaseModel):
    path: str
    content: str
    language: Optional[str] = None


class ApplyFilesRequest(BaseModel):
    session_id: str
    files: List[FileSpec]


class InstallPackagesRequest(BaseModel):
    session_id: str
    packages: List[str]


class RestartRequest(BaseModel):
    session_id: str


class SecretsRequest(BaseModel):
    session_id: str
    # Write-only; values are never echoed back. Keys must be strings.
    secrets: Dict[str, str]


class PatchRequest(BaseModel):
    session_id: str
    unified_diff: str


async def _ensure_tenant(request: Request) -> str:
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        # Middleware should normally set this; keep strict here to avoid silent failures.
        raise HTTPException(status_code=400, detail="Tenant not specified")
    return tenant_id


def _sse_message(data: Dict[str, Any]) -> bytes:
    return f"data: {json.dumps(data)}\n\n".encode("utf-8")


async def _sse_stream_async(async_iter: AsyncIterator[Dict[str, Any]]) -> AsyncIterator[bytes]:
    """Consume an async iterator of dicts and emit SSE frames with periodic heartbeats.

    - Wraps items as SSE: `data: <json>\n\n`
    - Emits a heartbeat comment periodically and once at the end to flush proxies.
    """
    ping_interval = HEARTBEAT_SECONDS
    last_sent = asyncio.get_event_loop().time()

    async def produce() -> AsyncIterator[bytes]:
        nonlocal last_sent
        async for item in async_iter:
            yield _sse_message(item)
            last_sent = asyncio.get_event_loop().time()
        # final flush ping so intermediaries don't buffer
        yield b": ping\n\n"

    iterator = produce()
    while True:
        try:
            chunk = await iterator.__anext__()
            yield chunk
        except StopAsyncIteration:
            break
        # heartbeat if needed
        now = asyncio.get_event_loop().time()
        if now - last_sent >= ping_interval:
            yield b": ping\n\n"
            last_sent = now


@router.post("/sandbox")
async def create_sandbox(request: Request, body: Any = Body(...)):
    tenant_id = await _ensure_tenant(request)
    # Normalize body to a dict-like with session_id
    session_id: str = "default"
    runtime: Optional[str] = None
    port: Optional[int] = None
    try:
        if isinstance(body, str):
            # Handle double-stringified JSON or plain string
            try:
                parsed = json.loads(body)
                if isinstance(parsed, dict):
                    session_id = str(parsed.get("session_id") or session_id)
                    runtime = parsed.get("runtime") or runtime
                    try:
                        port = int(parsed.get("port")) if parsed.get("port") is not None else None
                    except Exception:
                        port = None
                else:
                    session_id = str(parsed) or session_id
            except Exception:
                session_id = body or session_id
        elif isinstance(body, dict):
            session_id = str(body.get("session_id") or session_id)
            runtime = body.get("runtime") or runtime
            try:
                port = int(body.get("port")) if body.get("port") is not None else None
            except Exception:
                port = None
        elif hasattr(body, "dict"):
            d = body.dict()
            if isinstance(d, dict):
                session_id = str(d.get("session_id") or session_id)
                runtime = d.get("runtime") or runtime
                try:
                    port = int(d.get("port")) if d.get("port") is not None else None
                except Exception:
                    port = None
        else:
            # Fallback: attempt to coerce to dict via json if possible
            try:
                parsed = json.loads(str(body))
                if isinstance(parsed, dict):
                    session_id = str(parsed.get("session_id") or session_id)
                    runtime = parsed.get("runtime") or runtime
                    try:
                        port = int(parsed.get("port")) if parsed.get("port") is not None else None
                    except Exception:
                        port = None
            except Exception:
                pass
    except Exception:
        # Keep default if anything goes wrong
        session_id = "default"
    base = {
        "sandbox_id": None,
        "preview_url": None,
        "status": "unavailable",
        "message": "Sandbox integration not yet configured. Set E2B_API_KEY or enable mock.",
    }
    item = _store().ensure_session(tenant_id, session_id, base)
    # Store runtime/port if provided
    updates: Dict[str, Any] = {}
    if runtime:
        updates["runtime"] = runtime
    if port is not None:
        updates["port"] = port
    if updates:
        item = _store().update_session_fields(tenant_id, session_id, updates)
    # Attempt to provision with E2B (mock-supported)
    provider = _e2b()
    if provider:
        try:
            created = provider.create_sandbox(tenant_id=tenant_id, session_id=session_id)
            item = _store().update_session_fields(
                tenant_id,
                session_id,
                {
                    "sandbox_id": created.get("sandbox_id"),
                    "preview_url": created.get("preview_url"),
                    "status": "ready" if created.get("preview_url") else "provisioned",
                    "message": "Sandbox provisioned",
                },
            )
            # Persist runtime metadata inside the sandbox for provider to branch on
            try:
                if item.get("sandbox_id") and (runtime or port is not None):
                    entry = None
                    if (runtime or "").lower() == "python":
                        # Default dotted entry for FastAPI apps; agent can override later via patch
                        entry = "app.main:app"
                    provider.set_runtime(
                        sandbox_id=item.get("sandbox_id"),
                        runtime=runtime,
                        port=port,
                        entry=entry,
                    )
            except Exception:
                # Non-fatal; routes can still operate with defaults
                pass
        except NotImplementedError:
            # keep placeholder state
            pass
    # ensure response shape
    resp = {
        "tenant_id": tenant_id,
        "session_id": session_id,
        "sandbox_id": item.get("sandbox_id"),
        "preview_url": item.get("preview_url"),
        "status": item.get("status", "unavailable"),
        "message": item.get("message"),
        "runtime": item.get("runtime"),
        "port": item.get("port"),
    }
    return JSONResponse(resp)


@router.post("/files")
async def apply_files(request: Request, body: ApplyFilesRequest):
    tenant_id = await _ensure_tenant(request)
    # mark state
    _store().update_session_fields(tenant_id, body.session_id, {"status": "applying_files"})
    provider = _e2b()
    sess = _store().get_session(tenant_id, body.session_id) or {}
    sandbox_id = sess.get("sandbox_id")

    async def gen():
        yield {"type": "start", "message": f"Applying {len(body.files)} files...", "session_id": body.session_id}
        # Try provider first (mock will no-op)
        if provider and sandbox_id:
            try:
                provider.apply_files(sandbox_id=sandbox_id, files=[f.dict() for f in body.files])
            except NotImplementedError:
                pass
        # Persist files for tree/file endpoints
        try:
            existing = (_store().get_session(tenant_id, body.session_id) or {}).get("files") or []
            path_to_idx = {f.get("path"): i for i, f in enumerate(existing) if isinstance(f, dict) and f.get("path")}
            for f in body.files:
                if f.path in path_to_idx:
                    existing[path_to_idx[f.path]] = {"path": f.path, "content": f.content, "language": f.language}
                else:
                    existing.append({"path": f.path, "content": f.content, "language": f.language})
            _store().update_session_fields(tenant_id, body.session_id, {"files": existing})
        except Exception:
            pass
        # Simulate per-file progress
        for f in body.files:
            await asyncio.sleep(0.01)
            yield {"type": "file", "path": f.path, "status": "applied"}
        _store().update_session_fields(tenant_id, body.session_id, {"status": "files_applied"})
        yield {"type": "complete", "message": "Files applied (placeholder)", "tenant_id": tenant_id}

    return StreamingResponse(_sse_stream_async(gen()), media_type="text/event-stream")


@router.post("/install")
async def install_packages(request: Request, body: InstallPackagesRequest):
    tenant_id = await _ensure_tenant(request)
    _store().update_session_fields(tenant_id, body.session_id, {"status": "installing"})
    provider = _e2b()
    sess = _store().get_session(tenant_id, body.session_id) or {}
    sandbox_id = sess.get("sandbox_id")
    runtime = (sess.get("runtime") or "vite").lower()

    async def gen():
        pkgs = body.packages or []
        yield {"type": "start", "message": f"Installing {len(pkgs)} packages...", "packages": pkgs, "runtime": runtime}
        # Try provider first (mock will no-op)
        if provider and sandbox_id:
            try:
                # Current provider installs npm packages for vite path.
                # Python/Node-specific installers will be added in provider later.
                provider.install_packages(sandbox_id=sandbox_id, packages=pkgs)
            except NotImplementedError:
                pass
        # Simulate install steps
        for p in pkgs:
            await asyncio.sleep(0.01)
            yield {"type": "package", "name": p, "status": "installed"}
        # Simulate dev server restart
        await asyncio.sleep(0.02)
        yield {"type": "status", "message": "Restarted dev server (placeholder)"}
        _store().update_session_fields(tenant_id, body.session_id, {"status": "ready"})
        yield {"type": "complete", "message": "Install complete (placeholder)", "tenant_id": tenant_id}

    return StreamingResponse(_sse_stream_async(gen()), media_type="text/event-stream")


@router.post("/restart")
async def restart_dev_server(request: Request, body: RestartRequest):
    tenant_id = await _ensure_tenant(request)
    _store().update_session_fields(tenant_id, body.session_id, {"status": "restarting"})
    provider = _e2b()
    sess = _store().get_session(tenant_id, body.session_id) or {}
    sandbox_id = sess.get("sandbox_id")
    if provider and sandbox_id:
        try:
            provider.restart(sandbox_id=sandbox_id)
        except NotImplementedError:
            pass
    # Placeholder restart
    _store().update_session_fields(tenant_id, body.session_id, {"status": "ready"})
    return {"status": "ok", "message": "Dev server restart requested (placeholder)", "tenant_id": tenant_id}


@router.get("/logs")
async def preview_logs(request: Request, session_id: str):
    tenant_id = await _ensure_tenant(request)
    item = _store().get_session(tenant_id, session_id) or {}
    head = item.get("logs_head") or ""
    logs = [l for l in head.split("\n") if l]
    return {
        "tenant_id": tenant_id,
        "session_id": session_id,
        "has_errors": False,
        "missing_packages": [],
        "logs": logs,
    }


@router.post("/secrets")
async def save_secrets(request: Request, body: SecretsRequest):
    tenant_id = await _ensure_tenant(request)
    # Never store raw values beyond immediate injection in a real provider.
    # Here we only persist the keys for audit and mark secrets as configured.
    keys = sorted([k for k in (body.secrets or {}).keys() if isinstance(k, str)])
    _store().update_session_fields(
        tenant_id,
        body.session_id,
        {"secrets_configured": True, "secret_keys": keys},
    )
    # Send to provider for in-sandbox storage (for injection on restart)
    provider = _e2b()
    sess = _store().get_session(tenant_id, body.session_id) or {}
    sandbox_id = sess.get("sandbox_id")
    if provider and sandbox_id and body.secrets:
        try:
            provider.set_secrets(sandbox_id=sandbox_id, secrets=body.secrets)
        except NotImplementedError:
            pass
        except Exception:
            # Do not fail the request on provider error; front-end can choose to restart later
            pass
    return {"status": "ok", "configured": keys, "tenant_id": tenant_id}


@router.post("/patch")
async def apply_patch(request: Request, body: PatchRequest):
    tenant_id = await _ensure_tenant(request)
    provider = _e2b()
    sess = _store().get_session(tenant_id, body.session_id) or {}
    sandbox_id = sess.get("sandbox_id")
    applied = False
    if provider and sandbox_id and (body.unified_diff or "").strip():
        try:
            provider.apply_patch(sandbox_id=sandbox_id, unified_diff=body.unified_diff)
            applied = True
        except NotImplementedError:
            applied = False
        except Exception:
            applied = False
    _store().update_session_fields(
        tenant_id,
        body.session_id,
        {"last_patch": {"len": len(body.unified_diff or ""), "applied": applied}, "status": "patched"},
    )
    return {"status": "ok", "applied": applied, "tenant_id": tenant_id}


@router.get("/tree")
async def get_file_tree(request: Request, session_id: str = Query(...)):
    tenant_id = await _ensure_tenant(request)
    sess = _store().get_session(tenant_id, session_id) or {}
    files = sess.get("files") or []
    paths = [f.get("path") for f in files if isinstance(f, dict) and f.get("path")]
    return {"tenant_id": tenant_id, "session_id": session_id, "files": sorted(paths)}


@router.get("/file")
async def get_file(request: Request, session_id: str = Query(...), path: str = Query(...)):
    tenant_id = await _ensure_tenant(request)
    sess = _store().get_session(tenant_id, session_id) or {}
    files = sess.get("files") or []
    for f in files:
        if isinstance(f, dict) and f.get("path") == path:
            return {"tenant_id": tenant_id, "session_id": session_id, "path": path, "content": f.get("content", "")}
    raise HTTPException(status_code=404, detail="File not found")
