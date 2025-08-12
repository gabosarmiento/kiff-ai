from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime
from pydantic import BaseModel

from ..util.admin_guard import require_admin
from ..util.gallery_store import (
    list_api_services,
    upsert_api_service,
    bulk_upsert_doc_urls,
    mark_api_indexed,
)
from .admin_url_extractor import _discover_sitemaps, _parse_sitemap, _filter_urls, DEFAULT_PREFIXES

router = APIRouter(prefix="/admin/bulk_indexer", tags=["admin:bulk_indexer"])

# Global state for tracking bulk indexing progress
_indexing_state = {
    "status": "idle",  # "idle", "running", "completed", "failed"
    "progress": {"current": 0, "total": 0, "processed": []},
    "started_at": None,
    "completed_at": None,
    "results": {"success": 0, "failed": 0, "skipped": 0},
    "errors": []
}

class BulkIndexRequest(BaseModel):
    force_reindex: bool = False
    max_concurrent: int = 3
    include_providers: Optional[List[str]] = None  # Provider names to include, None = all
    create_vector_index: bool = True  # Whether to create vector embeddings
    max_urls_per_api: int = 50  # Limit URLs per API to prevent overload

class IndexResult(BaseModel):
    api_id: str
    api_name: str
    status: str
    url_count: int
    error: Optional[str] = None

async def _index_single_api(api: Dict[str, Any], force: bool = False) -> IndexResult:
    """Index a single API service by discovering and parsing its documentation."""
    api_id = api.get("id")
    api_name = api.get("name", "Unknown")
    
    try:
        # Skip if already indexed and not forcing
        if not force and api.get("url_count", 0) > 0:
            return IndexResult(
                api_id=api_id,
                api_name=api_name,
                status="skipped",
                url_count=api.get("url_count", 0)
            )
        
        base_url = str(api.get("doc_base_url") or "").rstrip("/")
        if not base_url:
            return IndexResult(
                api_id=api_id,
                api_name=api_name,
                status="failed",
                url_count=0,
                error="No doc_base_url provided"
            )
        
        # Discover sitemaps
        sitemaps = await _discover_sitemaps(base_url)
        if not sitemaps:
            # Mark as indexed with minimal count to make it visible
            mark_api_indexed(api_id, url_count=1)
            return IndexResult(
                api_id=api_id,
                api_name=api_name,
                status="success",
                url_count=1,
                error="No sitemaps found, marked as minimal"
            )
        
        # Parse all sitemaps
        all_urls: List[str] = []
        for sitemap_url in sitemaps:
            try:
                urls = await _parse_sitemap(sitemap_url)
                if urls:
                    all_urls.extend(urls)
            except Exception as e:
                print(f"Failed to parse sitemap {sitemap_url}: {e}")
                continue
        
        if not all_urls:
            # Mark as indexed with minimal count
            mark_api_indexed(api_id, url_count=1)
            return IndexResult(
                api_id=api_id,
                api_name=api_name,
                status="success",
                url_count=1,
                error="No URLs found in sitemaps, marked as minimal"
            )
        
        # Filter URLs to documentation paths
        filtered_urls = _filter_urls(all_urls, base_url, DEFAULT_PREFIXES)
        final_count = max(len(filtered_urls), 1)  # Ensure at least 1
        
        # Mark as indexed
        mark_api_indexed(api_id, url_count=final_count)
        
        # Store URLs for future vector indexing (if we have many)
        if len(filtered_urls) > 5:
            try:
                bulk_upsert_doc_urls([
                    {
                        "api_service_id": api_id,
                        "url": url,
                        "status": "discovered",
                        "priority": 1.0
                    } for url in filtered_urls[:100]  # Limit to first 100 URLs
                ])
            except Exception as e:
                print(f"Failed to store URLs for {api_name}: {e}")
        
        return IndexResult(
            api_id=api_id,
            api_name=api_name,
            status="success",
            url_count=final_count
        )
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error indexing {api_name}: {error_msg}")
        return IndexResult(
            api_id=api_id,
            api_name=api_name,
            status="failed",
            url_count=0,
            error=error_msg
        )

