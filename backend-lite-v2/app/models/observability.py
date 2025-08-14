from __future__ import annotations
import datetime as dt
from typing import Optional, Any
from sqlalchemy import (
    Column, String, DateTime, Integer, Boolean, Numeric, Text, JSON, Index
)
from sqlalchemy.orm import declarative_base

BaseObs = declarative_base(name="BaseObs")


class UsageEvent(BaseObs):
    __tablename__ = "usage_event"

    id = Column(String, primary_key=True)
    ts = Column(DateTime(timezone=True), default=dt.datetime.utcnow, nullable=False)
    tenant_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=True)
    workspace_id = Column(String, nullable=True)
    session_id = Column(String, nullable=False, index=True)
    run_id = Column(String, nullable=False, index=True)
    step_id = Column(String, nullable=False, index=True)
    parent_step_id = Column(String, nullable=True)
    agent_name = Column(String, nullable=True)
    tool_name = Column(String, nullable=True)
    provider = Column(String, nullable=False)
    model = Column(String, nullable=False)
    model_version = Column(String, nullable=True)
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    token_breakdown = Column(JSON, nullable=True)
    cache_hit = Column(Boolean, nullable=False, default=False)
    retries = Column(Integer, nullable=False, default=0)
    latency_ms = Column(Integer, nullable=False, default=0)
    cost_usd = Column(Numeric(12, 6), nullable=False, default=0)
    status = Column(String, nullable=False, default="ok")  # ok | error
    error_code = Column(Text, nullable=True)
    source = Column(String, nullable=False, default="provider")  # provider | estimated
    redaction_applied = Column(Boolean, nullable=False, default=False)
    prompt_digest = Column(Text, nullable=True)
    completion_digest = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_usage_event_ts", "ts"),
        Index("idx_usage_event_tenant_ts", "tenant_id", "ts"),
        Index("idx_usage_event_provider_model", "provider", "model"),
        Index("idx_usage_event_status", "status"),
    )


class TenantBudget(BaseObs):
    __tablename__ = "tenant_budget"

    tenant_id = Column(String, primary_key=True)
    period = Column(String, primary_key=True)  # daily | monthly
    period_start = Column(DateTime(timezone=False), primary_key=True)  # date
    soft_limit_usd = Column(Numeric, nullable=False)
    hard_limit_usd = Column(Numeric, nullable=False)
    usage_to_date_usd = Column(Numeric, nullable=False, default=0)
    state = Column(String, nullable=False, default="ok")  # ok | soft_exceeded | hard_blocked


class ModelPricing(BaseObs):
    __tablename__ = "model_pricing"

    provider = Column(String, primary_key=True)
    model = Column(String, primary_key=True)
    effective_from = Column(DateTime(timezone=True), primary_key=True, default=dt.datetime.utcnow)
    input_per_1k = Column(Numeric, nullable=False)
    output_per_1k = Column(Numeric, nullable=False)
    reasoning_per_1k = Column(Numeric, nullable=True)
    cache_discount = Column(Numeric, nullable=True)
