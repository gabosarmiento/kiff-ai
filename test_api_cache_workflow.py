#!/usr/bin/env python3
"""
Test Script for API Indexing Cache Workflow
============================================

This script tests the complete cost-sharing cached indexing workflow:
1. Admin pre-indexes APIs
2. Users request access and pay fractional costs
3. Users get immediate access to cached vector databases

Usage:
    python test_api_cache_workflow.py
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add backend to Python path
sys.path.append(str(Path(__file__).parent / "backend"))

from app.core.api_indexing_cache import get_cache_service
from app.core.billing_observability import get_billing_service
from app.core.fractional_billing import get_fractional_billing_service
from app.core.pricing_config import get_pricing_config, PricingTier
from app.knowledge.api_gallery import get_api_gallery

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

async def test_admin_workflow():
    """Test the admin pre-indexing workflow"""
    logger.info("🔧 Testing Admin Pre-indexing Workflow")
    
    cache_service = get_cache_service()
    gallery = get_api_gallery()
    
    # Test 1: Pre-index a popular API
    api_name = "stripe"
    api = gallery.get_api(api_name)
    
    if not api:
        logger.error(f"❌ API '{api_name}' not found in gallery")
        return False
    
    logger.info(f"📚 Pre-indexing {api.display_name}...")
    success, cache_entry = await cache_service.admin_pre_index_api(api_name)
    
    if success:
        logger.info(f"✅ Pre-indexing successful!")
        logger.info(f"💰 Original cost: ${cache_entry.original_indexing_cost:.4f}")
        logger.info(f"💵 Fractional cost: ${cache_entry.fractional_cost:.2f}")
        logger.info(f"📊 URLs indexed: {cache_entry.total_urls_indexed}")
        logger.info(f"🔤 Tokens used: {cache_entry.tokens_used}")
        return True
    else:
        logger.error(f"❌ Pre-indexing failed")
        return False

async def test_user_workflow():
    """Test the user access workflow"""
    logger.info("👤 Testing User Access Workflow")
    
    cache_service = get_cache_service()
    
    # Test user requesting access
    tenant_id = "demo_tenant"
    user_id = "test_user@demo.com"
    api_name = "stripe"
    
    logger.info(f"🎫 User {user_id} requesting access to {api_name}...")
    success, user_access, message = await cache_service.user_request_api_access(
        tenant_id=tenant_id,
        user_id=user_id,
        api_name=api_name,
        simulate_indexing=True  # Show simulated indexing progress
    )
    
    if success:
        logger.info(f"✅ Access granted!")
        logger.info(f"💳 Cost paid: ${user_access.cost_paid:.2f}")
        logger.info(f"🔑 Access token: {user_access.access_token}")
        logger.info(f"⏰ Expires: {user_access.expires_at}")
        
        # Test knowledge base access
        logger.info("📚 Testing knowledge base access...")
        knowledge_base = await cache_service.get_user_api_knowledge_base(
            tenant_id=tenant_id,
            user_id=user_id,
            api_name=api_name,
            access_token=user_access.access_token
        )
        
        if knowledge_base:
            logger.info("✅ Knowledge base access successful!")
            return True
        else:
            logger.error("❌ Knowledge base access failed")
            return False
    else:
        logger.error(f"❌ Access denied: {message}")
        return False

async def test_billing_tracking():
    """Test billing and cost tracking"""
    logger.info("💰 Testing Billing Tracking")
    
    billing_service = get_billing_service()
    fractional_billing = get_fractional_billing_service()
    pricing_config = get_pricing_config()
    
    # Get admin consumption summary
    admin_summary = billing_service.get_admin_consumption_summary()
    logger.info(f"🔧 Admin consumption summary:")
    logger.info(f"   Total tokens: {admin_summary['total_tokens']}")
    logger.info(f"   Preprocessing tokens: {admin_summary['preprocessing_tokens']}")
    logger.info(f"   Batch operations: {admin_summary['batch_operations']}")
    
    # Get tenant billing summary
    tenant_summary = billing_service.get_tenant_billing_summary("demo_tenant")
    if tenant_summary:
        logger.info(f"👤 Tenant billing summary:")
        logger.info(f"   Total cost: ${tenant_summary['current_period']['total_cost']:.4f}")
        logger.info(f"   Operations: {tenant_summary['operations']['total']}")
        logger.info(f"   Success rate: {tenant_summary['operations']['success_rate']:.1f}%")
    
    # Test fractional billing
    fractional_summary = fractional_billing.get_tenant_billing_summary("demo_tenant")
    logger.info(f"💳 Fractional billing summary:")
    logger.info(f"   Credit balance: ${fractional_summary['balance']['credit_balance']:.2f}")
    logger.info(f"   Total saved: ${fractional_summary['balance']['total_saved']:.2f}")
    logger.info(f"   APIs accessed: {fractional_summary['usage']['apis_accessed']}")
    
    # Test pricing configuration
    config_summary = pricing_config.get_configuration_summary()
    logger.info(f"🎛️ Pricing configuration:")
    logger.info(f"   Active rules: {config_summary['active_rules']}")
    logger.info(f"   Tier configurations: {config_summary['tier_configurations']}")
    
    return True

async def test_cache_overview():
    """Test cache overview and analytics"""
    logger.info("📊 Testing Cache Overview")
    
    cache_service = get_cache_service()
    
    # Get admin overview
    overview = cache_service.get_admin_cache_overview()
    logger.info(f"🎯 Cache Overview:")
    logger.info(f"   Cached APIs: {overview['total_cached_apis']}")
    logger.info(f"   Original indexing cost: ${overview['total_original_indexing_cost']:.4f}")
    logger.info(f"   Fractional revenue: ${overview['total_fractional_revenue']:.2f}")
    logger.info(f"   Cost recovery ratio: {overview['cost_recovery_ratio']*100:.1f}%")
    
    # Get tenant access summary
    tenant_summary = cache_service.get_tenant_api_access_summary("demo_tenant")
    logger.info(f"👤 Tenant Access Summary:")
    logger.info(f"   APIs accessed: {tenant_summary['total_apis_accessed']}")
    logger.info(f"   Total cost paid: ${tenant_summary['total_cost_paid']:.2f}")
    logger.info(f"   Active access: {len(tenant_summary['active_access'])}")
    
    return True

async def main():
    """Run the complete workflow test"""
    logger.info("🚀 Starting API Indexing Cache Workflow Test")
    logger.info("=" * 60)
    
    try:
        # Test admin workflow
        admin_success = await test_admin_workflow()
        if not admin_success:
            logger.error("❌ Admin workflow test failed")
            return
        
        logger.info("-" * 40)
        
        # Test user workflow  
        user_success = await test_user_workflow()
        if not user_success:
            logger.error("❌ User workflow test failed")
            return
        
        logger.info("-" * 40)
        
        # Test billing tracking
        billing_success = await test_billing_tracking()
        if not billing_success:
            logger.error("❌ Billing tracking test failed")
            return
        
        logger.info("-" * 40)
        
        # Test cache overview
        overview_success = await test_cache_overview()
        if not overview_success:
            logger.error("❌ Cache overview test failed")
            return
        
        logger.info("=" * 60)
        logger.info("🎉 All workflow tests completed successfully!")
        logger.info("")
        logger.info("✨ The cost-sharing cached indexing system is working!")
        logger.info("🏦 Admin can pre-index APIs once at full cost")
        logger.info("💰 Users pay fractional costs for immediate access")
        logger.info("📊 Billing tracks all consumption transparently")
        logger.info("🚀 Users get immediate access to cached vectors")
        
    except Exception as e:
        logger.error(f"❌ Workflow test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())