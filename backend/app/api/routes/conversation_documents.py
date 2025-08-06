"""
Conversation Documents API Routes
=================================

API endpoints for conversation-scoped document processing.
Follows AGNO best practices with tenant isolation and automatic cleanup.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse

from app.services.conversation_document_service import conversation_document_service
from app.middleware.tenant_middleware import get_current_tenant

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/conversation-documents", tags=["conversation-documents"])

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    document_type: str = Form("user_upload"),
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query("1", description="User ID")
):
    """
    Upload and process a document for a conversation session.
    
    Process:
    1. Validate file and session
    2. Process document with AGNO knowledge base
    3. Chunk and store in LanceDB with metadata
    4. Delete original file
    5. Return success status
    """
    
    try:
        # Validate tenant ID (following our recurring issue pattern)
        if not tenant_id:
            raise HTTPException(status_code=400, detail="Tenant ID is required")
        
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Check file size (limit to 10MB for now)
        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        
        # Validate file type
        allowed_extensions = {'.pdf', '.txt', '.md', '.doc', '.docx'}
        file_ext = '.' + file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        logger.info(f"📄 Processing document upload: {file.filename} for session {session_id}")
        
        # Process document using AGNO best practices
        result = await conversation_document_service.process_document(
            file_content=file_content,
            filename=file.filename,
            tenant_id=tenant_id,
            user_id=user_id,
            session_id=session_id,
            document_type=document_type
        )
        
        if result["status"] == "success":
            return JSONResponse(content={
                "success": True,
                "message": f"Document '{file.filename}' processed successfully",
                "data": {
                    "filename": result["filename"],
                    "session_id": result["session_id"],
                    "chunks_stored": result["chunks_stored"],
                    "original_deleted": result["original_deleted"],
                    "document_type": document_type
                }
            })
        else:
            raise HTTPException(status_code=500, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Document upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")

@router.get("/session/{session_id}")
async def get_session_documents(
    session_id: str,
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query("1", description="User ID")
):
    """
    Get information about documents in a conversation session.
    Returns metadata about processed documents (not the content).
    """
    
    try:
        # Validate tenant ID
        if not tenant_id:
            raise HTTPException(status_code=400, detail="Tenant ID is required")
        
        # Get session knowledge base
        knowledge_base = await conversation_document_service.get_session_knowledge_base(
            tenant_id=tenant_id,
            user_id=user_id,
            session_id=session_id
        )
        
        if knowledge_base:
            return JSONResponse(content={
                "success": True,
                "data": {
                    "session_id": session_id,
                    "has_documents": True,
                    "knowledge_base_ready": True
                }
            })
        else:
            return JSONResponse(content={
                "success": True,
                "data": {
                    "session_id": session_id,
                    "has_documents": False,
                    "knowledge_base_ready": False
                }
            })
            
    except Exception as e:
        logger.error(f"❌ Failed to get session documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/session/{session_id}")
async def cleanup_session_documents(
    session_id: str,
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query("1", description="User ID")
):
    """
    Manually clean up documents for a conversation session.
    Removes document chunks from LanceDB for privacy.
    """
    
    try:
        # Validate tenant ID
        if not tenant_id:
            raise HTTPException(status_code=400, detail="Tenant ID is required")
        
        # Clean up session
        session_key = f"{tenant_id}:{user_id}:{session_id}"
        await conversation_document_service._cleanup_session(session_key)
        
        # Remove from active sessions
        if session_key in conversation_document_service.active_sessions:
            del conversation_document_service.active_sessions[session_key]
        
        return JSONResponse(content={
            "success": True,
            "message": f"Session {session_id} documents cleaned up successfully"
        })
        
    except Exception as e:
        logger.error(f"❌ Session cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cleanup-expired")
async def trigger_cleanup(
    max_age_minutes: int = Query(15, description="Maximum age in minutes for session cleanup")
):
    """
    Manually trigger cleanup of expired sessions.
    Useful for testing or forced cleanup.
    """
    
    try:
        await conversation_document_service.cleanup_expired_sessions(max_age_minutes)
        
        return JSONResponse(content={
            "success": True,
            "message": f"Cleanup completed for sessions older than {max_age_minutes} minutes"
        })
        
    except Exception as e:
        logger.error(f"❌ Manual cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Health check for conversation document service"""
    
    try:
        active_sessions_count = len(conversation_document_service.active_sessions)
        
        return JSONResponse(content={
            "success": True,
            "service": "conversation_documents",
            "status": "healthy",
            "active_sessions": active_sessions_count,
            "vector_db_ready": True
        })
        
    except Exception as e:
        logger.error(f"❌ Health check failed: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "service": "conversation_documents", 
                "status": "unhealthy",
                "error": str(e)
            }
        )
