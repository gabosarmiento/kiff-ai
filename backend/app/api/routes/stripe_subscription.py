"""
Stripe Subscription Management API Routes
======================================

API endpoints for managing Stripe-based subscriptions with three tiers:
- Free Plan: Limited usage
- Pay-per-token: Usage-based billing
- Pro Subscription: $20/month unlimited access
"""

from fastapi import APIRouter, HTTPException, Query, Body, Request
from typing import Dict, Any, Optional
import logging
import os
from decimal import Decimal
from datetime import datetime, timezone
import stripe

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/stripe-subscription", tags=["Stripe Subscription"])

# For demo purposes, use a valid UUID format tenant ID
DEMO_TENANT_ID = "550e8400-e29b-41d4-a716-446655440000"

# Initialize Stripe with API key
stripe_secret_key = os.getenv("STRIPE_SECRET_KEY")
if not stripe_secret_key or stripe_secret_key == "sk_test_...":
    logger.warning("⚠️  STRIPE_SECRET_KEY not configured. Stripe functionality will be limited.")
    stripe.api_key = None
else:
    stripe.api_key = stripe_secret_key

# Stripe Price IDs (these would be created in Stripe Dashboard)
SUBSCRIPTION_PLANS = {
    "pro_monthly": {
        "price_id": "price_1234567890",  # Replace with actual Stripe Price ID
        "name": "Pro Plan",
        "amount": 20.00,
        "currency": "usd",
        "interval": "month",
        "features": [
            "Unlimited API indexing",
            "Priority processing (5x faster)",
            "Advanced AI capabilities",
            "Premium support",
            "Export functionality",
            "Team collaboration",
            "Analytics dashboard"
        ]
    }
}

@router.post("/create-checkout-session")
async def create_checkout_session(
    tenant_id: str = Query("demo", description="Tenant identifier"),
    user_id: str = Query("demo_user", description="User identifier"),
    subscription_data: Dict[str, Any] = Body(..., description="Subscription details")
) -> Dict[str, Any]:
    """
    Create Stripe checkout session for Pro subscription
    """
    try:
        # Check if Stripe is configured
        if not stripe.api_key:
            raise HTTPException(
                status_code=503, 
                detail="Stripe not configured. Please contact administrator to set up payment processing."
            )
        
        plan_type = subscription_data.get("plan_type", "pro_monthly")
        success_url = subscription_data.get("success_url", "http://localhost:3000/subscription/success")
        cancel_url = subscription_data.get("cancel_url", "http://localhost:3000/subscription/cancel")
        
        if plan_type not in SUBSCRIPTION_PLANS:
            raise HTTPException(status_code=400, detail="Invalid subscription plan")
        
        plan = SUBSCRIPTION_PLANS[plan_type]
        
        # Create Stripe checkout session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': plan["price_id"],
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f"{success_url}?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=cancel_url,
            customer_email=subscription_data.get("email"),
            metadata={
                'tenant_id': tenant_id,
                'user_id': user_id,
                'plan_type': plan_type
            },
            subscription_data={
                'metadata': {
                    'tenant_id': tenant_id,
                    'user_id': user_id,
                    'plan_type': plan_type
                }
            },
            allow_promotion_codes=True,
            billing_address_collection='required'
        )
        
        logger.info(f"💳 Stripe checkout session created: {session.id} for {tenant_id}")
        
        return {
            "success": True,
            "checkout_session_id": session.id,
            "checkout_url": session.url,
            "plan_details": plan
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"❌ Stripe error: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Checkout session creation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Checkout session failed: {str(e)}")

