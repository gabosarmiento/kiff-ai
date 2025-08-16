"""
Simple test to verify if the AGNO generation endpoint is working
"""
import requests
import json

# Test the deployed backend
# backend_url = "https://z5cmpsm2zw.eu-west-3.awsapprunner.com"
backend_url = "http://localhost:8000"

def test_agno_endpoint():
    """Test the AGNO generation endpoint with model selector"""
    
    # Test data with model selector
    test_data = {
        "user_request": "Create a simple flask server that says hello world", 
        "stream": False, 
        "model": "moonshotai/Kimi-K2-Instruct"
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-Tenant-ID": "4485db48-71b7-47b0-8128-c6dca5be352d"
    }
    
    print("Testing AGNO Generation endpoint...")
    print(f"URL: {backend_url}/api/agno-generation/generate")
    print(f"Data: {json.dumps(test_data, indent=2)}")
    print(f"Headers: {json.dumps(headers, indent=2)}")
    
    try:
        response = requests.post(
            f"{backend_url}/api/agno-generation/generate",
            json=test_data,
            headers=headers,
            timeout=300
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 200:
            print("✅ AGNO endpoint is working!")
            return True
        else:
            print("❌ AGNO endpoint failed")
            return False
            
    except Exception as e:
        print(f"❌ Error testing endpoint: {e}")
        return False

def test_openapi_routes():
    """Check what routes are available in OpenAPI"""
    
    try:
        response = requests.get(f"{backend_url}/openapi.json")
        if response.status_code == 200:
            openapi_data = response.json()
            paths = openapi_data.get("paths", {})
            
            print(f"\nAvailable routes ({len(paths)}):")
            for path in sorted(paths.keys()):
                print(f"  - {path}")
                
            # Check specifically for AGNO routes
            agno_routes = [path for path in paths.keys() if "agno" in path.lower()]
            print(f"\nAGNO-related routes ({len(agno_routes)}):")
            for route in agno_routes:
                print(f"  - {route}")
                
            return len(agno_routes) > 0
        else:
            print(f"❌ Failed to get OpenAPI data: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error getting OpenAPI data: {e}")
        return False

if __name__ == "__main__":
    print("🔍 Testing Kiff AI Backend - AGNO Model Selector")
    print("=" * 50)
    
    # Test OpenAPI routes first
    has_agno_routes = test_openapi_routes()
    
    print("\n" + "=" * 50)
    
    # Test AGNO endpoint
    agno_working = test_agno_endpoint()
    
    print("\n" + "=" * 50)
    print("📋 Summary:")
    print(f"  AGNO routes in OpenAPI: {'✅' if has_agno_routes else '❌'}")
    print(f"  AGNO endpoint working: {'✅' if agno_working else '❌'}")
    
    if has_agno_routes and agno_working:
        print("🎉 Backend is ready for model selector testing!")
    else:
        print("🚨 Backend needs debugging - AGNO routes not available")
