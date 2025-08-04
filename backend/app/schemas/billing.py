from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

class BillingRecordBase(BaseModel):
    tenant_id: int
    amount: Decimal
    currency: str = "USD"
    billing_period_start: datetime
    billing_period_end: datetime
    payment_method: Optional[str] = None

class BillingRecordCreate(BillingRecordBase):
    transaction_id: str

class BillingRecordUpdate(BaseModel):
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None
    paid_at: Optional[datetime] = None

class BillingRecordResponse(BaseModel):
    id: str
    tenant_name: str
    tenant_slug: str
    amount: float
    currency: str
    billing_period_start: datetime
    billing_period_end: datetime
    payment_status: str
    payment_method: Optional[str]
    transaction_id: str
    created_at: datetime
    paid_at: Optional[datetime]

    class Config:
        from_attributes = True

class BillingSummaryResponse(BaseModel):
    total_revenue: float
    monthly_revenue: float
    pending_payments: int
    failed_payments: int
    total_customers: int
    active_subscriptions: int
    churn_rate: float
    avg_revenue_per_user: float

class RefundRequest(BaseModel):
    reason: Optional[str] = None
    amount: Optional[Decimal] = None  # Partial refund amount

class BillingExportRequest(BaseModel):
    days: int = Field(30, description="Number of days to export")
    status: Optional[str] = None
    format: str = Field("csv", description="Export format")

class SubscriptionBase(BaseModel):
    tenant_id: int
    plan: str
    billing_cycle: str = "monthly"
    amount: Decimal
    currency: str = "USD"
    starts_at: datetime
    ends_at: Optional[datetime] = None

class SubscriptionCreate(SubscriptionBase):
    pass

class SubscriptionUpdate(BaseModel):
    plan: Optional[str] = None
    status: Optional[str] = None
    billing_cycle: Optional[str] = None
    amount: Optional[Decimal] = None
    ends_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

class SubscriptionResponse(BaseModel):
    id: str
    tenant_id: int
    plan: str
    status: str
    billing_cycle: str
    amount: float
    currency: str
    created_at: datetime
    updated_at: datetime
    starts_at: datetime
    ends_at: Optional[datetime]
    cancelled_at: Optional[datetime]

    class Config:
        from_attributes = True
