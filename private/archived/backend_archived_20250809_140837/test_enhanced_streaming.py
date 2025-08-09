#!/usr/bin/env python3
"""
Test Enhanced AGNO Streaming
============================

Test script to verify the conversational streaming enhancements work properly.
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.append('/Users/caroco/Gabo-Dev/kiff-ai/backend')

from app.services.agno_conversational_generator import agno_conversational_generator

async def test_conversational_streaming():
    """Test the enhanced conversational streaming"""
    
    print("🧪 Testing Enhanced AGNO Conversational Streaming")
    print("=" * 60)
    
    # Simple request that should trigger various streaming events
    test_request = "Create a simple Python web API with FastAPI that has a health check endpoint"
    
    print(f"📝 Test Request: {test_request}")
    print("-" * 60)
    print("📡 Streaming Events:")
    print()
    
    event_count = 0
    conversation_messages = 0
    file_events = 0
    
    try:
        # Stream the conversational generation
        async for event in agno_conversational_generator.generate_with_conversation(test_request):
            event_count += 1
            
            event_type = event.get("type", "unknown")
            content = event.get("content", {})
            message = content.get("message", "")
            
            print(f"🔸 Event #{event_count}: {event_type}")
            
            if event_type == "conversation":
                conversation_messages += 1
                print(f"   💬 Message: {message}")
            elif event_type == "file_created":
                file_events += 1
                file_path = content.get("file_path", "unknown")
                print(f"   📄 File: {file_path}")
            elif event_type == "completed":
                print(f"   ✅ Status: {content.get('message', 'Complete')}")
                stats = content.get("stats", {})
                if stats:
                    print(f"   📊 Files: {stats.get('files_created', 0)}, Tools: {stats.get('tools_used', 0)}")
            elif event_type == "error":
                print(f"   ❌ Error: {content.get('error', 'Unknown error')}")
            
            print()
            
            # Limit output for testing
            if event_count > 20:
                print("   📋 (truncated for testing - stopping after 20 events)")
                break
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False
    
    print("=" * 60)
    print(f"📊 Test Summary:")
    print(f"   • Total Events: {event_count}")
    print(f"   • Conversation Messages: {conversation_messages}")
    print(f"   • File Events: {file_events}")
    print("✅ Enhanced streaming test completed!")
    
    return True

if __name__ == "__main__":
    asyncio.run(test_conversational_streaming())