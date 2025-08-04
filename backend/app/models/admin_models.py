"""
SaaS Admin Models for TradeForge AI
Comprehensive backoffice management system
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, Float, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum
from datetime import datetime
from typing import Dict, Any, Optional

from app.core.database import Base

class AdminRole(PyEnum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    SUPPORT = "support"
    VIEWER = "viewer"

class UserStatus(PyEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    BANNED = "banned"
    PENDING = "pending"

class SubscriptionPlan(PyEnum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"

class SystemStatus(PyEnum):
    OPERATIONAL = "operational"
    DEGRADED = "degraded"
    MAINTENANCE = "maintenance"
    OUTAGE = "outage"

class AdminUser(Base):
    """Admin users with different permission levels"""
    __tablename__ = "admin_users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(AdminRole), default=AdminRole.VIEWER, nullable=False)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    audit_logs = relationship("AdminAuditLog", back_populates="admin_user")

class UserManagement(Base):
    """Extended user management for admin control"""
    __tablename__ = "user_management"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    subscription_plan = Column(Enum(SubscriptionPlan), default=SubscriptionPlan.FREE, nullable=False)
    subscription_start = Column(DateTime(timezone=True))
    subscription_end = Column(DateTime(timezone=True))
    monthly_token_limit = Column(Integer, default=10000)
    monthly_tokens_used = Column(Integer, default=0)
    monthly_api_calls_limit = Column(Integer, default=1000)
    monthly_api_calls_used = Column(Integer, default=0)
    sandbox_limit = Column(Integer, default=2)
    notes = Column(Text)
    last_activity = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="management")
    # Note: BillingRecord relationship removed - using main BillingRecord model from models.py

class SystemMetrics(Base):
    """System-wide metrics and health monitoring"""
    __tablename__ = "system_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # System Health
    system_status = Column(Enum(SystemStatus), default=SystemStatus.OPERATIONAL)
    cpu_usage = Column(Float)  # Percentage
    memory_usage = Column(Float)  # Percentage
    disk_usage = Column(Float)  # Percentage
    
    # Database Metrics
    db_connections_active = Column(Integer)
    db_connections_max = Column(Integer)
    db_query_avg_time = Column(Float)  # milliseconds
    
    # API Metrics
    api_requests_per_minute = Column(Integer)
    api_avg_response_time = Column(Float)  # milliseconds
    api_error_rate = Column(Float)  # percentage
    
    # Sandbox Metrics
    active_sandboxes = Column(Integer)
    total_sandboxes_created = Column(Integer)
    sandbox_avg_uptime = Column(Float)  # hours
    
    # Usage Metrics
    total_tokens_consumed = Column(Integer)
    total_api_calls = Column(Integer)
    active_users_24h = Column(Integer)
    new_signups_24h = Column(Integer)

class AdminAuditLog(Base):
    """Audit log for all admin actions"""
    __tablename__ = "admin_audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    admin_user_id = Column(Integer, ForeignKey("admin_users.id"), nullable=False)
    action = Column(String, nullable=False)  # e.g., "user_suspended", "sandbox_stopped"
    target_type = Column(String, nullable=False)  # e.g., "user", "sandbox", "system"
    target_id = Column(String)  # ID of the affected resource
    details = Column(JSON)  # Additional context and data
    ip_address = Column(String)
    user_agent = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    admin_user = relationship("AdminUser", back_populates="audit_logs")

class SystemAnnouncement(Base):
    """System-wide announcements and maintenance notices"""
    __tablename__ = "system_announcements"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, default="info")  # info, warning, error, maintenance
    is_active = Column(Boolean, default=True)
    show_to_users = Column(Boolean, default=False)
    priority = Column(Integer, default=1)  # 1=low, 2=medium, 3=high, 4=critical
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    created_by = Column(Integer, ForeignKey("admin_users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# Note: SupportTicket and SupportMessage models removed - using main models from models.py

class FeatureFlag(Base):
    """Feature flags for gradual rollouts and A/B testing"""
    __tablename__ = "feature_flags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    is_enabled = Column(Boolean, default=False)
    rollout_percentage = Column(Integer, default=0)  # 0-100
    target_user_segments = Column(JSON)  # User criteria for targeting
    start_date = Column(DateTime(timezone=True))
    end_date = Column(DateTime(timezone=True))
    created_by = Column(Integer, ForeignKey("admin_users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class UsageAlert(Base):
    """Automated alerts for usage thresholds and system events"""
    __tablename__ = "usage_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String, nullable=False)  # usage_threshold, system_error, security_incident
    severity = Column(String, default="medium")  # low, medium, high, critical
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    
    # Alert Conditions
    threshold_type = Column(String)  # tokens, api_calls, sandboxes, cpu, memory
    threshold_value = Column(Float)
    current_value = Column(Float)
    
    # Targeting
    user_id = Column(Integer, ForeignKey("users.id"))
    affects_all_users = Column(Boolean, default=False)
    
    # Status
    is_resolved = Column(Boolean, default=False)
    acknowledged_by = Column(Integer, ForeignKey("admin_users.id"))
    acknowledged_at = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True))
    
    # Additional metadata
    alert_metadata = Column(JSON)

# Update User model to include management relationship
from app.models.models import User
User.management = relationship("UserManagement", back_populates="user", uselist=False)
