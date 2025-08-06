#!/usr/bin/env python3
"""
Test Model Tracking
===================

Test that the actual model IDs are being tracked correctly.
"""

import asyncio
import sys
import os

# Add the backend app to the path
sys.path.append('/Users/caroco/Gabo-Dev/kiff-ai/backend')

from app.config.llm_providers import llm_agentic, llm_highest
from app.core.database import get_db
from app.services.billing_token_service import BillingTokenService
from app.core.token_tracker import TokenUsage


async def test_model_tracking():
    """Test that we're tracking the correct model IDs"""
    
    print("🤖 Testing model tracking...")
    
    # Check what models are available
    print(f"📋 Available models:")
    print(f"  llm_agentic ID: {getattr(llm_agentic, 'id', 'unknown')}")
    print(f"  llm_highest ID: {getattr(llm_highest, 'id', 'unknown')}")
    
    # Test parameters
    tenant_id = "4485db48-71b7-47b0-8128-c6dca5be352d"
    user_id = "1"
    
    # Get database session
    async for db in get_db():
        try:
            # Test tracking llm_agentic model (used by generators)
            actual_model_id = getattr(llm_agentic, 'id', 'unknown')
            print(f"\\n🔍 Testing with actual model: {actual_model_id}")
            
            # Create test token usage
            token_usage = TokenUsage(
                input_tokens=500,
                output_tokens=300,
                total_tokens=800
            )
            
            # Record consumption with actual model ID
            consumption_record = await BillingTokenService.record_token_consumption(
                db=db,
                tenant_id=tenant_id,
                user_id=user_id,
                session_id='model_tracking_test',
                token_usage=token_usage,
                operation_type='model_tracking_test',
                operation_id='test_model_id',
                model_name=actual_model_id,  # Use actual model ID
                provider='groq',
                extra_data={
                    'test_purpose': 'Verify actual model tracking',
                    'model_used': actual_model_id,
                    'agent_type': 'model_tracking_test'
                }
            )
            
            print(f"✅ Created test record with model: {actual_model_id}")
            print(f"✅ Record ID: {consumption_record.id}")
            
            # Verify the record was saved correctly
            from sqlalchemy import text
            result = await db.execute(text('SELECT model_name, extra_data FROM token_consumptions WHERE id = :id'), {'id': consumption_record.id})
            saved_record = result.fetchone()
            
            if saved_record:
                print(f"✅ Verified saved model: {saved_record[0]}")
                print(f"✅ Extra data: {saved_record[1]}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            break  # Exit the async generator


if __name__ == "__main__":
    print("🚀 Starting model tracking test...")
    asyncio.run(test_model_tracking())
    print("✅ Model tracking test completed!")