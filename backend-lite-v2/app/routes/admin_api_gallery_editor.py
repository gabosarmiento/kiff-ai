from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, AnyHttpUrl
from typing import List, Optional, Dict, Any
from ..util.admin_guard import require_admin
from ..util.gallery_store import (
    list_providers, upsert_provider, delete_provider,
    list_api_services, upsert_api_service, delete_api_service,
    list_categories, save_categories, bulk_upsert_doc_urls,
)
from .admin_url_extractor import _discover_sitemaps, _parse_sitemap, _filter_urls, DEFAULT_PREFIXES
from ..util.agentic_url_discovery import discover_api_urls
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


# Categories admin endpoints
class CategoriesBody(BaseModel):
    categories: list[str]


@router.get("/categories")
async def get_categories(req: Request):
    require_admin(req)
    return {"categories": list_categories()}


@router.post("/categories")
async def set_categories(req: Request, body: CategoriesBody):
    require_admin(req)
    save_categories(body.categories)
    return {"ok": True, "categories": list_categories()}


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
    
    api_name = api.get("name", "Unknown")
    base = str(api.get("doc_base_url") or "").rstrip("/")
    
    if not base:
        return {
            "api_service_id": api_id,
            "api_name": api_name,
            "status": "error",
            "error": "No doc_base_url provided",
            "url_count": 0,
            "discovered_sitemaps": [],
            "all_urls": [],
            "filtered_urls": []
        }
    
    try:
        # Discover sitemaps with detailed logging
        sitemaps = await _discover_sitemaps(base)
        
        # Parse all sitemaps and collect URLs
        all_urls: List[str] = []
        sitemap_results = []
        
        for sm in sitemaps:
            try:
                urls = await _parse_sitemap(sm)
                sitemap_results.append({
                    "sitemap_url": sm,
                    "url_count": len(urls) if urls else 0,
                    "status": "success"
                })
                if urls:
                    all_urls.extend(urls)
            except Exception as e:
                sitemap_results.append({
                    "sitemap_url": sm,
                    "url_count": 0,
                    "status": "error",
                    "error": str(e)
                })
                continue
        
        if not all_urls:
            # Fallback to agentic discovery
            print(f"No URLs found in sitemaps for {api_name}, trying agentic discovery...")
            try:
                agentic_result = await discover_api_urls(base, max_depth=2, max_urls=100)
                agentic_urls = agentic_result.get("urls", [])
                
                if agentic_urls:
                    print(f"Agentic discovery found {len(agentic_urls)} URLs for {api_name}")
                    # Filter the agentic URLs too
                    filtered = _filter_urls(agentic_urls, base, DEFAULT_PREFIXES)
                    if not filtered:
                        filtered = agentic_urls  # Use all if filtering removes everything
                    
                    # Store the URLs
                    try:
                        bulk_upsert_doc_urls(api_id, [(url, None, None) for url in filtered])
                    except Exception as e:
                        print(f"Warning: Failed to store agentic URLs for {api_name}: {e}")
                    
                    # Update API service status
                    now = __import__("datetime").datetime.utcnow().isoformat() + "Z"
                    merged = {
                        **api, 
                        "url_count": len(filtered), 
                        "last_indexed_at": now,
                        "status": "ready"
                    }
                    upsert_api_service(merged)
                    
                    return {
                        "api_service_id": api_id,
                        "api_name": api_name,
                        "status": "success",
                        "method": "agentic_discovery",
                        "url_count": len(filtered),
                        "last_indexed_at": now,
                        "discovered_sitemaps": sitemaps,
                        "sitemap_results": sitemap_results,
                        "agentic_discovery": agentic_result,
                        "filtered_urls": filtered[:20],  # Preview
                        "full_urls_stored": True
                    }
                    
            except Exception as e:
                print(f"Agentic discovery failed for {api_name}: {e}")
            
            # Mark as error if both sitemap and agentic discovery failed
            merged = {**api, "status": "error", "url_count": 0}
            upsert_api_service(merged)
            return {
                "api_service_id": api_id,
                "api_name": api_name,
                "status": "error",
                "error": "No URLs found in sitemaps and agentic discovery failed",
                "url_count": 0,
                "discovered_sitemaps": sitemaps,
                "sitemap_results": sitemap_results,
                "agentic_attempted": True
            }
        
        # Filter URLs to documentation paths
        filtered = _filter_urls(all_urls, base, DEFAULT_PREFIXES)
        
        # Store the URLs for future reference
        try:
            bulk_upsert_doc_urls(api_id, [(url, None, None) for url in filtered])
        except Exception as e:
            print(f"Warning: Failed to store URLs for {api_name}: {e}")
        
        # Update API service status
        now = __import__("datetime").datetime.utcnow().isoformat() + "Z"
        merged = {
            **api, 
            "url_count": len(filtered), 
            "last_indexed_at": now,
            "status": "ready"
        }
        upsert_api_service(merged)
        
        return {
            "api_service_id": api_id,
            "api_name": api_name,
            "status": "success",
            "url_count": len(filtered),
            "last_indexed_at": now,
            "discovered_sitemaps": sitemaps,
            "sitemap_results": sitemap_results,
            "total_urls_found": len(all_urls),
            "filtered_urls_count": len(filtered),
            "filtered_urls": filtered[:20],  # First 20 for preview
            "full_urls_stored": True
        }
        
    except Exception as e:
        # Mark as error and return detailed error info
        merged = {**api, "status": "error"}
        upsert_api_service(merged)
        return {
            "api_service_id": api_id,
            "api_name": api_name,
            "status": "error",
            "error": str(e),
            "url_count": 0,
            "discovered_sitemaps": [],
            "sitemap_results": []
        }


