"""
Kiff Micro VM Orchestrator

A custom micro VM service that leverages existing ML infrastructure
to create secure, isolated execution environments for agentic applications.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from typing import Dict, List, Optional
import asyncio

from .vm_manager import VMManager
from .models import VMRequest, VMResponse, VMStatus, ServiceHealth
from .ml_bridge import MLServiceBridge
from .vector_bridge import VectorStoreBridge

# Initialize FastAPI app
app = FastAPI(
    title="Kiff Micro VM Orchestrator",
    description="Custom micro VM service for agentic applications",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
vm_manager = VMManager()
ml_bridge = MLServiceBridge(
    ml_service_url=os.getenv("ML_SERVICE_URL", "http://localhost:8001")
)
vector_bridge = VectorStoreBridge(
    vector_service_url=os.getenv("VECTOR_SERVICE_URL", "http://localhost:8003")
)

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    await vm_manager.initialize()
    await ml_bridge.initialize()
    await vector_bridge.initialize()

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await vm_manager.cleanup()

@app.get("/health", response_model=ServiceHealth)
async def health_check():
    """Health check endpoint"""
    try:
        vm_stats = await vm_manager.get_stats()
        ml_status = await ml_bridge.health_check()
        vector_status = await vector_bridge.health_check()
        
        return ServiceHealth(
            status="healthy",
            vm_count=vm_stats["active_vms"],
            ml_service_available=ml_status,
            vector_service_available=vector_status,
            memory_usage=vm_stats["memory_usage"],
            cpu_usage=vm_stats["cpu_usage"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@app.post("/vm/create", response_model=VMResponse)
async def create_vm(vm_request: VMRequest, background_tasks: BackgroundTasks):
    """Create a new micro VM"""
    try:
        vm_id = await vm_manager.create_vm(
            vm_type=vm_request.vm_type,
            config=vm_request.config,
            resources=vm_request.resources
        )
        
        # Warm up connections in background if requested
        if vm_request.warm_ml_connection:
            background_tasks.add_task(ml_bridge.warm_connection, vm_id)
        
        if vm_request.warm_vector_connection:
            background_tasks.add_task(vector_bridge.warm_connection, vm_id)
        
        return VMResponse(
            vm_id=vm_id,
            status="creating",
            message="VM creation initiated"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create VM: {str(e)}")

@app.get("/vm/{vm_id}/status", response_model=VMStatus)
async def get_vm_status(vm_id: str):
    """Get VM status and details"""
    try:
        status = await vm_manager.get_vm_status(vm_id)
        return status
    except KeyError:
        raise HTTPException(status_code=404, detail="VM not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get VM status: {str(e)}")

@app.post("/vm/{vm_id}/execute")
async def execute_code(vm_id: str, code: str, language: str = "python"):
    """Execute code in a specific VM"""
    try:
        result = await vm_manager.execute_code(vm_id, code, language)
        return {"result": result}
    except KeyError:
        raise HTTPException(status_code=404, detail="VM not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code execution failed: {str(e)}")

@app.post("/vm/{vm_id}/ml/query")
async def ml_query(vm_id: str, query_data: dict):
    """Proxy ML service queries through VM context"""
    try:
        # Verify VM exists and is running
        await vm_manager.verify_vm_active(vm_id)
        
        # Forward to ML service with VM context
        result = await ml_bridge.query(vm_id, query_data)
        return result
    except KeyError:
        raise HTTPException(status_code=404, detail="VM not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML query failed: {str(e)}")

@app.post("/vm/{vm_id}/vector/search")
async def vector_search(vm_id: str, search_data: dict):
    """Proxy vector store searches through VM context"""
    try:
        # Verify VM exists and is running
        await vm_manager.verify_vm_active(vm_id)
        
        # Forward to vector service with VM context
        result = await vector_bridge.search(vm_id, search_data)
        return result
    except KeyError:
        raise HTTPException(status_code=404, detail="VM not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vector search failed: {str(e)}")

@app.delete("/vm/{vm_id}")
async def destroy_vm(vm_id: str):
    """Destroy a micro VM"""
    try:
        await vm_manager.destroy_vm(vm_id)
        return {"message": f"VM {vm_id} destroyed successfully"}
    except KeyError:
        raise HTTPException(status_code=404, detail="VM not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to destroy VM: {str(e)}")

@app.get("/vms", response_model=List[VMStatus])
async def list_vms():
    """List all active VMs"""
    try:
        vms = await vm_manager.list_vms()
        return vms
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list VMs: {str(e)}")

@app.post("/agent/workflow")
async def run_agent_workflow(workflow_config: dict):
    """Run a multi-agent workflow across multiple VMs"""
    try:
        # Create multiple VMs for the workflow
        agent_vms = []
        for agent_config in workflow_config.get("agents", []):
            vm_id = await vm_manager.create_vm(
                vm_type="ml_agent",
                config=agent_config,
                resources={"cpu": "0.5", "memory": "512Mi"}
            )
            agent_vms.append(vm_id)
        
        # Execute workflow coordination
        result = await vm_manager.orchestrate_workflow(agent_vms, workflow_config)
        
        return {"workflow_id": result["workflow_id"], "agent_vms": agent_vms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Workflow execution failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8002,
        reload=True
    )