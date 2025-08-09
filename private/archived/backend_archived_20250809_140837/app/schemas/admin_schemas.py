"""
SaaS Admin Schemas for TradeForge AI
Pydantic models for admin API requests and responses
"""

from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

from app.models.admin_models import UserStatus, SubscriptionPlan, SystemStatus, AdminRole

# ============================================================================
# DASHBOARD SCHEMAS
# ============================================================================

class AdminDashboardResponse(BaseModel):
    user_stats: Dict[str, int]
    sandbox_stats: Dict[str, int]
    usage_stats: Dict[str, int]
    revenue_stats: Dict[str, Union[float, str]]
    system_health: Dict[str, Union[str, float]]
    recent_alerts: List[Dict[str, Any]]
    support_stats: Dict[str, int]

# ============================================================================
# USER MANAGEMENT SCHEMAS
# ============================================================================

class AdminUserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    status: UserStatus
    subscription_plan: SubscriptionPlan
    monthly_tokens_used: int
    monthly_token_limit: int
    sandbox_count: int
    last_activity: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

class AdminUserDetailResponse(BaseModel):
    user: AdminUserResponse
    billing_history: List[Dict[str, Any]]
    sandboxes: List[Dict[str, Any]]

class UserStatusUpdate(BaseModel):
    status: UserStatus
    reason: Optional[str] = Field(None, description="Reason for status change")

class UserSubscriptionUpdate(BaseModel):
    subscription_plan: SubscriptionPlan
    monthly_token_limit: Optional[int] = None
    monthly_api_calls_limit: Optional[int] = None
    sandbox_limit: Optional[int] = None

# ============================================================================
# SANDBOX MANAGEMENT SCHEMAS
# ============================================================================

class AdminSandboxResponse(BaseModel):
    sandbox_id: str
    user_id: int
    user_email: EmailStr
    status: str
    strategy_type: str
    uptime: float
    tokens_used: int
    api_calls_made: int
    trades_executed: int
    created_at: datetime
    last_activity: Optional[datetime]

    class Config:
        from_attributes = True

class SandboxActionRequest(BaseModel):
    reason: str = Field(..., description="Reason for the action")

# ============================================================================
# SYSTEM MONITORING SCHEMAS
# ============================================================================

class SystemMetricsResponse(BaseModel):
    timestamp: datetime
    system_status: SystemStatus
    cpu_usage: Optional[float]
    memory_usage: Optional[float]
    disk_usage: Optional[float]
    active_sandboxes: Optional[int]
    api_requests_per_minute: Optional[int]
    api_avg_response_time: Optional[float]
    api_error_rate: Optional[float]

    class Config:
        from_attributes = True

class SystemAnnouncementCreate(BaseModel):
    title: str = Field(..., max_length=200)
    message: str = Field(..., max_length=2000)
    type: str = Field(default="info", pattern="^(info|warning|error|maintenance)$")
    priority: int = Field(default=1, ge=1, le=4)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class SystemStatusUpdate(BaseModel):
    status: SystemStatus
    announcement: Optional[SystemAnnouncementCreate] = None

# ============================================================================
# SUPPORT SCHEMAS
# ============================================================================

class SupportTicketResponse(BaseModel):
    id: int
    ticket_number: str
    user_email: EmailStr
    subject: str
    status: str
    priority: str
    category: Optional[str]
    assigned_admin_email: Optional[EmailStr]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SupportTicketUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(open|in_progress|resolved|closed)$")
    priority: Optional[str] = Field(None, pattern="^(low|medium|high|urgent)$")
    assigned_admin_id: Optional[int] = None

class SupportMessageCreate(BaseModel):
    message: str = Field(..., max_length=5000)
    is_internal: bool = Field(default=False)

# ============================================================================
# BILLING SCHEMAS
# ============================================================================

class BillingOverviewResponse(BaseModel):
    total_revenue: float
    total_transactions: int
    avg_transaction_value: float
    monthly_recurring_revenue: float
    plan_distribution: Dict[str, int]
    currency: str

class BillingRecordResponse(BaseModel):
    id: int
    user_email: EmailStr
    amount: float
    currency: str
    billing_period_start: datetime
    billing_period_end: datetime
    payment_status: str
    created_at: datetime

    class Config:
        from_attributes = True

# ============================================================================
# AUDIT LOG SCHEMAS
# ============================================================================