@router.post("/api/{api_id}/agentic_discovery")
async def agentic_discovery_api(req: Request, api_id: str):
    """Trigger agentic URL discovery for a specific API (alternative to sitemap-based indexing)."""
    require_admin(req)
    apis = list_api_services()
    api = next((a for a in apis if a.get("id") == api_id), None)
    if not api:
        raise HTTPException(status_code=404, detail="api not found")
    
    api_name = api.get("name", "Unknown")
    base = str(api.get("doc_base_url") or "").rstrip("/")
    
    if not base:
        return {
            "api_service_id": api_id,
            "api_name": api_name,
            "status": "error",
            "error": "No doc_base_url provided"
        }
    
    try:
        print(f"Starting agentic discovery for {api_name}...")
        agentic_result = await discover_api_urls(base, max_depth=3, max_urls=200)
        agentic_urls = agentic_result.get("urls", [])
        
        if not agentic_urls:
            return {
                "api_service_id": api_id,
                "api_name": api_name,
                "status": "no_results",
                "agentic_discovery": agentic_result,
                "url_count": 0
            }
        
        # Filter URLs
        filtered = _filter_urls(agentic_urls, base, DEFAULT_PREFIXES)
        if not filtered:
            filtered = agentic_urls[:50]  # Use first 50 if filtering removes everything
        
        # Store the URLs
        try:
            bulk_upsert_doc_urls(api_id, [(url, None, None) for url in filtered])
        except Exception as e:
            print(f"Warning: Failed to store agentic URLs for {api_name}: {e}")
        
        # Update API service status
        now = __import__("datetime").datetime.utcnow().isoformat() + "Z"
        merged = {
            **api, 
            "url_count": len(filtered), 
            "last_indexed_at": now,
            "status": "ready"
        }
        upsert_api_service(merged)
        
        return {
            "api_service_id": api_id,
            "api_name": api_name,
            "status": "success",
            "method": "agentic_discovery_only",
            "url_count": len(filtered),
            "last_indexed_at": now,
            "agentic_discovery": agentic_result,
            "discovered_urls": filtered[:30],  # Show first 30
            "full_urls_stored": True,
            "analysis": agentic_result.get("analysis_log", []),
            "strategies_used": agentic_result.get("strategies_used", [])
        }
        
    except Exception as e:
        print(f"Agentic discovery failed for {api_name}: {e}")
        return {
            "api_service_id": api_id,
            "api_name": api_name,
            "status": "error",
            "error": str(e),
            "method": "agentic_discovery_only"
        }


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