async def _bulk_index_worker(apis: List[Dict[str, Any]], force: bool, max_concurrent: int):
    """Background worker for bulk indexing APIs."""
    global _indexing_state
    
    _indexing_state["status"] = "running"
    _indexing_state["started_at"] = datetime.utcnow().isoformat() + "Z"
    _indexing_state["progress"]["total"] = len(apis)
    _indexing_state["results"] = {"success": 0, "failed": 0, "skipped": 0}
    _indexing_state["errors"] = []
    
    try:
        # Process APIs with concurrency limit
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def _process_with_semaphore(api):
            async with semaphore:
                result = await _index_single_api(api, force)
                
                # Update progress
                _indexing_state["progress"]["current"] += 1
                _indexing_state["progress"]["processed"].append({
                    "api_name": result.api_name,
                    "status": result.status,
                    "url_count": result.url_count,
                    "error": result.error
                })
                
                # Update results
                _indexing_state["results"][result.status] += 1
                if result.error:
                    _indexing_state["errors"].append({
                        "api_name": result.api_name,
                        "error": result.error
                    })
                
                print(f"✅ Indexed {result.api_name}: {result.status} ({result.url_count} URLs)")
                return result
        
        # Execute all tasks
        tasks = [_process_with_semaphore(api) for api in apis]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        _indexing_state["status"] = "completed"
        _indexing_state["completed_at"] = datetime.utcnow().isoformat() + "Z"
        
        total_success = _indexing_state["results"]["success"]
        total_apis = len(apis)
        print(f"🎉 Bulk indexing completed: {total_success}/{total_apis} APIs successfully indexed")
        
    except Exception as e:
        _indexing_state["status"] = "failed"
        _indexing_state["errors"].append({"general": str(e)})
        print(f"❌ Bulk indexing failed: {e}")

@router.post("/start")
async def start_bulk_indexing(
    request: Request, 
    body: BulkIndexRequest,
    background_tasks: BackgroundTasks
):
    """Start bulk indexing of all API documentation."""
    require_admin(request)
    
    if _indexing_state["status"] == "running":
        raise HTTPException(status_code=409, detail="Bulk indexing already in progress")
    
    # Get APIs to index
    all_apis = list_api_services()
    
    # Filter by provider names if specified
    if body.include_providers:
        provider_names = set(body.include_providers)
        filtered_apis = [api for api in all_apis if api.get("name") in provider_names]
    else:
        filtered_apis = all_apis
    
    if not filtered_apis:
        raise HTTPException(status_code=400, detail="No APIs found to index")
    
    # Reset state
    _indexing_state["progress"]["current"] = 0
    _indexing_state["progress"]["processed"] = []
    
    # Start background task
    background_tasks.add_task(
        _bulk_index_worker, 
        filtered_apis, 
        body.force_reindex, 
        body.max_concurrent
    )
    
    return {
        "message": "Bulk indexing started",
        "total_apis": len(filtered_apis),
        "status": "running"
    }

@router.get("/status")
async def get_indexing_status(request: Request):
    """Get current bulk indexing status and progress."""
    require_admin(request)
    return _indexing_state

@router.post("/stop")
async def stop_bulk_indexing(request: Request):
    """Stop current bulk indexing process."""
    require_admin(request)
    
    if _indexing_state["status"] != "running":
        raise HTTPException(status_code=400, detail="No bulk indexing in progress")
    
    # Note: This is a simple implementation - in production you'd want proper cancellation
    _indexing_state["status"] = "stopped"
    _indexing_state["completed_at"] = datetime.utcnow().isoformat() + "Z"
    
    return {"message": "Bulk indexing stopped"}

@router.get("/results")
async def get_indexing_results(request: Request):
    """Get detailed results from the last bulk indexing run."""
    require_admin(request)
    
    return {
        "status": _indexing_state["status"],
        "results": _indexing_state["results"],
        "processed": _indexing_state["progress"]["processed"][-20:],  # Last 20 results
        "errors": _indexing_state["errors"][-10:],  # Last 10 errors
        "timing": {
            "started_at": _indexing_state["started_at"],
            "completed_at": _indexing_state["completed_at"]
        }
    }