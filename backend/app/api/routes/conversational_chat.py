"""
API Routes for Conversational Knowledge-Driven Chat
==================================================

These endpoints provide the conversational interface similar to Claude Code,
integrating with the knowledge system and AGNO tools.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
import asyncio
import json
from datetime import datetime

from app.services.conversational_chat_service import get_chat_service
from app.core.auth import get_current_user_optional
from app.core.billing_observability import get_billing_service

router = APIRouter(prefix="/api/v1/chat", tags=["conversational-chat"])


class ChatMessage(BaseModel):
    """Chat message model"""
    message: str = Field(..., description="User's message")
    session_id: Optional[str] = Field(None, description="Chat session ID")
    project_context: Optional[Dict[str, Any]] = Field(None, description="Project context")


class ChatResponse(BaseModel):
    """Chat response model"""
    success: bool
    session_id: str
    response: str
    message_count: int
    knowledge_domains_used: List[str]
    project_context: Dict[str, Any]
    timestamp: str


class SessionHistoryResponse(BaseModel):
    """Session history response model"""
    success: bool
    session_id: str
    messages: List[Dict[str, Any]]
    knowledge_domains: List[str]
    project_context: Dict[str, Any]
    created_at: str


class FollowUpSuggestionsResponse(BaseModel):
    """Follow-up suggestions response model"""
    success: bool
    session_id: str
    suggestions: List[str]
    based_on: Dict[str, Any]


class KnowledgeDomainsResponse(BaseModel):
    """Available knowledge domains response"""
    domains: List[str]
    total_count: int


@router.post("/message", response_model=ChatResponse)
async def send_chat_message(
    chat_message: ChatMessage,
    background_tasks: BackgroundTasks,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Send a message to the conversational chat assistant
    
    This endpoint provides Claude Code-like conversational development assistance
    with knowledge-driven responses based on indexed API documentation.
    """
    try:
        chat_service = get_chat_service()
        
        # Extract user info for billing
        tenant_id = current_user.get("tenant_id", "demo_tenant") if current_user else "demo_tenant"
        user_id = str(current_user.get("id", "demo_user")) if current_user else "demo_user"
        
        # Process chat message
        result = await chat_service.chat(
            message=chat_message.message,
            session_id=chat_message.session_id,
            tenant_id=tenant_id,
            user_id=user_id,
            project_context=chat_message.project_context
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Chat processing failed"))
        
        return ChatResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.get("/session/{session_id}/history", response_model=SessionHistoryResponse)
async def get_session_history(
    session_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get chat session history"""
    try:
        chat_service = get_chat_service()
        result = await chat_service.get_session_history(session_id)
        
        if not result.get("success"):
            raise HTTPException(status_code=404, detail="Session not found")
        
        return SessionHistoryResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving session: {str(e)}")


@router.get("/session/{session_id}/suggestions", response_model=FollowUpSuggestionsResponse)
async def get_follow_up_suggestions(
    session_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get follow-up question suggestions based on conversation context"""
    try:
        chat_service = get_chat_service()
        result = await chat_service.suggest_follow_up_questions(session_id)
        
        if not result.get("success"):
            raise HTTPException(status_code=404, detail="Session not found")
        
        return FollowUpSuggestionsResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting suggestions: {str(e)}")


@router.get("/knowledge-domains", response_model=KnowledgeDomainsResponse)
async def get_available_knowledge_domains():
    """Get list of available knowledge domains for API documentation"""
    try:
        chat_service = get_chat_service()
        domains = chat_service.get_available_knowledge_domains()
        
        return KnowledgeDomainsResponse(
            domains=domains,
            total_count=len(domains)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving domains: {str(e)}")


# Streaming chat endpoint for real-time responses
@router.post("/stream")
async def stream_chat_message(
    chat_message: ChatMessage,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Stream chat responses in real-time (similar to Claude Code)
    
    This endpoint provides streaming responses for better user experience
    during long knowledge queries or code generation.
    """
    
    async def generate_stream():
        try:
            chat_service = get_chat_service()
            
            # Extract user info
            tenant_id = current_user.get("tenant_id", "demo_tenant") if current_user else "demo_tenant"
            user_id = str(current_user.get("id", "demo_user")) if current_user else "demo_user"
            
            # Send initial acknowledgment
            yield f"data: {json.dumps({'type': 'start', 'message': 'Processing your request...'})}\n\n"
            
            # Process the chat message
            result = await chat_service.chat(
                message=chat_message.message,
                session_id=chat_message.session_id,
                tenant_id=tenant_id,
                user_id=user_id,
                project_context=chat_message.project_context
            )
            
            if result.get("success"):
                # Stream the response in chunks
                response_text = result["response"]
                chunk_size = 50  # Characters per chunk
                
                for i in range(0, len(response_text), chunk_size):
                    chunk = response_text[i:i + chunk_size]
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                    await asyncio.sleep(0.1)  # Small delay for streaming effect
                
                # Send completion data
                completion_data = {
                    "type": "complete",
                    "session_id": result["session_id"],
                    "knowledge_domains_used": result["knowledge_domains_used"],
                    "message_count": result["message_count"]
                }
                yield f"data: {json.dumps(completion_data)}\n\n"
            else:
                # Send error
                error_data = {
                    "type": "error",
                    "error": result.get("error", "Unknown error")
                }
                yield f"data: {json.dumps(error_data)}\n\n"
                
        except Exception as e:
            error_data = {
                "type": "error", 
                "error": str(e)
            }
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )


# Tool-specific endpoints for direct tool access
class ToolRequest(BaseModel):
    """Generic tool request model"""
    tool_name: str = Field(..., description="Name of the tool to use")
    parameters: Dict[str, Any] = Field(..., description="Tool parameters")


class ToolResponse(BaseModel):
    """Generic tool response model"""
    success: bool
    tool_name: str
    result: Dict[str, Any]
    timestamp: str


@router.post("/tools/execute", response_model=ToolResponse)
async def execute_tool_directly(
    tool_request: ToolRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Execute a specific knowledge tool directly
    
    This allows frontend to call specific tools without going through the chat agent,
    useful for specialized UI components.
    """
    try:
        chat_service = get_chat_service()
        
        # Find the requested tool
        tool = None
        for t in chat_service.tools:
            if t.name == tool_request.tool_name:
                tool = t
                break
        
        if not tool:
            raise HTTPException(status_code=404, detail=f"Tool '{tool_request.tool_name}' not found")
        
        # Execute the tool
        result = tool.run(**tool_request.parameters)
        
        return ToolResponse(
            success=True,
            tool_name=tool_request.tool_name,
            result=result,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        return ToolResponse(
            success=False,
            tool_name=tool_request.tool_name,
            result={"error": str(e)},
            timestamp=datetime.utcnow().isoformat()
        )


@router.get("/tools/available")
async def get_available_tools():
    """Get list of available knowledge tools"""
    try:
        chat_service = get_chat_service()
        
        tools_info = []
        for tool in chat_service.tools:
            tools_info.append({
                "name": tool.name,
                "description": tool.description
            })
        
        return {
            "success": True,
            "tools": tools_info,
            "total_count": len(tools_info)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving tools: {str(e)}")


# Health check endpoint
@router.get("/health")
async def chat_health_check():
    """Health check for the conversational chat service"""
    try:
        chat_service = get_chat_service()
        domains = chat_service.get_available_knowledge_domains()
        
        return {
            "status": "healthy",
            "service": "conversational_chat",
            "knowledge_domains_available": len(domains),
            "tools_available": len(chat_service.tools),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")
