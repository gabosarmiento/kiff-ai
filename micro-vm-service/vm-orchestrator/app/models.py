"""
Pydantic models for the VM orchestrator service
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from enum import Enum
from datetime import datetime

class VMType(str, Enum):
    """Available VM types"""
    CODE_EXECUTION = "code_execution"
    ML_AGENT = "ml_agent"
    API_COMPOSITION = "api_composition"
    DATA_PROCESSING = "data_processing"

class VMState(str, Enum):
    """VM lifecycle states"""
    CREATING = "creating"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPING = "stopping"
    STOPPED = "stopped"
    ERROR = "error"

class ResourceLimits(BaseModel):
    """Resource allocation limits for VMs"""
    cpu: str = Field(default="0.5", description="CPU limit (e.g., '0.5', '1')")
    memory: str = Field(default="512Mi", description="Memory limit (e.g., '512Mi', '1Gi')")
    storage: str = Field(default="1Gi", description="Storage limit")
    network_bandwidth: Optional[str] = Field(default=None, description="Network bandwidth limit")
    execution_timeout: int = Field(default=300, description="Maximum execution time in seconds")

class VMConfig(BaseModel):
    """Configuration for VM creation"""
    base_image: Optional[str] = Field(default="python:3.11-slim", description="Base container image")
    environment_vars: Dict[str, str] = Field(default_factory=dict, description="Environment variables")
    volumes: Dict[str, str] = Field(default_factory=dict, description="Volume mounts")
    network_mode: str = Field(default="bridge", description="Network mode")
    security_context: Dict[str, Any] = Field(default_factory=dict, description="Security settings")
    pre_install_packages: List[str] = Field(default_factory=list, description="Packages to install on startup")

class VMRequest(BaseModel):
    """Request to create a new VM"""
    vm_type: VMType = Field(description="Type of VM to create")
    config: VMConfig = Field(default_factory=VMConfig, description="VM configuration")
    resources: ResourceLimits = Field(default_factory=ResourceLimits, description="Resource limits")
    warm_ml_connection: bool = Field(default=False, description="Pre-warm ML service connection")
    warm_vector_connection: bool = Field(default=False, description="Pre-warm vector store connection")
    labels: Dict[str, str] = Field(default_factory=dict, description="Custom labels for the VM")

class VMResponse(BaseModel):
    """Response after VM creation"""
    vm_id: str = Field(description="Unique identifier for the created VM")
    status: str = Field(description="Current status of the VM")
    message: str = Field(description="Status message")
    endpoint: Optional[str] = Field(default=None, description="VM access endpoint")

class VMStatus(BaseModel):
    """Current status and details of a VM"""
    vm_id: str = Field(description="VM identifier")
    vm_type: VMType = Field(description="Type of VM")
    state: VMState = Field(description="Current state")
    created_at: datetime = Field(description="Creation timestamp")
    last_activity: datetime = Field(description="Last activity timestamp")
    resource_usage: Dict[str, Any] = Field(description="Current resource usage")
    endpoints: Dict[str, str] = Field(default_factory=dict, description="Available endpoints")
    logs_url: Optional[str] = Field(default=None, description="URL to access logs")

class ServiceHealth(BaseModel):
    """Health status of the orchestrator service"""
    status: str = Field(description="Overall service status")
    vm_count: int = Field(description="Number of active VMs")
    ml_service_available: bool = Field(description="ML service availability")
    vector_service_available: bool = Field(description="Vector store availability")
    memory_usage: float = Field(description="Memory usage percentage")
    cpu_usage: float = Field(description="CPU usage percentage")

class CodeExecutionRequest(BaseModel):
    """Request to execute code in a VM"""
    code: str = Field(description="Code to execute")
    language: str = Field(default="python", description="Programming language")
    timeout: int = Field(default=30, description="Execution timeout in seconds")
    environment: Dict[str, str] = Field(default_factory=dict, description="Additional environment variables")

class CodeExecutionResult(BaseModel):
    """Result of code execution"""
    success: bool = Field(description="Whether execution was successful")
    output: str = Field(description="Execution output")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    execution_time: float = Field(description="Execution time in seconds")
    resource_usage: Dict[str, Any] = Field(description="Resource usage during execution")

class WorkflowConfig(BaseModel):
    """Configuration for multi-agent workflows"""
    name: str = Field(description="Workflow name")
    agents: List[Dict[str, Any]] = Field(description="Agent configurations")
    coordination_strategy: str = Field(default="sequential", description="How agents coordinate")
    shared_resources: Dict[str, str] = Field(default_factory=dict, description="Shared resources between agents")
    max_execution_time: int = Field(default=1800, description="Maximum workflow execution time")

class MLQuery(BaseModel):
    """Query to ML service through VM"""
    model_name: str = Field(description="Model to use")
    input_data: Any = Field(description="Input data for the model")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Model parameters")

class VectorSearchQuery(BaseModel):
    """Query to vector store through VM"""
    query_text: str = Field(description="Text to search for")
    collection_name: str = Field(description="Vector collection to search")
    limit: int = Field(default=10, description="Maximum number of results")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")