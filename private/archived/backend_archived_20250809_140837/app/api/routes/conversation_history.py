"""
Conversation History API Routes
===============================

API endpoints for managing conversation history with feature flag control.
Modular design that can be enabled/disabled via feature flags.
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, func, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.conversation_models import (
    Conversation, ConversationMessage, ConversationDocument, ConversationSettings,
    ConversationStatus, MessageRole
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/conversation-history", tags=["conversation-history"])

# Feature flag check helper
async def check_conversation_history_enabled(db: AsyncSession = Depends(get_db)) -> bool:
    """Check if conversation history feature is enabled via feature flag"""
    try:
        from app.models.admin_models import FeatureFlag
        result = await db.execute(
            select(FeatureFlag).where(
                and_(
                    FeatureFlag.name == "conversation_history",
                    FeatureFlag.is_enabled == True
                )
            )
        )
        flag = result.scalar_one_or_none()
        return flag is not None
    except Exception as e:
        logger.warning(f"Feature flag check failed, defaulting to enabled: {e}")
        return True  # Default to enabled if check fails

@router.get("/enabled")
async def is_conversation_history_enabled(db: AsyncSession = Depends(get_db)):
    """Check if conversation history feature is enabled"""
    enabled = await check_conversation_history_enabled(db)
    return {"enabled": enabled}

@router.get("/conversations")
async def get_conversations(
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query(..., description="User ID"),
    limit: int = Query(50, description="Maximum number of conversations to return"),
    offset: int = Query(0, description="Number of conversations to skip"),
    status: Optional[str] = Query(None, description="Filter by conversation status"),
    db: AsyncSession = Depends(get_db)
):
    """Get conversation history for a user"""
    
    # Check feature flag
    if not await check_conversation_history_enabled(db):
        raise HTTPException(status_code=404, detail="Conversation history feature is disabled")
    
    try:
        # Build query
        query = select(Conversation).where(
            and_(
                Conversation.tenant_id == tenant_id,
                Conversation.user_id == user_id
            )
        ).order_by(desc(Conversation.updated_at))
        
        # Apply status filter if provided
        if status:
            try:
                status_enum = ConversationStatus(status)
                query = query.where(Conversation.status == status_enum)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
        
        # Apply pagination
        query = query.offset(offset).limit(limit)
        
        # Execute query
        result = await db.execute(query)
        conversations = result.scalars().all()
        
        # Format response
        conversation_list = []
        for conv in conversations:
            # Get message count and last message preview
            message_count_query = select(func.count(ConversationMessage.id)).where(
                ConversationMessage.conversation_id == conv.id
            )
            message_count_result = await db.execute(message_count_query)
            message_count = message_count_result.scalar() or 0
            
            # Get last user message for preview
            last_message_query = select(ConversationMessage).where(
                and_(
                    ConversationMessage.conversation_id == conv.id,
                    ConversationMessage.role == MessageRole.USER
                )
            ).order_by(desc(ConversationMessage.created_at)).limit(1)
            last_message_result = await db.execute(last_message_query)
            last_message = last_message_result.scalar_one_or_none()
            
            conversation_list.append({
                "id": conv.id,
                "title": conv.title,
                "description": conv.description,
                "session_id": conv.session_id,
                "status": conv.status.value,
                "is_pinned": conv.is_pinned,
                "generator_type": conv.generator_type,
                "app_generated": conv.app_generated,
                "message_count": message_count,
                "last_message_preview": last_message.content[:100] + "..." if last_message and len(last_message.content) > 100 else (last_message.content if last_message else None),
                "created_at": conv.created_at.isoformat(),
                "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
                "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None
            })
        
        return {
            "success": True,
            "conversations": conversation_list,
            "total": len(conversation_list),
            "offset": offset,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Failed to get conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: int = Path(..., description="Conversation ID"),
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query(..., description="User ID"),
    include_messages: bool = Query(True, description="Include conversation messages"),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific conversation with optional messages"""
    
    # Check feature flag
    if not await check_conversation_history_enabled(db):
        raise HTTPException(status_code=404, detail="Conversation history feature is disabled")
    
    try:
        # Query with optional message loading
        if include_messages:
            query = select(Conversation).options(
                selectinload(Conversation.messages)
            ).where(
                and_(
                    Conversation.id == conversation_id,
                    Conversation.tenant_id == tenant_id,
                    Conversation.user_id == user_id
                )
            )
        else:
            query = select(Conversation).where(
                and_(
                    Conversation.id == conversation_id,
                    Conversation.tenant_id == tenant_id,
                    Conversation.user_id == user_id
                )
            )
        
        result = await db.execute(query)
        conversation = result.scalar_one_or_none()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Format response
        response_data = {
            "id": conversation.id,
            "title": conversation.title,
            "description": conversation.description,
            "session_id": conversation.session_id,
            "status": conversation.status.value,
            "is_pinned": conversation.is_pinned,
            "generator_type": conversation.generator_type,
            "knowledge_sources": conversation.knowledge_sources,
            "app_generated": conversation.app_generated,
            "app_metadata": conversation.app_metadata,
            "created_at": conversation.created_at.isoformat(),
            "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
            "last_message_at": conversation.last_message_at.isoformat() if conversation.last_message_at else None
        }
        
        if include_messages:
            messages = []
            for msg in sorted(conversation.messages, key=lambda x: x.message_order):
                messages.append({
                    "id": msg.id,
                    "role": msg.role.value,
                    "content": msg.content,
                    "message_order": msg.message_order,
                    "token_count": msg.token_count,
                    "model_used": msg.model_used,
                    "knowledge_used": msg.knowledge_used,
                    "generated_files": msg.generated_files,
                    "app_info": msg.app_info,
                    "processing_time_ms": msg.processing_time_ms,
                    "created_at": msg.created_at.isoformat()
                })
            response_data["messages"] = messages
        
        return {
            "success": True,
            "conversation": response_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get conversation {conversation_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/conversations")
async def create_conversation(
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query(..., description="User ID"),
    title: str = Query(..., description="Conversation title"),
    session_id: str = Query(..., description="Session ID"),
    generator_type: str = Query("v0", description="Generator type"),
    description: Optional[str] = Query(None, description="Conversation description"),
    knowledge_sources: Optional[List[str]] = Query(None, description="Knowledge sources"),
    db: AsyncSession = Depends(get_db)
):
    """Create a new conversation"""
    
    # Check feature flag
    if not await check_conversation_history_enabled(db):
        raise HTTPException(status_code=404, detail="Conversation history feature is disabled")
    
    try:
        # Check if session_id already exists
        existing_query = select(Conversation).where(
            Conversation.session_id == session_id
        )
        existing_result = await db.execute(existing_query)
        existing_conversation = existing_result.scalar_one_or_none()
        
        if existing_conversation:
            return {
                "success": True,
                "conversation": {
                    "id": existing_conversation.id,
                    "session_id": existing_conversation.session_id,
                    "title": existing_conversation.title,
                    "message": "Conversation already exists"
                }
            }
        
        # Create new conversation
        conversation = Conversation(
            tenant_id=tenant_id,
            user_id=user_id,
            title=title,
            description=description,
            session_id=session_id,
            generator_type=generator_type,
            knowledge_sources=knowledge_sources,
            status=ConversationStatus.ACTIVE
        )
        
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        
        return {
            "success": True,
            "conversation": {
                "id": conversation.id,
                "session_id": conversation.session_id,
                "title": conversation.title,
                "created_at": conversation.created_at.isoformat()
            }
        }
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to create conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/conversations/{conversation_id}/messages")
async def add_message(
    conversation_id: int = Path(..., description="Conversation ID"),
    role: str = Query(..., description="Message role (user/assistant/system)"),
    content: str = Query(..., description="Message content"),
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query(..., description="User ID"),
    model_used: Optional[str] = Query(None, description="Model used for generation"),
    token_count: Optional[int] = Query(None, description="Token count"),
    knowledge_used: Optional[Dict[str, Any]] = Body(None, description="Knowledge sources used"),
    generated_files: Optional[Dict[str, Any]] = Body(None, description="Generated files"),
    app_info: Optional[Dict[str, Any]] = Body(None, description="App generation info"),
    processing_time_ms: Optional[int] = Query(None, description="Processing time in milliseconds"),
    db: AsyncSession = Depends(get_db)
):
    """Add a message to a conversation"""
    
    # Check feature flag
    if not await check_conversation_history_enabled(db):
        raise HTTPException(status_code=404, detail="Conversation history feature is disabled")
    
    try:
        # Verify conversation exists and belongs to user
        conversation_query = select(Conversation).where(
            and_(
                Conversation.id == conversation_id,
                Conversation.tenant_id == tenant_id,
                Conversation.user_id == user_id
            )
        )
        conversation_result = await db.execute(conversation_query)
        conversation = conversation_result.scalar_one_or_none()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Get next message order
        max_order_query = select(func.max(ConversationMessage.message_order)).where(
            ConversationMessage.conversation_id == conversation_id
        )
        max_order_result = await db.execute(max_order_query)
        max_order = max_order_result.scalar() or 0
        
        # Validate role
        try:
            message_role = MessageRole(role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid message role: {role}")
        
        # Create message
        message = ConversationMessage(
            conversation_id=conversation_id,
            role=message_role,
            content=content,
            message_order=max_order + 1,
            token_count=token_count,
            model_used=model_used,
            knowledge_used=knowledge_used,
            generated_files=generated_files,
            app_info=app_info,
            processing_time_ms=processing_time_ms
        )
        
        db.add(message)
        
        # Update conversation last_message_at
        conversation.last_message_at = datetime.utcnow()
        conversation.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(message)
        
        return {
            "success": True,
            "message": {
                "id": message.id,
                "conversation_id": message.conversation_id,
                "role": message.role.value,
                "content": message.content,
                "message_order": message.message_order,
                "created_at": message.created_at.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to add message to conversation {conversation_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int = Path(..., description="Conversation ID"),
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query(..., description="User ID"),
    permanent: bool = Query(False, description="Permanently delete or just mark as deleted"),
    db: AsyncSession = Depends(get_db)
):
    """Delete or archive a conversation"""
    
    # Check feature flag
    if not await check_conversation_history_enabled(db):
        raise HTTPException(status_code=404, detail="Conversation history feature is disabled")
    
    try:
        # Verify conversation exists and belongs to user
        conversation_query = select(Conversation).where(
            and_(
                Conversation.id == conversation_id,
                Conversation.tenant_id == tenant_id,
                Conversation.user_id == user_id
            )
        )
        conversation_result = await db.execute(conversation_query)
        conversation = conversation_result.scalar_one_or_none()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        if permanent:
            # Permanently delete conversation and all messages
            await db.delete(conversation)
        else:
            # Mark as deleted
            conversation.status = ConversationStatus.DELETED
            conversation.updated_at = datetime.utcnow()
        
        await db.commit()
        
        return {
            "success": True,
            "message": f"Conversation {'permanently deleted' if permanent else 'marked as deleted'}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to delete conversation {conversation_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cleanup-old-conversations")
async def cleanup_old_conversations(
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query(..., description="User ID"),
    days_old: int = Query(30, description="Delete conversations older than this many days"),
    db: AsyncSession = Depends(get_db)
):
    """Clean up old conversations for privacy"""
    
    # Check feature flag
    if not await check_conversation_history_enabled(db):
        raise HTTPException(status_code=404, detail="Conversation history feature is disabled")
    
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        
        # Delete old conversations
        delete_query = delete(Conversation).where(
            and_(
                Conversation.tenant_id == tenant_id,
                Conversation.user_id == user_id,
                Conversation.created_at < cutoff_date,
                Conversation.status != ConversationStatus.ARCHIVED  # Keep archived conversations
            )
        )
        
        result = await db.execute(delete_query)
        deleted_count = result.rowcount
        
        await db.commit()
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Deleted {deleted_count} conversations older than {days_old} days"
        }
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to cleanup old conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))
