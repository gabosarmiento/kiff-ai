from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
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
async def create_sandbox(request: Request, body: SandboxRequest):
    tenant_id = await _ensure_tenant(request)
    session_id = body.session_id or "default"
    base = {
        "sandbox_id": None,
        "preview_url": None,
        "status": "unavailable",
        "message": "Sandbox integration not yet configured. Set E2B_API_KEY or enable mock.",
    }
    item = _store().ensure_session(tenant_id, session_id, base)
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

    async def gen():
        pkgs = body.packages or []
        yield {"type": "start", "message": f"Installing {len(pkgs)} packages...", "packages": pkgs}
        # Try provider first (mock will no-op)
        if provider and sandbox_id:
            try:
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
