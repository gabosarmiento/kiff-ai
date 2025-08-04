from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SupportTicketBase(BaseModel):
    subject: str = Field(..., max_length=500)
    description: str
    priority: str = Field("medium", pattern="^(low|medium|high|urgent)$")
    category: str = Field("general", max_length=100)

class SupportTicketCreate(SupportTicketBase):
    pass

class SupportTicketUpdate(BaseModel):
    subject: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(open|in_progress|resolved|closed)$")
    priority: Optional[str] = Field(None, pattern="^(low|medium|high|urgent)$")
    category: Optional[str] = Field(None, max_length=100)
    assigned_admin_id: Optional[int] = None

class SupportTicketResponse(BaseModel):
    id: str
    user_id: int
    user_email: str
    tenant_name: str
    subject: str
    description: str
    status: str
    priority: str
    category: str
    assigned_admin_id: Optional[int]
    assigned_admin_name: Optional[str]
    created_at: datetime
    updated_at: datetime
    last_response_at: Optional[datetime]
    response_count: int

    class Config:
        from_attributes = True

class TicketResponseBase(BaseModel):
    message: str
    is_internal: bool = False

class TicketResponseCreate(TicketResponseBase):
    attachments: Optional[List[str]] = None

class TicketResponseUpdate(BaseModel):
    message: Optional[str] = None
    is_internal: Optional[bool] = None

class TicketResponseResponse(BaseModel):
    id: str
    ticket_id: str
    admin_id: Optional[int]
    admin_name: Optional[str]
    user_id: Optional[int]
    user_email: Optional[str]
    message: str
    is_internal: bool
    attachments: Optional[List[str]]
    created_at: datetime

    class Config:
        from_attributes = True

class TicketStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(open|in_progress|resolved|closed)$")

class TicketPriorityUpdate(BaseModel):
    priority: str = Field(..., pattern="^(low|medium|high|urgent)$")

class TicketAssignmentUpdate(BaseModel):
    admin_id: int

class SupportTicketListResponse(BaseModel):
    tickets: List[SupportTicketResponse]
    total: int
    page: int
    limit: int
    pages: int

class TicketResponseListResponse(BaseModel):
    responses: List[TicketResponseResponse]
    total: int
