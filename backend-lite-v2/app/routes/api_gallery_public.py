from __future__ import annotations
from fastapi import APIRouter
from typing import List, Dict, Any
from ..util.gallery_store import (
    list_providers, list_api_services, list_kb_collections,
)

router = APIRouter(prefix="/api-gallery", tags=["api-gallery"])


def _added_for_provider(provider_id: str, kbs: List[Dict[str, Any]], apis: List[Dict[str, Any]]) -> bool:
    api_ids = {a.get("id") for a in apis if a.get("provider_id") == provider_id}
    kb_api_ids = {k.get("api_service_id") for k in kbs}
    return bool(api_ids & kb_api_ids)


@router.get("/providers")
async def list_providers_public():
    providers = list_providers()
    apis = list_api_services()
    kbs = list_kb_collections()
    out: List[Dict[str, Any]] = []
    for p in providers:
        pid = p.get("id")
        prov_apis = [a for a in apis if a.get("provider_id") == pid]
        # representative doc url: first API's doc_base_url
        rep_doc = prov_apis[0].get("doc_base_url") if prov_apis else None
        out.append({
            "provider_id": pid,
            "name": p.get("name"),
            "description": p.get("description"),
            "categories": p.get("categories") or [],
            "logo_url": p.get("logo_url"),
            "homepage_url": p.get("homepage_url"),
            "doc_base_url": rep_doc,
            "api_count": len(prov_apis),
            "added": _added_for_provider(pid, kbs, apis),
            "is_visible": bool(p.get("is_visible", True)),
        })
    # optional sort by sort_order then name
    out.sort(key=lambda x: (next((pp.get("sort_order", 0) for pp in providers if pp.get("id") == x["provider_id"]), 0), x["name"]))
    return out


@router.get("/provider/{provider_id}")
async def list_provider_apis(provider_id: str):
    apis = [a for a in list_api_services() if a.get("provider_id") == provider_id]
    kbs = list_kb_collections()
    kb_ids = {k.get("api_service_id") for k in kbs}
    out: List[Dict[str, Any]] = []
    for a in apis:
        out.append({
            "api_service_id": a.get("id"),
            "name": a.get("name"),
            "doc_base_url": a.get("doc_base_url"),
            "url_count": a.get("url_count", 0),
            "last_indexed_at": a.get("last_indexed_at"),
            "added": a.get("id") in kb_ids,
            "is_visible": bool(a.get("is_visible", True)),
        })
    # sort by name
    out.sort(key=lambda x: x["name"] or "")
    return out
