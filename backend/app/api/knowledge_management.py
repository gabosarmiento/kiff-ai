"""
Knowledge Management API Endpoints
=================================

REST API endpoints for the Knowledge Management Engine.
Provides real-time visibility into token consumption, processing time, and vectorization progress.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import json
import asyncio
import logging

from app.knowledge.engine.knowledge_management_engine import (
    get_knowledge_engine,
    DomainConfig,
    ProcessingMetrics
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge-management"])


# Request/Response Models
class DomainConfigRequest(BaseModel):
    name: str
    display_name: str
    description: str
    sources: List[str]
    priority: int = 1
    keywords: List[str] = []


class KnowledgeExtractionRequest(BaseModel):
    domain_config: DomainConfigRequest
    background: bool = False


class CrossDomainSearchRequest(BaseModel):
    query: str
    domains: List[str]
    limit: int = 10


# API Endpoints

@router.get("/domains")
async def get_available_domains():
    """Get list of available knowledge domains with status"""
    try:
        engine = get_knowledge_engine()
        domains = engine.get_available_domains()
        
        return {
            "status": "success",
            "domains": domains,
            "total_domains": len(domains)
        }
    except Exception as e:
        logger.error(f"❌ Failed to get domains: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def get_processing_metrics(domain: Optional[str] = None):
    """Get real-time processing metrics for frontend visibility"""
    try:
        engine = get_knowledge_engine()
        metrics = engine.get_processing_metrics(domain)
        
        return {
            "status": "success",
            "metrics": metrics,
            "timestamp": asyncio.get_event_loop().time()
        }
    except Exception as e:
        logger.error(f"❌ Failed to get metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract")
async def create_knowledge_base(
    request: KnowledgeExtractionRequest,
    background_tasks: BackgroundTasks
):
    """Create knowledge base for a domain (foreground or background)"""
    try:
        engine = get_knowledge_engine()
        
        # Convert request to DomainConfig
        domain_config = DomainConfig(
            name=request.domain_config.name,
            display_name=request.domain_config.display_name,
            description=request.domain_config.description,
            sources=request.domain_config.sources,
            priority=request.domain_config.priority,
            keywords=request.domain_config.keywords
        )
        
        if request.background:
            # Start background extraction
            task_id = await engine.start_background_extraction(domain_config)
            
            return {
                "status": "started",
                "task_id": task_id,
                "domain": domain_config.name,
                "message": f"Background extraction started for {domain_config.display_name}"
            }
        else:
            # Foreground extraction with real-time metrics
            knowledge_base, metrics = await engine.create_domain_knowledge_base(domain_config)
            
            if knowledge_base:
                return {
                    "status": "success",
                    "domain": domain_config.name,
                    "metrics": {
                        "urls_processed": metrics.urls_processed,
                        "chunks_created": metrics.chunks_created,
                        "tokens_used": metrics.tokens_used,
                        "processing_time_seconds": metrics.processing_time_seconds,
                        "vectorization_time": metrics.vectorization_time,
                        "embedding_count": metrics.embedding_count
                    },
                    "message": f"Knowledge base created for {domain_config.display_name}"
                }
            else:
                return {
                    "status": "failed",
                    "domain": domain_config.name,
                    "error": metrics.error_message or "Unknown error",
                    "metrics": {
                        "processing_time_seconds": metrics.processing_time_seconds,
                        "tokens_used": metrics.tokens_used
                    }
                }
                
    except Exception as e:
        logger.error(f"❌ Knowledge extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/extract/status/{task_id}")
async def get_extraction_status(task_id: str):
    """Get status of background extraction task"""
    try:
        engine = get_knowledge_engine()
        status = engine.get_extraction_status(task_id)
        
        return {
            "status": "success",
            "task_id": task_id,
            "extraction_status": status
        }
    except Exception as e:
        logger.error(f"❌ Failed to get extraction status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_knowledge_bases(request: CrossDomainSearchRequest):
    """Search across knowledge bases"""
    try:
        engine = get_knowledge_engine()
        
        # Create cross-domain tools
        cross_tools = await engine.create_cross_domain_tools(request.domains)
        
        if not cross_tools:
            raise HTTPException(
                status_code=404, 
                detail=f"No knowledge bases available for domains: {request.domains}"
            )
        
        # Search across domains
        if len(request.domains) == 1:
            results = await cross_tools.search_domain_knowledge(
                request.domains[0], 
                request.query, 
                request.limit
            )
        else:
            results = await cross_tools.search_all_domains(
                request.query, 
                request.limit
            )
        
        return {
            "status": "success",
            "query": request.query,
            "domains_searched": request.domains,
            "results": results,
            "result_count": len(results)
        }
        
    except Exception as e:
        logger.error(f"❌ Knowledge search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stream/metrics/{domain}")
async def stream_processing_metrics(domain: str):
    """Stream real-time processing metrics for a domain"""
    
    async def generate_metrics():
        """Generate real-time metrics stream"""
        engine = get_knowledge_engine()
        
        while True:
            try:
                metrics = engine.get_processing_metrics(domain)
                
                if metrics:
                    yield f"data: {json.dumps(metrics)}\n\n"
                    
                    # Stop streaming if processing is complete or failed
                    if metrics.get('status') in ['completed', 'failed']:
                        break
                else:
                    yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
                    break
                
                await asyncio.sleep(1)  # Update every second
                
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                break
    
    return StreamingResponse(
        generate_metrics(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/domains/predefined")
async def create_predefined_domain(domain_type: str):
    """Create knowledge base for predefined domain types"""
    
    # Predefined domain configurations
    predefined_domains = {
        "fastapi": DomainConfig(
            name="fastapi",
            display_name="FastAPI Framework",
            description="FastAPI web framework documentation and tutorials",
            sources=[
                "https://fastapi.tiangolo.com/",
                "https://fastapi.tiangolo.com/tutorial/",
                "https://fastapi.tiangolo.com/advanced/",
                "https://fastapi.tiangolo.com/deployment/"
            ],
            keywords=["fastapi", "api", "web", "framework", "python"]
        ),
        
        "react": DomainConfig(
            name="react",
            display_name="React Framework",
            description="React JavaScript library documentation and guides",
            sources=[
                "https://react.dev/learn",
                "https://react.dev/reference",
                "https://react.dev/blog"
            ],
            keywords=["react", "javascript", "frontend", "components"]
        ),
        
        "binance": DomainConfig(
            name="binance",
            display_name="Binance Trading API",
            description="Binance cryptocurrency trading API documentation",
            sources=[
                "https://binance-docs.github.io/apidocs/spot/en/",
                "https://binance-docs.github.io/apidocs/futures/en/",
                "https://binance-docs.github.io/apidocs/margin/en/"
            ],
            keywords=["binance", "trading", "crypto", "api", "cryptocurrency"]
        ),
        
        "agno": DomainConfig(
            name="agno",
            display_name="AGNO Framework",
            description="AGNO AI agent framework documentation",
            sources=[
                "https://docs.agno.ai/introduction",
                "https://docs.agno.ai/agents",
                "https://docs.agno.ai/knowledge",
                "https://docs.agno.ai/tools"
            ],
            keywords=["agno", "ai", "agents", "framework", "llm"]
        )
    }
    
    if domain_type not in predefined_domains:
        raise HTTPException(
            status_code=404, 
            detail=f"Predefined domain '{domain_type}' not found. Available: {list(predefined_domains.keys())}"
        )
    
    try:
        engine = get_knowledge_engine()
        domain_config = predefined_domains[domain_type]
        
        # Start background extraction
        task_id = await engine.start_background_extraction(domain_config)
        
        return {
            "status": "started",
            "task_id": task_id,
            "domain": domain_config.name,
            "display_name": domain_config.display_name,
            "message": f"Started creating knowledge base for {domain_config.display_name}"
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to create predefined domain {domain_type}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        engine = get_knowledge_engine()
        
        return {
            "status": "healthy",
            "service": "knowledge-management-engine",
            "available_domains": len(engine.get_available_domains()),
            "active_extractions": len(engine.active_extractions)
        }
    except Exception as e:
        logger.error(f"❌ Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket endpoint for real-time updates
@router.websocket("/ws/metrics")
async def websocket_metrics(websocket):
    """WebSocket endpoint for real-time metrics updates"""
    await websocket.accept()
    
    try:
        engine = get_knowledge_engine()
        
        while True:
            # Send all current metrics
            all_metrics = engine.get_processing_metrics()
            
            await websocket.send_json({
                "type": "metrics_update",
                "data": all_metrics,
                "timestamp": asyncio.get_event_loop().time()
            })
            
            await asyncio.sleep(2)  # Update every 2 seconds
            
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")
        await websocket.close()


# Export router
__all__ = ["router"]
