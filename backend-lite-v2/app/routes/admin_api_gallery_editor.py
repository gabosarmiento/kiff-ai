from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, AnyHttpUrl
from typing import List, Optional, Dict, Any
from ..util.admin_guard import require_admin
from ..util.gallery_store import (
    list_providers, upsert_provider, delete_provider,
    list_api_services, upsert_api_service, delete_api_service,
)
from .admin_url_extractor import _discover_sitemaps, _parse_sitemap, _filter_urls, DEFAULT_PREFIXES
from ..util.seed_data import SEED_PROVIDERS

router = APIRouter(prefix="/admin/api_gallery_editor", tags=["admin:api_gallery_editor"])  # admin only


# Provider models
class ProviderBody(BaseModel):
    id: Optional[str] = None
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    categories: List[str] = []
    logo_url: Optional[AnyHttpUrl] = None
    homepage_url: Optional[AnyHttpUrl] = None
    is_visible: bool = True
    sort_order: int = 0


def _domain_from_url(u: Optional[str]) -> Optional[str]:
    if not u:
        return None
    try:
        from urllib.parse import urlparse
        netloc = urlparse(u).netloc
        return netloc or None
    except Exception:
        return None


@router.post("/provider")
async def create_or_update_provider(req: Request, body: ProviderBody):
    require_admin(req)
    data = body.model_dump()
    # Auto-generate logo_url if not provided, using Clearbit on homepage domain
    if not data.get("logo_url"):
        dom = _domain_from_url(data.get("homepage_url"))
        if not dom:
            dom = _domain_from_url(data.get("description"))  # no-op, keep compatibility
        if dom:
            data["logo_url"] = f"https://logo.clearbit.com/{dom}"
    obj = upsert_provider(data)
    return obj


@router.delete("/provider/{provider_id}")
async def remove_provider(req: Request, provider_id: str):
    require_admin(req)
    ok = delete_provider(provider_id)
    if not ok:
        raise HTTPException(status_code=404, detail="provider not found")
    return {"ok": True}


# ApiService models
class ApiServiceBody(BaseModel):
    id: Optional[str] = None
    provider_id: str
    name: str
    slug: Optional[str] = None
    doc_base_url: AnyHttpUrl
    status: Optional[str] = "ready"
    is_visible: bool = True
    url_count: int = 0
    last_indexed_at: Optional[str] = None


@router.post("/api")
async def create_or_update_api(req: Request, body: ApiServiceBody):
    require_admin(req)
    obj = upsert_api_service(body.model_dump())
    return obj


@router.delete("/api/{api_id}")
async def remove_api(req: Request, api_id: str):
    require_admin(req)
    ok = delete_api_service(api_id)
    if not ok:
        raise HTTPException(status_code=404, detail="api not found")
    return {"ok": True}


@router.post("/api/{api_id}/reindex")
async def reindex_api(req: Request, api_id: str):
    require_admin(req)
    apis = list_api_services()
    api = next((a for a in apis if a.get("id") == api_id), None)
    if not api:
        raise HTTPException(status_code=404, detail="api not found")
    base = str(api.get("doc_base_url") or "").rstrip("/")
    sitemaps = await _discover_sitemaps(base)
    all_urls: List[str] = []
    for sm in sitemaps:
        try:
            urls = await _parse_sitemap(sm)
            if urls:
                all_urls.extend(urls)
        except Exception:
            continue
    if not all_urls:
        # mark as partial/error but don't raise
        merged = {**api, "status": "error"}
        upsert_api_service(merged)
        return {"api_service_id": api_id, "url_count": 0, "last_indexed_at": None}
    filtered = _filter_urls(all_urls, base, DEFAULT_PREFIXES)
    # Do not persist doc urls here; only quick count update
    merged = {**api, "url_count": len(filtered), "last_indexed_at": __import__("datetime").datetime.utcnow().isoformat() + "Z"}
    upsert_api_service(merged)
    return {"api_service_id": api_id, "url_count": merged["url_count"], "last_indexed_at": merged["last_indexed_at"]}


@router.get("/list")
async def list_all(req: Request):
    require_admin(req)
    return {
        "providers": list_providers(),
        "apis": list_api_services(),
    }


@router.post("/seed")
async def seed_initial(req: Request):
    require_admin(req)
    # Create providers and a default ApiService per seed item
    created = {"providers": 0, "apis": 0}
    providers_by_name = {p.get("name"): p for p in list_providers()}
    for item in SEED_PROVIDERS:
        name = item.get("name")
        desc = item.get("description")
        cats = item.get("categories") or []
        doc = item.get("doc_base_url")
        # derive homepage and logo via Clearbit based on doc domain
        from urllib.parse import urlparse
        hp = None
        logo = None
        try:
            dom = urlparse(doc).netloc
            if dom:
                hp = f"https://{dom}"
                logo = f"https://logo.clearbit.com/{dom}"
        except Exception:
            pass
        prov = providers_by_name.get(name)
        if not prov:
            prov = upsert_provider({
                "name": name,
                "description": desc,
                "categories": cats,
                "homepage_url": hp,
                "logo_url": logo,
                "is_visible": True,
            })
            created["providers"] += 1
        # create ApiService
        upsert_api_service({
            "provider_id": prov["id"],
            "name": name,
            "doc_base_url": doc,
            "is_visible": True,
            "status": "ready",
        })
        created["apis"] += 1
    return {"ok": True, **created}


@router.post("/preindex_all")
async def preindex_all(req: Request):
    require_admin(req)
    apis = list_api_services()
    results = []
    for api in apis:
        base = str(api.get("doc_base_url") or "").rstrip("/")
        try:
            sitemaps = await _discover_sitemaps(base)
            all_urls = []
            for sm in sitemaps:
                try:
                    urls = await _parse_sitemap(sm)
                    if urls:
                        all_urls.extend(urls)
                except Exception:
                    continue
            filtered = _filter_urls(all_urls, base, DEFAULT_PREFIXES) if all_urls else []
            merged = {**api, "url_count": len(filtered), "last_indexed_at": __import__("datetime").datetime.utcnow().isoformat() + "Z"}
            upsert_api_service(merged)
            results.append({"api_service_id": api.get("id"), "url_count": merged["url_count"]})
        except Exception:
            results.append({"api_service_id": api.get("id"), "error": True})
    return {"ok": True, "results": results}