# --- Full end-to-end indexing: discover (sitemap + agentic) -> create/reuse KB -> index into LanceDB ---
from pydantic import BaseModel as _BaseModel


class IndexFullBody(_BaseModel):
    strategy: str = "semantic"  # fixed | semantic | agentic | recursive | document
    mode: str = "fast"          # fast | agentic
    embedder: str = "sentence-transformers"
    chunk_size: int = 4400
    chunk_overlap: int = 300
    budget_cap_usd: Optional[float] = None
    create_kb_if_missing: bool = True
    kb_name: Optional[str] = None  # default: f"API:{api_name}"


@router.post("/api/{api_id}/index_full")
async def index_full(req: Request, api_id: str, body: IndexFullBody):
    """Admin-only: Ensure URLs exist (sitemap + agentic fallback), then index into a tenant KB via /api/kb.

    This works even if there is no sitemap. It will:
      1) Call the existing reindex flow to persist URLs (falls back to agentic discovery).
      2) Find or create a LanceDB KB for this tenant (named per API).
      3) Call /api/kb/index with api_id to chunk+ingest into LanceDB.
    """
    require_admin(req)

    # Step 0: load API object and derive defaults
    apis = list_api_services()
    api = next((a for a in apis if a.get("id") == api_id), None)
    if not api:
        raise HTTPException(status_code=404, detail="api not found")

    api_name = api.get("name", "Unknown")
    kb_display = body.kb_name or f"API:{api_name}"

    # Step 1: Ensure URLs are discovered and stored
    _ = await reindex_api(req, api_id)  # reuses sitemap + agentic fallback and persists doc_urls

    # Step 2: Find or create a KB for this tenant
    import httpx as _httpx

    base_url = str(req.base_url).rstrip("/")
    # Propagate tenant header if present
    tenant_hdr = req.headers.get("X-Tenant-ID")
    headers = {"Content-Type": "application/json"}
    if tenant_hdr:
        headers["X-Tenant-ID"] = tenant_hdr

    async with _httpx.AsyncClient(timeout=60.0) as client:
        # List KBs
        kb_id: Optional[str] = None
        try:
            r_list = await client.get(f"{base_url}/api/kb", headers=headers)
            if r_list.status_code == 200:
                for kb in r_list.json():
                    if kb.get("name") == kb_display:
                        kb_id = kb.get("id")
                        break
        except Exception:
            pass

        # Create if missing
        if not kb_id and body.create_kb_if_missing:
            r_create = await client.post(
                f"{base_url}/api/kb/create",
                headers=headers,
                json={
                    "name": kb_display,
                    "vector_store": "lancedb",
                    "retrieval_mode": "agentic-search",
                    "embedder": body.embedder,
                },
            )
            if r_create.status_code != 200:
                raise HTTPException(status_code=500, detail=f"failed to create kb: {r_create.text}")
            kb_id = r_create.json().get("id")

        if not kb_id:
            raise HTTPException(status_code=400, detail="kb not found and not created")

        # Step 3: Index via /api/kb/index using api_id (will resolve URLs from gallery store)
        payload = {
            "kb_id": kb_id,
            "api_id": api_id,
            "mode": body.mode,
            "strategy": body.strategy,
            "embedder": body.embedder,
            "chunk_size": body.chunk_size,
            "chunk_overlap": body.chunk_overlap,
        }
        # If no budget cap specified, use a very high cap to effectively disable it
        payload["budget_cap_usd"] = body.budget_cap_usd if body.budget_cap_usd is not None else 9999.0
        r_index = await client.post(f"{base_url}/api/kb/index", headers=headers, json=payload)
        if r_index.status_code != 200:
            raise HTTPException(status_code=500, detail=f"indexing failed: {r_index.text}")

        out = r_index.json()
        return {
            "ok": True,
            "api_service_id": api_id,
            "api_name": api_name,
            "kb_id": kb_id,
            "indexing": out,
        }
