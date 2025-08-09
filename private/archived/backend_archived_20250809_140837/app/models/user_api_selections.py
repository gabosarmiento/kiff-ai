"""
User API Selection Models
========================

Models for tracking which APIs each user has selected/enabled for their account.
This enables user-specific knowledge base access while sharing global indexing.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class UserAPISelection(Base):
    """Track which APIs each user has selected/enabled"""
    __tablename__ = "user_api_selections"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    api_name = Column(String(100), nullable=False, index=True)  # e.g., "agno", "openai"
    
    # Selection metadata
    is_enabled = Column(Boolean, default=True)
    selected_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True))
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    tokens_consumed = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Ensure one selection per user per API
    __table_args__ = (
        UniqueConstraint('user_id', 'api_name', name='unique_user_api_selection'),
    )
    
    # Relationships
    user = relationship("User", back_populates="api_selections")


class UserKnowledgeBase(Base):
    """Track user's personalized knowledge base configuration"""
    __tablename__ = "user_knowledge_bases"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Knowledge base metadata
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    
    # Configuration
    selected_apis = Column(String(1000))  # Comma-separated list of API names
    custom_instructions = Column(String(2000))  # User's custom instructions for agents
    
    # Usage stats
    total_queries = Column(Integer, default=0)
    last_query_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="knowledge_bases")


# Add relationships to existing User model (this would be added to models.py)
"""
Add to User class in models.py:

    # API and Knowledge relationships
    api_selections = relationship("UserAPISelection", back_populates="user")
    knowledge_bases = relationship("UserKnowledgeBase", back_populates="user")
"""
