#!/usr/bin/env python3
"""
Mock VM Orchestrator for Testing
This provides a simple mock service that mimics the VM orchestrator API
so we can test the integration without building the full Docker infrastructure.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import uuid
import time
import asyncio
import json
from typing import Dict, Any, Optional, List

app = FastAPI(title="Mock VM Orchestrator", version="1.0.0")

# Store active VMs and their logs
active_vms: Dict[str, Dict[str, Any]] = {}
vm_logs: Dict[str, List[str]] = {}
vm_install_status: Dict[str, str] = {}  # "installing", "ready", "failed"

class VMRequest(BaseModel):
    vm_type: str
    config: Dict[str, Any] = {}
    resources: Dict[str, Any] = {}
    warm_ml_connection: bool = False
    warm_vector_connection: bool = False

class CodeRequest(BaseModel):
    code: str
    language: str = "python"

class FileRequest(BaseModel):
    files: List[Dict[str, str]]

class InstallRequest(BaseModel):
    packages: List[str]
    runtime: str = "npm"

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "mock-vm-orchestrator",
        "vm_count": len(active_vms),
        "ml_service_available": True,
        "vector_service_available": True
    }

@app.post("/vm/create")
async def create_vm(vm_request: VMRequest):
    vm_id = f"vm-{uuid.uuid4().hex[:8]}"
    
    # Store VM info
    active_vms[vm_id] = {
        "vm_type": vm_request.vm_type,
        "config": vm_request.config,
        "created_at": time.time(),
        "status": "running",
        "workspace": "/workspace"
    }
    
    # Initialize logs and status
    vm_logs[vm_id] = [
        f"[{time.strftime('%H:%M:%S')}] 🚀 VM {vm_id} created",
        f"[{time.strftime('%H:%M:%S')}] 📁 Workspace initialized at /workspace",
        f"[{time.strftime('%H:%M:%S')}] ⚡ VM ready for file deployment"
    ]
    vm_install_status[vm_id] = "ready"
    
    print(f"🚀 Created mock VM: {vm_id} (type: {vm_request.vm_type})")
    
    return {
        "vm_id": vm_id,
        "status": "creating",
        "message": "Mock VM created successfully"
    }

@app.get("/vm/{vm_id}/status")
async def get_vm_status(vm_id: str):
    if vm_id not in active_vms:
        raise HTTPException(status_code=404, detail="VM not found")
    
    vm_info = active_vms[vm_id]
    return {
        "vm_id": vm_id,
        "vm_type": vm_info["vm_type"],
        "state": "running",
        "created_at": vm_info["created_at"],
        "last_activity": time.time(),
        "resource_usage": {
            "cpu_usage_percent": 15.5,
            "memory_usage_bytes": 134217728,  # 128MB
            "memory_limit_bytes": 1073741824,  # 1GB
            "memory_usage_percent": 12.5
        },
        "endpoints": {
            "execute": f"/vm/{vm_id}/execute",
            "status": f"/vm/{vm_id}/status"
        }
    }

@app.post("/vm/{vm_id}/execute")
async def execute_code(vm_id: str, code_request: CodeRequest):
    if vm_id not in active_vms:
        raise HTTPException(status_code=404, detail="VM not found")
    
    # Mock code execution
    code = code_request.code
    language = code_request.language
    
    print(f"📝 Executing {language} code in VM {vm_id}:")
    print(f"Code: {code[:100]}{'...' if len(code) > 100 else ''}")
    
    # Simulate some realistic outputs based on code content
    if "import" in code and "pathlib" in code:
        output = "✅ Files and directories created successfully"
    elif "subprocess" in code and "npm" in code:
        output = "npm install completed successfully\\nPackages installed: react, react-dom, vite"
    elif "subprocess" in code and "pip" in code:
        output = "Successfully installed fastapi uvicorn\\nVirtual environment created"
    elif "pathlib" in code and "mkdir" in code:
        output = f"Initialized workspace at {code.split('workspace')[0] if 'workspace' in code else '/workspace'}"
    elif "print" in code:
        output = "Mock execution successful"
    else:
        output = f"Executed {len(code)} characters of {language} code successfully"
    
    return {
        "result": {
            "success": True,
            "output": output,
            "exit_code": 0,
            "execution_time": 0.5
        }
    }

@app.delete("/vm/{vm_id}")
async def destroy_vm(vm_id: str):
    if vm_id not in active_vms:
        raise HTTPException(status_code=404, detail="VM not found")
    
    del active_vms[vm_id]
    print(f"🗑️ Destroyed VM: {vm_id}")
    
    return {"message": f"VM {vm_id} destroyed successfully"}

@app.get("/vms")
async def list_vms():
    vms = []
    for vm_id, vm_info in active_vms.items():
        vms.append({
            "vm_id": vm_id,
            "vm_type": vm_info["vm_type"],
            "state": "running",
            "created_at": vm_info["created_at"],
            "last_activity": time.time(),
            "resource_usage": {"cpu_usage_percent": 10.0}
        })
    return vms

@app.post("/vm/{vm_id}/files")
async def deploy_files(vm_id: str, file_request: FileRequest):
    if vm_id not in active_vms:
        raise HTTPException(status_code=404, detail="VM not found")
    
    files = file_request.files
    
    # Add deployment logs
    vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] 📁 Deploying {len(files)} files...")
    
    for file_info in files:
        path = file_info.get("path", "unknown")
        vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] ✏️  Deploying {path}")
        
        # Simulate deployment time
        await asyncio.sleep(0.2)
    
    vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] ✅ All files deployed successfully")
    
    print(f"📁 Deployed {len(files)} files to VM {vm_id}")
    
    return {
        "status": "success",
        "files_deployed": len(files),
        "message": "Files deployed successfully"
    }

@app.post("/vm/{vm_id}/install")
async def install_packages(vm_id: str, install_request: InstallRequest):
    if vm_id not in active_vms:
        raise HTTPException(status_code=404, detail="VM not found")
    
    packages = install_request.packages
    runtime = install_request.runtime
    
    vm_install_status[vm_id] = "installing"
    
    # Add installation logs
    vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] 📦 Installing {len(packages)} packages via {runtime}...")
    
    if runtime == "npm":
        vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] 🔍 Running: npm install")
        await asyncio.sleep(2)  # Simulate npm install time
        vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] 📥 Downloaded dependencies")
        await asyncio.sleep(1)
        vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] 🔧 Building packages")
        await asyncio.sleep(1)
        vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] ✅ npm install completed successfully")
    elif runtime == "pip":
        vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] 🔍 Running: pip install {' '.join(packages)}")
        await asyncio.sleep(1.5)  # Simulate pip install time
        vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] ✅ pip install completed successfully")
    
    vm_install_status[vm_id] = "ready"
    
    print(f"📦 Installed packages in VM {vm_id}: {packages}")
    
    return {
        "status": "success",
        "packages_installed": packages,
        "runtime": runtime,
        "message": "Packages installed successfully"
    }

@app.post("/vm/{vm_id}/start-server")
async def start_dev_server(vm_id: str):
    if vm_id not in active_vms:
        raise HTTPException(status_code=404, detail="VM not found")
    
    if vm_install_status.get(vm_id) != "ready":
        vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] ⚠️  Waiting for package installation to complete...")
        return {"status": "waiting", "message": "Waiting for installation to complete"}
    
    # Start development server
    vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] 🚀 Starting development server...")
    await asyncio.sleep(1)  # Simulate server startup time
    
    vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] 🌐 Server running on http://0.0.0.0:5173")
    vm_logs[vm_id].append(f"[{time.strftime('%H:%M:%S')}] ✅ Preview ready!")
    
    # Generate preview URL (mock)
    preview_url = f"http://localhost:5173"  # In real implementation, this would be dynamic
    active_vms[vm_id]["preview_url"] = preview_url
    active_vms[vm_id]["server_status"] = "running"
    
    print(f"🌐 Dev server started for VM {vm_id}: {preview_url}")
    
    return {
        "status": "running",
        "preview_url": preview_url,
        "message": "Development server started"
    }

@app.get("/vm/{vm_id}/logs")
async def get_vm_logs(vm_id: str, tail: int = 50):
    if vm_id not in active_vms:
        raise HTTPException(status_code=404, detail="VM not found")
    
    logs = vm_logs.get(vm_id, [])
    if tail > 0:
        logs = logs[-tail:]
    
    return {
        "vm_id": vm_id,
        "logs": logs,
        "install_status": vm_install_status.get(vm_id, "unknown"),
        "server_status": active_vms[vm_id].get("server_status", "stopped")
    }

if __name__ == "__main__":
    print("🔧 Starting Mock VM Orchestrator on port 8002")
    print("This service mocks the VM orchestrator API for testing")
    uvicorn.run(app, host="0.0.0.0", port=8002, log_level="info")