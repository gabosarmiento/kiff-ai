"""
Performance Optimization API Routes
=================================

API endpoints for managing performance optimization, resource allocation,
and processing tier management for optimal user experience.
"""

from fastapi import APIRouter, HTTPException, Query, Body, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import Dict, Any, Optional, List
from decimal import Decimal
import logging
import json
from datetime import datetime, timezone

from ...internal.performance_optimizer import (
    get_performance_optimizer, 
    ResourceTier, 
    TaskStatus,
    ProcessingTask
)
from ...core.fractional_billing import get_fractional_billing_service
from ...core.pricing_config import get_pricing_config

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/performance", tags=["Performance Optimization"])

@router.post("/submit-task")
async def submit_processing_task(
    tenant_id: str = Query(..., description="Tenant identifier"),
    user_id: str = Query(..., description="User identifier"),
    browser_session: str = Query(..., description="Browser session for resource optimization"),
    task_data: Dict[str, Any] = Body(..., description="Task processing data")
) -> Dict[str, Any]:
    """
    Submit a processing task with intelligent resource allocation
    
    Optimizes processing based on available resources and user tier preferences
    """
    try:
        optimizer = get_performance_optimizer()
        
        # Extract task parameters
        operation_type = task_data.get("operation_type", "api_indexing")
        complexity_score = task_data.get("complexity_score", 3)
        resource_tier = ResourceTier(task_data.get("resource_tier", "standard"))
        metadata = task_data.get("metadata", {})
        
        # Submit task for processing
        success, task, message = await optimizer.submit_processing_task(
            tenant_id=tenant_id,
            user_id=user_id,
            browser_session=browser_session,
            operation_type=operation_type,
            complexity_score=complexity_score,
            resource_tier=resource_tier,
            metadata=metadata
        )
        
        if not success:
            logger.warning(f"Task submission blocked: {message}")
            return {
                "success": False,
                "message": message,
                "recommendations": await _get_upgrade_recommendations(
                    tenant_id, complexity_score, resource_tier
                )
            }
        
        logger.info(f"✅ Task {task.task_id} submitted successfully for {operation_type}")
        
        return {
            "success": True,
            "task_id": task.task_id,
            "message": message,
            "estimated_completion": task.estimated_completion,
            "resource_tier": task.resource_tier.value,
            "stream_url": f"/api/performance/stream/{task.task_id}"
        }
        
    except Exception as e:
        logger.error(f"❌ Task submission failed: {e}")
        raise HTTPException(status_code=500, detail=f"Task submission failed: {str(e)}")

