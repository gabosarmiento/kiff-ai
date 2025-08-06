"""
Billing-focused Observability Module
====================================

This module extends LangTrace observability with billing and consumption tracking
for multi-tenant SaaS platform with pay-per-consumption model.

Key Features:
- Token consumption tracking per agent and per tenant
- Real-time billing metrics
- Commission calculation
- Stripe integration preparation
- Admin dashboard data
"""

import os
import logging
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from decimal import Decimal
import json

from app.core.langtrace_config import (
    trace_agno_agent, log_agent_interaction, is_langtrace_enabled,
    add_trace_metadata
)

logger = logging.getLogger(__name__)

@dataclass
class TokenConsumption:
    """Token consumption record for billing purposes"""
    tenant_id: str
    user_id: str
    agent_name: str
    agent_type: str  # e.g., "groq_llm", "knowledge_engine", "trading_agent"
    session_id: Optional[str]
    timestamp: datetime
    input_tokens: int
    output_tokens: int
    total_tokens: int
    model_used: str
    cost_per_token: Decimal  # Cost in USD per token
    total_cost: Decimal  # Total cost for this operation
    commission_rate: Decimal  # Commission rate (e.g., 0.15 for 15%)
    commission_amount: Decimal  # Commission amount
    operation_type: str  # e.g., "generate_application", "knowledge_search"
    success: bool
    # New modular fields
    consumption_context: str  # "user", "admin", "system", "preprocessing"
    billable_to: str  # "tenant", "admin", "system" - who gets billed
    api_endpoint: Optional[str] = None  # Which API endpoint triggered this
    batch_id: Optional[str] = None  # For batch operations like API indexing
    error_message: Optional[str] = None

@dataclass
class TenantBillingMetrics:
    """Aggregated billing metrics per tenant"""
    tenant_id: str
    period_start: datetime
    period_end: datetime
    total_tokens: int
    total_cost: Decimal
    total_commission: Decimal
    operations_count: int
    successful_operations: int
    failed_operations: int
    agents_used: List[str]
    top_consuming_agent: str
    last_updated: datetime

