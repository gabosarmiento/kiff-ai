"""
AGNO-Native Monitoring Service
==============================

Background service using AGNO's native monitoring capabilities and custom tools.
Leverages AGNO storage, tools, and built-in monitoring features.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import json

from agno.agent import Agent
from agno.models.groq import Groq
from agno.storage.postgres import PostgresStorage
from app.services.agno_monitoring_tools import (
    log_user_activity,
    detect_user_patterns,
    generate_platform_insights,
    send_admin_alert,
    get_admin_alerts,
    resolve_admin_alert
)
from app.core.config import settings

logger = logging.getLogger(__name__)

# Enable AGNO monitoring globally
os.environ["AGNO_MONITOR"] = "true"

class AgenticMonitoringService:
    """AGNO-native service for monitoring user activity and generating insights"""
    
    def __init__(self):
        self.monitoring_agent = self._create_monitoring_agent()
        self.analysis_window_hours = 2  # Analyze last 2 hours by default
        
        # Initialize AGNO storage
        try:
            self.storage = PostgresStorage(
                table_name="agno_monitoring_sessions",
                db_url=settings.DATABASE_URL
            )
        except Exception as e:
            logger.warning(f"AGNO storage initialization failed: {e}")
            self.storage = None
        
    def _create_monitoring_agent(self) -> Agent:
        """Create the monitoring agent with AGNO tools"""
        return Agent(
            name="kiff Platform Monitor",
            model=Groq(id="llama-3.3-70b-versatile"),
            tools=[
                log_user_activity,
                detect_user_patterns,
                generate_platform_insights,
                send_admin_alert,
                get_admin_alerts,
                resolve_admin_alert
            ],
            instructions="""
You are a platform monitoring agent. Use your tools to track user behavior and generate actionable insights.

Your responsibilities:
1. **Track Activities**: Use log_user_activity() to record user interactions
2. **Detect Patterns**: Use detect_user_patterns() to identify struggling users
3. **Generate Insights**: Use generate_platform_insights() for platform-wide analysis
4. **Send Alerts**: Use send_admin_alert() when users need immediate attention
5. **Manage Alerts**: Use get_admin_alerts() and resolve_admin_alert() for dashboard

FOCUS ON:
- Users with repeated prompt failures (3+ similar attempts)
- Build failures and error patterns
- Users who abandon app creation
- Performance issues (slow builds)
- Platform-wide trends and opportunities

When you detect issues, always:
1. Analyze the specific user pattern
2. Determine severity and impact
3. Provide clear, actionable recommendations
4. Send appropriate alerts to admins

Be proactive in identifying users who need help before they abandon the platform.
""",
            storage=self.storage,
            monitoring=True,  # Enable AGNO monitoring
            add_history_to_messages=True,
            show_tool_calls=True,
            markdown=True
        )
    
    async def run_monitoring_cycle(self) -> Dict[str, Any]:
        """Run a complete AGNO-native monitoring cycle"""
        cycle_id = f"cycle_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            logger.info(f"Starting AGNO monitoring cycle: {cycle_id}")
            
            # Use AGNO agent to run platform analysis
            analysis_prompt = f"""
Run a comprehensive platform monitoring analysis for the last {self.analysis_window_hours} hours.

1. First, use generate_platform_insights() to get overall platform health
2. Then, for any concerning patterns, use detect_user_patterns() on specific users
3. Send admin alerts using send_admin_alert() for users who need immediate attention
4. Provide a summary of your findings and actions taken

