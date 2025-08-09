"""
Conversation History Models
===========================

Models for storing conversation history and chat messages.
Modular design with feature flag control.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum
from datetime import datetime
from typing import Dict, Any, Optional

from app.core.database import Base

class ConversationStatus(PyEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"

class MessageRole(PyEnum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class Conversation(Base):
    """
    Conversation history for chat sessions.
    Tenant-scoped and feature-flag controlled.
    """
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Tenant and user scoping
    tenant_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    
    # Conversation metadata
    title = Column(String, nullable=False)
    description = Column(Text)
    session_id = Column(String, unique=True, index=True, nullable=False)
    
    # Status and lifecycle
    status = Column(Enum(ConversationStatus), default=ConversationStatus.ACTIVE, nullable=False)
    is_pinned = Column(Boolean, default=False)
    
    # Generator context
    generator_type = Column(String, default="v0")  # v0, v0.1, etc.
    knowledge_sources = Column(JSON)  # URLs and sources used
    app_generated = Column(Boolean, default=False)
    app_metadata = Column(JSON)  # Generated app info
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_message_at = Column(DateTime(timezone=True))
    
    # Relationships
    messages = relationship("ConversationMessage", back_populates="conversation", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Conversation(id={self.id}, title='{self.title}', session_id='{self.session_id}')>"

class ConversationMessage(Base):
    """
    Individual messages within a conversation.
    Stores the complete chat history.
    """
    __tablename__ = "conversation_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign key to conversation
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    
    # Message content
    role = Column(Enum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    
    # Message metadata
    message_order = Column(Integer, nullable=False)  # Order within conversation
    token_count = Column(Integer)  # Tokens used for this message
    
    # Generation context (for assistant messages)
    model_used = Column(String)  # Which LLM model was used
    knowledge_used = Column(JSON)  # Knowledge sources referenced
    generated_files = Column(JSON)  # Files generated in this message
    app_info = Column(JSON)  # App generation info
    
    # Processing metadata
    processing_time_ms = Column(Integer)  # Time taken to generate response
    error_info = Column(JSON)  # Any errors that occurred
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    
    def __repr__(self):
        return f"<ConversationMessage(id={self.id}, role='{self.role}', conversation_id={self.conversation_id})>"

class ConversationDocument(Base):
    """
    Documents uploaded to specific conversations.
    Links conversation sessions with uploaded documents.
    """
    __tablename__ = "conversation_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign key to conversation
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    
    # Document metadata
    filename = Column(String, nullable=False)
    original_size = Column(Integer)  # Original file size in bytes
    document_type = Column(String, default="user_upload")
    
    # Processing status
    is_processed = Column(Boolean, default=False)
    chunks_count = Column(Integer, default=0)
    processing_error = Column(Text)
    
    # LanceDB integration
    vector_db_table = Column(String)  # Which LanceDB table stores the chunks
    metadata_filter = Column(JSON)  # Metadata used for filtering
    
    # Timestamps
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))
    
    # Relationships
    conversation = relationship("Conversation")
    
    def __repr__(self):
        return f"<ConversationDocument(id={self.id}, filename='{self.filename}', conversation_id={self.conversation_id})>"

class ConversationSettings(Base):
    """
    User preferences for conversation history feature.
    Allows per-user customization and feature control.
    """
    __tablename__ = "conversation_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User scoping
    tenant_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    
    # Feature preferences
    auto_save_conversations = Column(Boolean, default=True)
    auto_generate_titles = Column(Boolean, default=True)
    show_conversation_history = Column(Boolean, default=True)
    max_conversations_to_keep = Column(Integer, default=50)
    
    # Privacy settings
    auto_delete_after_days = Column(Integer, default=30)  # Auto-delete old conversations
    include_documents_in_history = Column(Boolean, default=True)
    
    # UI preferences
    conversation_sidebar_collapsed = Column(Boolean, default=False)
    show_message_timestamps = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<ConversationSettings(user_id='{self.user_id}', tenant_id='{self.tenant_id}')>"
