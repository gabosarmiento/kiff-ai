"""
Billing and Token Consumption Models
===================================

Database models for tracking token consumption within billing cycles.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, BigInteger, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

class BillingCycle(Base):
    """Billing cycle management for token consumption tracking"""
    __tablename__ = "billing_cycles"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=False)
    
    # Billing cycle period
    cycle_start = Column(DateTime(timezone=True), nullable=False)
    cycle_end = Column(DateTime(timezone=True), nullable=False)
    cycle_type = Column(String, default='monthly')  # monthly, weekly, yearly
    
    # Status
    is_active = Column(Boolean, default=True)
    is_completed = Column(Boolean, default=False)
    
    # Metadata
    plan_type = Column(String, default='free')  # free, pay_per_token, pro
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    token_consumptions = relationship("TokenConsumption", back_populates="billing_cycle")
    
    @classmethod
    def get_current_cycle(cls, db, tenant_id: str, user_id: str) -> Optional['BillingCycle']:
        """Get the current active billing cycle for a user"""
        from sqlalchemy import select
        now = datetime.utcnow()
        
        result = db.execute(
            select(cls).where(
                cls.tenant_id == tenant_id,
                cls.user_id == user_id,
                cls.is_active == True,
                cls.cycle_start <= now,
                cls.cycle_end >= now
            ).order_by(cls.cycle_start.desc())
        )
        return result.scalar_one_or_none()
    
    @classmethod
    def create_monthly_cycle(cls, tenant_id: str, user_id: str, plan_type: str = 'free') -> 'BillingCycle':
        """Create a new monthly billing cycle"""
        now = datetime.utcnow()
        # Start of current month
        cycle_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Start of next month
        if cycle_start.month == 12:
            cycle_end = cycle_start.replace(year=cycle_start.year + 1, month=1)
        else:
            cycle_end = cycle_start.replace(month=cycle_start.month + 1)
        
        return cls(
            tenant_id=tenant_id,
            user_id=user_id,
            cycle_start=cycle_start,
            cycle_end=cycle_end,
            cycle_type='monthly',
            plan_type=plan_type,
            is_active=True,
            is_completed=False
        )


class TokenConsumption(Base):
    """Token consumption tracking within billing cycles"""
    __tablename__ = "token_consumptions"
    
    id = Column(BigInteger, primary_key=True, index=True)
    
    # User identification
    tenant_id = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=False)
    session_id = Column(String, index=True, nullable=True)
    
    # Billing cycle reference
    billing_cycle_id = Column(Integer, ForeignKey("billing_cycles.id"), nullable=False)
    
    # Token metrics (from AGNO native metrics)
    input_tokens = Column(BigInteger, default=0)
    output_tokens = Column(BigInteger, default=0)
    total_tokens = Column(BigInteger, default=0)
    cached_tokens = Column(BigInteger, default=0)
    reasoning_tokens = Column(BigInteger, default=0)
    audio_tokens = Column(BigInteger, default=0)
    cache_write_tokens = Column(BigInteger, default=0)
    cache_read_tokens = Column(BigInteger, default=0)
    
    # Consumption metadata
    operation_type = Column(String, index=True)  # 'generation', 'chat', 'api_indexing', etc.
    operation_id = Column(String, index=True, nullable=True)  # Related operation identifier
    
    # Source tracking
    model_name = Column(String, index=True, nullable=True)  # 'groq/llama-3.1-70b', etc.
    provider = Column(String, index=True, default='groq')  # 'groq', 'openai', etc.
    
    # Additional metadata
    extra_data = Column(JSON, nullable=True)  # Extra context (request details, etc.)
    
    # Timestamps
    consumed_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    billing_cycle = relationship("BillingCycle", back_populates="token_consumptions")
    
    @property
    def formatted_display(self) -> str:
        """Format total tokens for display like '1.5K tokens'"""
        total = self.total_tokens
        if total >= 1_000_000:
            return f"{total / 1_000_000:.1f}M tokens"
        elif total >= 1_000:
            return f"{total / 1_000:.1f}K tokens"
        else:
            return f"{total} tokens"


class TokenConsumptionSummary(Base):
    """Aggregated token consumption summary per billing cycle"""
    __tablename__ = "token_consumption_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User identification
    tenant_id = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=False)
    
    # Billing cycle reference
    billing_cycle_id = Column(Integer, ForeignKey("billing_cycles.id"), nullable=False, unique=True)
    
    # Aggregated totals
    total_input_tokens = Column(BigInteger, default=0)
    total_output_tokens = Column(BigInteger, default=0)
    total_tokens = Column(BigInteger, default=0)
    total_cached_tokens = Column(BigInteger, default=0)
    total_reasoning_tokens = Column(BigInteger, default=0)
    total_audio_tokens = Column(BigInteger, default=0)
    total_cache_write_tokens = Column(BigInteger, default=0)
    total_cache_read_tokens = Column(BigInteger, default=0)
    
    # Operation breakdowns
    generation_tokens = Column(BigInteger, default=0)
    chat_tokens = Column(BigInteger, default=0)
    api_indexing_tokens = Column(BigInteger, default=0)
    other_tokens = Column(BigInteger, default=0)
    
    # Provider breakdowns
    groq_tokens = Column(BigInteger, default=0)
    openai_tokens = Column(BigInteger, default=0)
    other_provider_tokens = Column(BigInteger, default=0)
    
    # Timestamps
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    billing_cycle = relationship("BillingCycle")
    
    @property
    def formatted_total(self) -> str:
        """Format total tokens for display like '1.5K tokens'"""
        total = self.total_tokens
        if total >= 1_000_000:
            return f"{total / 1_000_000:.1f}M tokens"
        elif total >= 1_000:
            return f"{total / 1_000:.1f}K tokens"
        else:
            return f"{total} tokens"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            'billing_cycle_id': self.billing_cycle_id,
            'total_tokens': self.total_tokens,
            'total_input_tokens': self.total_input_tokens,
            'total_output_tokens': self.total_output_tokens,
            'total_cached_tokens': self.total_cached_tokens,
            'total_reasoning_tokens': self.total_reasoning_tokens,
            'total_audio_tokens': self.total_audio_tokens,
            'formatted_total': self.formatted_total,
            'breakdown_by_operation': {
                'generation': self.generation_tokens,
                'chat': self.chat_tokens,
                'api_indexing': self.api_indexing_tokens,
                'other': self.other_tokens
            },
            'breakdown_by_provider': {
                'groq': self.groq_tokens,
                'openai': self.openai_tokens,
                'other': self.other_provider_tokens
            },
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }