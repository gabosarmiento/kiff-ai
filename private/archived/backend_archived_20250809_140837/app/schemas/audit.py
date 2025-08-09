from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class AuditLogBase(BaseModel):
    action: str = Field(..., max_length=255)
    target_type: str = Field(..., max_length=100)
    target_id: str = Field(..., max_length=255)
    details: Optional[Dict[str, Any]] = None
    severity: str = Field("medium", pattern="^(low|medium|high|critical)$")

class AuditLogCreate(AuditLogBase):
    admin_user_id: int
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class AuditLogUpdate(BaseModel):
    details: Optional[Dict[str, Any]] = None
    severity: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")

class AuditLogResponse(BaseModel):
    id: str
    admin_user_id: int
    admin_name: str
    admin_email: str
    action: str
    target_type: str
    target_id: str
    details: Optional[Dict[str, Any]]
    severity: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

class AuditSummaryResponse(BaseModel):
    total_actions: int
    unique_admins: int
    critical_actions: int
    recent_logins: int
    failed_attempts: int
    data_modifications: int

class AuditLogListResponse(BaseModel):
    logs: List[AuditLogResponse]
    total: int
    page: int
    limit: int
    pages: int

class AuditLogExportRequest(BaseModel):
    days: int = Field(7, description="Number of days to export")
    action: Optional[str] = None
    severity: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    format: str = Field("csv", description="Export format")

class AuditLogCleanupRequest(BaseModel):
    days: int = Field(90, description="Delete logs older than this many days")

class AuditActionRequest(BaseModel):
    action: str = Field(..., max_length=255)
    target_type: str = Field(..., max_length=100)
    target_id: str = Field(..., max_length=255)
    details: Dict[str, Any]
    severity: str = Field("medium", pattern="^(low|medium|high|critical)$")