class BillingObservabilityService:
    """
    Service for tracking token consumption and billing metrics
    across all agents and tenants
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # In-memory storage for real-time metrics (should be replaced with database)
        self.consumption_records: List[TokenConsumption] = []
        self.tenant_metrics: Dict[str, TenantBillingMetrics] = {}
        
        # Configuration
        self.commission_rate = Decimal(os.getenv("BILLING_COMMISSION_RATE", "0.15"))  # 15% default
        self.token_pricing = self._load_token_pricing()
        
        # Demo account configuration - bypass charging but track everything
        self.demo_accounts = {
            "bob@kiff.ai",
            "demo@kiff.ai",
            "test@kiff.ai"
        }
        
        # Note: No billing thresholds or caps - tracking is for transparency only
        
        self.logger.info(f"🏦 Billing Observability Service initialized with {self.commission_rate*100}% commission rate")
        self.logger.info(f"📋 Demo accounts (free usage): {', '.join(self.demo_accounts)}")
    
    def _load_token_pricing(self) -> Dict[str, Decimal]:
        """Load token pricing for different models"""
        # These should come from your configuration or database
        return {
            "llama-3.3-70b-versatile": Decimal("0.000001"),  # $0.000001 per token
            "llama3-8b-8192": Decimal("0.0000005"),
            "mixtral-8x7b-32768": Decimal("0.0000008"),
            "llama3-70b-8192": Decimal("0.000001"),
            "default": Decimal("0.000001")
        }
    
    def get_token_cost(self, model: str, token_count: int) -> Decimal:
        """Calculate cost for tokens based on model pricing"""
        cost_per_token = self.token_pricing.get(model, self.token_pricing["default"])
        return cost_per_token * Decimal(token_count)
    
    def calculate_commission(self, total_cost: Decimal) -> Decimal:
        """Calculate commission amount"""
        return total_cost * self.commission_rate
    
    def is_demo_account(self, user_id: str) -> bool:
        """Check if user is a demo account (free usage)"""
        return user_id in self.demo_accounts
    
    async def track_agent_consumption(
        self,
        tenant_id: str,
        user_id: str,
        agent_name: str,
        agent_type: str,
        operation_type: str,
        input_tokens: int,
        output_tokens: int,
        model_used: str,
        success: bool = True,
        error_message: Optional[str] = None,
        session_id: Optional[str] = None,
        consumption_context: str = "user",  # "user", "admin", "system", "preprocessing"
        billable_to: str = "tenant",  # "tenant", "admin", "system"
        api_endpoint: Optional[str] = None,
        batch_id: Optional[str] = None
    ) -> TokenConsumption:
        """
        Track token consumption for billing purposes
        """
        try:
            total_tokens = input_tokens + output_tokens
            total_cost = self.get_token_cost(model_used, total_tokens)
            commission_amount = self.calculate_commission(total_cost)
            
            # Check if this is a demo account
            is_demo = self.is_demo_account(user_id)
            
            # For demo accounts, track everything but set costs to zero for billing
            billing_cost = Decimal("0") if is_demo else total_cost
            billing_commission = Decimal("0") if is_demo else commission_amount
            
            consumption = TokenConsumption(
                tenant_id=tenant_id,
                user_id=user_id,
                agent_name=agent_name,
                agent_type=agent_type,
                session_id=session_id,
                timestamp=datetime.now(timezone.utc),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                model_used=model_used,
                cost_per_token=self.get_token_cost(model_used, 1),
                total_cost=billing_cost,  # Zero for demo accounts
                commission_rate=self.commission_rate,
                commission_amount=billing_commission,  # Zero for demo accounts
                operation_type=operation_type,
                success=success,
                consumption_context=consumption_context,
                billable_to=billable_to,
                api_endpoint=api_endpoint,
                batch_id=batch_id,
                error_message=error_message
            )
            
            # Store consumption record (in production, save to database)
            self.consumption_records.append(consumption)
            
            # Update tenant metrics
            await self._update_tenant_metrics(consumption)
            
            # Add to LangTrace metadata for observability
            if is_langtrace_enabled():
                add_trace_metadata({
                    "billing_tenant_id": tenant_id,
                    "billing_user_id": user_id,
                    "billing_total_tokens": total_tokens,
                    "billing_total_cost": float(total_cost),
                    "billing_commission": float(commission_amount),
                    "billing_model": model_used
                })
            
            # Log for monitoring and transparency (no enforcement)
            self.logger.info(
                f"📊 Token consumption tracked: {agent_name} | "
                f"Tenant: {tenant_id} | Tokens: {total_tokens} | "
                f"Cost: ${total_cost:.6f} | Commission: ${commission_amount:.6f} | "
                f"Context: {consumption_context}"
            )
            
            return consumption
            
        except Exception as e:
            self.logger.error(f"Error tracking agent consumption: {e}")
            raise
    
    # Convenience methods for different consumption contexts
    
    async def track_user_consumption(
        self, tenant_id: str, user_id: str, agent_name: str, agent_type: str,
        operation_type: str, input_tokens: int, output_tokens: int, model_used: str,
        success: bool = True, session_id: Optional[str] = None, api_endpoint: Optional[str] = None
    ) -> TokenConsumption:
        """Track consumption for user-facing operations"""
        return await self.track_agent_consumption(
            tenant_id=tenant_id, user_id=user_id, agent_name=agent_name,
            agent_type=agent_type, operation_type=operation_type,
            input_tokens=input_tokens, output_tokens=output_tokens,
            model_used=model_used, success=success, session_id=session_id,
            consumption_context="user", billable_to="tenant", api_endpoint=api_endpoint
        )
    
    async def track_admin_consumption(
        self, operation_type: str, input_tokens: int, output_tokens: int, model_used: str,
        agent_name: str = "admin_agent", agent_type: str = "admin_operation",
        success: bool = True, batch_id: Optional[str] = None, api_endpoint: Optional[str] = None
    ) -> TokenConsumption:
        """Track consumption for admin operations (API preprocessing, indexing, etc.)"""
        return await self.track_agent_consumption(
            tenant_id="admin", user_id="admin@kiff.ai", agent_name=agent_name,
            agent_type=agent_type, operation_type=operation_type,
            input_tokens=input_tokens, output_tokens=output_tokens,
            model_used=model_used, success=success, batch_id=batch_id,
            consumption_context="admin", billable_to="admin", api_endpoint=api_endpoint
        )
    
    async def track_system_consumption(
        self, operation_type: str, input_tokens: int, output_tokens: int, model_used: str,
        agent_name: str = "system_agent", agent_type: str = "system_operation",
        success: bool = True, batch_id: Optional[str] = None
    ) -> TokenConsumption:
        """Track consumption for system operations (background tasks, maintenance, etc.)"""
        return await self.track_agent_consumption(
            tenant_id="system", user_id="system@kiff.ai", agent_name=agent_name,
            agent_type=agent_type, operation_type=operation_type,
            input_tokens=input_tokens, output_tokens=output_tokens,
            model_used=model_used, success=success, batch_id=batch_id,
            consumption_context="system", billable_to="system"
        )
    
    async def track_preprocessing_consumption(
        self, operation_type: str, input_tokens: int, output_tokens: int, model_used: str,
        batch_id: str, agent_name: str = "preprocessing_agent", agent_type: str = "api_indexing",
        success: bool = True, api_endpoint: Optional[str] = None
    ) -> TokenConsumption:
        """Track consumption for API preprocessing and indexing operations"""
        return await self.track_agent_consumption(
            tenant_id="admin", user_id="admin@kiff.ai", agent_name=agent_name,
            agent_type=agent_type, operation_type=operation_type,
            input_tokens=input_tokens, output_tokens=output_tokens,
            model_used=model_used, success=success, batch_id=batch_id,
            consumption_context="preprocessing", billable_to="admin", api_endpoint=api_endpoint
        )
    
    async def _update_tenant_metrics(self, consumption: TokenConsumption):
        """Update aggregated tenant metrics"""
        tenant_id = consumption.tenant_id
        
        if tenant_id not in self.tenant_metrics:
            self.tenant_metrics[tenant_id] = TenantBillingMetrics(
                tenant_id=tenant_id,
                period_start=consumption.timestamp,
                period_end=consumption.timestamp,
                total_tokens=0,
                total_cost=Decimal("0"),
                total_commission=Decimal("0"),
                operations_count=0,
                successful_operations=0,
                failed_operations=0,
                agents_used=[],
                top_consuming_agent="",
                last_updated=consumption.timestamp
            )
        
        metrics = self.tenant_metrics[tenant_id]
        metrics.total_tokens += consumption.total_tokens
        metrics.total_cost += consumption.total_cost
        metrics.total_commission += consumption.commission_amount
        metrics.operations_count += 1
        
        if consumption.success:
            metrics.successful_operations += 1
        else:
            metrics.failed_operations += 1
        
        if consumption.agent_name not in metrics.agents_used:
            metrics.agents_used.append(consumption.agent_name)
        
        metrics.period_end = consumption.timestamp
        metrics.last_updated = consumption.timestamp
        
        # Update top consuming agent (simplified logic)
        agent_consumption = {}
        for record in self.consumption_records:
            if record.tenant_id == tenant_id:
                if record.agent_name not in agent_consumption:
                    agent_consumption[record.agent_name] = 0
                agent_consumption[record.agent_name] += record.total_tokens
        
        if agent_consumption:
            metrics.top_consuming_agent = max(agent_consumption, key=agent_consumption.get)
    
    # Note: No billing threshold checking - tracking is for transparency only
    
    def get_tenant_billing_summary(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get billing summary for a tenant"""
        if tenant_id not in self.tenant_metrics:
            return None
        
        metrics = self.tenant_metrics[tenant_id]
        return {
            "tenant_id": tenant_id,
            "current_period": {
                "start": metrics.period_start.isoformat(),
                "end": metrics.period_end.isoformat(),
                "total_tokens": metrics.total_tokens,
                "total_cost": float(metrics.total_cost),
                "total_commission": float(metrics.total_commission),
                "net_cost": float(metrics.total_cost - metrics.total_commission),
            },
            "operations": {
                "total": metrics.operations_count,
                "successful": metrics.successful_operations,
                "failed": metrics.failed_operations,
                "success_rate": (metrics.successful_operations / metrics.operations_count * 100) if metrics.operations_count > 0 else 0
            },
            "agents": {
                "used": metrics.agents_used,
                "top_consumer": metrics.top_consuming_agent
            },
            "transparency_note": "Token consumption tracked for transparency - no usage limits enforced"
        }
    
    def get_all_tenant_summaries(self) -> List[Dict[str, Any]]:
        """Get billing summaries for all tenants"""
        return [
            self.get_tenant_billing_summary(tenant_id)
            for tenant_id in self.tenant_metrics.keys()
        ]
    
    def get_consumption_history(
        self, 
        tenant_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get consumption history for analysis"""
        records = self.consumption_records
        
        if tenant_id:
            records = [r for r in records if r.tenant_id == tenant_id]
        
        # Sort by timestamp (newest first) and limit
        records = sorted(records, key=lambda x: x.timestamp, reverse=True)[:limit]
        
        return [asdict(record) for record in records]
    
    def get_consumption_by_context(
        self, 
        context: str,  # "user", "admin", "system", "preprocessing"
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get consumption history filtered by context"""
        records = [r for r in self.consumption_records if r.consumption_context == context]
        records = sorted(records, key=lambda x: x.timestamp, reverse=True)[:limit]
        return [asdict(record) for record in records]
    
    def get_admin_consumption_summary(self) -> Dict[str, Any]:
        """Get summary of admin consumption (preprocessing, indexing, etc.)"""
        admin_records = [r for r in self.consumption_records if r.consumption_context in ["admin", "preprocessing"]]
        
        if not admin_records:
            return {
                "total_tokens": 0,
                "total_operations": 0,
                "preprocessing_tokens": 0,
                "admin_tokens": 0,
                "batch_operations": 0,
                "api_endpoints_processed": 0
            }
        
        total_tokens = sum(r.total_tokens for r in admin_records)
        preprocessing_tokens = sum(r.total_tokens for r in admin_records if r.consumption_context == "preprocessing")
        admin_tokens = sum(r.total_tokens for r in admin_records if r.consumption_context == "admin")
        batch_operations = len(set(r.batch_id for r in admin_records if r.batch_id))
        api_endpoints = len(set(r.api_endpoint for r in admin_records if r.api_endpoint))
        
        return {
            "total_tokens": total_tokens,
            "total_operations": len(admin_records),
            "preprocessing_tokens": preprocessing_tokens,
            "admin_tokens": admin_tokens,
            "batch_operations": batch_operations,
            "api_endpoints_processed": api_endpoints,
            "recent_batches": list(set(r.batch_id for r in admin_records[-10:] if r.batch_id))
        }
    
    def get_batch_consumption(self, batch_id: str) -> Dict[str, Any]:
        """Get consumption summary for a specific batch operation"""
        batch_records = [r for r in self.consumption_records if r.batch_id == batch_id]
        
        if not batch_records:
            return {"batch_id": batch_id, "message": "No records found for this batch"}
        
        total_tokens = sum(r.total_tokens for r in batch_records)
        successful_ops = sum(1 for r in batch_records if r.success)
        
        return {
            "batch_id": batch_id,
            "total_tokens": total_tokens,
            "total_operations": len(batch_records),
            "successful_operations": successful_ops,
            "failed_operations": len(batch_records) - successful_ops,
            "start_time": min(r.timestamp for r in batch_records).isoformat(),
            "end_time": max(r.timestamp for r in batch_records).isoformat(),
            "agents_used": list(set(r.agent_name for r in batch_records)),
            "api_endpoints": list(set(r.api_endpoint for r in batch_records if r.api_endpoint))
        }

# Global billing service instance
_billing_service: Optional[BillingObservabilityService] = None

def get_billing_service() -> BillingObservabilityService:
    """Get the global billing observability service instance"""
    global _billing_service
    if _billing_service is None:
        _billing_service = BillingObservabilityService()
    return _billing_service

def billing_aware_agent_trace(
    agent_name: str,
    agent_type: str,
    operation_type: str
):
    """
    Enhanced decorator that combines LangTrace observability with billing tracking
    
    Usage:
        @billing_aware_agent_trace("GroqLLMService", "groq_llm", "generate_application")
        async def my_agent_method(self, tenant_id: str, user_id: str, ...):
            # Your agent code here
            pass
    """
    def decorator(func):
        # Apply LangTrace decorator first
        traced_func = trace_agno_agent(f"{agent_type}_{operation_type}")(func)
        
        async def wrapper(*args, **kwargs):
            # Extract tenant and user info from kwargs or args
            tenant_id = kwargs.get('tenant_id') or (args[1] if len(args) > 1 else None)
            user_id = kwargs.get('user_id') or (args[2] if len(args) > 2 else None)
            
            if not tenant_id or not user_id:
                logger.warning(f"Missing tenant_id or user_id for billing tracking in {agent_name}")
                return await traced_func(*args, **kwargs)
            
            try:
                # Execute the original function
                result = await traced_func(*args, **kwargs)
                
                # Extract token usage from result (if available)
                tokens_used = 0
                model_used = "unknown"
                
                if isinstance(result, dict):
                    tokens_used = result.get('tokens_used', 0)
                    model_used = result.get('model_used', 'unknown')
                
                # Track consumption for billing
                if tokens_used > 0:
                    billing_service = get_billing_service()
                    await billing_service.track_agent_consumption(
                        tenant_id=tenant_id,
                        user_id=user_id,
                        agent_name=agent_name,
                        agent_type=agent_type,
                        operation_type=operation_type,
                        input_tokens=tokens_used // 2,  # Rough estimate
                        output_tokens=tokens_used // 2,  # Rough estimate
                        model_used=model_used,
                        success=True
                    )
                
                return result
                
            except Exception as e:
                # Track failed operation for billing
                billing_service = get_billing_service()
                await billing_service.track_agent_consumption(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    agent_name=agent_name,
                    agent_type=agent_type,
                    operation_type=operation_type,
                    input_tokens=0,
                    output_tokens=0,
                    model_used="unknown",
                    success=False,
                    error_message=str(e)
                )
                raise
        
        return wrapper
    return decorator
