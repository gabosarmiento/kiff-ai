"""
Subscription Management API Routes
===============================

API endpoints for managing premium subscriptions, billing cycles,
and tier-based feature access for enhanced user experience.
"""

from fastapi import APIRouter, HTTPException, Query, Body, BackgroundTasks
from typing import Dict, Any, Optional, List
from decimal import Decimal
import logging
import json
from datetime import datetime, timedelta, timezone
from enum import Enum

from ...core.fractional_billing import get_fractional_billing_service
from ...internal.performance_optimizer import get_performance_optimizer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/subscription", tags=["Subscription Management"])

class SubscriptionTier(Enum):
    """Available subscription tiers"""
    FREE = "free"
    EARLY_ACCESS = "early_access_premium"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"

class SubscriptionStatus(Enum):
    """Subscription status types"""
    ACTIVE = "active"
    CANCELLED = "cancelled"
    PAST_DUE = "past_due"
    TRIALING = "trialing"
    EXPIRED = "expired"

@router.post("/subscribe")
async def create_subscription(
    tenant_id: str = Query(..., description="Tenant identifier"),
    user_id: str = Query(..., description="User identifier"),
    subscription_data: Dict[str, Any] = Body(..., description="Subscription details")
) -> Dict[str, Any]:
    """
    Create a new premium subscription with early access pricing
    """
    try:
        plan_type = subscription_data.get("plan_type", "early_access")
        payment_method = subscription_data.get("payment_method", "account_balance")
        
        # Define subscription pricing
        subscription_plans = {
            "early_access": {
                "name": "Premium Early Access",
                "monthly_cost": Decimal("15.00"),
                "original_cost": Decimal("99.00"),
                "discount": 85,
                "features": [
                    "5x faster processing",
                    "Unlimited parallel operations",
                    "Skip all processing queues",
                    "Priority resource allocation",
                    "Advanced algorithm optimization",
                    "Premium customer support",
                    "Early access to new features"
                ],
                "performance_tier": "premium"
            },
            "premium": {
                "name": "Premium Access",
                "monthly_cost": Decimal("99.00"),
                "original_cost": Decimal("99.00"),
                "discount": 0,
                "features": [
                    "5x faster processing",
                    "Unlimited parallel operations",
                    "Skip all processing queues",
                    "Priority resource allocation",
                    "Advanced algorithm optimization",
                    "Premium customer support"
                ],
                "performance_tier": "premium"
            }
        }
        
        if plan_type not in subscription_plans:
            raise HTTPException(status_code=400, detail="Invalid subscription plan")
        
        plan = subscription_plans[plan_type]
        billing_service = get_fractional_billing_service()
        
        # Process subscription payment
        if payment_method == "account_balance":
            # Charge from account balance
            billing_result = await billing_service.process_fractional_payment(
                tenant_id=tenant_id,
                user_id=user_id,
                amount=plan["monthly_cost"],
                description=f"{plan['name']} - Monthly subscription",
                api_name="premium_subscription"
            )
            
            if not billing_result.success:
                return {
                    "success": False,
                    "error": billing_result.error_message,
                    "required_balance": float(plan["monthly_cost"])
                }
        
        # Create subscription record (in a real system, this would be stored in database)
        subscription = {
            "subscription_id": f"sub_{tenant_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "tenant_id": tenant_id,
            "user_id": user_id,
            "plan_type": plan_type,
            "plan_name": plan["name"],
            "status": SubscriptionStatus.ACTIVE.value,
            "monthly_cost": float(plan["monthly_cost"]),
            "original_cost": float(plan["original_cost"]),
            "discount_percentage": plan["discount"],
            "features": plan["features"],
            "performance_tier": plan["performance_tier"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "current_period_start": datetime.now(timezone.utc).isoformat(),
            "current_period_end": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "next_billing_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "auto_renew": True
        }
        
        logger.info(f"💎 Premium subscription created: {subscription['subscription_id']} for {tenant_id}")
        
        return {
            "success": True,
            "subscription": subscription,
            "message": f"Welcome to {plan['name']}! Your premium features are now active.",
            "benefits_activated": [
                "5x faster processing speed",
                "Unlimited parallel operations", 
                "Skip all processing queues",
                "Premium resource allocation"
            ],
            "next_billing": {
                "date": subscription["next_billing_date"],
                "amount": plan["monthly_cost"]
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Subscription creation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Subscription creation failed: {str(e)}")

@router.get("/status")
async def get_subscription_status(
    tenant_id: str = Query(..., description="Tenant identifier"),
    user_id: str = Query(..., description="User identifier")
) -> Dict[str, Any]:
    """
    Get current subscription status and details
    """
    try:
        # In a real system, this would fetch from database
        # For demo, return mock subscription status
        
        # Check if user has active premium subscription
        has_premium = False  # This would be a database lookup
        
        if has_premium:
            return {
                "subscription_active": True,
                "plan_type": "early_access",
                "plan_name": "Premium Early Access",
                "status": "active",
                "features_enabled": [
                    "5x faster processing",
                    "Unlimited parallel operations",
                    "Skip all processing queues",
                    "Priority resource allocation"
                ],
                "current_period_end": (datetime.now(timezone.utc) + timedelta(days=15)).isoformat(),
                "next_billing_date": (datetime.now(timezone.utc) + timedelta(days=15)).isoformat(),
                "monthly_cost": 15.00
            }
        else:
            return {
                "subscription_active": False,
                "plan_type": "free",
                "plan_name": "Free Tier",
                "status": "free",
                "limitations": [
                    "Standard processing speed (1x)",
                    "Single operation processing",
                    "Queue-based resource allocation"
                ],
                "upgrade_available": {
                    "plan": "Premium Early Access",
                    "discount": "85% off",
                    "monthly_cost": 15.00,
                    "original_cost": 99.00
                }
            }
        
    except Exception as e:
        logger.error(f"❌ Subscription status lookup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Status lookup failed: {str(e)}")

@router.post("/cancel")
async def cancel_subscription(
    tenant_id: str = Query(..., description="Tenant identifier"),
    user_id: str = Query(..., description="User identifier"),
    cancel_data: Dict[str, Any] = Body(..., description="Cancellation details")
) -> Dict[str, Any]:
    """
    Cancel premium subscription (remains active until period end)
    """
    try:
        reason = cancel_data.get("reason", "user_request")
        immediate = cancel_data.get("immediate", False)
        
        # In a real system, this would update the database record
        cancellation = {
            "subscription_id": f"sub_{tenant_id}_demo",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "reason": reason,
            "immediate": immediate,
            "access_until": (datetime.now(timezone.utc) + timedelta(days=15)).isoformat() if not immediate else datetime.now(timezone.utc).isoformat(),
            "refund_eligible": not immediate
        }
        
        logger.info(f"📋 Subscription cancelled: {tenant_id} - Reason: {reason}")
        
        return {
            "success": True,
            "cancellation": cancellation,
            "message": "Subscription cancelled successfully" + (
                " - Access continues until period end" if not immediate else " - Access terminated immediately"
            ),
            "access_until": cancellation["access_until"],
            "refund_info": {
                "eligible": cancellation["refund_eligible"],
                "policy": "Full refund available within 30 days of subscription start"
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Subscription cancellation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Cancellation failed: {str(e)}")

@router.post("/modify")
async def modify_subscription(
    tenant_id: str = Query(..., description="Tenant identifier"),
    user_id: str = Query(..., description="User identifier"),
    modification_data: Dict[str, Any] = Body(..., description="Modification details")
) -> Dict[str, Any]:
    """
    Modify existing subscription (upgrade/downgrade)
    """
    try:
        new_plan = modification_data.get("new_plan_type", "premium")
        effective_date = modification_data.get("effective_date", "immediate")
        
        # Calculate pro-rated billing adjustments
        prorated_credit = Decimal("7.50")  # Example: half month credit
        additional_charge = Decimal("42.00")  # Example: upgrade cost difference
        
        modification = {
            "modification_id": f"mod_{tenant_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "old_plan": "early_access",
            "new_plan": new_plan,
            "effective_date": datetime.now(timezone.utc).isoformat() if effective_date == "immediate" else effective_date,
            "prorated_credit": float(prorated_credit),
            "additional_charge": float(additional_charge),
            "net_charge": float(additional_charge - prorated_credit)
        }
        
        logger.info(f"📝 Subscription modified: {tenant_id} - {modification['old_plan']} → {modification['new_plan']}")
        
        return {
            "success": True,
            "modification": modification,
            "message": f"Subscription updated to {new_plan} plan",
            "billing_adjustment": {
                "prorated_credit": float(prorated_credit),
                "additional_charge": float(additional_charge),
                "net_amount": float(additional_charge - prorated_credit)
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Subscription modification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Modification failed: {str(e)}")

@router.get("/usage-analytics")
async def get_subscription_usage(
    tenant_id: str = Query(..., description="Tenant identifier"),
    user_id: str = Query(..., description="User identifier"),
    period: str = Query("current", description="Usage period (current, last_month)")
) -> Dict[str, Any]:
    """
    Get subscription usage analytics and performance metrics
    """
    try:
        optimizer = get_performance_optimizer()
        
        # Get performance analytics
        queue_analytics = optimizer.get_queue_analytics()
        
        # Mock usage data (in real system, this would come from database)
        usage_analytics = {
            "period": period,
            "period_start": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat(),
            "period_end": datetime.now(timezone.utc).isoformat(),
            "subscription_value": {
                "total_operations": 47,
                "premium_operations": 23,
                "time_saved_minutes": 156,
                "queue_skips": 23,
                "estimated_value": 78.50
            },
            "performance_metrics": {
                "average_processing_time": "18 seconds",
                "fastest_processing_time": "8 seconds",
                "total_processing_time": "14 minutes",
                "time_without_premium": "84 minutes (estimated)",
                "efficiency_gain": "83%"
            },
            "feature_usage": {
                "parallel_operations": 12,
                "priority_queue_usage": 23,
                "premium_algorithms": 47,
                "dedicated_resources": 23
            },
            "cost_comparison": {
                "subscription_cost": 15.00,
                "pay_per_use_equivalent": 78.50,
                "savings": 63.50,
                "roi_percentage": 523
            }
        }
        
        return {
            "success": True,
            "usage_analytics": usage_analytics,
            "system_analytics": queue_analytics,
            "recommendations": {
                "message": "Your premium subscription saved you over 2 hours this month!",
                "value_statement": f"You saved ${usage_analytics['cost_comparison']['savings']:.2f} compared to pay-per-use pricing",
                "efficiency_tip": "You're using premium features efficiently - keep it up!"
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Usage analytics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analytics retrieval failed: {str(e)}")

@router.get("/billing-history")
async def get_billing_history(
    tenant_id: str = Query(..., description="Tenant identifier"),
    user_id: str = Query(..., description="User identifier"),
    limit: int = Query(10, description="Number of records to return")
) -> Dict[str, Any]:
    """
    Get subscription billing history and invoices
    """
    try:
        # Mock billing history (in real system, from database)
        billing_history = [
            {
                "invoice_id": "inv_001",
                "date": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat(),
                "description": "Premium Early Access - Monthly subscription",
                "amount": 15.00,
                "status": "paid",
                "payment_method": "account_balance"
            },
            {
                "invoice_id": "inv_002", 
                "date": (datetime.now(timezone.utc) - timedelta(days=35)).isoformat(),
                "description": "Premium Early Access - Monthly subscription",
                "amount": 15.00,
                "status": "paid",
                "payment_method": "account_balance"
            }
        ]
        
        return {
            "success": True,
            "billing_history": billing_history[:limit],
            "total_records": len(billing_history),
            "subscription_summary": {
                "total_paid": sum(item["amount"] for item in billing_history if item["status"] == "paid"),
                "average_monthly": 15.00,
                "subscription_duration_days": 65
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Billing history retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=f"Billing history failed: {str(e)}")