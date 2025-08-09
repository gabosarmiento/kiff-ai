from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import uuid
from datetime import datetime

from app.models.models import Agent
from app.schemas.agent import AgentCreate, AgentUpdate
import logging

logger = logging.getLogger(__name__)

class AgentService:
    """Service for managing trading agents"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_agent(self, agent_data: AgentCreate) -> Agent:
        """Create a new trading agent"""
        try:
            agent = Agent(
                id=str(uuid.uuid4()),
                name=agent_data.name,
                description=agent_data.description,
                strategy=agent_data.strategy,
                code=agent_data.code,
                status=agent_data.status,
                config=agent_data.config,
                created_at=datetime.utcnow()
            )
            
            self.db.add(agent)
            await self.db.commit()
            await self.db.refresh(agent)
            
            logger.info(f"Created agent: {agent.id} - {agent.name}")
            return agent
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating agent: {e}")
            raise
    
    async def get_agent(self, agent_id: str) -> Optional[Agent]:
        """Get agent by ID"""
        try:
            result = await self.db.execute(select(Agent).where(Agent.id == agent_id))
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching agent {agent_id}: {e}")
            raise
    
    async def get_all_agents(self) -> List[Agent]:
        """Get all agents"""
        try:
            result = await self.db.execute(select(Agent))
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching agents: {e}")
            raise
    
    async def update_agent(self, agent_id: str, agent_data: AgentUpdate) -> Optional[Agent]:
        """Update an existing agent"""
        try:
            result = await self.db.execute(select(Agent).where(Agent.id == agent_id))
            agent = result.scalar_one_or_none()
            
            if not agent:
                return None
            
            # Update fields
            update_data = agent_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(agent, field, value)
            
            agent.updated_at = datetime.utcnow()
            
            await self.db.commit()
            await self.db.refresh(agent)
            
            logger.info(f"Updated agent: {agent.id} - {agent.name}")
            return agent
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating agent {agent_id}: {e}")
            raise
    
    async def delete_agent(self, agent_id: str) -> bool:
        """Delete an agent"""
        try:
            result = await self.db.execute(select(Agent).where(Agent.id == agent_id))
            agent = result.scalar_one_or_none()
            
            if not agent:
                return False
            
            await self.db.delete(agent)
            await self.db.commit()
            
            logger.info(f"Deleted agent: {agent_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting agent {agent_id}: {e}")
            raise
    
    async def deploy_agent(self, agent_id: str) -> bool:
        """Deploy an agent (mock implementation)"""
        try:
            result = await self.db.execute(select(Agent).where(Agent.id == agent_id))
            agent = result.scalar_one_or_none()
            
            if not agent:
                return False
            
            # Mock deployment logic
            agent.status = "deployed"
            agent.updated_at = datetime.utcnow()
            
            await self.db.commit()
            
            logger.info(f"Deployed agent: {agent_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deploying agent {agent_id}: {e}")
            raise
    
    async def stop_agent(self, agent_id: str) -> bool:
        """Stop a deployed agent"""
        try:
            result = await self.db.execute(select(Agent).where(Agent.id == agent_id))
            agent = result.scalar_one_or_none()
            
            if not agent:
                return False
            
            agent.status = "stopped"
            agent.updated_at = datetime.utcnow()
            
            await self.db.commit()
            
            logger.info(f"Stopped agent: {agent_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error stopping agent {agent_id}: {e}")
            raise
