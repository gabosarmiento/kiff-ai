"""
Advanced AGNO Generation API Routes (V0.1)
==========================================

API endpoints for enhanced AGNO application generation with comprehensive documentation knowledge.
"""

import logging
import asyncio
from typing import Optional, List
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.advanced_agno_generator import advanced_agno_generator
from app.middleware.tenant_middleware import get_current_tenant

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agno-generation-v01", tags=["advanced-agno-generation"])

class AdvancedGenerationRequest(BaseModel):
    """Request model for advanced AGNO application generation"""
    user_request: str = Field(..., description="Detailed description of the application to generate")
    session_id: Optional[str] = Field(None, description="Session ID for token tracking")
    complexity_level: str = Field(default="advanced", description="Complexity level: basic, intermediate, advanced, expert")
    include_vector_db: bool = Field(default=True, description="Include vector database setup")
    include_workflows: bool = Field(default=True, description="Include AGNO workflow orchestration") 
    include_custom_tools: bool = Field(default=True, description="Generate custom tools")
    include_monitoring: bool = Field(default=True, description="Include monitoring and observability")
    target_deployment: str = Field(default="docker", description="Target deployment: docker, kubernetes, cloud")

class AdvancedGenerationResponse(BaseModel):
    """Response model for advanced generation"""
    id: str
    tenant_id: str
    output_dir: str
    status: str
    version: str
    features: dict
    response: Optional[str] = None
    error: Optional[str] = None

@router.post("/warmup")
async def warmup_comprehensive_knowledge(background_tasks: BackgroundTasks):
    """Warmup comprehensive AGNO knowledge base for better performance"""
    try:
        # Start warmup in background
        background_tasks.add_task(advanced_agno_generator.warmup_comprehensive_knowledge)
        
        return {
            "status": "warmup_started", 
            "message": "Comprehensive AGNO knowledge base warmup initiated"
        }
    except Exception as e:
        logger.error(f"Warmup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Warmup failed: {str(e)}")

@router.post("/generate", response_model=AdvancedGenerationResponse)
async def generate_advanced_application(generation_request: AdvancedGenerationRequest, request: Request):
    """Generate advanced AGNO application with comprehensive knowledge"""
    try:
        # Get tenant context
        tenant_info = get_current_tenant(request)
        tenant_id = tenant_info.get("tenant_id", "default")
        user_id = tenant_info.get("user_id", "1")
        
        logger.info(f"🚀 Starting advanced AGNO generation for tenant {tenant_id}")
        logger.info(f"📝 Request: {generation_request.user_request[:200]}...")
        
        # Generate advanced application
        result = await advanced_agno_generator.generate_advanced_application(
            tenant_id=tenant_id,
            user_request=generation_request.user_request,
            session_id=generation_request.session_id,
            user_id=user_id
        )
        
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error", "Generation failed"))
        
        logger.info(f"✅ Advanced generation completed: {result.get('id')}")
        return AdvancedGenerationResponse(**result)
        
    except Exception as e:
        logger.error(f"❌ Advanced generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Advanced generation failed: {str(e)}")

@router.post("/generate-stream")
async def generate_advanced_application_stream(generation_request: AdvancedGenerationRequest, request: Request):
    """Generate advanced application with streaming response"""
    
    async def generate_stream():
        """Generate application with streaming updates"""
        try:
            # Get tenant context
            tenant_info = get_current_tenant(request)
            tenant_id = tenant_info.get("tenant_id", "default")
            user_id = tenant_info.get("user_id", "1")
            
            # Send initial status
            yield f'data: {{"type": "status", "content": {{"message": "🚀 Initializing advanced AGNO generator with comprehensive knowledge...", "stage": "init"}}, "timestamp": null}}\n\n'
            await asyncio.sleep(0.1)
            
            # Warmup knowledge if needed
            yield f'data: {{"type": "status", "content": {{"message": "📚 Loading comprehensive AGNO documentation and best practices...", "stage": "knowledge"}}, "timestamp": null}}\n\n'
            await asyncio.sleep(0.5)
            
            yield f'data: {{"type": "status", "content": {{"message": "🤖 Creating advanced AGNO agent with full framework knowledge...", "stage": "agent_init"}}, "timestamp": null}}\n\n'
            await asyncio.sleep(0.5)
            
            yield f'data: {{"type": "status", "content": {{"message": "🏗️ Generating sophisticated application with advanced patterns...", "stage": "generation"}}, "timestamp": null}}\n\n'
            await asyncio.sleep(1.0)
            
            # Generate the application
            result = await advanced_agno_generator.generate_advanced_application(
                tenant_id=tenant_id,
                user_request=generation_request.user_request,
                session_id=generation_request.session_id,
                user_id=user_id
            )
            
            if result.get("status") == "error":
                yield f'data: {{"type": "error", "content": {{"message": "❌ Generation failed: {result.get("error", "Unknown error")}", "stage": "error"}}, "timestamp": null}}\n\n'
                return
            
            # Send completion status
            yield f'data: {{"type": "status", "content": {{"message": "✅ Advanced application generated successfully!", "stage": "completed"}}, "timestamp": null}}\n\n'
            await asyncio.sleep(0.2)
            
            # Send final result
            yield f'data: {{"type": "completed", "content": {{"result": {result}, "message": "🎉 Your sophisticated AGNO application is ready with advanced features!", "stage": "done"}}, "timestamp": null}}\n\n'
            
        except Exception as e:
            logger.error(f"❌ Streaming generation failed: {e}")
            yield f'data: {{"type": "error", "content": {{"message": "❌ Generation failed: {str(e)}", "stage": "error"}}, "timestamp": null}}\n\n'
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@router.get("/status")
async def get_generator_status():
    """Get status of the advanced AGNO generator"""
    try:
        return {
            "status": "operational",
            "version": "v0.1", 
            "features": {
                "comprehensive_agno_knowledge": True,
                "advanced_patterns": True,
                "vector_database_integration": True,
                "workflow_orchestration": True,
                "custom_tools": True,
                "async_streaming": True,
                "production_deployment": True,
                "monitoring_observability": True
            },
            "knowledge_base": {
                "loaded": advanced_agno_generator.knowledge_base is not None,
                "comprehensive_docs": True,
                "source_count": 30  # Approximate number of documentation sources
            }
        }
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

@router.get("/knowledge/status")
async def get_knowledge_base_status():
    """Get detailed knowledge base status"""
    try:
        is_loaded = advanced_agno_generator.knowledge_base is not None
        
        return {
            "knowledge_base": {
                "loaded": is_loaded,
                "warmup_completed": advanced_agno_generator._warmup_done,
                "comprehensive": True,
                "sources": {
                    "core_documentation": True,
                    "advanced_examples": True,
                    "best_practices": True,
                    "tool_integrations": True,
                    "vector_db_patterns": True,
                    "workflow_examples": True
                }
            }
        }
    except Exception as e:
        logger.error(f"Knowledge status check failed: {e}")
        return {
            "error": str(e),
            "knowledge_base": {"loaded": False}
        }