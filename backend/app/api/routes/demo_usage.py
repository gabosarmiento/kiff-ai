"""
Demo Usage Tracking API
=======================

Simple API endpoints for demo token consumption transparency.
Shows clear token usage per tenant without payment complexity.
"""

from fastapi import APIRouter, Depends, Query
from typing import List, Optional, Dict, Any

from app.core.demo_token_tracking import get_demo_tracker, DemoTokenTracker
from app.middleware.tenant_middleware import get_current_tenant_id

router = APIRouter(prefix="/api/v1/demo/usage", tags=["demo-usage"])

@router.get("/dashboard")
async def get_usage_dashboard(
    tenant_id: str = Depends(get_current_tenant_id),
    tracker: DemoTokenTracker = Depends(get_demo_tracker)
) -> Dict[str, Any]:
    """
    Get token usage dashboard for current tenant - perfect for demo transparency
    """
    return tracker.get_tenant_dashboard(tenant_id)

@router.get("/agents")
async def get_agent_breakdown(
    tenant_id: str = Depends(get_current_tenant_id),
    tracker: DemoTokenTracker = Depends(get_demo_tracker)
) -> Dict[str, Any]:
    """
    Get token usage breakdown by agent for transparency
    """
    return {
        "tenant_id": tenant_id,
        "agents": tracker.get_agent_breakdown(tenant_id)
    }

@router.get("/admin/overview")
async def get_admin_overview(
    # TODO: Add admin check when needed
    tracker: DemoTokenTracker = Depends(get_demo_tracker)
) -> Dict[str, Any]:
    """
    Get overview of all tenants for admin dashboard (demo purposes)
    """
    return {
        "total_tenants": len(tracker.tenant_summaries),
        "tenants": tracker.get_all_tenants_overview(),
        "global_agents": tracker.get_agent_breakdown()
    }

@router.get("/transparency")
async def get_transparency_info() -> Dict[str, Any]:
    """
    Get transparency information for demo users
    """
    return {
        "message": "Token usage tracking for transparency",
        "what_we_track": [
            "Number of tokens used per operation",
            "Which AI agent performed the operation", 
            "Input and output token breakdown",
            "Success/failure status",
            "Timestamp of each operation"
        ],
        "what_we_dont_track": [
            "Actual content of your requests",
            "Personal data beyond user/tenant IDs",
            "Detailed conversation history"
        ],
        "demo_note": "During demo phase, all costs are covered. Token tracking is for transparency only.",
        "future_billing": "Future billing will be based on actual token consumption with clear pricing."
    }
