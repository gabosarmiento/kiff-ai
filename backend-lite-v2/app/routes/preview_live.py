from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException, Body, Query
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Iterator, AsyncIterator
import asyncio
import json
import os
from decimal import Decimal
from app.util.preview_store import PreviewStore
from app.util.sandbox_e2b import E2BProvider, E2BUnavailable
from app.util.sandbox_infra import InfraVMProvider, InfraVMUnavailable

router = APIRouter(prefix="/api/preview", tags=["preview"])

class AutomatedDeployRequest(BaseModel):
    session_id: str
    files: List[FileSpec]
    auto_install: bool = True
    auto_start: bool = True

# Note: This is a scaffold that is safe to run on App Runner.
# It does not create external sandboxes yet. It streams SSE with heartbeats
# and enforces tenant handling via middleware (request.state.tenant_id).
# Replace the placeholders with calls to your sandbox provider (e.g., E2B) later.

HEARTBEAT_SECONDS = float(os.getenv("PREVIEW_SSE_HEARTBEAT_SECONDS", "25"))


def _decimal_to_serializable(obj: Any) -> Any:
    """Convert Decimal objects and nested structures to JSON-serializable types."""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: _decimal_to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_decimal_to_serializable(item) for item in obj]
    return obj


def _store() -> PreviewStore:
    # Lazily construct; avoids using globals for state, client is stateless.
    table = os.getenv("DYNAMO_TABLE_PREVIEW_SESSIONS") or os.getenv("PREVIEW_TABLE") or "preview_sessions"
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "eu-west-3"
    return PreviewStore(table_name=table, region_name=region)


def _provider():
    """Factory function to create appropriate sandbox provider based on environment"""
    provider_type = os.getenv("SANDBOX_PROVIDER", "e2b").lower()
    
    if provider_type == "infra":
        try:
            return InfraVMProvider()
        except InfraVMUnavailable:
            return None
    else:
        # Default to E2B
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


def _detect_project_runtime(files: List[Any]) -> Optional[Dict[str, Any]]:
    """Detect project runtime based on files and return appropriate server configuration."""
    file_paths = [f.path for f in files]
    
    # Check for Python Flask project
    if any(path in ["app.py", "main.py", "server.py"] for path in file_paths):
        if any("requirements.txt" in path for path in file_paths):
            return {
                "runtime": "python",
                "port": 5000,
                "entry": "app.py"  # Will be detected dynamically
            }
    
    # Check for Node.js project
    if "package.json" in file_paths:
        # Check if it's a Vite React project
        package_content = ""
        for f in files:
            if f.path == "package.json":
                package_content = f.content
                break
        
        if "vite" in package_content.lower():
            return {
                "runtime": "vite",
                "port": 5173,
                "entry": None
            }
        elif any(keyword in package_content.lower() for keyword in ["express", "fastify", "koa"]):
            return {
                "runtime": "node",
                "port": 3000,
                "entry": "server.js"
            }
    
    # Default fallback
    return None


async def _ensure_tenant(request: Request) -> str:
    tenant_id = getattr(request.state, "tenant_id", None)
    if tenant_id:
        return tenant_id
    # Fallback: read from headers if middleware not present
    headers = request.headers or {}
    # Exact-case first per platform standard
    tenant_id = headers.get("X-Tenant-ID") or headers.get("x-tenant-id") or headers.get("X-tenant-id")
    if tenant_id:
        return str(tenant_id)
    # Final fallback: known dev tenant to avoid hard failure in local
    fallback = os.getenv("DEFAULT_TENANT_ID", "4485db48-71b7-47b0-8128-c6dca5be352d")
    if fallback:
        return fallback
    raise HTTPException(status_code=400, detail="Tenant not specified")


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
    provider = _provider()
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
        except Exception as e:
            # Keep placeholder state; record error message for diagnostics
            _store().update_session_fields(
                tenant_id,
                session_id,
                {"status": "unavailable", "message": f"Sandbox error: {str(e)[:200]}"},
            )
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
    # Convert any Decimal objects to serializable types
    serializable_resp = _decimal_to_serializable(resp)
    return JSONResponse(serializable_resp)


@router.post("/files")
async def apply_files(request: Request, body: ApplyFilesRequest):
    tenant_id = await _ensure_tenant(request)
    # mark state
    _store().update_session_fields(tenant_id, body.session_id, {"status": "applying_files"})
    provider = _provider()
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
        
        # Auto-detect project type and start appropriate server
        runtime_detected = _detect_project_runtime(body.files)
        if runtime_detected and provider and sandbox_id:
            try:
                provider.set_runtime(
                    sandbox_id=sandbox_id,
                    runtime=runtime_detected["runtime"],
                    port=runtime_detected["port"],
                    entry=runtime_detected.get("entry")
                )
                provider.restart(sandbox_id=sandbox_id)
                
                # Generate preview URL for the detected port
                preview_url = provider.get_preview_url(sandbox_id=sandbox_id, port=runtime_detected["port"])
                
                # Update session with the correct preview URL
                _store().update_session_fields(tenant_id, body.session_id, {
                    "preview_url": preview_url,
                    "runtime": runtime_detected["runtime"],
                    "port": runtime_detected["port"]
                })
                
                yield {"type": "server", "runtime": runtime_detected["runtime"], "port": runtime_detected["port"], "preview_url": preview_url, "status": "started"}
            except Exception as e:
                yield {"type": "server", "runtime": runtime_detected["runtime"], "status": "failed", "error": str(e)}
        
        _store().update_session_fields(tenant_id, body.session_id, {"status": "files_applied"})
        yield {"type": "complete", "message": "Files applied and server started", "tenant_id": tenant_id}

    return StreamingResponse(_sse_stream_async(gen()), media_type="text/event-stream")


