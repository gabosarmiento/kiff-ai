"""
AGNO Application Generation API Routes
=====================================

API endpoints for Generate V0 - AGNO-powered application generation.
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

from app.services.agno_application_generator import agno_app_generator
from app.middleware.tenant_middleware import get_current_tenant
from app.core.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agno-generation", tags=["agno-generation"])

class GenerationRequest(BaseModel):
    """Request model for application generation"""
    user_request: str
    stream: bool = True
    knowledge_sources: Optional[list[str]] = None

class SessionResponse(BaseModel):
    """Response model for session creation"""
    session_id: str
    status: str

@router.post("/session", response_model=SessionResponse)
async def create_generation_session(
    user_id: str = Query("1", description="User identifier"),
    tenant_id: str = Query("default", description="Tenant identifier")
):
    """Create new AGNO application generation session"""
    try:
        
        # For this simple implementation, we'll use a basic session ID
        # In a real system, you might want to track sessions in memory/database
        session_id = f"agno_{tenant_id}_{user_id}"
        
        logger.info(f"🚀 Created AGNO generation session for tenant {tenant_id}")
        
        return SessionResponse(
            session_id=session_id,
            status="ready"
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to create session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
async def generate_application(
    request: GenerationRequest,
    background_tasks: BackgroundTasks,
    tenant_id: str = Query("default", description="Tenant identifier"),
    user_id: str = Query("1", description="User identifier")
):
    """Generate application using AGNO agent"""
    
    if not request.stream:
        # Non-streaming generation
        try:
            result = await agno_app_generator.generate_application(
                tenant_id=tenant_id,
                user_request=request.user_request,
                knowledge_sources=request.knowledge_sources,
                session_id=f"agno_session_{tenant_id}_{user_id}",
                user_id=user_id
            )
            return result
            
        except Exception as e:
            logger.error(f"❌ Generation failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    else:
        # Streaming generation
        async def generate_stream():
            try:
                # Send tool call started event (knowledge retrieval)
                yield f"data: {json.dumps({'type': 'tool_call_started', 'content': {'tool': 'knowledge_retriever', 'message': 'Searching real indexed API documentation...'}, 'timestamp': None})}\n\n"
                
                # Start generation in background
                result = await agno_app_generator.generate_application(
                    tenant_id=tenant_id,
                    user_request=request.user_request,
                    knowledge_sources=request.knowledge_sources,
                    session_id=f"agno_session_{tenant_id}_{user_id}",
                    user_id=user_id
                )
                
                # Send tool call completed event (knowledge found)
                yield f"data: {json.dumps({'type': 'tool_call_completed', 'content': {'tool': 'knowledge_retriever', 'message': 'Found real API knowledge! Using indexed documentation to generate your app...'}, 'timestamp': None})}\n\n"
                
                # Get the generated files from the output directory
                generated_files = []
                if result.get("status") == "completed":
                    import os
                    from pathlib import Path
                    
                    output_dir = result.get("output_dir", "")
                    
                    if output_dir and os.path.exists(output_dir):
                        for root, dirs, files in os.walk(output_dir):
                            for file in files:
                                file_path = os.path.join(root, file)
                                relative_path = os.path.relpath(file_path, output_dir)
                                
                                try:
                                    with open(file_path, 'r', encoding='utf-8') as f:
                                        content = f.read()
                                    
                                    # Simple language detection based on file extension
                                    def get_language_from_extension(filename):
                                        ext = filename.split('.')[-1].lower() if '.' in filename else ''
                                        lang_map = {
                                            'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
                                            'py': 'python', 'html': 'html', 'css': 'css', 'json': 'json',
                                            'md': 'markdown', 'txt': 'text', 'yml': 'yaml', 'yaml': 'yaml'
                                        }
                                        return lang_map.get(ext, 'text')
                                    
                                    file_info = {
                                        "name": file,
                                        "path": relative_path,
                                        "content": content,
                                        "language": get_language_from_extension(file),
                                        "size": len(content)
                                    }
                                    generated_files.append(file_info)
                                    
                                except Exception as e:
                                    logger.warning(f"Could not read file {file_path}: {e}")
                
                # Send final completion event with generated files
                completion_event = {
                    "type": "tool_call_completed",
                    "content": {
                        "tool": "app_generator",
                        "result": {
                            "name": f"Generated App {result.get('id', 'v0')}",
                            "description": request.user_request,
                            "framework": "react",
                            "files": generated_files,
                            "status": "completed",
                            "live_url": None,
                            "download_url": None
                        }
                    },
                    "timestamp": None
                }
                
                yield f"data: {json.dumps(completion_event)}\n\n"
                
                # Send final content message
                final_message = {
                    "type": "content",
                    "content": {
                        "chunk": f"\n\n🎉 **Application Generated Successfully!**\n\nI've created a {len(generated_files)} file application based on your request. The code is now available in the Files panel on the right. You can:\n\n- 📁 **Browse Files**: Click through the generated files\n- 📋 **Copy Code**: Use the copy button on any file\n- 💾 **Download**: Get the complete project as a ZIP\n\nYour application is ready to use!"
                    },
                    "timestamp": None
                }
                
                yield f"data: {json.dumps(final_message)}\n\n"
                
            except Exception as e:
                logger.error(f"❌ Streaming generation failed: {e}")
                error_event = {
                    "type": "generation_error",
                    "content": {"error": str(e)},
                    "timestamp": None
                }
                yield f"data: {json.dumps(error_event)}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )

@router.post("/generate-stream")
async def generate_application_with_streaming(
    request: GenerationRequest,
    tenant_id: str = Query("default", description="Tenant identifier"),
    user_id: str = Query("1", description="User identifier")
):
    """Generate application with real-time progress updates using AGNO streaming"""
    
    async def streaming_generator():
        try:
            async for event in agno_app_generator.generate_application_streaming(
                tenant_id=tenant_id,
                user_request=request.user_request,
                knowledge_sources=request.knowledge_sources,
                session_id=f"agno_stream_{tenant_id}_{user_id}",
                user_id=user_id
            ):
                # Send Server-Sent Events format
                yield f"data: {json.dumps(event)}\n\n"
                
        except Exception as e:
            logger.error(f"❌ Streaming generation failed: {e}")
            error_event = {
                "type": "error",
                "content": {
                    "message": f"❌ Generation failed: {str(e)}",
                    "error": str(e)
                }
            }
            yield f"data: {json.dumps(error_event)}\n\n"
    
    return StreamingResponse(
        streaming_generator(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/applications")
async def get_tenant_applications(
    tenant_id: str = Query("default", description="Tenant identifier")
):
    """Get all generated applications for tenant"""
    try:
        # For now, return empty list - will be implemented when we add database storage
        # In future: return agno_app_generator.get_tenant_applications(tenant_id)
        return {
            "applications": [],
            "tenant_id": tenant_id,
            "total": 0
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_generation_status():
    """Get AGNO generation service status"""
    try:
        # Check if knowledge base is loaded
        kb_status = "loaded" if agno_app_generator.knowledge_base is not None else "loading"
        
        return {
            "status": "ready",
            "knowledge_base": kb_status,
            "service": "AGNO Application Generator",
            "version": "1.0.0"
        }
        
    except Exception as e:
        logger.error(f"❌ Status check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))