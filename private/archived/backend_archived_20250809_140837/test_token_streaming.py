#!/usr/bin/env python3
"""
Test Real-time Token Consumption Streaming
==========================================

Test script to verify real-time token consumption tracking works during generation.
"""

import asyncio
import sys
import os
import uuid

# Add the backend directory to the path
sys.path.append('/Users/caroco/Gabo-Dev/kiff-ai/backend')

from app.services.agno_application_generator import agno_app_generator

async def test_token_streaming():
    """Test the real-time token consumption streaming"""
    
    print("🔢 Testing Real-time Token Consumption Streaming")
    print("=" * 60)
    
    # Create test session parameters that enable token tracking
    tenant_id = "4485db48-71b7-47b0-8128-c6dca5be352d"
    user_id = "1"
    session_id = str(uuid.uuid4())
    model = "kimi-k2"  # Use a specific model
    
    test_request = "Create a simple Python Flask API with one endpoint"
    
    print(f"📝 Test Request: {test_request}")
    print(f"🔑 Session ID: {session_id}")
    print(f"🤖 Model: {model}")
    print("-" * 60)
    print("📡 Streaming Events with Token Tracking:")
    print()
    
    event_count = 0
    token_messages = 0
    
    try:
        # Stream the generation with token tracking enabled
        async for event in agno_app_generator.generate_application_streaming(
            tenant_id=tenant_id,
            user_request=test_request,
            session_id=session_id,
            user_id=user_id,
            model=model
        ):
            event_count += 1
            
            event_type = event.get("type", "unknown")
            content = event.get("content", {})
            message = content.get("message", "")
            
            print(f"🔸 Event #{event_count}: {event_type}")
            
            if event_type == "conversation":
                print(f"   💬 Message: {message}")
                
                # Count token-related messages
                if "token" in message.lower() or "running total" in message.lower():
                    token_messages += 1
                    print(f"   📊 TOKEN UPDATE DETECTED!")
                
            elif event_type == "completed":
                print(f"   ✅ Status: {content.get('message', 'Complete')}")
                stats = content.get("stats", {})
                if stats:
                    print(f"   📊 Stats: {stats}")
            elif event_type == "error":
                print(f"   ❌ Error: {content.get('error', 'Unknown error')}")
            
            print()
            
            # Limit output for testing but allow more events to see token tracking
            if event_count > 30:
                print("   📋 (truncated for testing - stopping after 30 events)")
                break
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("=" * 60)
    print(f"📊 Token Streaming Test Summary:")
    print(f"   • Total Events: {event_count}")
    print(f"   • Token Update Messages: {token_messages}")
    
    if token_messages > 0:
        print("✅ Token streaming is working - detected token updates during generation!")
    else:
        print("⚠️  No token updates detected - might need to check token tracking setup")
    
    print("✅ Token streaming test completed!")
    
    return token_messages > 0

if __name__ == "__main__":
    success = asyncio.run(test_token_streaming())
    sys.exit(0 if success else 1)