@router.get("/stream/{task_id}")
async def stream_task_progress(task_id: str):
    """
    Stream real-time task progress updates with performance optimization data
    """
    try:
        optimizer = get_performance_optimizer()
        
        async def generate_progress():
            async for update in optimizer.stream_task_progress(task_id):
                yield f"data: {json.dumps(update)}\n\n"
        
        return StreamingResponse(
            generate_progress(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Progress streaming failed: {e}")
        raise HTTPException(status_code=500, detail=f"Progress streaming failed: {str(e)}")

@router.get("/task/{task_id}/status")
async def get_task_status(task_id: str) -> Dict[str, Any]:
    """
    Get current task status and performance metrics
    """
    try:
        optimizer = get_performance_optimizer()
        task = optimizer.get_task_status(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return {
            "task_id": task.task_id,
            "status": task.status.value,
            "progress": task.completion_percentage,
            "current_operation": task.current_operation,
            "resource_tier": task.resource_tier.value,
            "estimated_completion": task.estimated_completion,
            "optimized_completion": task.optimized_completion,
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "performance_metrics": {
                "efficiency_gain": f"{(1 - task.optimized_completion / task.estimated_completion) * 100:.1f}%",
                "resource_optimization": f"{task.resource_tier.value} allocation"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Status retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=f"Status retrieval failed: {str(e)}")

@router.get("/session/{browser_session}/active-task")
async def get_session_task(browser_session: str) -> Dict[str, Any]:
    """
    Get active processing task for browser session
    """
    try:
        optimizer = get_performance_optimizer()
        task = optimizer.get_session_task(browser_session)
        
        if not task:
            return {"active_task": None}
        
        return {
            "active_task": {
                "task_id": task.task_id,
                "status": task.status.value,
                "progress": task.completion_percentage,
                "current_operation": task.current_operation,
                "resource_tier": task.resource_tier.value,
                "estimated_remaining": max(0, task.optimized_completion - 
                    ((datetime.now(timezone.utc) - task.started_at).total_seconds() 
                     if task.started_at else 0))
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Session task retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=f"Session task retrieval failed: {str(e)}")

@router.get("/optimization-recommendations")
async def get_optimization_recommendations(
    tenant_id: str = Query(..., description="Tenant identifier"),
    complexity_score: int = Query(3, description="Processing complexity score"),
    current_tier: str = Query("standard", description="Current resource tier")
) -> Dict[str, Any]:
    """
    Get performance optimization recommendations and upgrade options
    """
    try:
        optimizer = get_performance_optimizer()
        pricing_service = get_pricing_config()
        
        # Get base cost for recommendations
        base_cost = await pricing_service.calculate_fractional_cost(
            tenant_id=tenant_id,
            api_name="performance_optimization",
            original_cost=Decimal("5.0")
        )
        
        resource_tier = ResourceTier(current_tier)
        recommendations = optimizer.get_optimization_recommendations(
            base_cost=base_cost.fractional_cost,
            complexity_score=complexity_score,
            current_tier=resource_tier
        )
        
        logger.info(f"📈 Generated optimization recommendations for {tenant_id}")
        
        return {
            "success": True,
            "recommendations": recommendations,
            "system_load": await _get_system_performance_metrics(),
            "upgrade_benefits": await _get_tier_comparison(complexity_score)
        }
        
    except Exception as e:
        logger.error(f"❌ Recommendations generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Recommendations failed: {str(e)}")

@router.post("/upgrade-tier")
async def upgrade_processing_tier(
    tenant_id: str = Query(..., description="Tenant identifier"),
    user_id: str = Query(..., description="User identifier"),
    upgrade_data: Dict[str, Any] = Body(..., description="Upgrade request data")
) -> Dict[str, Any]:
    """
    Process immediate tier upgrade for priority processing
    """
    try:
        billing_service = get_fractional_billing_service()
        optimizer = get_performance_optimizer()
        
        upgrade_type = upgrade_data.get("upgrade_type", "priority")  # priority, premium, subscription
        base_cost = Decimal(str(upgrade_data.get("base_cost", "0.20")))
        
        if upgrade_type == "priority":
            # Immediate priority processing upgrade
            priority_cost, time_value = optimizer.calculate_priority_pricing(base_cost)
            
            # Process billing for priority upgrade
            billing_result = await billing_service.process_fractional_payment(
                tenant_id=tenant_id,
                user_id=user_id,
                amount=priority_cost,
                description=f"Priority processing upgrade - immediate resource allocation",
                api_name="priority_processing"
            )
            
            if billing_result.success:
                logger.info(f"💰 Priority upgrade processed: ${priority_cost} for {tenant_id}")
                return {
                    "success": True,
                    "upgrade_type": "priority",
                    "cost_charged": float(priority_cost),
                    "time_saved": f"Skip processing queue - immediate start",
                    "new_tier": "priority",
                    "benefits": [
                        "3x faster processing",
                        "Skip resource optimization queue", 
                        "Immediate processing start",
                        "Enhanced resource allocation"
                    ]
                }
            else:
                return {
                    "success": False,
                    "error": billing_result.error_message,
                    "required_balance": float(priority_cost)
                }
        
        elif upgrade_type == "subscription":
            # Premium subscription upgrade
            return {
                "success": True,
                "upgrade_type": "subscription",
                "redirect_url": "/subscription/premium-early-access",
                "promotional_offer": {
                    "regular_price": "$99.00/month",
                    "promotional_price": "$15.00/month", 
                    "savings": "85% off",
                    "benefits": [
                        "5x faster processing",
                        "Unlimited parallel operations",
                        "Skip all processing queues",
                        "Premium resource allocation",
                        "Advanced algorithm optimization"
                    ]
                }
            }
        
        return {"success": False, "error": "Invalid upgrade type"}
        
    except Exception as e:
        logger.error(f"❌ Tier upgrade failed: {e}")
        raise HTTPException(status_code=500, detail=f"Tier upgrade failed: {str(e)}")

@router.get("/analytics/queue")
async def get_queue_analytics() -> Dict[str, Any]:
    """
    Get processing queue analytics and performance metrics
    """
    try:
        optimizer = get_performance_optimizer()
        analytics = optimizer.get_queue_analytics()
        
        return {
            "success": True,
            "analytics": analytics,
            "system_status": "operational",
            "performance_optimization": "active"
        }
        
    except Exception as e:
        logger.error(f"❌ Analytics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analytics failed: {str(e)}")

# Helper functions
async def _get_upgrade_recommendations(
    tenant_id: str, 
    complexity_score: int, 
    current_tier: ResourceTier
) -> Dict[str, Any]:
    """Generate upgrade recommendations for blocked sessions"""
    if current_tier == ResourceTier.STANDARD:
        return {
            "message": "⚡ Optimize your processing experience",
            "current_limitation": "Single operation processing - other operations must wait",
            "immediate_solution": {
                "name": "Priority Processing",
                "benefit": "Skip queue and process immediately",
                "cost": "$0.60",
                "time_saved": "Start processing now instead of waiting"
            },
            "premium_solution": {
                "name": "Premium Access",
                "benefit": "Unlimited parallel operations + 5x speed",
                "monthly_cost": "$99.00",
                "promotional_cost": "$15.00",
                "savings": "85% off early access pricing"
            },
            "performance_comparison": {
                "standard": f"~{complexity_score * 15} seconds (queue-based)",
                "priority": f"~{complexity_score * 5} seconds (immediate start)",
                "premium": f"~{complexity_score * 3} seconds (parallel + optimized)"
            }
        }
    
    return {"message": "You're using optimized processing resources"}

async def _get_system_performance_metrics() -> Dict[str, Any]:
    """Get current system performance metrics"""
    return {
        "current_load": "moderate",
        "average_wait_time": "2-3 minutes",
        "optimization_active": True,
        "resource_availability": {
            "standard": "limited - queue-based processing",
            "priority": "available - immediate processing",
            "premium": "optimal - dedicated resources"
        }
    }

async def _get_tier_comparison(complexity_score: int) -> Dict[str, Any]:
    """Get tier comparison for user education"""
    return {
        "processing_times": {
            "standard": f"{complexity_score * 15} seconds",
            "priority": f"{complexity_score * 5} seconds", 
            "premium": f"{complexity_score * 3} seconds"
        },
        "features": {
            "standard": ["Basic processing", "Queue-based", "Single operation"],
            "priority": ["3x faster", "Skip queue", "Immediate start"],
            "premium": ["5x faster", "Parallel operations", "Dedicated resources"]
        },
        "pricing": {
            "standard": "Free",
            "priority": "$0.60 per operation",
            "premium": "$15/month (85% off)"
        }
    }