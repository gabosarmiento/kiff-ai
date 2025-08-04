"""
API Gallery Routes
==================

REST API endpoints for the API Gallery system.
Provides access to curated API documentation collection for indexing and multi-tenant knowledge sharing.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import logging
import asyncio
from datetime import datetime

from app.knowledge.api_gallery import (
    get_api_gallery,
    APIDocumentation,
    APIPriority,
    APICategory
)
from app.knowledge.engine.julia_bff_knowledge_engine import get_julia_bff_engine, DomainConfig
from app.knowledge.url_discovery_service import get_url_discovery_service, URLDiscoveryResult
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gallery", tags=["api-gallery"])


# Response Models
class APIDocumentationResponse(BaseModel):
    name: str
    display_name: str
    description: str
    base_url: str
    documentation_urls: List[str]
    category: str
    priority: str
    tags: List[str]
    last_updated: Optional[str] = None
    indexing_status: str = "pending"


class GalleryStatsResponse(BaseModel):
    total_apis: int
    by_priority: Dict[str, int]
    by_category: Dict[str, int]
    by_status: Dict[str, int]


class URLDiscoveryResponse(BaseModel):
    api_name: str
    display_name: str
    total_urls: int
    documentation_urls: int
    discovery_method: str
    timestamp: str
    error: Optional[str] = None


class ComprehensiveURLDiscoveryResponse(BaseModel):
    timestamp: str
    total_apis: int
    total_documentation_urls: int
    successful_apis: int
    results: Dict[str, URLDiscoveryResponse]


class IndexingRequest(BaseModel):
    api_names: List[str]
    force_reindex: bool = False


# API Endpoints

@router.get("/", response_model=Dict[str, APIDocumentationResponse])
async def get_all_apis():
    """Get all APIs in the gallery"""
    try:
        gallery = get_api_gallery()
        apis = gallery.get_all_apis()
        
        # Convert to response format
        response = {}
        for name, api in apis.items():
            response[name] = APIDocumentationResponse(
                name=api.name,
                display_name=api.display_name,
                description=api.description,
                base_url=api.base_url,
                documentation_urls=api.documentation_urls,
                category=api.category.value,
                priority=api.priority.name.lower(),
                tags=api.tags,
                last_updated=api.last_updated,
                indexing_status=api.indexing_status
            )
        
        logger.info(f"📚 Retrieved {len(response)} APIs from gallery")
        return response
        
    except Exception as e:
        logger.error(f"❌ Failed to get APIs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve APIs: {str(e)}")


@router.get("/stats", response_model=GalleryStatsResponse)
async def get_gallery_stats():
    """Get statistics about the API gallery"""
    try:
        gallery = get_api_gallery()
        stats = gallery.get_gallery_stats()
        
        response = GalleryStatsResponse(
            total_apis=stats["total_apis"],
            by_priority=stats["by_priority"],
            by_category=stats["by_category"],
            by_status=stats["by_status"]
        )
        
        logger.info(f"📊 Retrieved gallery stats: {stats['total_apis']} total APIs")
        return response
        
    except Exception as e:
        logger.error(f"❌ Failed to get gallery stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve gallery stats: {str(e)}")


@router.get("/{api_name}", response_model=APIDocumentationResponse)
async def get_api(api_name: str):
    """Get a specific API by name"""
    try:
        gallery = get_api_gallery()
        api = gallery.get_api(api_name)
        
        if not api:
            raise HTTPException(status_code=404, detail=f"API '{api_name}' not found in gallery")
        
        response = APIDocumentationResponse(
            name=api.name,
            display_name=api.display_name,
            description=api.description,
            base_url=api.base_url,
            documentation_urls=api.documentation_urls,
            category=api.category.value,
            priority=api.priority.name.lower(),
            tags=api.tags,
            last_updated=api.last_updated,
            indexing_status=api.indexing_status
        )
        
        logger.info(f"🎯 Retrieved API: {api.display_name}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get API {api_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve API: {str(e)}")


@router.get("/category/{category}", response_model=Dict[str, APIDocumentationResponse])
async def get_apis_by_category(category: str):
    """Get APIs by category"""
    try:
        # Validate category
        try:
            api_category = APICategory(category)
        except ValueError:
            valid_categories = [cat.value for cat in APICategory]
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid category '{category}'. Valid categories: {valid_categories}"
            )
        
        gallery = get_api_gallery()
        apis = gallery.get_apis_by_category(api_category)
        
        # Convert to response format
        response = {}
        for name, api in apis.items():
            response[name] = APIDocumentationResponse(
                name=api.name,
                display_name=api.display_name,
                description=api.description,
                base_url=api.base_url,
                documentation_urls=api.documentation_urls,
                category=api.category.value,
                priority=api.priority.name.lower(),
                tags=api.tags,
                last_updated=api.last_updated,
                indexing_status=api.indexing_status
            )
        
        logger.info(f"🏷️ Retrieved {len(response)} APIs in category: {category}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get APIs by category {category}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve APIs by category: {str(e)}")


@router.get("/priority/{priority}", response_model=Dict[str, APIDocumentationResponse])
async def get_apis_by_priority(priority: str):
    """Get APIs by priority level"""
    try:
        # Validate priority
        try:
            api_priority = APIPriority[priority.upper()]
        except KeyError:
            valid_priorities = [p.name.lower() for p in APIPriority]
            raise HTTPException(
                status_code=400,
                detail=f"Invalid priority '{priority}'. Valid priorities: {valid_priorities}"
            )
        
        gallery = get_api_gallery()
        apis = gallery.get_apis_by_priority(api_priority)
        
        # Convert to response format
        response = {}
        for name, api in apis.items():
            response[name] = APIDocumentationResponse(
                name=api.name,
                display_name=api.display_name,
                description=api.description,
                base_url=api.base_url,
                documentation_urls=api.documentation_urls,
                category=api.category.value,
                priority=api.priority.name.lower(),
                tags=api.tags,
                last_updated=api.last_updated,
                indexing_status=api.indexing_status
            )
        
        logger.info(f"⭐ Retrieved {len(response)} APIs with priority: {priority}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get APIs by priority {priority}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve APIs by priority: {str(e)}")


@router.get("/search/", response_model=Dict[str, APIDocumentationResponse])
async def search_apis(q: str = Query(..., description="Search query")):
    """Search APIs by name, description, or tags"""
    try:
        if not q.strip():
            raise HTTPException(status_code=400, detail="Search query cannot be empty")
        
        gallery = get_api_gallery()
        apis = gallery.search_apis(q)
        
        # Convert to response format
        response = {}
        for name, api in apis.items():
            response[name] = APIDocumentationResponse(
                name=api.name,
                display_name=api.display_name,
                description=api.description,
                base_url=api.base_url,
                documentation_urls=api.documentation_urls,
                category=api.category.value,
                priority=api.priority.name.lower(),
                tags=api.tags,
                last_updated=api.last_updated,
                indexing_status=api.indexing_status
            )
        
        logger.info(f"🔍 Found {len(response)} APIs matching query: '{q}'")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to search APIs with query '{q}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search APIs: {str(e)}")


@router.get("/high-priority", response_model=Dict[str, APIDocumentationResponse])
async def get_high_priority_apis():
    """Get critical and high priority APIs (most valuable for indexing)"""
    try:
        gallery = get_api_gallery()
        apis = gallery.get_high_priority_apis()
        
        # Convert to response format
        response = {}
        for name, api in apis.items():
            response[name] = APIDocumentationResponse(
                name=api.name,
                display_name=api.display_name,
                description=api.description,
                base_url=api.base_url,
                documentation_urls=api.documentation_urls,
                category=api.category.value,
                priority=api.priority.name.lower(),
                tags=api.tags,
                last_updated=api.last_updated,
                indexing_status=api.indexing_status
            )
        
        logger.info(f"🌟 Retrieved {len(response)} high-priority APIs")
        return response
        
    except Exception as e:
        logger.error(f"❌ Failed to get high-priority APIs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve high-priority APIs: {str(e)}")


@router.get("/indexing/queue", response_model=List[APIDocumentationResponse])
async def get_indexing_queue():
    """Get APIs that need to be indexed"""
    try:
        gallery = get_api_gallery()
        apis = gallery.get_indexing_queue()
        
        # Convert to response format
        response = []
        for api in apis:
            response.append(APIDocumentationResponse(
                name=api.name,
                display_name=api.display_name,
                description=api.description,
                base_url=api.base_url,
                documentation_urls=api.documentation_urls,
                category=api.category.value,
                priority=api.priority.name.lower(),
                tags=api.tags,
                last_updated=api.last_updated,
                indexing_status=api.indexing_status
            ))
        
        logger.info(f"📋 Retrieved {len(response)} APIs in indexing queue")
        return response
        
    except Exception as e:
        logger.error(f"❌ Failed to get indexing queue: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve indexing queue: {str(e)}")


@router.post("/index")
async def start_indexing(request: IndexingRequest, background_tasks: BackgroundTasks):
    """Start indexing process for selected APIs"""
    try:
        gallery = get_api_gallery()
        
        # Validate API names
        invalid_apis = []
        valid_apis = []
        
        for api_name in request.api_names:
            api = gallery.get_api(api_name)
            if not api:
                invalid_apis.append(api_name)
            else:
                valid_apis.append(api)
        
        if invalid_apis:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid API names: {invalid_apis}"
            )
        
        # Update status to indexing
        for api in valid_apis:
            gallery.update_indexing_status(api.name, "indexing")
        
        # Start actual indexing process
        background_tasks.add_task(index_apis_with_julia_bff, valid_apis, request.force_reindex)
        
        logger.info(f"🚀 Started indexing for {len(valid_apis)} APIs")
        return {
            "message": f"Started indexing for {len(valid_apis)} APIs",
            "apis": [api.name for api in valid_apis],
            "status": "indexing"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to start indexing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start indexing: {str(e)}")


@router.put("/{api_name}/status")
async def update_api_status(api_name: str, status: str):
    """Update the indexing status of an API"""
    try:
        valid_statuses = ["pending", "indexing", "completed", "failed"]
        if status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{status}'. Valid statuses: {valid_statuses}"
            )
        
        gallery = get_api_gallery()
        success = gallery.update_indexing_status(api_name, status)
        
        if not success:
            raise HTTPException(status_code=404, detail=f"API '{api_name}' not found")
        
        logger.info(f"📊 Updated {api_name} status to: {status}")
        return {
            "message": f"Updated {api_name} status to {status}",
            "api_name": api_name,
            "status": status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to update API status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update API status: {str(e)}")


async def index_apis_with_julia_bff(apis: List[APIDocumentation], force_reindex: bool = False, user_id: str = None):
    """Background task to index APIs using Julia BFF Knowledge Engine"""
    gallery = get_api_gallery()
    
    # Import here to avoid circular imports
    from app.models.user_api_selections import UserAPISelection
    from app.core.database import get_db
    from sqlalchemy.orm import Session
    
    try:
        # Get Julia BFF Knowledge Engine
        groq_api_key = getattr(settings, 'GROQ_API_KEY', None)
        if not groq_api_key:
            logger.error("❌ GROQ_API_KEY not found - cannot initialize knowledge engine")
            for api in apis:
                gallery.update_indexing_status(api.name, "failed")
            return
        
        knowledge_engine = get_julia_bff_engine(groq_api_key)
        logger.info(f"🚀 Starting indexing for {len(apis)} APIs using Julia BFF Knowledge Engine")
        
        for api in apis:
            try:
                logger.info(f"📚 Indexing API: {api.display_name}")
                
                # Create domain configuration for this API
                domain_config = DomainConfig(
                    name=api.name,
                    display_name=api.display_name,
                    description=api.description,
                    sitemap_url=f"{api.base_url}/sitemap.xml",  # Try standard sitemap location
                    url_prefix=api.base_url,
                    keywords=api.tags,
                    priority=1
                )
                
                # Add documentation URLs to domain config if available
                if api.documentation_urls:
                    logger.info(f"📝 Using {len(api.documentation_urls)} configured documentation URLs for {api.display_name}")
                    # Add documentation_urls to domain_config so Julia BFF uses them
                    domain_config.documentation_urls = api.documentation_urls
                    for url in api.documentation_urls:
                        logger.info(f"📄 Will process: {url}")
                else:
                    logger.info(f"🔍 Using sitemap extraction for {api.display_name}")
                
                # Use Julia BFF Knowledge Engine (it will automatically use documentation_urls if present)
                await knowledge_engine.create_domain_knowledge_base(domain_config)
                
                # Update status to completed
                gallery.update_indexing_status(api.name, "completed")
                logger.info(f"✅ Successfully indexed {api.display_name}")
                
            except Exception as e:
                logger.error(f"❌ Failed to index {api.display_name}: {e}")
                gallery.update_indexing_status(api.name, "failed")
                continue
        
        logger.info(f"🎉 Completed indexing process for {len(apis)} APIs")
        
    except Exception as e:
        logger.error(f"❌ Critical error in indexing process: {e}")
        # Mark all APIs as failed
        for api in apis:
            gallery.update_indexing_status(api.name, "failed")


# Removed index_api_from_urls - now using unified approach in create_domain_knowledge_base


@router.get("/discover-urls", response_model=ComprehensiveURLDiscoveryResponse)
async def discover_comprehensive_urls(
    background_tasks: BackgroundTasks,
    api_name: Optional[str] = Query(None, description="Discover URLs for specific API only")
):
    """
    Discover comprehensive documentation URLs for APIs using AGNO WebsiteReader.
    
    This endpoint uses AGNO's WebsiteReader to crawl API documentation sites and discover
    ALL available documentation URLs, providing realistic counts for indexing expectations.
    
    - **api_name**: Optional - discover URLs for specific API only
    - Returns comprehensive URL counts and discovery details
    """
    try:
        discovery_service = get_url_discovery_service()
        
        if api_name:
            # Discover URLs for specific API
            gallery = get_api_gallery()
            api = gallery.get_api(api_name)
            
            if not api:
                raise HTTPException(status_code=404, detail=f"API '{api_name}' not found")
            
            logger.info(f"🔍 Starting URL discovery for {api.display_name}")
            result = await discovery_service.discover_api_urls(api)
            
            return ComprehensiveURLDiscoveryResponse(
                timestamp=datetime.now().isoformat(),
                total_apis=1,
                total_documentation_urls=result.documentation_urls,
                successful_apis=1 if result.error is None else 0,
                results={
                    api_name: URLDiscoveryResponse(
                        api_name=result.api_name,
                        display_name=result.display_name,
                        total_urls=result.total_urls,
                        documentation_urls=result.documentation_urls,
                        discovery_method=result.discovery_method,
                        timestamp=result.timestamp,
                        error=result.error
                    )
                }
            )
        else:
            # Discover URLs for all APIs
            logger.info("🚀 Starting comprehensive URL discovery for all APIs")
            
            # Run discovery in background for better performance
            results = await discovery_service.discover_all_api_urls()
            
            # Convert results to response format
            response_results = {}
            total_docs = 0
            successful_count = 0
            
            for name, result in results.items():
                response_results[name] = URLDiscoveryResponse(
                    api_name=result.api_name,
                    display_name=result.display_name,
                    total_urls=result.total_urls,
                    documentation_urls=result.documentation_urls,
                    discovery_method=result.discovery_method,
                    timestamp=result.timestamp,
                    error=result.error
                )
                
                if result.error is None:
                    successful_count += 1
                    total_docs += result.documentation_urls
            
            return ComprehensiveURLDiscoveryResponse(
                timestamp=datetime.now().isoformat(),
                total_apis=len(results),
                total_documentation_urls=total_docs,
                successful_apis=successful_count,
                results=response_results
            )
            
    except Exception as e:
        logger.error(f"❌ URL discovery failed: {e}")
        raise HTTPException(status_code=500, detail=f"URL discovery failed: {str(e)}")


# Health check
@router.get("/health")
async def gallery_health():
    """Health check for API Gallery system"""
    try:
        gallery = get_api_gallery()
        stats = gallery.get_gallery_stats()
        
        return {
            "status": "healthy",
            "message": "API Gallery system is operational",
            "total_apis": stats["total_apis"],
            "timestamp": "2025-08-02T04:30:00Z"
        }
        
    except Exception as e:
        logger.error(f"❌ API Gallery health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


# Export router
__all__ = ["router"]
