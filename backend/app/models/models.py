from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, JSON, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

# AGNO-Native Models

class Agent(Base):
    """AGNO Agent model for kiff application generation"""
    __tablename__ = "agents"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Agent configuration
    model_name = Column(String(100), nullable=False, default="llama-3.3-70b-versatile")
    instructions = Column(Text, nullable=False)
    tools = Column(JSON)  # List of tool configurations
    knowledge_base_id = Column(String)
    
    # Kiff-specific configuration
    app_type = Column(String(100))  # web_app, api_client, data_processor, etc.
    api_domains = Column(JSON)  # List of API domains this agent specializes in
    
    # Metadata
    user_id = Column(Integer, nullable=False, index=True)
    tenant_id = Column(String, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())



# BacktestResult model removed - legacy trading functionality cleaned up
# This model was part of the old TradeForge AI system and is not needed for kiff


class Signup(Base):
    """Signup model for waitlist/beta signup collection"""
    __tablename__ = "signups"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Contact information
    email = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True)
    
    # Interest and use case
    use_case = Column(Text, nullable=True)  # What they want to build
    experience_level = Column(String(50), nullable=True)  # beginner, intermediate, advanced
    
    # Source tracking
    source = Column(String(100), nullable=True)  # How they found us
    referrer_url = Column(String(500), nullable=True)
    
    # Status and notifications
    status = Column(String(50), default='active')  # active, contacted, converted, unsubscribed
    email_verified = Column(Boolean, default=False)
    welcome_email_sent = Column(Boolean, default=False)
    
    # Metadata
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6
    user_agent = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# TradingSandbox model removed - legacy trading functionality cleaned up
# This model was part of the old TradeForge AI system and is not needed for kiff

# SandboxLog model removed - legacy trading functionality cleaned up
# This model was part of the old TradeForge AI system and is not needed for kiff

# MarketData model removed - legacy trading functionality cleaned up
# This model was part of the old TradeForge AI system and is not needed for kiff  # Additional market data fields

class APIKey(Base):
    """API key storage model"""
    __tablename__ = "api_keys"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)  # User identifier
    exchange = Column(String(50), nullable=False)  # binance, coinbase, etc.
    
    # Encrypted keys
    api_key = Column(Text, nullable=False)  # Encrypted
    secret_key = Column(Text, nullable=False)  # Encrypted
    passphrase = Column(Text)  # For some exchanges, encrypted
    
    # Metadata
    is_testnet = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class User(Base):
    """User model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    
    # Authentication
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    role = Column(String(50), default='user')  # user, admin, superadmin
    
    # Multi-tenancy
    tenant_id = Column(String, ForeignKey('tenants.id'), nullable=True)
    
    # Profile
    full_name = Column(String(255))
    avatar_url = Column(String(500))
    
    # Settings
    settings = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))
    
    # Relationships
    # TradingSandbox relationship removed - legacy trading functionality cleaned up
    support_tickets = relationship("SupportTicket", back_populates="user", foreign_keys="SupportTicket.user_id")
    audit_logs = relationship("AuditLog", back_populates="admin_user", foreign_keys="AuditLog.admin_user_id")

class UsageRecord(Base):
    """Usage tracking model for monitoring resource consumption"""
    __tablename__ = "usage_records"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, nullable=False, index=True)
    
    # Resource tracking
    resource_type = Column(String(100), nullable=False)  # agent_generation, app_generation, api_call, etc.
    tokens_used = Column(Integer, default=0)
    api_calls = Column(Integer, default=0)
    
    # Additional metadata
    additional_data = Column(JSON)  # Store additional context
    
    # Timestamp
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

# Multi-tenant and Admin Models
class Tenant(Base):
    """Tenant model for multi-tenancy"""
    __tablename__ = "tenants"
    
    id = Column(String, primary_key=True)  # UUID in database
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    schema_name = Column(String(100), unique=True, nullable=False)
    
    # Tenant status
    status = Column(String(50), default='active')  # active, suspended, deleted
    tier = Column(String(50), default='starter')  # starter, pro, enterprise
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # JSON fields that exist in database
    settings = Column(JSON, default={})
    resource_limits = Column(JSON, default={})
    billing_info = Column(JSON, default={})
    
    # Contact info
    contact_email = Column(String(255))
    admin_user_id = Column(Integer)
    
    # Relationships removed - billing models deleted for live trading demo

# Billing and subscription models removed for live trading demo
# These were causing foreign key constraint errors and are not needed

class SupportTicket(Base):
    """Support ticket model"""
    __tablename__ = "support_tickets"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Ticket details
    subject = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(50), default='open')  # open, in_progress, resolved, closed
    priority = Column(String(50), default='medium')  # low, medium, high, urgent
    category = Column(String(100), default='general')  # general, technical, billing, etc.
    
    # Assignment
    assigned_admin_id = Column(Integer, ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_response_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="support_tickets", foreign_keys=[user_id])
    responses = relationship("TicketResponse", back_populates="ticket")

class TicketResponse(Base):
    """Ticket response model"""
    __tablename__ = "ticket_responses"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String, ForeignKey("support_tickets.id"), nullable=False)
    
    # Response details
    admin_id = Column(Integer, ForeignKey("users.id"))  # If from admin
    user_id = Column(Integer, ForeignKey("users.id"))   # If from user
    message = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)  # Internal admin notes
    
    # Attachments
    attachments = Column(JSON)  # List of attachment URLs
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    ticket = relationship("SupportTicket", back_populates="responses")

class AuditLog(Base):
    """Audit log model for tracking admin actions"""
    __tablename__ = "audit_logs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Action details
    action = Column(String(255), nullable=False)  # login, user_created, tenant_suspended, etc.
    target_type = Column(String(100), nullable=False)  # user, tenant, billing_record, etc.
    target_id = Column(String(255), nullable=False)  # ID of the affected resource
    
    # Additional context
    details = Column(JSON)  # Additional action details
    severity = Column(String(50), default='medium')  # low, medium, high, critical
    
    # Request context
    ip_address = Column(String(45))  # IPv4 or IPv6
    user_agent = Column(Text)
    
    # Timestamp
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    admin_user = relationship("User", back_populates="audit_logs")
