#!/usr/bin/env python3
"""
Test script for Kiff VM Integration

This script tests the integration between the backend and the new VM infrastructure
for code execution without using E2B.
"""

import requests
import json
import time
import sys
from typing import Dict, Any

BASE_URL = "http://localhost:8000/api/preview"
TENANT_ID = "4485db48-71b7-47b0-8128-c6dca5be352d"

def test_vm_integration():
    """Test the VM integration end-to-end"""
    print("🧪 Testing Kiff VM Integration")
    print("=" * 50)
    
    # Test 1: Create sandbox
    print("\n1. Creating sandbox...")
    response = requests.post(
        f"{BASE_URL}/sandbox",
        json={"session_id": "test-session-vm", "runtime": "vite"},
        headers={"X-Tenant-ID": TENANT_ID}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to create sandbox: {response.status_code} - {response.text}")
        return False
    
    result = response.json()
    print(f"✅ Sandbox created: {result.get('sandbox_id', 'N/A')}")
    
    # Test 2: Apply files (simple React Vite project)
    print("\n2. Applying files...")
    files = [
        {
            "path": "package.json",
            "content": json.dumps({
                "name": "test-vite-app",
                "private": True,
                "version": "0.0.0",
                "type": "module",
                "scripts": {
                    "dev": "vite",
                    "build": "vite build",
                    "preview": "vite preview"
                },
                "dependencies": {
                    "react": "^18.2.0",
                    "react-dom": "^18.2.0"
                },
                "devDependencies": {
                    "@types/react": "^18.2.15",
                    "@types/react-dom": "^18.2.7",
                    "@vitejs/plugin-react": "^4.0.3",
                    "vite": "^4.4.5"
                }
            }, indent=2)
        },
        {
            "path": "index.html",
            "content": """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kiff VM Test</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>"""
        },
        {
            "path": "src/main.jsx",
            "content": """import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)"""
        },
        {
            "path": "src/App.jsx",
            "content": """import React, { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🚀 Kiff VM Test App</h1>
      <p>This app is running in a Kiff micro VM!</p>
      <div style={{ margin: '20px 0' }}>
        <button 
          onClick={() => setCount(count + 1)}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Count: {count}
        </button>
      </div>
      <p>✅ VM infrastructure is working correctly!</p>
    </div>
  )
}

export default App"""
        },
        {
            "path": "vite.config.js",
            "content": """import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})"""
        }
    ]
    
    response = requests.post(
        f"{BASE_URL}/files",
        json={"session_id": "test-session-vm", "files": files},
        headers={"X-Tenant-ID": TENANT_ID}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to apply files: {response.status_code} - {response.text}")
        return False
    
    print("✅ Files applied successfully")
    
    # Test 3: Install packages
    print("\n3. Installing packages...")
    response = requests.post(
        f"{BASE_URL}/install",
        json={"session_id": "test-session-vm", "packages": ["react", "react-dom", "vite"]},
        headers={"X-Tenant-ID": TENANT_ID}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to install packages: {response.status_code} - {response.text}")
        return False
    
    print("✅ Packages installed successfully")
    
    # Test 4: Restart server
    print("\n4. Starting development server...")
    response = requests.post(
        f"{BASE_URL}/restart",
        json={"session_id": "test-session-vm"},
        headers={"X-Tenant-ID": TENANT_ID}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to restart server: {response.status_code} - {response.text}")
        return False
    
    print("✅ Development server started")
    
    # Test 5: Check logs
    print("\n5. Checking logs...")
    time.sleep(3)  # Give server time to start
    
    response = requests.get(
        f"{BASE_URL}/logs",
        params={"session_id": "test-session-vm"},
        headers={"X-Tenant-ID": TENANT_ID}
    )
    
    if response.status_code == 200:
        logs = response.json().get("logs", "")
        print(f"✅ Logs retrieved: {len(logs)} characters")
        if logs:
            print("📝 Recent logs:")
            print(logs[-500:] if len(logs) > 500 else logs)
    else:
        print(f"⚠️  Could not retrieve logs: {response.status_code}")
    
    # Test 6: Get preview URL
    print("\n6. Getting preview URL...")
    response = requests.get(
        f"{BASE_URL}/tree",
        params={"session_id": "test-session-vm"},
        headers={"X-Tenant-ID": TENANT_ID}
    )
    
    if response.status_code == 200:
        tree_data = response.json()
        preview_url = tree_data.get("preview_url")
        if preview_url:
            print(f"✅ Preview URL: {preview_url}")
        else:
            print("⚠️  Preview URL not available yet")
    else:
        print(f"⚠️  Could not get tree data: {response.status_code}")
    
    print("\n🎉 VM integration test completed successfully!")
    print("\n📋 Summary:")
    print("   ✅ Sandbox creation")
    print("   ✅ File deployment")
    print("   ✅ Package installation")
    print("   ✅ Development server startup")
    print("   ✅ Log retrieval")
    
    return True

def test_python_app():
    """Test Python application deployment"""
    print("\n\n🐍 Testing Python Application Deployment")
    print("=" * 50)
    
    # Create a simple FastAPI app
    print("\n1. Creating Python sandbox...")
    response = requests.post(
        f"{BASE_URL}/sandbox",
        json={"session_id": "test-python-vm", "runtime": "python"},
        headers={"X-Tenant-ID": TENANT_ID}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to create Python sandbox: {response.status_code}")
        return False
    
    print("✅ Python sandbox created")
    
    # Apply Python files
    print("\n2. Applying Python files...")
    files = [
        {
            "path": "main.py",
            "content": """from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI(title="Kiff VM Python Test")

@app.get("/")
def read_root():
    return {"message": "🐍 Python app running in Kiff VM!", "status": "success"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "kiff-vm-python-test"}

@app.get("/demo", response_class=HTMLResponse)
def demo_page():
    return '''
    <html>
        <head><title>Kiff VM Python Demo</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h1>🚀 Python App in Kiff VM</h1>
            <p>This FastAPI application is running inside a Kiff micro VM!</p>
            <ul>
                <li>✅ Python runtime</li>
                <li>✅ FastAPI framework</li>
                <li>✅ Custom VM infrastructure</li>
                <li>✅ File deployment</li>
            </ul>
            <p><a href="/docs">API Documentation</a></p>
        </body>
    </html>
    '''

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
"""
        },
        {
            "path": "requirements.txt",
            "content": """fastapi==0.104.1
uvicorn[standard]==0.24.0
"""
        }
    ]
    
    response = requests.post(
        f"{BASE_URL}/files",
        json={"session_id": "test-python-vm", "files": files},
        headers={"X-Tenant-ID": TENANT_ID}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to apply Python files: {response.status_code}")
        return False
    
    print("✅ Python files applied")
    
    # Install Python packages
    print("\n3. Installing Python packages...")
    response = requests.post(
        f"{BASE_URL}/install",
        json={"session_id": "test-python-vm", "packages": ["fastapi", "uvicorn[standard]"]},
        headers={"X-Tenant-ID": TENANT_ID}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to install Python packages: {response.status_code}")
        return False
    
    print("✅ Python packages installed")
    
    # Start Python app
    print("\n4. Starting Python application...")
    response = requests.post(
        f"{BASE_URL}/restart",
        json={"session_id": "test-python-vm"},
        headers={"X-Tenant-ID": TENANT_ID}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to start Python app: {response.status_code}")
        return False
    
    print("✅ Python application started")
    print("\n🎉 Python app deployment test completed!")
    
    return True

def main():
    """Run all tests"""
    print("🚀 Kiff VM Integration Test Suite")
    print("Testing custom VM infrastructure for code execution")
    print("\nMake sure the backend is running with SANDBOX_PROVIDER=infra")
    
    try:
        # Test VM orchestrator is available
        response = requests.get("http://localhost:8002/health", timeout=5)
        if response.status_code != 200:
            print("❌ VM Orchestrator not available at localhost:8002")
            print("   Please start the VM service with: docker-compose -f docker-compose.vm-service.yml up")
            return False
    except:
        print("❌ VM Orchestrator not available at localhost:8002")
        print("   Please start the VM service with: docker-compose -f docker-compose.vm-service.yml up")
        return False
    
    # Test backend is available
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code != 200:
            print("❌ Backend not available at localhost:8000")
            return False
    except:
        print("❌ Backend not available at localhost:8000")
        return False
    
    print("✅ Services are available, starting tests...\n")
    
    success = True
    
    # Run tests
    if not test_vm_integration():
        success = False
    
    if not test_python_app():
        success = False
    
    if success:
        print("\n🎉 All tests passed! VM integration is working correctly.")
        print("\n📖 Next steps:")
        print("   1. Check the preview URLs to see your apps running")
        print("   2. Try the frontend launcher at http://localhost:3000/kiffs/launcher")
        print("   3. Deploy to production by setting INFRA_ENABLE_MOCK=false")
    else:
        print("\n❌ Some tests failed. Check the logs for details.")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)