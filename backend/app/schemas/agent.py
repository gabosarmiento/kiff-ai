from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class AgentBase(BaseModel):
    """Base agent schema"""
    name: str = Field(..., description="Agent name")
    description: Optional[str] = Field(None, description="Agent description")
    model_name: str = Field(default="gpt-4o", description="LLM model to use")
    instructions: str = Field(..., description="Agent instructions/prompt")
    tools: Optional[List[Dict[str, Any]]] = Field(default=[], description="Agent tools configuration")
    knowledge_base_id: Optional[str] = Field(None, description="Knowledge base ID")
    trading_strategy: Optional[str] = Field(None, description="Trading strategy type")
    risk_parameters: Optional[Dict[str, Any]] = Field(default={}, description="Risk management parameters")

class AgentCreate(AgentBase):
    """Schema for creating a new agent"""
    pass

class AgentUpdate(BaseModel):
    """Schema for updating an agent"""
    name: Optional[str] = None
    description: Optional[str] = None
    model_name: Optional[str] = None
    instructions: Optional[str] = None
    tools: Optional[List[Dict[str, Any]]] = None
    knowledge_base_id: Optional[str] = None
    trading_strategy: Optional[str] = None
    risk_parameters: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class AgentResponse(AgentBase):
    """Schema for agent response"""
    id: str
    user_id: str
    tenant_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AgentGenerateRequest(BaseModel):
    """Schema for generating agent code/configuration"""
    prompt: str = Field(..., description="User prompt for agent generation")
    trading_pair: Optional[str] = Field(default="BTCUSDT", description="Trading pair")
    strategy_type: Optional[str] = Field(default="momentum", description="Strategy type")
    risk_level: Optional[str] = Field(default="medium", description="Risk level: low, medium, high")
    timeframe: Optional[str] = Field(default="1h", description="Trading timeframe")
    
class AgentGenerateResponse(BaseModel):
    """Schema for agent generation response"""
    agent_id: str
    name: str
    instructions: str
    tools: List[Dict[str, Any]]
    risk_parameters: Dict[str, Any]
    generated_code: Optional[str] = None
    status: str = Field(default="generated", description="Generation status")
