"""
Kiff Packs Database Models
==========================

Models for managing tenant-wide API knowledge packs that can be used
in kiff generation to enhance projects with real API integrations.
"""

from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, JSON, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from typing import Dict, List, Any, Optional
import uuid

from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class KiffPack(Base):
    """
    Tenant-wide API knowledge pack that contains processed API documentation,
    code examples, and integration patterns for use in kiff generation.
    """
    __tablename__ = "kiff_packs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Basic pack information
    name = Column(String, nullable=False)  # URL-friendly name like "elevenlabs-voice-api"
    display_name = Column(String, nullable=False)  # Human-readable name like "ElevenLabs Voice API"
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False)  # AI/ML, Audio/Video, Payment, etc.
    
    # Tenant and user association
    tenant_id = Column(String, nullable=False, index=True)
    created_by = Column(String, nullable=False)  # User ID who created the pack
    
    # API information
    api_url = Column(String, nullable=False)  # Primary API documentation URL
    documentation_urls = Column(JSON, default=list)  # Additional documentation URLs
    
    # Pack content (processed by Agno)
    api_structure = Column(JSON, default=dict)  # Extracted API endpoints, parameters, etc.
    code_examples = Column(JSON, default=dict)  # Code examples by language
    integration_patterns = Column(JSON, default=list)  # Reusable integration patterns
    
    # Community and quality metrics
    usage_count = Column(Integer, default=0)  # How many times this pack was used
    total_users_used = Column(Integer, default=0)  # Unique users who used this pack
    avg_rating = Column(Float, default=0.0)  # Average user rating (1-5)
    
    # Pack status and visibility
    is_public = Column(Boolean, default=True)  # Available to all tenant users
    is_verified = Column(Boolean, default=False)  # Admin verified for quality
    is_active = Column(Boolean, default=True)  # Can be disabled by admin
    
    # Metadata
    tags = Column(JSON, default=list)  # Searchable tags
    processing_status = Column(String, default="pending")  # pending, processing, ready, failed
    processing_error = Column(Text, nullable=True)  # Error message if processing failed
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    
    # Relationships
    usage_records = relationship("PackUsage", back_populates="pack", cascade="all, delete-orphan")
    ratings = relationship("PackRating", back_populates="pack", cascade="all, delete-orphan")

    # Indexes for efficient queries
    __table_args__ = (
        Index('idx_tenant_category', 'tenant_id', 'category'),
        Index('idx_tenant_public', 'tenant_id', 'is_public'),
        Index('idx_usage_count', 'usage_count'),
        Index('idx_avg_rating', 'avg_rating'),
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert pack to dictionary for API responses"""
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "category": self.category,
            "tenant_id": self.tenant_id,
            "created_by": self.created_by,
            "api_url": self.api_url,
            "documentation_urls": self.documentation_urls,
            "usage_count": self.usage_count,
            "total_users_used": self.total_users_used,
            "avg_rating": self.avg_rating,
            "is_public": self.is_public,
            "is_verified": self.is_verified,
            "is_active": self.is_active,
            "tags": self.tags,
            "processing_status": self.processing_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None
        }

    def to_dict_detailed(self) -> Dict[str, Any]:
        """Convert pack to detailed dictionary including content"""
        base_dict = self.to_dict()
        base_dict.update({
            "api_structure": self.api_structure,
            "code_examples": self.code_examples,
            "integration_patterns": self.integration_patterns,
            "processing_error": self.processing_error
        })
        return base_dict


class PackUsage(Base):
    """
    Tracks usage of packs in kiff generation for analytics and recommendations
    """
    __tablename__ = "pack_usage"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # References
    pack_id = Column(String, ForeignKey("kiff_packs.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, nullable=False)
    tenant_id = Column(String, nullable=False)
    kiff_id = Column(String, nullable=True)  # Which kiff used this pack (if available)
    
    # Usage context
    usage_context = Column(Text, nullable=True)  # User's idea/prompt that led to pack usage
    usage_type = Column(String, default="generation")  # generation, preview, download
    
    # Timestamps
    usage_timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    pack = relationship("KiffPack", back_populates="usage_records")

    # Indexes
    __table_args__ = (
        Index('idx_pack_usage', 'pack_id', 'usage_timestamp'),
        Index('idx_user_usage', 'user_id', 'usage_timestamp'),
        Index('idx_tenant_usage', 'tenant_id', 'usage_timestamp'),
    )


class PackRating(Base):
    """
    User ratings and feedback for packs to maintain quality
    """
    __tablename__ = "pack_ratings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # References
    pack_id = Column(String, ForeignKey("kiff_packs.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, nullable=False)
    tenant_id = Column(String, nullable=False)
    
    # Rating and feedback
    rating = Column(Integer, nullable=False)  # 1-5 stars
    feedback_comment = Column(Text, nullable=True)
    
    # Context
    kiff_id = Column(String, nullable=True)  # Kiff where this pack was used
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    pack = relationship("KiffPack", back_populates="ratings")

    # Ensure one rating per user per pack
    __table_args__ = (
        Index('idx_unique_user_pack_rating', 'user_id', 'pack_id', unique=True),
        Index('idx_pack_ratings', 'pack_id', 'rating'),
    )


class PackRequest(Base):
    """
    User requests for new packs to be created by team members
    """
    __tablename__ = "pack_requests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Request details
    api_name = Column(String, nullable=False)
    api_url = Column(String, nullable=True)
    use_case = Column(Text, nullable=False)
    priority = Column(String, default="medium")  # low, medium, high, urgent
    
    # Requester info
    requested_by = Column(String, nullable=False)  # User ID
    tenant_id = Column(String, nullable=False)
    
    # Status tracking
    status = Column(String, default="open")  # open, in_progress, completed, cancelled
    assigned_to = Column(String, nullable=True)  # User ID who took the request
    fulfilled_pack_id = Column(String, nullable=True)  # Pack ID if request was fulfilled
    
    # Community engagement
    upvotes = Column(Integer, default=0)  # Other users who want this pack
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_tenant_requests', 'tenant_id', 'status'),
        Index('idx_request_priority', 'priority', 'upvotes'),
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert request to dictionary"""
        return {
            "id": self.id,
            "api_name": self.api_name,
            "api_url": self.api_url,
            "use_case": self.use_case,
            "priority": self.priority,
            "requested_by": self.requested_by,
            "tenant_id": self.tenant_id,
            "status": self.status,
            "assigned_to": self.assigned_to,
            "fulfilled_pack_id": self.fulfilled_pack_id,
            "upvotes": self.upvotes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }