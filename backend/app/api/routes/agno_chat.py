"""
AGNO Chat API Routes
Implements streaming chat interface using AGNO agent patterns
"""

from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from typing import Dict, Any, Optional
import json
import logging
from datetime import datetime

from app.services.agno_agent_service import agno_service, AgentEvent

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agno-chat", tags=["AGNO Chat"])

@router.post("/session")
async def create_chat_session(
    user_id: str = Query(..., description="User identifier"),
    session_data: Dict[str, Any] = Body({}, description="Optional session configuration")
) -> Dict[str, Any]:
    """
    Create a new AGNO chat session following the agent patterns
    """
    try:
        session_id = agno_service.create_session(user_id)
        
        return {
            "success": True,
            "session_id": session_id,
            "created_at": datetime.now().isoformat(),
            "message": "AGNO chat session created successfully"
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to create chat session: {e}")
        raise HTTPException(status_code=500, detail=f"Session creation failed: {str(e)}")

@router.post("/message")
async def send_message(
    session_id: str = Query(..., description="Session identifier"),
    user_id: str = Query(..., description="User identifier"),
    message_data: Dict[str, Any] = Body(..., description="Message content and options")
) -> StreamingResponse:
    """
    Send message to AGNO agent and stream response events
    Implements Agent.run() pattern with streaming events
    """
    try:
        user_input = message_data.get("message", "").strip()
        stream_enabled = message_data.get("stream", True)
        
        if not user_input:
            raise HTTPException(status_code=400, detail="Message content is required")
        
        async def event_stream():
            """Stream AGNO agent events following the event-driven pattern"""
            try:
                async for event in agno_service.run_agent(
                    session_id=session_id,
                    user_input=user_input,
                    stream=stream_enabled
                ):
                    # Format event as Server-Sent Event
                    event_data = {
                        "type": event.type,
                        "content": event.content,
                        "timestamp": event.timestamp.isoformat(),
                        "session_id": event.session_id
                    }
                    
                    yield f"data: {json.dumps(event_data)}\\n\\n"
                    
                # Send final completion event
                yield f"data: {json.dumps({'type': 'StreamCompleted', 'timestamp': datetime.now().isoformat()})}\\n\\n"
                
            except Exception as e:
                logger.error(f"❌ Error in event stream: {e}")
                error_event = {
                    "type": "StreamError",
                    "content": {"error": str(e)},
                    "timestamp": datetime.now().isoformat(),
                    "session_id": session_id
                }
                yield f"data: {json.dumps(error_event)}\\n\\n"
        
        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to process message: {e}")
        raise HTTPException(status_code=500, detail=f"Message processing failed: {str(e)}")

@router.get("/session/{session_id}")
async def get_session_info(
    session_id: str,
    user_id: str = Query(..., description="User identifier")
) -> Dict[str, Any]:
    """
    Get session information and conversation history
    """
    try:
        if session_id not in agno_service.sessions:
            raise HTTPException(status_code=404, detail="Session not found")
            
        session = agno_service.sessions[session_id]
        
        # Verify user access
        if session["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return {
            "success": True,
            "session_id": session_id,
            "user_id": session["user_id"],
            "created_at": session["created_at"].isoformat(),
            "memory_count": len(session["memory"]),
            "has_active_project": session.get("active_project") is not None,
            "knowledge_context_count": len(session.get("knowledge_context", [])),
            "active_project": session.get("active_project").__dict__ if session.get("active_project") else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get session info: {e}")
        raise HTTPException(status_code=500, detail=f"Session lookup failed: {str(e)}")

@router.get("/session/{session_id}/history")
async def get_conversation_history(
    session_id: str,
    user_id: str = Query(..., description="User identifier"),
    limit: int = Query(50, description="Maximum number of messages to return")
) -> Dict[str, Any]:
    """
    Get conversation history for a session
    """
    try:
        if session_id not in agno_service.sessions:
            raise HTTPException(status_code=404, detail="Session not found")
            
        session = agno_service.sessions[session_id]
        
        # Verify user access  
        if session["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get recent messages
        memory = session["memory"][-limit:] if len(session["memory"]) > limit else session["memory"]
        
        # Format messages
        messages = []
        for item in memory:
            message = {
                "role": item["role"],
                "content": item["content"],
                "timestamp": item["timestamp"].isoformat()
            }
            
            # Include project info if available
            if "project" in item and item["project"]:
                message["project"] = item["project"].__dict__ if hasattr(item["project"], "__dict__") else item["project"]
                
            messages.append(message)
        
        return {
            "success": True,
            "session_id": session_id,
            "messages": messages,
            "total_messages": len(session["memory"]),
            "returned_messages": len(messages)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get conversation history: {e}")
        raise HTTPException(status_code=500, detail=f"History lookup failed: {str(e)}")

@router.delete("/session/{session_id}")
async def delete_session(
    session_id: str,
    user_id: str = Query(..., description="User identifier")
) -> Dict[str, Any]:
    """
    Delete a chat session and clear its memory
    """
    try:
        if session_id not in agno_service.sessions:
            raise HTTPException(status_code=404, detail="Session not found")
            
        session = agno_service.sessions[session_id]
        
        # Verify user access
        if session["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Delete session
        del agno_service.sessions[session_id]
        
        logger.info(f"🗑️ Deleted AGNO session: {session_id} for user: {user_id}")
        
        return {
            "success": True,
            "message": "Session deleted successfully",
            "session_id": session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete session: {e}")
        raise HTTPException(status_code=500, detail=f"Session deletion failed: {str(e)}")

@router.get("/sessions")
async def list_user_sessions(
    user_id: str = Query(..., description="User identifier"),
    active_only: bool = Query(False, description="Return only sessions with active projects")
) -> Dict[str, Any]:
    """
    List all sessions for a user
    """
    try:
        user_sessions = []
        
        for session_id, session in agno_service.sessions.items():
            if session["user_id"] == user_id:
                if active_only and not session.get("active_project"):
                    continue
                    
                session_info = {
                    "session_id": session_id,
                    "created_at": session["created_at"].isoformat(),
                    "message_count": len(session["memory"]),
                    "has_active_project": session.get("active_project") is not None,
                    "project_name": session["active_project"].name if session.get("active_project") else None
                }
                user_sessions.append(session_info)
        
        # Sort by creation time (most recent first)
        user_sessions.sort(key=lambda x: x["created_at"], reverse=True)
        
        return {
            "success": True,
            "user_id": user_id,
            "sessions": user_sessions,
            "total_sessions": len(user_sessions)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to list sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Session listing failed: {str(e)}")

@router.get("/health")
async def agno_health_check() -> Dict[str, Any]:
    """
    Health check for AGNO agent service
    """
    try:
        return {
            "status": "healthy",
            "service": "AGNO Agent Service",
            "active_sessions": len(agno_service.sessions),
            "timestamp": datetime.now().isoformat(),
            "version": "1.0.0"
        }
        
    except Exception as e:
        logger.error(f"❌ AGNO health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")