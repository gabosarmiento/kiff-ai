#!/usr/bin/env python3
"""
Test Token Consumption Data Generator
=====================================

Quick script to create sample token consumption data for testing the dashboard.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone

# Add the backend app to the path
sys.path.append('/Users/caroco/Gabo-Dev/kiff-ai/backend')

from app.core.database import get_db
from app.services.billing_token_service import BillingTokenService
from app.core.token_tracker import TokenUsage


async def create_test_consumption():
    """Create some test token consumption data"""
    
    # Test parameters
    tenant_id = "4485db48-71b7-47b0-8128-c6dca5be352d"
    user_id = "1"
    
    print(f"🔢 Creating test token consumption for tenant {tenant_id}, user {user_id}")
    
    # Get database session
    async for db in get_db():
        try:
            # Ensure billing cycle exists
            cycle = await BillingTokenService.ensure_active_billing_cycle(
                db, tenant_id, user_id
            )
            print(f"✅ Billing cycle ensured: {cycle.id}")
            
            # Create some test token consumption entries
            test_entries = [
                {
                    'operation_type': 'generation',
                    'operation_id': 'test_generation_001',
                    'model_name': 'groq/llama-3.1-70b',
                    'provider': 'groq',
                    'input_tokens': 1250,
                    'output_tokens': 890,
                    'cached_tokens': 0,
                    'reasoning_tokens': 0,
                    'audio_tokens': 0,
                    'extra_data': {
                        'user_request': 'Create a simple hello world FastAPI app',
                        'test_data': True
                    }
                },
                {
                    'operation_type': 'chat',
                    'operation_id': 'test_chat_001',
                    'model_name': 'groq/llama-3.1-70b',
                    'provider': 'groq',
                    'input_tokens': 850,
                    'output_tokens': 420,
                    'cached_tokens': 0,
                    'reasoning_tokens': 0,
                    'audio_tokens': 0,
                    'extra_data': {
                        'conversation': 'Test conversation about AGNO framework',
                        'test_data': True
                    }
                },
                {
                    'operation_type': 'api_indexing',
                    'operation_id': 'test_indexing_001',
                    'model_name': 'groq/llama-3.1-70b',
                    'provider': 'groq',
                    'input_tokens': 2150,
                    'output_tokens': 680,
                    'cached_tokens': 0,
                    'reasoning_tokens': 0,
                    'audio_tokens': 0,
                    'extra_data': {
                        'api_documentation': 'Indexed OpenAI API docs',
                        'test_data': True
                    }
                }
            ]
            
            # Add each test entry
            for entry in test_entries:
                # Create TokenUsage object
                token_usage = TokenUsage(
                    input_tokens=entry['input_tokens'],
                    output_tokens=entry['output_tokens'],
                    total_tokens=entry['input_tokens'] + entry['output_tokens'],
                    cached_tokens=entry['cached_tokens'],
                    reasoning_tokens=entry['reasoning_tokens'],
                    audio_tokens=entry['audio_tokens']
                )
                
                consumption_record = await BillingTokenService.record_token_consumption(
                    db=db,
                    tenant_id=tenant_id,
                    user_id=user_id,
                    session_id='test_session_data_creation',
                    token_usage=token_usage,
                    operation_type=entry['operation_type'],
                    operation_id=entry['operation_id'],
                    model_name=entry['model_name'],
                    provider=entry['provider'],
                    extra_data=entry['extra_data']
                )
                print(f"✅ Created consumption record: {consumption_record.id} ({entry['operation_type']})")
            
            # Get summary to verify
            summary = await BillingTokenService.get_current_cycle_summary(
                db, tenant_id, user_id
            )
            
            if summary:
                print(f"📊 Total tokens consumed: {summary.total_tokens}")
                print(f"📊 Formatted total: {summary.formatted_total}")
                print(f"📊 Input tokens: {summary.total_input_tokens}")
                print(f"📊 Output tokens: {summary.total_output_tokens}")
                print(f"📊 By operation: {summary.breakdown_by_operation}")
            else:
                print("⚠️ No summary found after creating test data")
                
        except Exception as e:
            print(f"❌ Error creating test data: {e}")
            import traceback
            traceback.print_exc()
        finally:
            break  # Exit the async generator


if __name__ == "__main__":
    print("🚀 Starting test token consumption data creation...")
    asyncio.run(create_test_consumption())
    print("✅ Test data creation completed!")