class AuditLogResponse(BaseModel):
    id: int
    admin_email: EmailStr
    action: str
    target_type: str
    target_id: Optional[str]
    details: Optional[Dict[str, Any]]
    timestamp: datetime

    class Config:
        from_attributes = True

# ============================================================================
# FEATURE FLAG SCHEMAS
# ============================================================================

class FeatureFlagResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_enabled: bool
    rollout_percentage: int
    target_user_segments: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True

class FeatureFlagCreate(BaseModel):
    name: str = Field(..., max_length=100, pattern="^[a-zA-Z0-9_-]+$")
    description: Optional[str] = Field(None, max_length=500)
    is_enabled: bool = Field(default=False)
    rollout_percentage: int = Field(default=0, ge=0, le=100)
    target_user_segments: Optional[Dict[str, Any]] = None

class FeatureFlagUpdate(BaseModel):
    description: Optional[str] = Field(None, max_length=500)
    is_enabled: Optional[bool] = None
    rollout_percentage: Optional[int] = Field(None, ge=0, le=100)
    target_user_segments: Optional[Dict[str, Any]] = None

# ============================================================================
# ALERT SCHEMAS
# ============================================================================

class UsageAlertResponse(BaseModel):
    id: int
    alert_type: str
    severity: str
    title: str
    message: str
    threshold_type: Optional[str]
    threshold_value: Optional[float]
    current_value: Optional[float]
    user_id: Optional[int]
    affects_all_users: bool
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True

class AlertAcknowledgeRequest(BaseModel):
    acknowledge: bool = Field(default=True)

# ============================================================================
# ADMIN USER SCHEMAS
# ============================================================================

class AdminUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., max_length=100)
    role: AdminRole = Field(default=AdminRole.VIEWER)
    password: str = Field(..., min_length=8)

class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    role: Optional[AdminRole] = None
    is_active: Optional[bool] = None

class AdminUserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: AdminRole
    is_active: bool
    last_login: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

# ============================================================================
# ANALYTICS SCHEMAS
# ============================================================================

class AnalyticsTimeRange(str, Enum):
    HOUR = "1h"
    DAY = "1d"
    WEEK = "1w"
    MONTH = "1m"
    QUARTER = "3m"
    YEAR = "1y"

class AnalyticsMetric(str, Enum):
    USERS = "users"
    SANDBOXES = "sandboxes"
    TOKENS = "tokens"
    API_CALLS = "api_calls"
    REVENUE = "revenue"
    ERRORS = "errors"

class AnalyticsRequest(BaseModel):
    metrics: List[AnalyticsMetric]
    time_range: AnalyticsTimeRange
    group_by: Optional[str] = Field(None, pattern="^(hour|day|week|month)$")

class AnalyticsDataPoint(BaseModel):
    timestamp: datetime
    value: float
    metadata: Optional[Dict[str, Any]] = None

class AnalyticsResponse(BaseModel):
    metric: AnalyticsMetric
    time_range: AnalyticsTimeRange
    data_points: List[AnalyticsDataPoint]
    total: float
    change_percentage: Optional[float] = None

# ============================================================================
# BULK OPERATIONS SCHEMAS
# ============================================================================

class BulkUserAction(str, Enum):
    SUSPEND = "suspend"
    ACTIVATE = "activate"
    UPDATE_PLAN = "update_plan"
    SEND_EMAIL = "send_email"

class BulkUserOperation(BaseModel):
    user_ids: List[int] = Field(..., min_items=1, max_items=1000)
    action: BulkUserAction
    parameters: Dict[str, Any] = Field(default_factory=dict)
    reason: Optional[str] = None

class BulkOperationResult(BaseModel):
    total_requested: int
    successful: int
    failed: int
    errors: List[Dict[str, str]]

# ============================================================================
# EXPORT SCHEMAS
# ============================================================================

class ExportFormat(str, Enum):
    CSV = "csv"
    JSON = "json"
    XLSX = "xlsx"

class ExportRequest(BaseModel):
    data_type: str = Field(..., pattern="^(users|sandboxes|billing|audit_logs)$")
    format: ExportFormat = Field(default=ExportFormat.CSV)
    date_range: Optional[Dict[str, datetime]] = None
    filters: Optional[Dict[str, Any]] = None

class ExportResponse(BaseModel):
    export_id: str
    status: str
    download_url: Optional[str] = None
    created_at: datetime
    expires_at: datetime
