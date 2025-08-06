"""
API Indexing Cache Routes
=========================

REST API endpoints for the cost-sharing cached API indexing system.
Provides admin pre-indexing and user fractional-cost access to cached APIs.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import logging
from datetime import datetime

from app.core.api_indexing_cache import get_cache_service, APIIndexingCacheService
from app.core.billing_observability import get_billing_service
from app.knowledge.api_gallery import get_api_gallery

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gallery/cache", tags=["api-indexing-cache"])

# Request/Response Models

class AdminPreIndexRequest(BaseModel):
    api_names: List[str]
    force_reindex: bool = False

class AdminPreIndexResponse(BaseModel):
    message: str
    batch_id: str
    apis_queued: List[str]
    estimated_cost: float

class UserAccessRequest(BaseModel):
    api_name: str
    simulate_indexing: bool = True

class UserAccessResponse(BaseModel):
    success: bool
    message: str
    access_token: Optional[str] = None
    cost_paid: Optional[float] = None
    expires_at: Optional[str] = None

class CacheStatusResponse(BaseModel):
    api_name: str
    status: str
    fractional_cost: Optional[float] = None
    original_cost: Optional[float] = None
    cost_savings: Optional[float] = None
    urls_indexed: Optional[int] = None
    usage_count: Optional[int] = None
    created_at: Optional[str] = None

# Admin Routes (for pre-indexing APIs)

@router.post("/admin/pre-index", response_model=AdminPreIndexResponse)
async def admin_pre_index_apis(
    request: AdminPreIndexRequest,
    background_tasks: BackgroundTasks,
    cache_service: APIIndexingCacheService = Depends(get_cache_service)
):
    """
    Admin endpoint to pre-index APIs for cost-sharing cache.
    This does the expensive indexing once so users can access cached results.
    """
    try:
        gallery = get_api_gallery()
        batch_id = f"admin_pre_index_{int(datetime.now().timestamp())}"
        
        # Validate API names
        invalid_apis = []
        valid_apis = []
        
        for api_name in request.api_names:
            api = gallery.get_api(api_name)
            if not api:
                invalid_apis.append(api_name)
            else:
                valid_apis.append(api_name)
        
        if invalid_apis:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid API names: {invalid_apis}"
            )
        
        if not valid_apis:
            raise HTTPException(
                status_code=400,
                detail="No valid APIs to pre-index"
            )
        
        # Estimate cost (this would be more accurate with actual token prediction)
        estimated_cost = len(valid_apis) * 5.0  # $5 average per API
        
        # Start pre-indexing in background
        background_tasks.add_task(
            _admin_pre_index_batch,
            cache_service,
            valid_apis,
            request.force_reindex,
            batch_id
        )
        
        logger.info(f"🚀 Started admin pre-indexing batch: {batch_id}")
        logger.info(f"📋 APIs queued: {valid_apis}")
        
        return AdminPreIndexResponse(
            message=f"Started pre-indexing {len(valid_apis)} APIs",
            batch_id=batch_id,
            apis_queued=valid_apis,
            estimated_cost=estimated_cost
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Admin pre-indexing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Pre-indexing failed: {str(e)}")

@router.get("/admin/overview")
async def get_admin_cache_overview(
    cache_service: APIIndexingCacheService = Depends(get_cache_service)
) -> Dict[str, Any]:
    """
    Get admin overview of cached APIs and cost recovery
    """
    try:
        return cache_service.get_admin_cache_overview()
    except Exception as e:
        logger.error(f"❌ Failed to get admin overview: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get overview: {str(e)}")

@router.get("/admin/status/{api_name}")
async def get_cache_status_admin(
    api_name: str,
    cache_service: APIIndexingCacheService = Depends(get_cache_service)
) -> CacheStatusResponse:
    """
    Get detailed cache status for a specific API (admin view)
    """
    try:
        status = cache_service.get_cache_status(api_name)
        return CacheStatusResponse(**status)
    except Exception as e:
        logger.error(f"❌ Failed to get cache status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache status: {str(e)}")

# User Routes (for accessing cached APIs)

@router.post("/user/request-access", response_model=UserAccessResponse)
async def user_request_api_access(
    request: UserAccessRequest,
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query(..., description="User ID"),
    cache_service: APIIndexingCacheService = Depends(get_cache_service)
):
    """
    User requests access to a cached API. 
    Pays fractional cost for immediate access to pre-indexed data.
    """
    try:
        success, user_access, message = await cache_service.user_request_api_access(
            tenant_id=tenant_id,
            user_id=user_id,
            api_name=request.api_name,
            simulate_indexing=request.simulate_indexing
        )
        
        if success and user_access:
            return UserAccessResponse(
                success=True,
                message=message,
                access_token=user_access.access_token,
                cost_paid=float(user_access.cost_paid),
                expires_at=user_access.expires_at.isoformat()
            )
        else:
            return UserAccessResponse(
                success=False,
                message=message
            )
            
    except Exception as e:
        logger.error(f"❌ User access request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Access request failed: {str(e)}")

@router.get("/user/access-summary")
async def get_user_access_summary(
    tenant_id: str = Query(..., description="Tenant ID"),
    cache_service: APIIndexingCacheService = Depends(get_cache_service)
) -> Dict[str, Any]:
    """
    Get summary of tenant's API access and costs
    """
    try:
        return cache_service.get_tenant_api_access_summary(tenant_id)
    except Exception as e:
        logger.error(f"❌ Failed to get access summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get access summary: {str(e)}")

@router.get("/user/knowledge-base/{api_name}")
async def get_cached_knowledge_base(
    api_name: str,
    access_token: str = Query(..., description="Access token"),
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query(..., description="User ID"),
    cache_service: APIIndexingCacheService = Depends(get_cache_service)
):
    """
    Get access to the cached knowledge base for an API.
    Requires valid access token from previous request.
    """
    try:
        knowledge_base = await cache_service.get_user_api_knowledge_base(
            tenant_id=tenant_id,
            user_id=user_id,
            api_name=api_name,
            access_token=access_token
        )
        
        if knowledge_base:
            return {
                "success": True,
                "message": f"Knowledge base access granted for {api_name}",
                "api_name": api_name,
                "knowledge_base_available": True,
                # In real implementation, you'd return search/query endpoints
                "search_endpoint": f"/api/gallery/cache/user/search/{api_name}",
                "query_endpoint": f"/api/gallery/cache/user/query/{api_name}"
            }
        else:
            raise HTTPException(
                status_code=403,
                detail="Access denied. Invalid token or expired access."
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Knowledge base access failed: {e}")
        raise HTTPException(status_code=500, detail=f"Knowledge base access failed: {str(e)}")

# Public Routes (for checking availability)

@router.get("/status/{api_name}", response_model=CacheStatusResponse)
async def get_api_cache_status(
    api_name: str,
    cache_service: APIIndexingCacheService = Depends(get_cache_service)
):
    """
    Get cache status for an API (public endpoint for users to check availability)
    """
    try:
        status = cache_service.get_cache_status(api_name)
        
        # Filter sensitive admin info for public endpoint
        public_status = {
            "api_name": status["api_name"],
            "status": status["status"],
            "fractional_cost": status.get("fractional_cost"),
            "urls_indexed": status.get("urls_indexed"),
            "usage_count": status.get("usage_count")
        }
        
        # Only show cost savings if cached
        if status["status"] == "cached" and status.get("original_cost"):
            public_status["cost_savings"] = status["cost_savings"]
        
        return CacheStatusResponse(**public_status)
        
    except Exception as e:
        logger.error(f"❌ Failed to get public cache status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache status: {str(e)}")

@router.get("/available-apis")
async def get_available_cached_apis(
    cache_service: APIIndexingCacheService = Depends(get_cache_service)
) -> Dict[str, Any]:
    """
    Get list of APIs available in cache for user access
    """
    try:
        overview = cache_service.get_admin_cache_overview()
        
        # Filter to only cached APIs and remove admin-sensitive info
        available_apis = []
        for api in overview["cached_apis"]:
            if api["status"] == "cached":
                available_apis.append({
                    "api_name": api["api_name"],
                    "display_name": api["display_name"],
                    "fractional_cost": api["fractional_cost"],
                    "urls_indexed": api["urls_indexed"],
                    "usage_count": api["usage_count"]
                })
        
        return {
            "total_available": len(available_apis),
            "apis": available_apis,
            "message": f"{len(available_apis)} APIs available for immediate access"
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get available APIs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get available APIs: {str(e)}")

# Background task functions

async def _admin_pre_index_batch(
    cache_service: APIIndexingCacheService,
    api_names: List[str],
    force_reindex: bool,
    batch_id: str
):
    """Background task to pre-index a batch of APIs"""
    logger.info(f"🔄 Starting admin pre-indexing batch: {batch_id}")
    
    success_count = 0
    failed_count = 0
    
    for api_name in api_names:
        try:
            logger.info(f"📚 Pre-indexing {api_name}...")
            success, cache_entry = await cache_service.admin_pre_index_api(
                api_name, force_reindex
            )
            
            if success:
                success_count += 1
                logger.info(f"✅ Pre-indexed {api_name} successfully")
            else:
                failed_count += 1
                logger.error(f"❌ Failed to pre-index {api_name}")
                
        except Exception as e:
            failed_count += 1
            logger.error(f"❌ Exception pre-indexing {api_name}: {e}")
    
    # Log batch completion for admin tracking
    billing_service = get_billing_service()
    await billing_service.track_admin_consumption(
        operation_type=f"pre_index_batch_complete",
        input_tokens=0,
        output_tokens=0,
        model_used="batch_operation",
        agent_name="api_indexing_cache",
        agent_type="admin_batch_indexing",
        success=success_count > 0,
        batch_id=batch_id,
        api_endpoint="/api/gallery/cache/admin/pre-index"
    )
    
    logger.info(f"🎉 Batch {batch_id} complete: {success_count} success, {failed_count} failed")

# Health check
@router.get("/health")
async def cache_health_check():
    """Health check for API indexing cache system"""
    try:
        cache_service = get_cache_service()
        overview = cache_service.get_admin_cache_overview()
        
        return {
            "status": "healthy",
            "message": "API Indexing Cache system operational",
            "cached_apis": overview["total_cached_apis"],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Cache health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

# Export router
__all__ = ["router"]