@router.post("/install")
async def install_packages(request: Request, body: InstallPackagesRequest):
    tenant_id = await _ensure_tenant(request)
    _store().update_session_fields(tenant_id, body.session_id, {"status": "installing"})
    provider = _provider()
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


@router.post("/deploy-and-start")
async def automated_deploy_and_start(request: Request, body: AutomatedDeployRequest):
    """
    E2B-like automated workflow: deploy files, install packages, start server, return preview URL
    """
    tenant_id = await _ensure_tenant(request)
    
    # Mark session as deploying
    _store().update_session_fields(tenant_id, body.session_id, {"status": "deploying"})
    
    provider = _provider()
    sess = _store().get_session(tenant_id, body.session_id) or {}
    sandbox_id = sess.get("sandbox_id")
    
    async def gen():
        try:
            # Step 1: Deploy files
            yield {"type": "start", "message": f"Deploying {len(body.files)} files...", "session_id": body.session_id}
            
            if provider and sandbox_id:
                # Try new VM service methods first
                if hasattr(provider, 'deploy_files_to_vm'):
                    provider.deploy_files_to_vm(sandbox_id=sandbox_id, files=[f.dict() for f in body.files])
                else:
                    provider.apply_files(sandbox_id=sandbox_id, files=[f.dict() for f in body.files])
            
            # Emit file deployment progress
            for f in body.files:
                await asyncio.sleep(0.1)
                yield {"type": "file", "path": f.path, "status": "deployed"}
            
            yield {"type": "status", "message": "Files deployed successfully"}
            
            # Step 2: Auto-install packages if enabled
            if body.auto_install:
                # Detect packages from files
                packages = []
                for f in body.files:
                    if f.path == "package.json" and f.content:
                        try:
                            import json
                            pkg_data = json.loads(f.content)
                            deps = pkg_data.get("dependencies", {})
                            dev_deps = pkg_data.get("devDependencies", {})
                            packages = list(deps.keys()) + list(dev_deps.keys())
                        except:
                            pass
                        break
                
                if packages:
                    yield {"type": "status", "message": f"Installing {len(packages)} packages..."}
                    
                    if provider and sandbox_id:
                        provider.install_packages(sandbox_id=sandbox_id, packages=packages)
                    
                    # Simulate package installation progress
                    for pkg in packages[:5]:  # Show first 5 packages
                        await asyncio.sleep(0.3)
                        yield {"type": "package", "name": pkg, "status": "installed"}
                    
                    yield {"type": "status", "message": "Package installation completed"}
            
            # Step 3: Auto-start development server if enabled
            preview_url = None
            if body.auto_start:
                yield {"type": "status", "message": "Starting development server..."}
                
                if provider and sandbox_id:
                    # Try new VM service method for starting server
                    if hasattr(provider, 'start_dev_server'):
                        preview_url = provider.start_dev_server(sandbox_id=sandbox_id)
                    else:
                        provider.restart(sandbox_id=sandbox_id)
                        preview_url = provider.get_preview_url(sandbox_id=sandbox_id, port=5173)
                
                await asyncio.sleep(1.0)  # Simulate server startup time
                yield {"type": "status", "message": "Development server started"}
                
                if preview_url:
                    yield {"type": "preview_ready", "preview_url": preview_url, "message": "Preview is ready!"}
            
            # Update session status
            _store().update_session_fields(tenant_id, body.session_id, {
                "status": "ready",
                "preview_url": preview_url,
                "last_deploy": int(asyncio.get_event_loop().time())
            })
            
            yield {"type": "complete", "message": "Deployment completed successfully", "preview_url": preview_url, "tenant_id": tenant_id}
            
        except Exception as e:
            yield {"type": "error", "message": f"Deployment failed: {str(e)}", "tenant_id": tenant_id}
            _store().update_session_fields(tenant_id, body.session_id, {"status": "error"})
    
    return StreamingResponse(_sse_stream_async(gen()), media_type="text/event-stream")


@router.post("/restart")
async def restart_dev_server(request: Request, body: RestartRequest):
    tenant_id = await _ensure_tenant(request)
    _store().update_session_fields(tenant_id, body.session_id, {"status": "restarting"})
    provider = _provider()
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
    
    # Try to get real-time logs from VM service
    provider = _provider()
    sess = _store().get_session(tenant_id, session_id) or {}
    sandbox_id = sess.get("sandbox_id")
    
    if provider and sandbox_id and hasattr(provider, 'get_vm_logs'):
        try:
            vm_logs_data = provider.get_vm_logs(sandbox_id=sandbox_id, tail=50)
            return {
                "tenant_id": tenant_id,
                "session_id": session_id,
                "sandbox_id": sandbox_id,
                "has_errors": False,
                "missing_packages": [],
                "logs": vm_logs_data.get("logs", []),
                "install_status": vm_logs_data.get("install_status", "unknown"),
                "server_status": vm_logs_data.get("server_status", "unknown"),
                "vm_logs": True
            }
        except Exception as e:
            # Fall back to stored logs if VM service fails
            pass
    
    # Fallback to stored logs
    item = _store().get_session(tenant_id, session_id) or {}
    head = item.get("logs_head") or ""
    logs = [l for l in head.split("\n") if l]
    return {
        "tenant_id": tenant_id,
        "session_id": session_id,
        "has_errors": False,
        "missing_packages": [],
        "logs": logs,
        "vm_logs": False
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
    provider = _provider()
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
    provider = _provider()
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
