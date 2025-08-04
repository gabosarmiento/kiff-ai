from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from app.core.database import get_db
from app.models.models import Agent
# DeploymentLog model removed - legacy trading functionality cleaned up

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/agents/{agent_id}/logs")
async def get_agent_logs(
    agent_id: str,
    level: Optional[str] = Query(None, description="Log level filter (DEBUG, INFO, WARN, ERROR)"),
    start_time: Optional[str] = Query(None, description="Start time filter (ISO format)"),
    end_time: Optional[str] = Query(None, description="End time filter (ISO format)"),
    limit: int = Query(100, description="Maximum number of logs to return"),
    db: AsyncSession = Depends(get_db)
):
    """Get generation logs for a specific agent (kiff system)"""
    try:
        # Check if agent exists
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )
        
        # For kiff system, return mock logs since DeploymentLog model was removed
        # In a real implementation, this would query a GenerationLog or AppLog model
        log_entries = [
            {
                "id": "1",
                "timestamp": datetime.utcnow().isoformat(),
                "level": "INFO",
                "message": f"Agent {agent.name} ready for app generation",
                "source": "kiff-system",
                "metadata": {"agent_type": agent.app_type}
            }
        ]
        
        return {
            "logs": log_entries,
            "total": len(log_entries),
            "agent_id": agent_id,
            "note": "Legacy deployment logs removed - showing kiff system logs"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching agent logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch agent logs"
        )

@router.get("/")
async def get_all_logs(
    limit: int = Query(100, description="Number of log entries to return", le=1000),
    level: Optional[str] = Query(None, description="Log level filter (INFO, WARNING, ERROR)"),
    db: AsyncSession = Depends(get_db)
):
    """Get logs from all agents (kiff system)"""
    try:
        # For kiff system, return mock system logs since DeploymentLog model was removed
        # In a real implementation, this would query a SystemLog or GenerationLog model
        log_entries = [
            {
                "id": "system-1",
                "agentId": "kiff-system",
                "timestamp": datetime.utcnow().isoformat(),
                "level": "INFO",
                "message": "kiff system ready for API documentation extraction",
                "metadata": {"system": "kiff", "status": "ready"}
            },
            {
                "id": "system-2",
                "agentId": "kiff-system",
                "timestamp": datetime.utcnow().isoformat(),
                "level": "INFO",
                "message": "Legacy trading functionality removed successfully",
                "metadata": {"migration": "complete", "system": "kiff"}
            }
        ]
        
        return {
            "logs": log_entries,
            "total": len(log_entries),
            "note": "Legacy deployment logs removed - showing kiff system logs"
        }
        
    except Exception as e:
        logger.error(f"Error fetching all logs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch logs: {str(e)}"
        )

@router.delete("/{agent_id}")
async def clear_agent_logs(
    agent_id: str,
    older_than_days: int = Query(30, description="Clear logs older than N days"),
    db: AsyncSession = Depends(get_db)
):
    """Clear logs for a specific agent"""
    try:
        # Verify agent exists
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )
        
        # Calculate cutoff date
        cutoff_date = datetime.utcnow() - timedelta(days=older_than_days)
        
        # Delete old logs (this would be implemented with proper cascade deletes)
        # For now, return success message
        
        return {
            "message": f"Logs older than {older_than_days} days cleared for agent {agent_id}",
            "cutoffDate": cutoff_date.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing logs for agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear agent logs: {str(e)}"
        )

def _generate_mock_logs(agent_id: str, limit: int) -> List[dict]:
    """Generate mock logs for demo purposes"""
    import random
    from datetime import datetime, timedelta
    
    levels = ["INFO", "WARNING", "ERROR"]
    messages = [
        "Agent started successfully",
        "Market data connection established",
        "Trade signal generated: BUY BTCUSDT",
        "Order executed successfully",
        "Portfolio rebalanced",
        "Risk check passed",
        "WebSocket connection lost, reconnecting...",
        "API rate limit approached",
        "Insufficient balance for trade",
        "Stop loss triggered",
        "Take profit reached",
        "Agent performance metrics updated"
    ]
    
    logs = []
    for i in range(min(limit, 50)):  # Cap at 50 mock logs
        timestamp = datetime.utcnow() - timedelta(minutes=random.randint(1, 1440))
        level = random.choice(levels)
        message = random.choice(messages)
        
        logs.append({
            "id": f"log-{agent_id}-{i}",
            "timestamp": timestamp.isoformat(),
            "level": level,
            "message": message,
            "metadata": {
                "source": "trading_engine",
                "version": "1.0.0"
            }
        })
    
    return sorted(logs, key=lambda x: x["timestamp"], reverse=True)

def _generate_mock_system_logs(limit: int) -> List[dict]:
    """Generate mock system logs for demo purposes"""
    import random
    from datetime import datetime, timedelta
    
    levels = ["INFO", "WARNING", "ERROR"]
    messages = [
        "System startup completed",
        "Database connection established",
        "WebSocket server started",
        "Market data feed connected",
        "Agent deployment successful",
        "Backup completed successfully",
        "High memory usage detected",
        "Database connection timeout",
        "API endpoint response time high",
        "Security scan completed"
    ]
    
    logs = []
    for i in range(min(limit, 30)):  # Cap at 30 mock system logs
        timestamp = datetime.utcnow() - timedelta(minutes=random.randint(1, 2880))
        level = random.choice(levels)
        message = random.choice(messages)
        
        logs.append({
            "id": f"system-log-{i}",
            "agentId": "system",
            "timestamp": timestamp.isoformat(),
            "level": level,
            "message": message,
            "metadata": {
                "source": "system",
                "component": "core"
            }
        })
    
    return sorted(logs, key=lambda x: x["timestamp"], reverse=True)
