"""
Demo Token Tracking Module
==========================

Simplified token consumption tracking for demo purposes.
Focus on transparency and per-tenant visibility without payment complexity.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
import json

from app.core.langtrace_config import (
    trace_agno_agent, log_agent_interaction, is_langtrace_enabled,
    add_trace_metadata
)

logger = logging.getLogger(__name__)

@dataclass
class TokenUsage:
    """Simple token usage record for demo transparency"""
    tenant_id: str
    user_id: str
    agent_name: str
    operation: str
    timestamp: datetime
    input_tokens: int
    output_tokens: int
    total_tokens: int
    model_used: str
    success: bool
    session_id: Optional[str] = None

@dataclass
class TenantUsageSummary:
    """Per-tenant usage summary for demo dashboard"""
    tenant_id: str
    total_tokens_used: int
    total_operations: int
    successful_operations: int
    agents_used: List[str]
    most_used_agent: str
    first_usage: datetime
    last_usage: datetime
    daily_average: float

class DemoTokenTracker:
    """
    Simple token tracker for demo purposes - focuses on transparency
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # In-memory storage for demo (replace with database in production)
        self.usage_records: List[TokenUsage] = []
        self.tenant_summaries: Dict[str, TenantUsageSummary] = {}
        
        self.logger.info("📊 Demo Token Tracker initialized - focusing on transparency")
    
    async def track_usage(
        self,
        tenant_id: str,
        user_id: str,
        agent_name: str,
        operation: str,
        input_tokens: int,
        output_tokens: int,
        model_used: str,
        success: bool = True,
        session_id: Optional[str] = None
    ) -> TokenUsage:
        """Track token usage for transparency"""
        
        usage = TokenUsage(
            tenant_id=tenant_id,
            user_id=user_id,
            agent_name=agent_name,
            operation=operation,
            timestamp=datetime.now(timezone.utc),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            model_used=model_used,
            success=success,
            session_id=session_id
        )
        
        # Store usage record
        self.usage_records.append(usage)
        
        # Update tenant summary
        await self._update_tenant_summary(usage)
        
        # Add to LangTrace for observability
        if is_langtrace_enabled():
            add_trace_metadata({
                "demo_tenant_id": tenant_id,
                "demo_total_tokens": usage.total_tokens,
                "demo_agent": agent_name,
                "demo_operation": operation,
                "demo_model": model_used
            })
        
        # Log for transparency
        self.logger.info(
            f"🔍 Token Usage: {agent_name} | Tenant: {tenant_id} | "
            f"Tokens: {usage.total_tokens} ({input_tokens} in, {output_tokens} out) | "
            f"Model: {model_used} | Success: {success}"
        )
        
        return usage
    
    async def _update_tenant_summary(self, usage: TokenUsage):
        """Update tenant summary for dashboard"""
        tenant_id = usage.tenant_id
        
        if tenant_id not in self.tenant_summaries:
            self.tenant_summaries[tenant_id] = TenantUsageSummary(
                tenant_id=tenant_id,
                total_tokens_used=0,
                total_operations=0,
                successful_operations=0,
                agents_used=[],
                most_used_agent="",
                first_usage=usage.timestamp,
                last_usage=usage.timestamp,
                daily_average=0.0
            )
        
        summary = self.tenant_summaries[tenant_id]
        summary.total_tokens_used += usage.total_tokens
        summary.total_operations += 1
        
        if usage.success:
            summary.successful_operations += 1
        
        if usage.agent_name not in summary.agents_used:
            summary.agents_used.append(usage.agent_name)
        
        summary.last_usage = usage.timestamp
        
        # Calculate daily average
        days_active = max(1, (summary.last_usage - summary.first_usage).days)
        summary.daily_average = summary.total_tokens_used / days_active
        
        # Find most used agent
        agent_usage = {}
        for record in self.usage_records:
            if record.tenant_id == tenant_id:
                if record.agent_name not in agent_usage:
                    agent_usage[record.agent_name] = 0
                agent_usage[record.agent_name] += record.total_tokens
        
        if agent_usage:
            summary.most_used_agent = max(agent_usage, key=agent_usage.get)
    
    def get_tenant_dashboard(self, tenant_id: str) -> Dict[str, Any]:
        """Get tenant dashboard data for demo transparency"""
        if tenant_id not in self.tenant_summaries:
            return {
                "tenant_id": tenant_id,
                "message": "No usage data yet",
                "total_tokens": 0,
                "total_operations": 0,
                "agents_used": [],
                "recent_activity": []
            }
        
        summary = self.tenant_summaries[tenant_id]
        
        # Get recent activity (last 10 operations)
        recent_activity = [
            {
                "timestamp": record.timestamp.isoformat(),
                "agent": record.agent_name,
                "operation": record.operation,
                "tokens": record.total_tokens,
                "model": record.model_used,
                "success": record.success
            }
            for record in sorted(
                [r for r in self.usage_records if r.tenant_id == tenant_id],
                key=lambda x: x.timestamp,
                reverse=True
            )[:10]
        ]
        
        return {
            "tenant_id": tenant_id,
            "summary": {
                "total_tokens_used": summary.total_tokens_used,
                "total_operations": summary.total_operations,
                "successful_operations": summary.successful_operations,
                "success_rate": (summary.successful_operations / summary.total_operations * 100) if summary.total_operations > 0 else 0,
                "agents_used": summary.agents_used,
                "most_used_agent": summary.most_used_agent,
                "daily_average_tokens": round(summary.daily_average, 2),
                "first_usage": summary.first_usage.isoformat(),
                "last_usage": summary.last_usage.isoformat()
            },
            "recent_activity": recent_activity
        }
    
    def get_all_tenants_overview(self) -> List[Dict[str, Any]]:
        """Get overview of all tenants for admin dashboard"""
        return [
            {
                "tenant_id": tenant_id,
                "total_tokens": summary.total_tokens_used,
                "total_operations": summary.total_operations,
                "agents_count": len(summary.agents_used),
                "most_used_agent": summary.most_used_agent,
                "last_activity": summary.last_usage.isoformat(),
                "daily_average": round(summary.daily_average, 2)
            }
            for tenant_id, summary in self.tenant_summaries.items()
        ]
    
    def get_agent_breakdown(self, tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """Get breakdown by agent for transparency"""
        records = self.usage_records
        if tenant_id:
            records = [r for r in records if r.tenant_id == tenant_id]
        
        agent_stats = {}
        for record in records:
            if record.agent_name not in agent_stats:
                agent_stats[record.agent_name] = {
                    "total_tokens": 0,
                    "operations": 0,
                    "successful_operations": 0,
                    "models_used": set()
                }
            
            stats = agent_stats[record.agent_name]
            stats["total_tokens"] += record.total_tokens
            stats["operations"] += 1
            if record.success:
                stats["successful_operations"] += 1
            stats["models_used"].add(record.model_used)
        
        # Convert sets to lists for JSON serialization
        for agent, stats in agent_stats.items():
            stats["models_used"] = list(stats["models_used"])
            stats["success_rate"] = (stats["successful_operations"] / stats["operations"] * 100) if stats["operations"] > 0 else 0
        
        return agent_stats

# Global demo tracker instance
_demo_tracker: Optional[DemoTokenTracker] = None

def get_demo_tracker() -> DemoTokenTracker:
    """Get the global demo token tracker instance"""
    global _demo_tracker
    if _demo_tracker is None:
        _demo_tracker = DemoTokenTracker()
    return _demo_tracker

def demo_track_agent(agent_name: str, operation: str):
    """
    Simple decorator for demo token tracking
    
    Usage:
        @demo_track_agent("GroqLLMService", "generate_application")
        async def my_method(self, tenant_id: str, user_id: str, ...):
            # Your code here
            return result_with_tokens_used
    """
    def decorator(func):
        # Apply LangTrace decorator
        traced_func = trace_agno_agent(f"demo_{agent_name}_{operation}")(func)
        
        async def wrapper(*args, **kwargs):
            # Extract tenant and user info
            tenant_id = kwargs.get('tenant_id') or (args[1] if len(args) > 1 else "demo_tenant")
            user_id = kwargs.get('user_id') or (args[2] if len(args) > 2 else "demo_user")
            
            try:
                # Execute function
                result = await traced_func(*args, **kwargs)
                
                # Extract token info from result
                tokens_used = 0
                model_used = "unknown"
                success = True
                
                if isinstance(result, dict):
                    tokens_used = result.get('tokens_used', 0)
                    model_used = result.get('model_used', 'unknown')
                    success = result.get('success', True)
                
                # Track for demo transparency
                if tokens_used > 0:
                    tracker = get_demo_tracker()
                    await tracker.track_usage(
                        tenant_id=tenant_id,
                        user_id=user_id,
                        agent_name=agent_name,
                        operation=operation,
                        input_tokens=tokens_used // 2,  # Estimate
                        output_tokens=tokens_used // 2,  # Estimate
                        model_used=model_used,
                        success=success
                    )
                
                return result
                
            except Exception as e:
                # Track failed operation
                tracker = get_demo_tracker()
                await tracker.track_usage(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    agent_name=agent_name,
                    operation=operation,
                    input_tokens=0,
                    output_tokens=0,
                    model_used="unknown",
                    success=False
                )
                raise
        
        return wrapper
    return decorator
