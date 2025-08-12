from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from typing import List, Dict, Any, Optional
from ..util.gallery_store import (
    list_providers,
    list_api_services,
    list_kb_collections,
    list_categories,
    is_ready_api,
    list_bag_for_tenant,
    add_bag_item,
    remove_bag_item,
    clear_bag,
    provider_has_bag_item,
)

router = APIRouter(prefix="/api-gallery", tags=["api-gallery"])


def _ready_apis_for_provider(provider_id: str, apis: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [a for a in apis if a.get("provider_id") == provider_id and is_ready_api(a)]


@router.get("/providers")
async def list_providers_public(request: Request):
    providers = list_providers()
    apis = list_api_services()
    tenant_id: Optional[str] = getattr(request.state, "tenant_id", None)
    out: List[Dict[str, Any]] = []
    for p in providers:
        pid = p.get("id")
        prov_apis = _ready_apis_for_provider(pid, apis)
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
            "added": bool(tenant_id and provider_has_bag_item(tenant_id, pid)),
            "is_visible": bool(p.get("is_visible", True)),
        })
    # optional sort by sort_order then name
    out.sort(key=lambda x: (next((pp.get("sort_order", 0) for pp in providers if pp.get("id") == x["provider_id"]), 0), x["name"]))
    return out


@router.get("/categories")
async def list_categories_public():
    """Return categories with curated order first and discovered categories appended.

    Response shape:
      {
        "categories": ["AI/ML", ...],
        "curated": [...],
        "discovered": [...]
      }
    """
    curated = list_categories()  # ordered
    # discover and count from providers (visible or all? we use visibility from providers list route logic)
    provs = list_providers()
    counts: dict[str, int] = {}
    for p in provs:
        if not bool(p.get("is_visible", True)):
            continue
        for c in (p.get("categories") or []):
            if not c:
                continue
            key = str(c)
            counts[key] = counts.get(key, 0) + 1

    discovered = sorted(counts.keys())

    # merge curated first then remaining, but within both groups order by popularity desc then alpha as tiebreaker
    def sort_key(name: str):
        # negative count for descending, then name
        return (-counts.get(name, 0), name.lower())

    curated_sorted = sorted(curated, key=sort_key)
    curated_set = set(curated)
    remaining = [c for c in discovered if c not in curated_set]
    remaining_sorted = sorted(remaining, key=sort_key)
    merged = curated_sorted + remaining_sorted

    return {
        "categories": merged,
        "curated": curated_sorted,
        "discovered": remaining_sorted,
        "counts": counts,
    }


@router.get("/provider/{provider_id}")
async def list_provider_apis(provider_id: str, request: Request):
    apis = [a for a in list_api_services() if a.get("provider_id") == provider_id and is_ready_api(a)]
    tenant_id: Optional[str] = getattr(request.state, "tenant_id", None)
    bag_items = list_bag_for_tenant(tenant_id) if tenant_id else []
    bag_api_ids = {it.get("api_service_id") for it in bag_items}
    out: List[Dict[str, Any]] = []
    for a in apis:
        out.append({
            "api_service_id": a.get("id"),
            "name": a.get("name"),
            "doc_base_url": a.get("doc_base_url"),
            "url_count": a.get("url_count", 0),
            "last_indexed_at": a.get("last_indexed_at"),
            "added": a.get("id") in bag_api_ids,
            "is_visible": bool(a.get("is_visible", True)),
        })
    # sort by name
    out.sort(key=lambda x: x["name"] or "")
    return out


# Tenant-scoped Bag endpoints

@router.get("/bag")
async def list_bag(request: Request):
    tenant_id: Optional[str] = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant not specified")
    items = list_bag_for_tenant(tenant_id)
    # hydrate with API info for convenience
    apis = list_api_services()
    api_by_id = {a.get("id"): a for a in apis}
    out: List[Dict[str, Any]] = []
    for it in items:
        a = api_by_id.get(it.get("api_service_id"))
        if not a:
            # stale entry; skip but keep it stored
            continue
        out.append({
            **it,
            "api_name": a.get("name"),
            "doc_base_url": a.get("doc_base_url"),
            "url_count": a.get("url_count", 0),
        })
    return out


@router.post("/bag")
async def add_to_bag(request: Request, payload: Dict[str, Any]):
    tenant_id: Optional[str] = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant not specified")
    api_service_id = str(payload.get("api_service_id") or "").strip()
    if not api_service_id:
        raise HTTPException(status_code=400, detail="api_service_id required")
    try:
        obj = add_bag_item(tenant_id, api_service_id, None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return obj


@router.delete("/bag/{api_service_id}")
async def remove_from_bag(api_service_id: str, request: Request):
    tenant_id: Optional[str] = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant not specified")
    ok = remove_bag_item(tenant_id, api_service_id)
    return {"removed": bool(ok)}


@router.delete("/bag")
async def clear_bag_items(request: Request):
    tenant_id: Optional[str] = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant not specified")
    n = clear_bag(tenant_id)
    return {"cleared": int(n)}
