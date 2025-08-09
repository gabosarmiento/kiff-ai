"""
Billing Token Consumption API Routes
====================================

API endpoints for billing-cycle-based token consumption tracking
"""

import logging
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.billing_token_service import BillingTokenService
from app.middleware.tenant_middleware import get_current_tenant

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/billing/consumption", tags=["billing-consumption"])

@router.get("/current")
async def get_current_cycle_consumption(
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query(..., description="User ID"), 
    db: AsyncSession = Depends(get_db)
):
    """Get token consumption for current billing cycle"""
    try:
        summary = await BillingTokenService.get_current_cycle_summary(
            db, tenant_id, user_id
        )
        
        if not summary:
            # Ensure billing cycle exists
            cycle = await BillingTokenService.ensure_active_billing_cycle(
                db, tenant_id, user_id
            )
            summary = await BillingTokenService.get_current_cycle_summary(
                db, tenant_id, user_id
            )
        
        return JSONResponse(content={
            "success": True,
            "data": {
                "consumption": summary.to_dict() if summary else {
                    "total_tokens": 0,
                    "formatted_total": "0 tokens"
                },
                "tenant_id": tenant_id,
                "user_id": user_id
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting current cycle consumption: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_consumption_history(
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query(..., description="User ID"),
    limit: int = Query(10, description="Number of cycles to return"),
    db: AsyncSession = Depends(get_db)
):
    """Get token consumption history across billing cycles"""
    try:
        history = await BillingTokenService.get_consumption_history(
            db, tenant_id, user_id, limit
        )
        
        return JSONResponse(content={
            "success": True,
            "data": {
                "history": history,
                "tenant_id": tenant_id,
                "user_id": user_id,
                "total_cycles": len(history)
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting consumption history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tenant-overview")
async def get_tenant_consumption_overview(
    tenant_id: str = Query(..., description="Tenant ID"),
    limit: int = Query(20, description="Number of users to return"),
    db: AsyncSession = Depends(get_db)
):
    """Get token consumption overview for all users in tenant (admin view)"""
    try:
        overview = await BillingTokenService.get_tenant_consumption_overview(
            db, tenant_id, limit
        )
        
        # Calculate tenant totals
        total_tokens = sum(
            item['consumption']['total_tokens'] 
            for item in overview 
            if item['consumption']
        )
        
        # Format total for display
        if total_tokens >= 1_000_000:
            formatted_total = f"{total_tokens / 1_000_000:.1f}M tokens"
        elif total_tokens >= 1_000:
            formatted_total = f"{total_tokens / 1_000:.1f}K tokens"
        else:
            formatted_total = f"{total_tokens} tokens"
        
        return JSONResponse(content={
            "success": True,
            "data": {
                "tenant_overview": overview,
                "tenant_id": tenant_id,
                "total_users": len(overview),
                "tenant_totals": {
                    "total_tokens": total_tokens,
                    "formatted_total": formatted_total
                }
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting tenant consumption overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard-summary")
async def get_dashboard_summary(
    tenant_id: str = Query(..., description="Tenant ID"),
    user_id: str = Query(..., description="User ID"),
    db: AsyncSession = Depends(get_db)
):
    """Get consumption summary for dashboard display"""
    try:
        summary = await BillingTokenService.get_current_cycle_summary(
            db, tenant_id, user_id
        )
        
        if not summary:
            # Ensure billing cycle exists
            await BillingTokenService.ensure_active_billing_cycle(
                db, tenant_id, user_id
            )
            summary = await BillingTokenService.get_current_cycle_summary(
                db, tenant_id, user_id
            )
        
        # Get billing cycle info
        from app.models.billing_models import BillingCycle
        from sqlalchemy import select
        from datetime import datetime, timezone
        
        now = datetime.now(timezone.utc)
        cycle_result = await db.execute(
            select(BillingCycle).where(
                BillingCycle.tenant_id == tenant_id,
                BillingCycle.user_id == user_id,
                BillingCycle.is_active == True,
                BillingCycle.cycle_start <= now,
                BillingCycle.cycle_end >= now
            )
        )
        cycle = cycle_result.scalar_one_or_none()
        
        # Calculate days remaining in cycle
        days_remaining = 0
        if cycle:
            days_remaining = (cycle.cycle_end - now).days
        
        return JSONResponse(content={
            "success": True,
            "data": {
                "consumption": summary.to_dict() if summary else {
                    "total_tokens": 0,
                    "formatted_total": "0 tokens"
                },
                "cycle_info": {
                    "cycle_start": cycle.cycle_start.isoformat() if cycle else None,
                    "cycle_end": cycle.cycle_end.isoformat() if cycle else None,
                    "days_remaining": days_remaining,
                    "cycle_type": cycle.cycle_type if cycle else "monthly",
                    "plan_type": cycle.plan_type if cycle else "free"
                },
                "display_summary": {
                    "tokens_used": summary.formatted_total if summary else "0 tokens",
                    "cycle_progress": f"{days_remaining} days left" if days_remaining > 0 else "Cycle ending soon"
                }
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting dashboard summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))