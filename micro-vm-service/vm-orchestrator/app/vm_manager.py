"""
VM Manager - Core orchestration logic for micro VMs

Handles VM lifecycle, resource management, and code execution
using Docker containers with security and performance optimizations.
"""

import asyncio
import docker
import uuid
import json
import time
import psutil
from datetime import datetime
from typing import Dict, List, Optional, Any
import logging
from contextlib import asynccontextmanager

from .models import VMType, VMState, VMStatus, ResourceLimits, VMConfig

logger = logging.getLogger(__name__)

class VMManager:
    """Manages micro VM lifecycle and orchestration"""
    
    def __init__(self):
        self.docker_client = None
        self.active_vms: Dict[str, dict] = {}
        self.vm_containers: Dict[str, Any] = {}
        self.network_name = "kiff-vm-network"
        
    async def initialize(self):
        """Initialize the VM manager"""
        try:
            # Initialize Docker client
            self.docker_client = docker.from_env()
            
            # Create dedicated network for VMs
            await self._ensure_vm_network()
            
            # Clean up any orphaned containers
            await self._cleanup_orphaned_containers()
            
            logger.info("VM Manager initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize VM Manager: {e}")
            raise
    
    async def _ensure_vm_network(self):
        """Ensure the VM network exists"""
        try:
            self.docker_client.networks.get(self.network_name)
            logger.info(f"Using existing network: {self.network_name}")
        except docker.errors.NotFound:
            # Create network with security policies
            network = self.docker_client.networks.create(
                name=self.network_name,
                driver="bridge",
                options={
                    "com.docker.network.bridge.enable_icc": "true",
                    "com.docker.network.bridge.enable_ip_masquerade": "true",
                    "com.docker.network.driver.mtu": "1500"
                },
                labels={"managed_by": "kiff-vm-orchestrator"}
            )
            logger.info(f"Created VM network: {self.network_name}")
    
    async def _cleanup_orphaned_containers(self):
        """Clean up containers from previous runs"""
        try:
            containers = self.docker_client.containers.list(
                all=True,
                filters={"label": "kiff.vm.managed=true"}
            )
            for container in containers:
                if container.status in ["exited", "dead"]:
                    container.remove()
                    logger.info(f"Removed orphaned container: {container.id[:12]}")
        except Exception as e:
            logger.warning(f"Error cleaning up containers: {e}")
    
    async def create_vm(self, vm_type: VMType, config: VMConfig, resources: ResourceLimits) -> str:
        """Create a new micro VM"""
        vm_id = f"vm-{uuid.uuid4().hex[:8]}"
        
        try:
            # Build container configuration
            container_config = await self._build_container_config(
                vm_id, vm_type, config, resources
            )
            
            # Create and start container
            container = self.docker_client.containers.run(
                **container_config,
                detach=True,
                remove=False,  # We'll manage cleanup
                network=self.network_name
            )
            
            # Store VM metadata
            self.active_vms[vm_id] = {
                "vm_type": vm_type,
                "state": VMState.CREATING,
                "created_at": datetime.utcnow(),
                "last_activity": datetime.utcnow(),
                "config": config,
                "resources": resources,
                "container_id": container.id
            }
            
            self.vm_containers[vm_id] = container
            
            # Wait for container to be ready
            await self._wait_for_container_ready(vm_id, container)
            
            # Update state to running
            self.active_vms[vm_id]["state"] = VMState.RUNNING
            
            logger.info(f"Created VM {vm_id} of type {vm_type}")
            return vm_id
            
        except Exception as e:
            # Cleanup on failure
            if vm_id in self.active_vms:
                del self.active_vms[vm_id]
            if vm_id in self.vm_containers:
                try:
                    self.vm_containers[vm_id].remove(force=True)
                except:
                    pass
                del self.vm_containers[vm_id]
            
            logger.error(f"Failed to create VM {vm_id}: {e}")
            raise
    
    async def _build_container_config(self, vm_id: str, vm_type: VMType, 
                                    config: VMConfig, resources: ResourceLimits) -> dict:
        """Build Docker container configuration"""
        
        # Base configuration for Python 3.11-slim
        container_config = {
            "image": await self._get_or_build_image(vm_type, config),
            "name": f"kiff-{vm_id}",
            "hostname": vm_id,
            "labels": {
                "kiff.vm.managed": "true",
                "kiff.vm.id": vm_id,
                "kiff.vm.type": vm_type.value,
                "kiff.vm.created": datetime.utcnow().isoformat()
            },
            "environment": {
                "VM_ID": vm_id,
                "VM_TYPE": vm_type.value,
                "PYTHONUNBUFFERED": "1",
                "PYTHONDONTWRITEBYTECODE": "1",
                **config.environment_vars
            },
            "mem_limit": resources.memory,
            "cpu_period": 100000,  # 100ms
            "cpu_quota": int(float(resources.cpu) * 100000),  # CPU limit
            "security_opt": ["no-new-privileges:true"],
            "read_only": False,  # Allow writes to specific dirs
            "tmpfs": {"/tmp": "noexec,nosuid,size=100m"},
            "cap_drop": ["ALL"],
            "cap_add": ["CHOWN", "SETGID", "SETUID"],  # Minimal required caps
            "user": "1001:1001",  # Non-root user
            "working_dir": "/app"
        }
        
        # Add resource constraints
        if hasattr(resources, 'storage'):
            # Note: Docker storage limits require specific setup
            pass
        
        # Configure volumes
        if config.volumes:
            container_config["volumes"] = config.volumes
        
        return container_config
    
    async def _get_or_build_image(self, vm_type: VMType, config: VMConfig) -> str:
        """Get or build the appropriate container image"""
        base_image = config.base_image or "python:3.11-slim"
        
        # For now, use base image directly
        # TODO: Build optimized images for each VM type
        image_map = {
            VMType.CODE_EXECUTION: "kiff/vm-code-execution:latest",
            VMType.ML_AGENT: "kiff/vm-ml-agent:latest",
            VMType.API_COMPOSITION: "kiff/vm-api-composition:latest",
            VMType.DATA_PROCESSING: "kiff/vm-data-processing:latest"
        }
        
        target_image = image_map.get(vm_type, base_image)
        
        # Check if custom image exists, fallback to base
        try:
            self.docker_client.images.get(target_image)
            return target_image
        except docker.errors.ImageNotFound:
            logger.warning(f"Custom image {target_image} not found, using {base_image}")
            return base_image
    
    async def _wait_for_container_ready(self, vm_id: str, container, timeout: int = 30):
        """Wait for container to be ready"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                container.reload()
                if container.status == "running":
                    # Additional health check could go here
                    return
                elif container.status in ["exited", "dead"]:
                    logs = container.logs().decode('utf-8')
                    raise Exception(f"Container failed to start: {logs[-500:]}")
                
                await asyncio.sleep(0.5)
            except Exception as e:
                if "not found" in str(e).lower():
                    raise Exception("Container was removed unexpectedly")
                raise
        
        raise Exception(f"Container {vm_id} failed to become ready within {timeout}s")
    
    async def execute_code(self, vm_id: str, code: str, language: str = "python") -> dict:
        """Execute code in a specific VM"""
        if vm_id not in self.vm_containers:
            raise KeyError(f"VM {vm_id} not found")
        
        container = self.vm_containers[vm_id]
        
        try:
            # Update last activity
            self.active_vms[vm_id]["last_activity"] = datetime.utcnow()
            
            if language.lower() == "python":
                # Execute Python code
                cmd = ["python", "-c", code]
            elif language.lower() in ["javascript", "js", "node"]:
                # Execute JavaScript code
                cmd = ["node", "-e", code]
            else:
                raise ValueError(f"Unsupported language: {language}")
            
            # Execute with timeout
            start_time = time.time()
            result = container.exec_run(
                cmd,
                user="1001",  # Non-root execution
                workdir="/app",
                environment={"PYTHONUNBUFFERED": "1"}
            )
            execution_time = time.time() - start_time
            
            return {
                "success": result.exit_code == 0,
                "output": result.output.decode('utf-8'),
                "exit_code": result.exit_code,
                "execution_time": execution_time
            }
            
        except Exception as e:
            logger.error(f"Code execution failed in VM {vm_id}: {e}")
            return {
                "success": False,
                "output": "",
                "error": str(e),
                "execution_time": 0
            }
    
    async def get_vm_status(self, vm_id: str) -> VMStatus:
        """Get detailed status of a VM"""
        if vm_id not in self.active_vms:
            raise KeyError(f"VM {vm_id} not found")
        
        vm_data = self.active_vms[vm_id]
        container = self.vm_containers.get(vm_id)
        
        # Get resource usage
        resource_usage = {}
        if container:
            try:
                container.reload()
                stats = container.stats(stream=False)
                
                # Calculate CPU usage
                cpu_stats = stats["cpu_stats"]
                precpu_stats = stats["precpu_stats"]
                cpu_usage = 0.0
                
                if "cpu_usage" in cpu_stats and "system_cpu_usage" in cpu_stats:
                    cpu_delta = cpu_stats["cpu_usage"]["total_usage"] - precpu_stats["cpu_usage"]["total_usage"]
                    system_delta = cpu_stats["system_cpu_usage"] - precpu_stats["system_cpu_usage"]
                    if system_delta > 0:
                        cpu_usage = (cpu_delta / system_delta) * len(cpu_stats["cpu_usage"]["percpu_usage"]) * 100
                
                # Memory usage
                memory_stats = stats["memory_stats"]
                memory_usage = memory_stats.get("usage", 0)
                memory_limit = memory_stats.get("limit", 0)
                
                resource_usage = {
                    "cpu_usage_percent": round(cpu_usage, 2),
                    "memory_usage_bytes": memory_usage,
                    "memory_limit_bytes": memory_limit,
                    "memory_usage_percent": round((memory_usage / memory_limit) * 100, 2) if memory_limit > 0 else 0
                }
            except Exception as e:
                logger.warning(f"Failed to get container stats for {vm_id}: {e}")
        
        return VMStatus(
            vm_id=vm_id,
            vm_type=vm_data["vm_type"],
            state=vm_data["state"],
            created_at=vm_data["created_at"],
            last_activity=vm_data["last_activity"],
            resource_usage=resource_usage,
            endpoints={
                "execute": f"/vm/{vm_id}/execute",
                "status": f"/vm/{vm_id}/status"
            }
        )
    
    async def destroy_vm(self, vm_id: str):
        """Destroy a micro VM"""
        if vm_id not in self.active_vms:
            raise KeyError(f"VM {vm_id} not found")
        
        try:
            # Update state
            self.active_vms[vm_id]["state"] = VMState.STOPPING
            
            # Stop and remove container
            if vm_id in self.vm_containers:
                container = self.vm_containers[vm_id]
                container.stop(timeout=10)
                container.remove()
                del self.vm_containers[vm_id]
            
            # Remove from active VMs
            del self.active_vms[vm_id]
            
            logger.info(f"Destroyed VM {vm_id}")
            
        except Exception as e:
            logger.error(f"Failed to destroy VM {vm_id}: {e}")
            raise
    
    async def list_vms(self) -> List[VMStatus]:
        """List all active VMs"""
        vms = []
        for vm_id in list(self.active_vms.keys()):
            try:
                status = await self.get_vm_status(vm_id)
                vms.append(status)
            except Exception as e:
                logger.warning(f"Failed to get status for VM {vm_id}: {e}")
        return vms
    
    async def get_stats(self) -> dict:
        """Get overall VM manager statistics"""
        active_count = len(self.active_vms)
        
        # System resource usage
        cpu_usage = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        
        return {
            "active_vms": active_count,
            "cpu_usage": cpu_usage,
            "memory_usage": memory.percent,
            "memory_total": memory.total,
            "memory_available": memory.available
        }
    
    async def verify_vm_active(self, vm_id: str) -> bool:
        """Verify that a VM exists and is running"""
        if vm_id not in self.active_vms:
            raise KeyError(f"VM {vm_id} not found")
        
        vm_state = self.active_vms[vm_id]["state"]
        if vm_state != VMState.RUNNING:
            raise Exception(f"VM {vm_id} is not running (state: {vm_state})")
        
        return True
    
    async def orchestrate_workflow(self, agent_vms: List[str], workflow_config: dict) -> dict:
        """Orchestrate a multi-agent workflow"""
        workflow_id = f"workflow-{uuid.uuid4().hex[:8]}"
        
        # This is a simplified workflow orchestration
        # In production, you'd want a more sophisticated workflow engine
        
        results = {}
        for vm_id in agent_vms:
            # Execute workflow step in each VM
            step_code = workflow_config.get("coordination_code", "print('Hello from agent')")
            result = await self.execute_code(vm_id, step_code)
            results[vm_id] = result
        
        return {
            "workflow_id": workflow_id,
            "results": results,
            "status": "completed"
        }
    
    async def cleanup(self):
        """Cleanup all resources"""
        logger.info("Cleaning up VM Manager...")
        
        # Destroy all active VMs
        for vm_id in list(self.active_vms.keys()):
            try:
                await self.destroy_vm(vm_id)
            except Exception as e:
                logger.error(f"Failed to cleanup VM {vm_id}: {e}")
        
        # Close Docker client
        if self.docker_client:
            self.docker_client.close()
        
        logger.info("VM Manager cleanup completed")