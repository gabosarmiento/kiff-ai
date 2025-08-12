from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import httpx

router = APIRouter(prefix="/api/deps", tags=["deps"])


class ResolveRequest(BaseModel):
    session_id: str
    python: Optional[List[str]] = None  # e.g., ["fastapi", "uvicorn==0.30.1"]
    node: Optional[List[str]] = None    # e.g., ["express", "cors@^2"]


class ResolveResponse(BaseModel):
    python: Dict[str, str] = {}
    node: Dict[str, str] = {}


class ValidateRequest(BaseModel):
    session_id: str
    python: Optional[Dict[str, str]] = None  # name -> version
    node: Optional[Dict[str, str]] = None    # name -> version


class ValidateResponse(BaseModel):
    ok: bool
    python: List[Dict[str, Any]] = []
    node: List[Dict[str, Any]] = []


async def _ensure_tenant(request: Request) -> str:
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant not specified")
    return tenant_id


async def _fetch_json(client: httpx.AsyncClient, url: str) -> Optional[Dict[str, Any]]:
    try:
        r = await client.get(url, timeout=10)
        if r.status_code == 200:
            return r.json()
        return None
    except Exception:
        return None


def _parse_py_pkg(s: str) -> (str, Optional[str]):
    # Supports formats: name, name==x.y.z
    if "==" in s:
        parts = s.split("==", 1)
        return parts[0].strip(), parts[1].strip()
    return s.strip(), None


def _parse_node_pkg(s: str) -> (str, Optional[str]):
    # Supports formats: name, name@version|range
    if "@" in s and not s.startswith("@"):  # ignore scoped packages leading '@'
        parts = s.split("@", 1)
        return parts[0].strip(), parts[1].strip()
    return s.strip(), None


@router.post("/resolve", response_model=ResolveResponse)
async def resolve_deps(request: Request, body: ResolveRequest) -> ResolveResponse:
    await _ensure_tenant(request)
    out_py: Dict[str, str] = {}
    out_node: Dict[str, str] = {}
    async with httpx.AsyncClient() as client:
        # Python (PyPI)
        for spec in (body.python or []):
            name, pinned = _parse_py_pkg(spec)
            info = await _fetch_json(client, f"https://pypi.org/pypi/{name}/json")
            if not info:
                continue
            if pinned:
                # If exact version exists, keep it; else fallback to latest
                if pinned in (info.get("releases") or {}):
                    out_py[name] = pinned
                else:
                    out_py[name] = (info.get("info") or {}).get("version") or pinned
            else:
                out_py[name] = (info.get("info") or {}).get("version") or ""
        # Node (npm)
        for spec in (body.node or []):
            name, rng = _parse_node_pkg(spec)
            data = await _fetch_json(client, f"https://registry.npmjs.org/{name}")
            if not data:
                continue
            versions = sorted(list((data.get("versions") or {}).keys()))
            latest = (data.get("dist-tags") or {}).get("latest") or (versions[-1] if versions else "")
            if rng and rng in versions:
                out_node[name] = rng
            else:
                # TODO: implement semver resolution for ranges; fallback to latest for now
                out_node[name] = latest
    return ResolveResponse(python=out_py, node=out_node)


@router.post("/validate", response_model=ValidateResponse)
async def validate_deps(request: Request, body: ValidateRequest) -> ValidateResponse:
    await _ensure_tenant(request)
    py_results: List[Dict[str, Any]] = []
    node_results: List[Dict[str, Any]] = []
    ok = True
    async with httpx.AsyncClient() as client:
        # Validate Python
        for name, ver in (body.python or {}).items():
            info = await _fetch_json(client, f"https://pypi.org/pypi/{name}/json")
            exists = bool(info)
            has_version = exists and ver in (info.get("releases") or {})
            result = {"name": name, "version": ver, "exists": exists, "has_version": has_version}
            if exists:
                deprecated = bool((info.get("info") or {}).get("yanked", False))
                result["deprecated"] = deprecated
            py_results.append(result)
            if not (exists and has_version):
                ok = False
        # Validate Node
        for name, ver in (body.node or {}).items():
            data = await _fetch_json(client, f"https://registry.npmjs.org/{name}")
            exists = bool(data)
            has_version = exists and ver in (data.get("versions") or {})
            result = {"name": name, "version": ver, "exists": exists, "has_version": has_version}
            if exists:
                deprecated = False
                try:
                    meta = (data.get("versions") or {}).get(ver) or {}
                    deprecated = bool(meta.get("deprecated"))
                except Exception:
                    pass
                result["deprecated"] = deprecated
            node_results.append(result)
            if not (exists and has_version):
                ok = False
    return ValidateResponse(ok=ok, python=py_results, node=node_results)
