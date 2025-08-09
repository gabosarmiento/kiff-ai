#!/usr/bin/env python3
"""
Test the streaming endpoint to verify AGNO-native streaming works in production
"""

import requests
import json
import time
from datetime import datetime

def test_streaming_endpoint():
    """Test the streaming endpoint with a simple request"""
    
    # Real user data from database
    real_tenant_id = "4485db48-71b7-47b0-8128-c6dca5be352d"
    real_user_id = "1"
    
    url = f"http://localhost:8000/api/agno-generation/generate-stream?tenant_id={real_tenant_id}&user_id={real_user_id}"
    
    payload = {
        "user_request": "Create a simple Hello World Python application with a main.py file",
        "model": "kimi-k2",
        "knowledge_sources": []
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "X-Tenant-ID": real_tenant_id
    }
    
    print("🚀 Testing AGNO-native streaming endpoint")
    print("=" * 60)
    print(f"📝 Request: {payload['user_request']}")
    print(f"🌐 URL: {url}")
    print("=" * 60)
    
    start_time = datetime.now()
    event_count = 0
    conversation_events = 0
    file_events = 0
    
    try:
        with requests.post(url, json=payload, headers=headers, stream=True) as response:
            print(f"📡 Response Status: {response.status_code}")
            print(f"📋 Response Headers: {dict(response.headers)}")
            print("=" * 60)
            
            if response.status_code != 200:
                print(f"❌ Error: {response.status_code} - {response.text}")
                return
            
            print("📡 Streaming events:")
            print("=" * 60)
            
            for line in response.iter_lines(decode_unicode=True):
                if line.strip():
                    try:
                        # Parse SSE data
                        if line.startswith("data: "):
                            data = line[6:]  # Remove "data: " prefix
                            if data.strip() == "[DONE]":
                                print("🏁 Stream completed")
                                break
                                
                            event_data = json.loads(data)
                            event_count += 1
                            
                            elapsed = (datetime.now() - start_time).total_seconds()
                            event_type = event_data.get("type", "unknown")
                            
                            if event_type == "conversation":
                                conversation_events += 1
                                message = event_data.get("content", {}).get("message", "")
                                # Show first 80 chars to see streaming behavior
                                display_message = message[:80] + "..." if len(message) > 80 else message
                                print(f"⏰ [{elapsed:6.2f}s] #{event_count:2d} 💬 CONVERSATION: {display_message}")
                                
                            elif event_type == "file_created":
                                file_events += 1
                                content = event_data.get("content", {})
                                file_path = content.get("file_path", "unknown")
                                print(f"⏰ [{elapsed:6.2f}s] #{event_count:2d} 📁 FILE_CREATED: {file_path}")
                                
                            elif event_type == "completed":
                                print(f"⏰ [{elapsed:6.2f}s] #{event_count:2d} ✅ COMPLETED")
                                
                            elif event_type == "error":
                                error_msg = event_data.get("content", {}).get("message", "")
                                print(f"⏰ [{elapsed:6.2f}s] #{event_count:2d} ❌ ERROR: {error_msg}")
                                
                            else:
                                print(f"⏰ [{elapsed:6.2f}s] #{event_count:2d} ❓ {event_type.upper()}")
                                
                        else:
                            # Handle other SSE format lines
                            print(f"📋 SSE Line: {line}")
                            
                    except json.JSONDecodeError as e:
                        print(f"⚠️ JSON Parse Error: {e} - Line: {line}")
                    except Exception as e:
                        print(f"⚠️ Processing Error: {e} - Line: {line}")
    
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return
    
    total_time = (datetime.now() - start_time).total_seconds()
    
    print("=" * 60)
    print("📊 STREAMING TEST RESULTS")
    print("=" * 60)
    print(f"⏱️  Total Time: {total_time:.2f}s")
    print(f"📊 Total Events: {event_count}")
    print(f"💬 Conversation Events: {conversation_events}")
    print(f"📁 File Events: {file_events}")
    if total_time > 0:
        print(f"📈 Events/sec: {event_count/total_time:.2f}")
    
    # Expected behavior based on our AGNO test
    expected_events_per_sec = 15  # Based on AGNO test showing ~17 events/sec
    if event_count > 0 and total_time > 0:
        actual_rate = event_count / total_time
        if actual_rate >= expected_events_per_sec * 0.7:  # Allow 30% variance
            print("✅ Streaming rate looks good (similar to native AGNO)")
        else:
            print("⚠️ Streaming rate lower than expected (may indicate batching/delays)")
    
    print("=" * 60)

if __name__ == "__main__":
    test_streaming_endpoint()