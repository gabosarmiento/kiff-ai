#!/usr/bin/env python3
"""
Quick Token Tracking Test
========================

A focused test to validate our token tracking system with AGNO.
"""

import asyncio
import logging
import sys
import os
from datetime import datetime

# Add the app to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.token_tracker import get_token_tracker, get_tenant_usage
from app.core.langtrace_config import is_langtrace_enabled

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def test_token_tracking():
    """Run a quick token tracking test"""
    
    logger.info("🚀 Quick Token Tracking Test")
    logger.info(f"   LangTrace Enabled: {is_langtrace_enabled()}")
    
    # Test parameters
    tenant_id = "test_tenant_quick"
    user_id = "test_user_123"
    session_id = f"test_session_{datetime.now().strftime('%H%M%S')}"
    
    # Get token tracker
    tracker = get_token_tracker(tenant_id, user_id, session_id)
    
    logger.info(f"🔢 Initial Usage: {tracker.get_current_usage().format_display()}")
    
    # Simulate AGNO metrics (like what we'd get from a real run)
    mock_agno_metrics = {
        'input_tokens': [150, 75],  # AGNO returns lists for aggregation
        'output_tokens': [300, 120],
        'total_tokens': [450, 195],
        'cached_tokens': [0],
        'reasoning_tokens': [0],
        'audio_tokens': [0]
    }
    
    # Track the simulated usage
    tracker.usage.add_run_metrics(mock_agno_metrics)
    # Trigger callbacks to update tenant usage
    tracker._notify_callbacks()
    
    current_usage = tracker.get_current_usage()
    logger.info(f"🔢 After Mock Run: {current_usage.format_display()}")
    logger.info(f"   Details: Input={current_usage.input_tokens}, Output={current_usage.output_tokens}, Total={current_usage.total_tokens}")
    
    # Test tenant-level aggregation
    tenant_usage = get_tenant_usage(tenant_id)
    logger.info(f"🏢 Tenant Usage: {tenant_usage.format_display()}")
    
    # Test multiple sessions for same tenant
    session_2 = f"test_session_2_{datetime.now().strftime('%H%M%S')}"
    tracker_2 = get_token_tracker(tenant_id, user_id, session_2)
    
    mock_agno_metrics_2 = {
        'input_tokens': [200],
        'output_tokens': [400], 
        'total_tokens': [600],
        'cached_tokens': [50],  # Some cached tokens
        'reasoning_tokens': [0],
        'audio_tokens': [0]
    }
    
    tracker_2.usage.add_run_metrics(mock_agno_metrics_2)
    # Trigger callbacks to update tenant usage
    tracker_2._notify_callbacks()
    
    # Check updated tenant usage
    tenant_usage_updated = get_tenant_usage(tenant_id)
    logger.info(f"🏢 Updated Tenant Usage (2 sessions): {tenant_usage_updated.format_display()}")
    logger.info(f"   Session 1: {tracker.get_current_usage().format_display()}")
    logger.info(f"   Session 2: {tracker_2.get_current_usage().format_display()}")
    
    # Expected totals
    expected_total = current_usage.total_tokens + tracker_2.get_current_usage().total_tokens
    actual_total = tenant_usage_updated.total_tokens
    
    logger.info(f"✅ Aggregation Test:")
    logger.info(f"   Expected Total: {expected_total}")
    logger.info(f"   Actual Total: {actual_total}")
    logger.info(f"   Match: {'✅ YES' if expected_total == actual_total else '❌ NO'}")
    
    # Test display formatting
    test_values = [0, 150, 999, 1000, 1500, 10000, 1000000, 1500000]
    logger.info("🎨 Display Format Tests:")
    for val in test_values:
        from app.core.token_tracker import TokenUsage
        test_usage = TokenUsage(total_tokens=val)
        logger.info(f"   {val:,} tokens -> '{test_usage.format_display()}'")
    
    logger.info("✅ Quick token tracking test completed!")

if __name__ == "__main__":
    asyncio.run(test_token_tracking())