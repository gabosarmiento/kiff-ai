#!/usr/bin/env python3
"""
Test AGNO Agent Streaming
========================

Simple test to understand how AGNO streaming works without file operations.
"""

import asyncio
import os
import sys

# Add the backend directory to the path so we can import our modules
sys.path.append('/Users/caroco/Gabo-Dev/kiff-ai/backend')

from agno.agent import Agent
from agno.tools.thinking import ThinkingTools
from app.config.llm_providers import llm_agentic

def test_agno_streaming():
    """Test AGNO agent streaming without file operations"""
    
    print("🚀 Testing AGNO Agent Streaming...")
    print("=" * 50)
    
    # Create a simple agent with only thinking tools
    agent = Agent(
        model=llm_agentic,
        tools=[ThinkingTools(add_instructions=True)],
        show_tool_calls=True,
        stream_intermediate_steps=True,
        instructions=[
            "You are a helpful assistant.",
            "Think step by step about the task.",
            "Explain your reasoning clearly."
        ]
    )
    
    # Simple task that requires thinking
    prompt = "Plan how to organize a small birthday party for 10 people. Think through the key steps."
    
    print(f"📝 Task: {prompt}")
    print("-" * 50)
    print("📡 Streaming events:")
    print()
    
    # Stream the response
    for event in agent.run(prompt, stream=True, stream_intermediate_steps=True):
        print(f"🔸 Event Type: {getattr(event, 'event', 'Unknown')}")
        
        if hasattr(event, 'event'):
            event_type = event.event
            print(f"   📋 Event: {event_type}")
            
            if hasattr(event, 'content') and event.content:
                content = str(event.content)[:100] + "..." if len(str(event.content)) > 100 else str(event.content)
                print(f"   💬 Content: {content}")
            
            if hasattr(event, 'tool') and event.tool:
                tool_name = getattr(event.tool, 'tool_name', str(event.tool))
                print(f"   🔧 Tool: {tool_name}")
            
            if hasattr(event, 'result') and event.result:
                result = str(event.result)[:100] + "..." if len(str(event.result)) > 100 else str(event.result)
                print(f"   ✅ Result: {result}")
                
        elif hasattr(event, 'content'):
            # Direct content
            content = str(event.content)
            print(f"   💬 Direct Content: {content}")
        
        print()
    
    print("✅ Test completed!")
    print("=" * 50)

if __name__ == "__main__":
    test_agno_streaming()