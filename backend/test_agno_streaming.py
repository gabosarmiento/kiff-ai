#!/usr/bin/env python3
"""
Test script to understand AGNO agent streaming integration
Based on official documentation: https://docs.agno.com/agents/run
"""

import asyncio
from typing import Iterator
from agno.agent import Agent, RunResponseEvent
from app.config.llm_providers import llm_agentic

async def test_agno_streaming():
    """Test AGNO agent streaming to understand the actual API"""
    
    print("🧪 Testing AGNO Agent Streaming Integration")
    print("=" * 50)
    
    try:
        # Initialize agent using your configured Groq model (moonshotai/kimi-k2-instruct)
        agent = Agent(
            model=llm_agentic,
            markdown=True,
            monitoring=True
        )
        
        print("✅ Agent initialized successfully")
        
        # Test basic run first
        print("\n📝 Testing basic agent.run()...")
        response = agent.run("Tell me a short story about AI")
        print(f"Response type: {type(response)}")
        print(f"Response: {response}")
        
        print("\n🌊 Testing streaming with stream=True...")
        
        # Test streaming as per documentation
        response_stream: Iterator[RunResponseEvent] = agent.run(
            "Tell me a 5 second short story about a robot",
            stream=True,
            stream_intermediate_steps=True
        )
        
        print(f"Stream type: {type(response_stream)}")
        
        # Process the stream events
        print("\n📡 Processing stream events:")
        for event in response_stream:
            print(f"Event: {event.event}")
            print(f"Content: {getattr(event, 'content', 'N/A')}")
            print(f"Event type: {type(event)}")
            print("-" * 30)
            
            # Handle different event types as per documentation
            if event.event == "RunResponseContent":
                print(f"📄 Content: {event.content}")
            elif event.event == "ToolCallStarted":
                print(f"🔧 Tool call started: {getattr(event, 'tool', 'unknown')}")
            elif event.event == "ReasoningStep":
                print(f"🧠 Reasoning step: {event.content}")
            elif event.event == "RunStarted":
                print("🚀 Run started")
            elif event.event == "RunCompleted":
                print("✅ Run completed")
            elif event.event == "RunError":
                print(f"❌ Run error: {event.content}")
        
        print("\n✅ Streaming test completed successfully")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_agno_streaming())
