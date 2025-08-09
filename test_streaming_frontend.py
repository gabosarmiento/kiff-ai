#!/usr/bin/env python3
"""
Test script to verify streaming endpoint is working correctly
"""
import requests
import json
import time

def test_streaming_endpoint():
    """Test the streaming endpoint directly"""
    
    url = "http://localhost:8000/api/agno-generation/generate-stream"
    params = {
        "tenant_id": "4485db48-71b7-47b0-8128-c6dca5be352d",
        "user_id": "test_user"
    }
    
    payload = {
        "user_request": "Create a simple React component with a button that shows an alert when clicked",
        "stream": True,
        "model": "kimi-k2"
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-Tenant-ID": "4485db48-71b7-47b0-8128-c6dca5be352d"
    }
    
    print("Testing streaming endpoint...")
    
    try:
        response = requests.post(url, params=params, json=payload, headers=headers, stream=True)
        response.raise_for_status()
        
        print(f"Status: {response.status_code}")
        print("Streaming events:")
        
        event_count = 0
        for line in response.iter_lines(decode_unicode=True):
            if line.strip():
                print(f"Raw line: {line}")
                if line.startswith("data: "):
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        print("✅ Streaming completed successfully")
                        break
                    
                    try:
                        event_data = json.loads(data)
                        event_count += 1
                        print(f"Event {event_count}: {event_data.get('type', 'unknown')} - {event_data.get('content', {}).get('message', 'no message')[:100]}...")
                    except json.JSONDecodeError as e:
                        print(f"❌ JSON decode error: {e}")
                        print(f"Problematic data: {data}")
        
        print(f"✅ Received {event_count} streaming events")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    test_streaming_endpoint()
