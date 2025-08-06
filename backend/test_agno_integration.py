#!/usr/bin/env python3
"""
Test AGNO Agent Service Integration
Tests the complete streaming flow with tools and knowledge integration
"""

import asyncio
import json
from app.services.agno_agent_service import agno_service

async def test_agno_integration():
    """Test the complete AGNO agent integration with streaming and tools"""
    
    print("🧪 Testing AGNO Agent Service Integration")
    print("=" * 60)
    
    try:
        # Create a test session
        user_id = "test_user_123"
        session_id = await agno_service.create_session(user_id)
        print(f"✅ Created session: {session_id}")
        
        # Test message that should trigger tools
        test_message = "I need to create a simple Flask API that says hello world"
        
        print(f"\n📝 Testing message: '{test_message}'")
        print("\n🌊 Streaming AGNO agent response:")
        print("-" * 40)
        
        # Stream the agent response
        event_count = 0
        content_chunks = []
        
        async for event in agno_service.run_agent(
            session_id=session_id,
            user_input=test_message,
            stream=True
        ):
            event_count += 1
            
            print(f"Event {event_count}: {event.type}")
            
            if hasattr(event, 'content') and event.content:
                if isinstance(event.content, dict):
                    if 'message' in event.content:
                        print(f"  Message: {event.content['message']}")
                    if 'chunk' in event.content:
                        content_chunks.append(event.content['chunk'])
                        print(f"  Chunk: '{event.content['chunk']}'")
                    if 'tool_name' in event.content:
                        print(f"  Tool: {event.content['tool_name']}")
                else:
                    print(f"  Content: {event.content}")
            
            print(f"  Timestamp: {event.timestamp}")
            print()
        
        print(f"✅ Processed {event_count} events")
        
        if content_chunks:
            full_response = ''.join(content_chunks)
            print(f"\n📄 Full Response Preview:")
            print(f"'{full_response[:200]}{'...' if len(full_response) > 200 else ''}'")
        
        # Test session info
        session_info = agno_service.get_session_info(session_id)
        print(f"\n📊 Session Info:")
        print(f"  Memory entries: {len(session_info.get('memory', []))}")
        print(f"  User ID: {session_info.get('user_id')}")
        
        print("\n✅ AGNO Integration Test Completed Successfully!")
        
    except Exception as e:
        print(f"❌ Error during integration test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_agno_integration())
