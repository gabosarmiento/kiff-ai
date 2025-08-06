"""
Billing Observability API Routes
================================

API endpoints for monitoring token consumption, billing metrics,
and tenant usage for the multi-tenant SaaS platform.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from app.core.billing_observability import get_billing_service, BillingObservabilityService
from app.middleware.tenant_middleware import get_current_tenant_id

router = APIRouter(prefix="/api/v1/billing", tags=["billing-observability"])

@router.get("/tenant/summary")
async def get_tenant_billing_summary(
    tenant_id: str = Depends(get_current_tenant_id),
    billing_service: BillingObservabilityService = Depends(get_billing_service)
) -> Dict[str, Any]:
    """
    Get billing summary for the current tenant
    """
    summary = billing_service.get_tenant_billing_summary(tenant_id)
    
    if not summary:
        return {
            "tenant_id": tenant_id,
            "message": "No billing data available yet",
            "current_period": {
                "total_tokens": 0,
                "total_cost": 0.0,
                "total_commission": 0.0,
                "net_cost": 0.0
            },
            "operations": {
                "total": 0,
                "successful": 0,
                "failed": 0,
                "success_rate": 0
            }
        }
    
    return summary

@router.get("/tenant/consumption-history")
async def get_tenant_consumption_history(
    limit: int = Query(default=50, le=500),
    tenant_id: str = Depends(get_current_tenant_id),
    billing_service: BillingObservabilityService = Depends(get_billing_service)
) -> List[Dict[str, Any]]:
    """
    Get consumption history for the current tenant
    """
    return billing_service.get_consumption_history(tenant_id=tenant_id, limit=limit)

@router.get("/admin/all-tenants")
async def get_all_tenants_billing(
    # TODO: Add admin authentication check
    billing_service: BillingObservabilityService = Depends(get_billing_service)
) -> List[Dict[str, Any]]:
    """
    Get billing summaries for all tenants (admin only)
    """
    # TODO: Implement admin role check
    # if not is_admin(current_user):
    #     raise HTTPException(status_code=403, detail="Admin access required")
    
    return billing_service.get_all_tenant_summaries()

@router.get("/admin/consumption-history")
async def get_all_consumption_history(
    limit: int = Query(default=100, le=1000),
    tenant_id: Optional[str] = Query(default=None),
    billing_service: BillingObservabilityService = Depends(get_billing_service)
) -> List[Dict[str, Any]]:
    """
    Get consumption history for all tenants or specific tenant (admin only)
    """
    # TODO: Implement admin role check
    return billing_service.get_consumption_history(tenant_id=tenant_id, limit=limit)

@router.get("/pricing")
async def get_pricing_info(
    billing_service: BillingObservabilityService = Depends(get_billing_service)
) -> Dict[str, Any]:
    """
    Get current pricing information for transparency
    """
    return {
        "commission_rate": float(billing_service.commission_rate),
        "commission_percentage": float(billing_service.commission_rate * 100),
        "token_pricing": {
            model: float(price) 
            for model, price in billing_service.token_pricing.items()
        },
        "transparency_note": "Token consumption tracked for transparency - no usage limits or caps enforced"
    }

@router.post("/webhook/stripe")
async def stripe_webhook_handler(
    # This will be implemented when you add Stripe integration
    billing_service: BillingObservabilityService = Depends(get_billing_service)
):
    """
    Handle Stripe webhook events for billing
    """
    # TODO: Implement Stripe webhook handling
    # - Payment successful
    # - Payment failed
    # - Subscription updated
    # - etc.
    return {"status": "webhook_received"}

@router.get("/tenant/usage-forecast")
async def get_usage_forecast(
    days: int = Query(default=30, ge=1, le=90),
    tenant_id: str = Depends(get_current_tenant_id),
    billing_service: BillingObservabilityService = Depends(get_billing_service)
) -> Dict[str, Any]:
    """
    Get usage forecast for the tenant based on historical data
    """
    # TODO: Implement usage forecasting based on historical consumption
    # This would analyze patterns and predict future usage
    
    summary = billing_service.get_tenant_billing_summary(tenant_id)
    if not summary:
        return {
            "tenant_id": tenant_id,
            "forecast_period_days": days,
            "message": "Insufficient data for forecasting"
        }
    
    # Simple forecast based on current usage (should be more sophisticated)
    current_daily_cost = float(summary["current_period"]["total_cost"]) / max(1, 
        (datetime.fromisoformat(summary["current_period"]["end"]) - 
         datetime.fromisoformat(summary["current_period"]["start"])).days)
    
    forecasted_cost = current_daily_cost * days
    
    return {
        "tenant_id": tenant_id,
        "forecast_period_days": days,
        "current_daily_average": current_daily_cost,
        "forecasted_total_cost": forecasted_cost,
        "forecasted_commission": forecasted_cost * float(billing_service.commission_rate),
        "transparency_note": "Forecast for transparency only - no usage limits will be enforced"
    }

# Modular consumption tracking endpoints

@router.get("/admin/consumption-summary")
async def get_admin_consumption_summary(
    # TODO: Add admin authentication check
    billing_service: BillingObservabilityService = Depends(get_billing_service)
) -> Dict[str, Any]:
    """
    Get admin consumption summary (preprocessing, API indexing, etc.)
    """
    return billing_service.get_admin_consumption_summary()

@router.get("/admin/consumption-by-context")
async def get_consumption_by_context(
    context: str = Query(..., regex="^(user|admin|system|preprocessing)$"),
    limit: int = Query(default=100, le=500),
    # TODO: Add admin authentication check
    billing_service: BillingObservabilityService = Depends(get_billing_service)
) -> List[Dict[str, Any]]:
    """
    Get consumption history filtered by context (admin only)
    """
    return billing_service.get_consumption_by_context(context, limit)

@router.get("/admin/batch/{batch_id}")
async def get_batch_consumption(
    batch_id: str,
    # TODO: Add admin authentication check
    billing_service: BillingObservabilityService = Depends(get_billing_service)
) -> Dict[str, Any]:
    """
    Get consumption summary for a specific batch operation (admin only)
    """
    return billing_service.get_batch_consumption(batch_id)
