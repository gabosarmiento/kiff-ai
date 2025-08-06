"""
Modular RAG API Routes
=====================

API endpoints for the modular Agentic RAG system.
Provides easy "Lego" swapping and management of RAG implementations.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

from app.services.modular_rag_service import (
    get_rag_service,
    switch_global_rag,
    search_rag,
    list_available_rags
)
from app.knowledge.interfaces.agentic_rag_interface import DomainConfig, RAGMetrics
from app.middleware.tenant_middleware import get_current_tenant_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag", tags=["modular-rag"])


class DomainConfigRequest(BaseModel):
    """Request model for domain configuration"""
    name: str
    display_name: str
    description: str
    sources: List[str]
    priority: int = 1
    extraction_strategy: str = "agentic_pipeline"
    keywords: List[str] = []


class SearchRequest(BaseModel):
    """Request model for knowledge search"""
    domain: str
    query: str
    limit: int = 5


class SwitchImplementationRequest(BaseModel):
    """Request model for switching RAG implementations"""
    implementation: str
    kwargs: Dict[str, Any] = {}


@router.get("/implementations")
async def list_rag_implementations():
    """List all available RAG implementations"""
    try:
        implementations = list_available_rags()
        
        return {
            "implementations": implementations,
            "total": len(implementations),
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to list RAG implementations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/current")
async def get_current_implementation():
    """Get information about the current RAG implementation"""
    try:
        service = await get_rag_service()
        info = service.get_current_implementation_info()
        
        return {
            "current_implementation": info,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get current implementation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/switch")
async def switch_rag_implementation(request: SwitchImplementationRequest):
    """Switch to a different RAG implementation (the "Lego" swap)"""
    try:
        logger.info(f"🔄 Switching RAG implementation to: {request.implementation}")
        
        success = await switch_global_rag(request.implementation, **request.kwargs)
        
        if success:
            service = await get_rag_service()
            new_info = service.get_current_implementation_info()
            
            return {
                "status": "success",
                "message": f"Successfully switched to {request.implementation}",
                "new_implementation": new_info
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to switch RAG implementation")
            
    except Exception as e:
        logger.error(f"❌ Failed to switch RAG implementation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process-domain")
async def process_domain(request: DomainConfigRequest, background_tasks: BackgroundTasks):
    """Process a domain through the current RAG implementation"""
    try:
        # Convert request to DomainConfig
        domain_config = DomainConfig(
            name=request.name,
            display_name=request.display_name,
            description=request.description,
            sources=request.sources,
            priority=request.priority,
            extraction_strategy=request.extraction_strategy,
            keywords=request.keywords
        )
        
        # Stream processing metrics
        async def process_stream():
            try:
                service = await get_rag_service()
                
                async for metrics in service.process_domain(domain_config):
                    metrics_dict = metrics.to_dict()
                    yield f"data: {json.dumps(metrics_dict)}\n\n"
                
                # Send completion event
                completion = {
                    "type": "completion",
                    "domain": request.name,
                    "status": "completed",
                    "timestamp": metrics_dict.get("end_time")
                }
                yield f"data: {json.dumps(completion)}\n\n"
                
            except Exception as e:
                error_event = {
                    "type": "error",
                    "domain": request.name,
                    "error": str(e),
                    "timestamp": asyncio.get_event_loop().time()
                }
                yield f"data: {json.dumps(error_event)}\n\n"
        
        return StreamingResponse(
            process_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to process domain: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_knowledge(request: SearchRequest):
    """Search knowledge using the current RAG implementation"""
    try:
        results = await search_rag(request.domain, request.query, request.limit)
        
        # Convert ProcessedChunk objects to dictionaries
        results_dict = []
        for chunk in results:
            chunk_dict = {
                "content": chunk.content,
                "metadata": chunk.metadata,
                "quality_score": chunk.quality_score,
                "chunk_type": chunk.chunk_type,
                "source_url": chunk.source_url,
                "domain": chunk.domain
            }
            results_dict.append(chunk_dict)
        
        return {
            "results": results_dict,
            "total": len(results_dict),
            "domain": request.domain,
            "query": request.query,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to search knowledge: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def get_rag_metrics(domain: Optional[str] = Query(None, description="Optional domain filter")):
    """Get current RAG processing metrics"""
    try:
        service = await get_rag_service()
        metrics = await service.get_current_metrics(domain)
        
        # Convert RAGMetrics objects to dictionaries
        metrics_dict = {}
        for pipeline_id, metric in metrics.items():
            metrics_dict[pipeline_id] = metric.to_dict()
        
        return {
            "metrics": metrics_dict,
            "total_pipelines": len(metrics_dict),
            "domain_filter": domain,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get RAG metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def rag_health_check():
    """Get health status of the RAG system"""
    try:
        service = await get_rag_service()
        health = await service.health_check()
        
        return {
            "health": health,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"❌ RAG health check failed: {e}")
        return {
            "health": {
                "status": "unhealthy",
                "error": str(e),
                "service": "Modular RAG Service"
            },
            "status": "error"
        }


@router.post("/cleanup")
async def cleanup_rag():
    """Clean up RAG resources"""
    try:
        service = await get_rag_service()
        success = await service.cleanup()
        
        if success:
            return {
                "message": "RAG cleanup completed successfully",
                "status": "success"
            }
        else:
            raise HTTPException(status_code=500, detail="RAG cleanup failed")
            
    except Exception as e:
        logger.error(f"❌ Failed to cleanup RAG: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Example domain configurations for testing
@router.get("/example-domains")
async def get_example_domains():
    """Get example domain configurations for testing"""
    examples = [
        {
            "name": "fastapi",
            "display_name": "FastAPI Framework",
            "description": "FastAPI web framework documentation",
            "sources": [
                "https://fastapi.tiangolo.com/",
                "https://fastapi.tiangolo.com/tutorial/",
                "https://fastapi.tiangolo.com/advanced/"
            ],
            "priority": 1,
            "extraction_strategy": "agentic_pipeline",
            "keywords": ["fastapi", "api", "web", "framework", "python"]
        },
        {
            "name": "openai",
            "display_name": "OpenAI API",
            "description": "OpenAI API documentation and guides",
            "sources": [
                "https://platform.openai.com/docs/",
                "https://platform.openai.com/docs/api-reference",
                "https://platform.openai.com/docs/guides"
            ],
            "priority": 1,
            "extraction_strategy": "agentic_pipeline",
            "keywords": ["openai", "api", "ai", "gpt", "llm"]
        },
        {
            "name": "stripe",
            "display_name": "Stripe Payments",
            "description": "Stripe payment processing API documentation",
            "sources": [
                "https://stripe.com/docs/",
                "https://stripe.com/docs/api",
                "https://stripe.com/docs/payments"
            ],
            "priority": 1,
            "extraction_strategy": "agentic_pipeline",
            "keywords": ["stripe", "payments", "api", "billing", "subscriptions"]
        }
    ]
    
    return {
        "examples": examples,
        "total": len(examples),
        "status": "success"
    }