Focus on identifying users who are struggling and need help.
"""
            
            # Run the monitoring agent
            response = await self.monitoring_agent.arun(analysis_prompt)
            
            # Store the monitoring session in AGNO storage
            if self.storage:
                session_data = {
                    "cycle_id": cycle_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "analysis_window_hours": self.analysis_window_hours,
                    "agent_response": response.content,
                    "tool_calls": len(response.messages) if hasattr(response, 'messages') else 0
                }
                self.storage.upsert(session_id=cycle_id, data=session_data)
            
            logger.info(f"AGNO monitoring cycle completed: {cycle_id}")
            return {
                "status": "completed",
                "cycle_id": cycle_id,
                "agent_response": response.content,
                "analysis_window_hours": self.analysis_window_hours
            }
            
        except Exception as e:
            logger.error(f"AGNO monitoring cycle failed: {e}")
            return {
                "status": "failed",
                "cycle_id": cycle_id,
                "error": str(e)
            }
    
    async def track_user_activity(
        self, 
        user_id: str, 
        action: str, 
        **kwargs
    ) -> Dict[str, Any]:
        """Track user activity using AGNO tools"""
        try:
            prompt = f"Log activity for user {user_id}: {action}"
            if kwargs.get('prompt'):
                prompt += f" with prompt: '{kwargs['prompt'][:100]}...'"
            if kwargs.get('error_message'):
                prompt += f" (error: {kwargs['error_message'][:100]}...)"
            
            # Use the monitoring agent to log activity
            response = await self.monitoring_agent.arun(
                f"Use log_user_activity to track: {prompt}"
            )
            
            return {
                "status": "success",
                "message": response.content
            }
            
        except Exception as e:
            logger.error(f"Failed to track user activity: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    async def analyze_user_patterns(self, user_id: str) -> Dict[str, Any]:
        """Analyze patterns for a specific user using AGNO tools"""
        try:
            # Use the monitoring agent to analyze user patterns
            response = await self.monitoring_agent.arun(
                f"Use detect_user_patterns to analyze user {user_id} and send alerts if needed"
            )
            
            return {
                "status": "success",
                "analysis": response.content
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze user patterns: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    async def get_admin_alerts(self, hours_back: int = 24) -> Dict[str, Any]:
        """Get admin alerts using AGNO tools"""
        try:
            # Use the monitoring agent to get alerts
            response = await self.monitoring_agent.arun(
                f"Use get_admin_alerts to retrieve alerts from the last {hours_back} hours"
            )
            
            return {
                "status": "success",
                "alerts": response.content
            }
            
        except Exception as e:
            logger.error(f"Failed to get admin alerts: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    async def resolve_alert(self, user_id: str, timestamp: str) -> Dict[str, Any]:
        """Resolve an admin alert using AGNO tools"""
        try:
            # Use the monitoring agent to resolve alert
            response = await self.monitoring_agent.arun(
                f"Use resolve_admin_alert to mark alert as resolved for user {user_id} at {timestamp}"
            )
            
            return {
                "status": "success",
                "message": response.content
            }
            
        except Exception as e:
            logger.error(f"Failed to resolve alert: {e}")
            return {
                "status": "error",
                "message": str(e)
            }

# Background task runner
async def start_monitoring_loop():
    """Start the AGNO-native background monitoring loop"""
    monitoring_service = AgenticMonitoringService()
    
    while True:
        try:
            logger.info("Starting AGNO monitoring cycle...")
            result = await monitoring_service.run_monitoring_cycle()
            logger.info(f"AGNO monitoring cycle result: {result['status']}")
            
        except Exception as e:
            logger.error(f"AGNO monitoring cycle error: {e}")
        
        # Wait 10 minutes before next cycle
        await asyncio.sleep(600)  # 10 minutes

# AGNO-native event tracking helper functions
async def track_user_event(
    user_id: str,
    action: str,
    prompt: str = None,
    app_name: str = None,
    error_message: str = None,
    duration_ms: int = None,
    **kwargs
) -> Dict[str, Any]:
    """Track a user activity event using AGNO tools"""
    try:
        monitoring_service = AgenticMonitoringService()
        result = await monitoring_service.track_user_activity(
            user_id=user_id,
            action=action,
            prompt=prompt,
            app_name=app_name,
            error_message=error_message,
            duration_ms=duration_ms,
            metadata=kwargs
        )
        return result
    except Exception as e:
        logger.error(f"Failed to track user event: {e}")
        return {"status": "error", "message": str(e)}

async def analyze_user_behavior(user_id: str) -> Dict[str, Any]:
    """Analyze user behavior patterns using AGNO tools"""
    try:
        monitoring_service = AgenticMonitoringService()
        result = await monitoring_service.analyze_user_patterns(user_id)
        return result
    except Exception as e:
        logger.error(f"Failed to analyze user behavior: {e}")
        return {"status": "error", "message": str(e)}
