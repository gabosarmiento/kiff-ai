"""
VM Orchestrator Client for Kiff Backend Integration
Connects to the deployed VM orchestrator service
"""
import os
import json
import httpx
import uuid
import time
from typing import Dict, Any, List, Optional


class VMOrchestratorClient:
    """Client for communicating with the VM orchestrator service"""
    
    def __init__(self):
        # Use environment variable or default to our ALB endpoint
        self.base_url = os.getenv(
            "VM_ORCHESTRATOR_URL", 
            "http://your-vm-orchestrator-alb.region.elb.amazonaws.com"
        )
        self.timeout = 30.0
        
    async def create_vm(self, tenant_id: str, session_id: str, env: str = "default") -> Dict[str, Any]:
        """Create a new VM instance"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                payload = {
                    "tenant_id": tenant_id,
                    "session_id": session_id,
                    "environment": env,
                    "vm_type": "secure-code-execution"
                }
                response = await client.post(
                    f"{self.base_url}/vm/create",
                    json=payload
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            return {"error": f"VM creation failed: {e}"}
    
    async def deploy_files(self, vm_id: str, files: List[Dict[str, str]]) -> Dict[str, Any]:
        """Deploy files to a VM"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                payload = {
                    "vm_id": vm_id,
                    "files": files
                }
                response = await client.post(
                    f"{self.base_url}/vm/{vm_id}/deploy",
                    json=payload
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            return {"error": f"File deployment failed: {e}"}
    
    async def install_packages(self, vm_id: str, packages: List[str], runtime: str = "npm") -> Dict[str, Any]:
        """Install packages in a VM"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                payload = {
                    "vm_id": vm_id,
                    "packages": packages,
                    "runtime": runtime
                }
                response = await client.post(
                    f"{self.base_url}/vm/{vm_id}/install",
                    json=payload
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            return {"error": f"Package installation failed: {e}"}
    
    async def start_dev_server(self, vm_id: str) -> Dict[str, Any]:
        """Start development server in a VM"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:  # Longer timeout for server start
                response = await client.post(f"{self.base_url}/vm/{vm_id}/start")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            return {"error": f"Dev server start failed: {e}"}
    
    async def get_logs(self, vm_id: str) -> Dict[str, Any]:
        """Get logs from a VM"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/vm/{vm_id}/logs")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            return {"error": f"Log retrieval failed: {e}"}
    
    async def stop_vm(self, vm_id: str) -> Dict[str, Any]:
        """Stop and cleanup a VM"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.delete(f"{self.base_url}/vm/{vm_id}")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            return {"error": f"VM stop failed: {e}"}
    
    async def health_check(self) -> Dict[str, Any]:
        """Check if VM orchestrator is healthy"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/health")
                response.raise_for_status()
                return {"status": "healthy", "details": response.json()}
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}


# Singleton instance
vm_client = VMOrchestratorClient()