@router.post("/setup-payment-method")
async def setup_payment_method(
    tenant_id: str = Query("demo", description="Tenant identifier"),
    user_id: str = Query("demo_user", description="User identifier"),
    setup_data: Dict[str, Any] = Body(..., description="Payment method setup details")
) -> Dict[str, Any]:
    """
    Create Stripe setup session for pay-per-token billing (requires payment method)
    """
    try:
        # Check if Stripe is configured
        if not stripe.api_key:
            raise HTTPException(
                status_code=503, 
                detail="Stripe not configured. Please contact administrator to set up payment processing."
            )
        
        plan_type = setup_data.get("plan_type", "pay_per_token")
        success_url = setup_data.get("success_url", "http://localhost:3000/subscription/success")
        cancel_url = setup_data.get("cancel_url", "http://localhost:3000/subscription/cancel")
        customer_email = setup_data.get("email")
        
        # Create or retrieve Stripe customer
        customer = None
        try:
            # Try to find existing customer by email
            customers = stripe.Customer.list(email=customer_email, limit=1)
            if customers.data:
                customer = customers.data[0]
            else:
                # Create new customer
                customer = stripe.Customer.create(
                    email=customer_email,
                    metadata={
                        'tenant_id': tenant_id,
                        'user_id': user_id,
                        'plan_type': plan_type
                    }
                )
        except Exception as e:
            logger.warning(f"Customer creation/lookup failed: {e}, creating new customer")
            customer = stripe.Customer.create(
                email=customer_email,
                metadata={
                    'tenant_id': tenant_id,
                    'user_id': user_id,
                    'plan_type': plan_type
                }
            )
        
        # Create setup session for payment method collection
        session = stripe.checkout.Session.create(
            customer=customer.id,
            payment_method_types=['card'],
            mode='setup',
            success_url=f"{success_url}&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=cancel_url,
            metadata={
                'tenant_id': tenant_id,
                'user_id': user_id,
                'plan_type': plan_type
            }
        )
        
        logger.info(f"💳 Stripe payment method setup session created: {session.id} for {tenant_id}")
        
        return {
            "success": True,
            "setup_session_id": session.id,
            "setup_url": session.url,
            "customer_id": customer.id,
            "plan_type": plan_type
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"❌ Stripe error: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Payment method setup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Setup failed: {str(e)}")

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events for subscription updates
    """
    try:
        payload = await request.body()
        sig_header = request.headers.get('stripe-signature')
        endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_...")
        
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
        
        # Handle the event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            if session['mode'] == 'setup':
                await handle_payment_method_setup_completed(session)
            else:
                await handle_successful_payment(session)
            
        elif event['type'] == 'customer.subscription.created':
            subscription = event['data']['object']
            await handle_subscription_created(subscription)
            
        elif event['type'] == 'customer.subscription.updated':
            subscription = event['data']['object']
            await handle_subscription_updated(subscription)
            
        elif event['type'] == 'customer.subscription.deleted':
            subscription = event['data']['object']
            await handle_subscription_cancelled(subscription)
            
        elif event['type'] == 'invoice.payment_succeeded':
            invoice = event['data']['object']
            await handle_payment_succeeded(invoice)
            
        elif event['type'] == 'invoice.payment_failed':
            invoice = event['data']['object']
            await handle_payment_failed(invoice)
        
        logger.info(f"📥 Stripe webhook processed: {event['type']}")
        return {"success": True}
        
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"❌ Stripe signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"❌ Webhook processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Webhook failed: {str(e)}")

@router.get("/subscription-status")
async def get_subscription_status(
    tenant_id: str = Query(..., description="Tenant identifier"),
    user_id: str = Query(..., description="User identifier")
) -> Dict[str, Any]:
    """
    Get current subscription status from Stripe
    """
    try:
        # In a real implementation, you'd look up the customer ID from your database
        # For now, return mock data based on tenant_id
        
        # Mock subscription status - replace with actual Stripe API calls
        subscription_status = {
            "has_active_subscription": False,
            "plan_type": "free",
            "plan_name": "Free Plan",
            "current_period_end": None,
            "status": "inactive",
            "usage_limits": {
                "api_calls_remaining": 100,
                "monthly_limit": 100,
                "reset_date": "2024-09-01"
            }
        }
        
        # Check if user has active subscription (this would be a database/Stripe lookup)
        has_pro_subscription = False  # Replace with actual lookup
        
        if has_pro_subscription:
            subscription_status.update({
                "has_active_subscription": True,
                "plan_type": "pro_monthly",
                "plan_name": "Pro Plan",
                "monthly_cost": 20.00,
                "status": "active",
                "current_period_end": "2024-09-01T00:00:00Z",
                "features": SUBSCRIPTION_PLANS["pro_monthly"]["features"],
                "usage_limits": {
                    "api_calls_remaining": "unlimited",
                    "monthly_limit": "unlimited"
                }
            })
        
        return {
            "success": True,
            "subscription": subscription_status,
            "available_plans": {
                "free": {
                    "name": "Free Plan",
                    "price": 0,
                    "features": ["100 API calls/month", "Basic support", "Standard processing"],
                    "limitations": ["Limited API calls", "Standard speed", "Basic features"]
                },
                "pay_per_token": {
                    "name": "Pay-per-token",
                    "price": "Pay per token",
                    "features": ["Pay only for tokens consumed", "No monthly commitment", "Transparent token billing", "Standard processing"],
                    "ideal_for": "Variable usage patterns"
                },
                "pro_monthly": {
                    "name": "Pro Plan",
                    "price": 20.00,
                    "features": SUBSCRIPTION_PLANS["pro_monthly"]["features"],
                    "ideal_for": "Power users and teams"
                }
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Subscription status lookup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Status lookup failed: {str(e)}")

@router.post("/cancel-subscription")
async def cancel_subscription(
    tenant_id: str = Query(..., description="Tenant identifier"),
    user_id: str = Query(..., description="User identifier"),
    cancel_data: Dict[str, Any] = Body(..., description="Cancellation details")
) -> Dict[str, Any]:
    """
    Cancel Stripe subscription
    """
    try:
        subscription_id = cancel_data.get("subscription_id")
        cancel_at_period_end = cancel_data.get("cancel_at_period_end", True)
        
        if not subscription_id:
            raise HTTPException(status_code=400, detail="Subscription ID required")
        
        # Cancel the subscription in Stripe
        if cancel_at_period_end:
            subscription = stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True
            )
        else:
            subscription = stripe.Subscription.delete(subscription_id)
        
        logger.info(f"📋 Subscription cancelled: {subscription_id} for {tenant_id}")
        
        return {
            "success": True,
            "message": "Subscription cancelled successfully",
            "subscription_id": subscription_id,
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "access_until": subscription.current_period_end if cancel_at_period_end else None
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"❌ Stripe cancellation error: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Subscription cancellation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Cancellation failed: {str(e)}")

@router.get("/billing-portal")
async def create_billing_portal_session(
    tenant_id: str = Query(..., description="Tenant identifier"),
    user_id: str = Query(..., description="User identifier"),
    return_url: str = Query(..., description="Return URL after portal session")
) -> Dict[str, Any]:
    """
    Create Stripe billing portal session for subscription management
    """
    try:
        # In a real implementation, look up customer ID from database
        customer_id = f"cus_demo_{tenant_id}"  # Replace with actual customer lookup
        
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        
        return {
            "success": True,
            "portal_url": session.url
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"❌ Stripe billing portal error: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Billing portal creation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Portal creation failed: {str(e)}")

# Webhook event handlers
async def handle_successful_payment(session):
    """Handle successful checkout session"""
    tenant_id = session['metadata']['tenant_id']
    user_id = session['metadata']['user_id'] 
    plan_type = session['metadata']['plan_type']
    
    # Update user subscription status in database
    logger.info(f"✅ Payment successful: {tenant_id} subscribed to {plan_type}")

async def handle_payment_method_setup_completed(session):
    """Handle successful payment method setup for pay-per-token billing"""
    tenant_id = session['metadata']['tenant_id']
    user_id = session['metadata']['user_id']
    plan_type = session['metadata']['plan_type']
    
    # Update user to pay-per-token plan in database
    # Store the customer ID and setup intent for future token billing
    logger.info(f"✅ Payment method setup completed: {tenant_id} enabled for {plan_type}")
    
    # In a real implementation, you would:
    # 1. Store customer ID in your database
    # 2. Set user plan to 'pay_per_token'
    # 3. Enable token usage tracking for this user
    # 4. Set up webhook to charge based on token usage

async def handle_subscription_created(subscription):
    """Handle new subscription creation"""
    tenant_id = subscription['metadata']['tenant_id']
    logger.info(f"🎉 Subscription created: {subscription['id']} for {tenant_id}")

async def handle_subscription_updated(subscription):
    """Handle subscription updates"""
    tenant_id = subscription['metadata']['tenant_id']
    logger.info(f"📝 Subscription updated: {subscription['id']} for {tenant_id}")

async def handle_subscription_cancelled(subscription):
    """Handle subscription cancellation"""
    tenant_id = subscription['metadata']['tenant_id']
    logger.info(f"📋 Subscription cancelled: {subscription['id']} for {tenant_id}")

async def handle_payment_succeeded(invoice):
    """Handle successful recurring payment"""
    logger.info(f"💰 Payment succeeded: {invoice['id']}")

async def handle_payment_failed(invoice):
    """Handle failed payment"""
    logger.info(f"❌ Payment failed: {invoice['id']}")