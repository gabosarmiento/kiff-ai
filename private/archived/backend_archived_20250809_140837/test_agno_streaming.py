#!/usr/bin/env python3
"""
Test AGNO streaming in isolation using the proper AGNO patterns from documentation.
This will help us understand the real-time streaming behavior.
"""

import os
import time
import sys
from datetime import datetime

# Add the app directory to Python path so we can import backend modules
sys.path.insert(0, '/Users/caroco/Gabo-Dev/kiff-ai/backend/app')

# Import AGNO modules
from agno.agent import Agent, RunResponseEvent
from agno.tools.file import FileTools

# Import our backend model configuration
from app.config.llm_providers import get_tradeforge_models

def create_simple_todo_tracker():
    """Create a simple todo tracker for testing"""
    from agno.tools import Toolkit
    from agno import Agent
    
    class SimpleTodoTracker(Toolkit):
        def __init__(self):
            super().__init__(name="simple_todo_tracker")
        
        def track_todo_progress(self, action: str, description: str = "") -> str:
            """Track todo progress with simple console output"""
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"📋 [{timestamp}] TODO: {action} - {description}")
            return f"Todo tracked: {action} - {description}"
    
    return SimpleTodoTracker()

def test_agno_streaming():
    """Test AGNO agent with streaming enabled using proper AGNO patterns"""
    print("🔥 Testing AGNO Streaming Behavior")
    print("=" * 50)
    
    # Get models from backend configuration (same as backend uses)
    print("🤖 Loading backend model configuration...")
    try:
        available_models = get_tradeforge_models()
        selected_llm = available_models.get("kimi-k2")  # Use same model as frontend
        print(f"✅ Using model: kimi-k2")
        
        agent = Agent(
            model=selected_llm,
            tools=[FileTools()],
            show_tool_calls=True,
            instructions=[
                "You are a helpful AI assistant that creates files as requested.",
                "Save files to the /tmp/agno_test/ directory.",  
                "Be conversational and explain what you're doing.",
                "IMPORTANT: When using save_file, use format: save_file(file_name='path/file.ext', contents='your content')"
            ]
        )
        print("✅ Agent created successfully")
    except Exception as e:
        print(f"❌ Failed to create agent: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Simple test prompt
    test_prompt = "Create a simple hello.txt file with 'Hello World' content in /tmp/agno_test/"
    
    print(f"📝 Test Prompt: {test_prompt}")
    print("\n🚀 Starting AGNO agent streaming...")
    print("=" * 50)
    
    # Track streaming behavior
    event_count = 0
    start_time = datetime.now()
    
    try:
        # Use proper AGNO streaming pattern from docs
        response_stream = agent.run(
            test_prompt, 
            stream=True, 
            stream_intermediate_steps=True
        )
        
        print("📡 Stream started, processing events...")
        
        for event in response_stream:
            event_count += 1
            current_time = datetime.now()
            elapsed = (current_time - start_time).total_seconds()
            
            print(f"⏰ [{elapsed:6.2f}s] Event #{event_count}: {event.event}")
            
            # Handle different event types using proper AGNO patterns
            if event.event == "RunResponseContent":
                if hasattr(event, 'content') and event.content:
                    content_preview = str(event.content)[:50]
                    print(f"   📝 Content: '{content_preview}'")
                    print("   💬 BACKEND WOULD YIELD: conversation event with this content")
                    
            elif event.event == "ToolCallStarted":
                if hasattr(event, 'tool'):
                    print(f"   🔧 Tool Started: {event.tool.tool_name}")
                    print(f"   📋 Tool Args: {event.tool.tool_args}")
                    print("   💬 BACKEND WOULD YIELD: conversation event 'Creating file...'")
                
            elif event.event == "ToolCallCompleted":
                if hasattr(event, 'tool'):
                    print(f"   ✅ Tool Completed: {event.tool.tool_name}")
                    print(f"   📊 Tool Result: {event.tool.result}")
                    
                    # Extract AGNO metrics from tool execution
                    if hasattr(event.tool, 'metrics') and event.tool.metrics:
                        metrics = event.tool.metrics
                        print(f"   📈 Tool Metrics:")
                        print(f"      - Input tokens: {getattr(metrics, 'input_tokens', 0)}")
                        print(f"      - Output tokens: {getattr(metrics, 'output_tokens', 0)}")
                        print(f"      - Total tokens: {getattr(metrics, 'total_tokens', 0)}")
                        print(f"      - Execution time: {getattr(metrics, 'time', 0):.3f}s")
                        print(f"      - Cached tokens: {getattr(metrics, 'cached_tokens', 0)}")
                        print(f"      - Reasoning tokens: {getattr(metrics, 'reasoning_tokens', 0)}")
                    
                    print("   💬 BACKEND WOULD YIELD: conversation event 'File created!'")
                    print("   📁 BACKEND WOULD YIELD: file_created event with file data")
                
            elif event.event == "ReasoningStarted":
                print("   🧠 Reasoning Started")
                print("   💬 BACKEND WOULD YIELD: conversation event 'Analyzing requirements...'")
                
            elif event.event == "ReasoningCompleted":
                print("   🧠 Reasoning Completed") 
                print("   💬 BACKEND WOULD YIELD: conversation event 'Analysis complete. Beginning implementation...'")
                
            elif event.event == "ReasoningStep":
                if hasattr(event, 'content') and event.content:
                    reasoning_preview = str(event.content)[:80]
                    print(f"   💭 Reasoning: {reasoning_preview}...")
                    
            elif event.event == "RunStarted":
                print("   🚀 AGNO Run Started")
                print("   💬 BACKEND WOULD YIELD: conversation event 'Starting work on your request...'")
                
            elif event.event == "RunCompleted":
                print("   🏁 AGNO Run Completed")
                print("   💬 BACKEND WOULD YIELD: conversation event 'Application completed!'")
                
            else:
                print(f"   ❓ Other event: {event.event}")
                if hasattr(event, '__dict__'):
                    for key, value in event.__dict__.items():
                        if key not in ['event']:
                            print(f"      {key}: {value}")
            
            print()  # Empty line for readability
            
            # Small delay to observe real-time behavior
            time.sleep(0.02)  # Faster to see real timing
            
    except Exception as e:
        print(f"❌ Error during streaming: {e}")
        import traceback
        traceback.print_exc()
    
    total_time = (datetime.now() - start_time).total_seconds()
    print("=" * 50)
    print(f"🏁 Streaming Complete!")
    print(f"   📊 Total Events: {event_count}")
    print(f"   ⏱️  Total Time: {total_time:.2f}s")
    if total_time > 0:
        print(f"   📈 Events/sec: {event_count/total_time:.2f}")
    
    print("\n" + "=" * 50)
    print("📈 COMPREHENSIVE AGNO METRICS ANALYSIS")
    print("=" * 50)
    
    # 1. SESSION-LEVEL METRICS (Most Important!)
    print("🔥 SESSION METRICS (session_metrics):")
    if hasattr(agent, 'session_metrics') and agent.session_metrics:
        session_metrics = agent.session_metrics
        print(f"   📊 Input tokens: {getattr(session_metrics, 'input_tokens', 0)}")
        print(f"   📊 Output tokens: {getattr(session_metrics, 'output_tokens', 0)}")
        print(f"   📊 Total tokens: {getattr(session_metrics, 'total_tokens', 0)}")
        print(f"   📊 Cached tokens: {getattr(session_metrics, 'cached_tokens', 0)}")
        print(f"   📊 Reasoning tokens: {getattr(session_metrics, 'reasoning_tokens', 0)}")
        print(f"   🚀 This is what our backend should track for real-time token consumption!")
    else:
        print("   ⚠️ Session metrics not available")
    
    # 2. RUN RESPONSE METRICS  
    print(f"\n🎯 RUN RESPONSE METRICS (run_response.metrics):")
    if hasattr(agent, 'run_response') and agent.run_response:
        if hasattr(agent.run_response, 'metrics') and agent.run_response.metrics:
            run_metrics = agent.run_response.metrics
            print(f"   📊 Input tokens: {getattr(run_metrics, 'input_tokens', 0)}")
            print(f"   📊 Output tokens: {getattr(run_metrics, 'output_tokens', 0)}")
            print(f"   📊 Total tokens: {getattr(run_metrics, 'total_tokens', 0)}")
            print(f"   ⏱️ Total time: {getattr(run_metrics, 'time', 0):.3f}s")
            print(f"   ⚡ Time to first token: {getattr(run_metrics, 'time_to_first_token', 0):.3f}s")
        else:
            print("   ⚠️ Run response metrics not available")
            
        # 3. PER-MESSAGE METRICS
        print(f"\n💬 PER-MESSAGE METRICS (run_response.messages):")
        if hasattr(agent.run_response, 'messages'):
            for i, message in enumerate(agent.run_response.messages):
                if hasattr(message, 'metrics') and message.metrics:
                    print(f"   📝 Message #{i+1} ({message.role}):")
                    print(f"      - Tokens: {getattr(message.metrics, 'total_tokens', 0)}")
                    print(f"      - Time: {getattr(message.metrics, 'time', 0):.3f}s")
                    if hasattr(message, 'content'):
                        content_preview = str(message.content)[:60]
                        print(f"      - Content: '{content_preview}...'")
        else:
            print("   ⚠️ Messages not available")
    else:
        print("   ⚠️ Run response not available")
    
    # 4. AVAILABLE ATTRIBUTES (Debug info)
    print(f"\n🔍 AGENT DEBUG INFO:")
    print(f"   🤖 Agent attributes: {[attr for attr in dir(agent) if not attr.startswith('_')]}")
    if hasattr(agent, 'run_response'):
        print(f"   📋 RunResponse attributes: {[attr for attr in dir(agent.run_response) if not attr.startswith('_')]}")
    
    # Check if file was actually created
    print(f"\n📁 FILE CREATION VERIFICATION:")
    if os.path.exists('/tmp/agno_test/hello.txt'):
        print(f"   ✅ File created successfully!")
        with open('/tmp/agno_test/hello.txt', 'r') as f:
            print(f"   📄 Content: {f.read()}")
    else:
        print(f"   ⚠️  File not found")
    
    print("\n" + "=" * 50)
    print("🎯 KEY INSIGHTS FOR BACKEND IMPLEMENTATION:")
    print("=" * 50)
    print("1. 🔥 Use agent.session_metrics for real-time token tracking")
    print("2. ⚡ Events stream every ~0.02-0.05s - backend should match this")
    print("3. 🛠️ ToolCallStarted/Completed events are the key for file creation")
    print("4. 📝 RunResponseContent events should drive conversation messages")
    print("5. 🚀 Each event should yield immediately to frontend, not batch")
    print("=" * 50)

if __name__ == "__main__":
    # Create test directory
    os.makedirs('/tmp/agno_test', exist_ok=True)
    
    # Run the test
    test_agno_streaming()