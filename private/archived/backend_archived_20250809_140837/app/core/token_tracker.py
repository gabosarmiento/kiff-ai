"""
Real-time Token Tracking System for AGNO + Groq
===============================================

Provides live token consumption tracking with real-time updates,
using AGNO's native metrics for accurate token counting.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.models import User

logger = logging.getLogger(__name__)

@dataclass
class TokenUsage:
    """Real-time token usage tracking"""
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cached_tokens: int = 0
    reasoning_tokens: int = 0
    audio_tokens: int = 0
    cache_write_tokens: int = 0
    cache_read_tokens: int = 0
    
    def add_run_metrics(self, metrics: Dict[str, Any]) -> None:
        """Add metrics from AGNO run_response.metrics"""
        # AGNO metrics can be lists or single values
        def sum_metric(key: str) -> int:
            value = metrics.get(key, 0)
            if isinstance(value, list):
                return sum(v for v in value if isinstance(v, (int, float)))
            return int(value) if isinstance(value, (int, float)) else 0
        
        self.input_tokens += sum_metric('input_tokens')
        self.output_tokens += sum_metric('output_tokens')
        self.total_tokens += sum_metric('total_tokens')
        self.cached_tokens += sum_metric('cached_tokens')
        self.reasoning_tokens += sum_metric('reasoning_tokens')
        self.audio_tokens += sum_metric('audio_tokens')
        self.cache_write_tokens += sum_metric('cache_write_tokens')
        self.cache_read_tokens += sum_metric('cache_read_tokens')
    
    def format_display(self) -> str:
        """Format for UI display like '1.5K tokens'"""
        total = self.total_tokens
        if total >= 1_000_000:
            return f"{total / 1_000_000:.1f}M tokens"
        elif total >= 1_000:
            return f"{total / 1_000:.1f}K tokens"
        else:
            return f"{total} tokens"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            'input_tokens': self.input_tokens,
            'output_tokens': self.output_tokens,
            'total_tokens': self.total_tokens,
            'cached_tokens': self.cached_tokens,
            'reasoning_tokens': self.reasoning_tokens,
            'audio_tokens': self.audio_tokens,
            'cache_write_tokens': self.cache_write_tokens,
            'cache_read_tokens': self.cache_read_tokens,
            'display': self.format_display()
        }

class TokenTracker:
    """Real-time token usage tracker for AGNO agents"""
    
    def __init__(self, tenant_id: str, user_id: str, session_id: str):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.session_id = session_id
        self.usage = TokenUsage()
        self.callbacks: List[Callable[[TokenUsage], None]] = []
        self.is_active = True
        
    def add_callback(self, callback: Callable[[TokenUsage], None]) -> None:
        """Add callback for real-time updates"""
        self.callbacks.append(callback)
    
    def remove_callback(self, callback: Callable[[TokenUsage], None]) -> None:
        """Remove callback"""
        if callback in self.callbacks:
            self.callbacks.remove(callback)
    
    def track_agno_run(self, agent) -> None:
        """Track tokens from completed AGNO agent run"""
        if not self.is_active:
            return
            
        try:
            # Extract metrics from AGNO agent's run_response
            if hasattr(agent, 'run_response') and agent.run_response and hasattr(agent.run_response, 'metrics'):
                self.usage.add_run_metrics(agent.run_response.metrics)
                self._notify_callbacks()
                
            # Also track session-level metrics for cumulative tracking
            if hasattr(agent, 'session_metrics') and agent.session_metrics:
                logger.debug(f"Session metrics available: {agent.session_metrics}")
                
        except Exception as e:
            logger.error(f"Error tracking AGNO run: {e}")
    
    def track_groq_usage(self, response_data: Dict[str, Any]) -> None:
        """Track tokens from direct Groq API response"""
        if not self.is_active:
            return
            
        try:
            # Extract usage from Groq response format
            usage = response_data.get('usage', {})
            if usage:
                self.usage.input_tokens += usage.get('prompt_tokens', 0)
                self.usage.output_tokens += usage.get('completion_tokens', 0) 
                self.usage.total_tokens += usage.get('total_tokens', 0)
                self._notify_callbacks()
                
        except Exception as e:
            logger.error(f"Error tracking Groq usage: {e}")
    
    def _notify_callbacks(self) -> None:
        """Notify all callbacks of usage update"""
        # Update tenant-level usage
        self._update_tenant_usage()
        
        for callback in self.callbacks:
            try:
                callback(self.usage)
            except Exception as e:
                logger.error(f"Error in token tracker callback: {e}")
    
    def _update_tenant_usage(self) -> None:
        """Update tenant-level aggregated usage"""
        # Force update of global tenant aggregate
        _update_tenant_aggregate(self.tenant_id)
    
    def get_current_usage(self) -> TokenUsage:
        """Get current usage snapshot"""
        return self.usage
    
    def reset(self) -> None:
        """Reset token counters"""
        self.usage = TokenUsage()
        self._notify_callbacks()
    
    async def persist_to_database(
        self, 
        operation_type: str = 'generation',
        operation_id: Optional[str] = None,
        model_name: Optional[str] = None,
        provider: str = 'groq',
        extra_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Persist current token usage to database for billing tracking"""
        try:
            from app.services.billing_token_service import BillingTokenService
            from app.core.database import get_async_db
            
            async for db in get_async_db():
                await BillingTokenService.record_token_consumption(
                    db=db,
                    tenant_id=self.tenant_id,
                    user_id=self.user_id,
                    session_id=self.session_id,
                    token_usage=self.usage,
                    operation_type=operation_type,
                    operation_id=operation_id,
                    model_name=model_name,
                    provider=provider,
                    extra_data=extra_data
                )
                break  # Only need first iteration
                
        except Exception as e:
            logger.error(f"Failed to persist token usage to database: {e}")
    
    def stop(self) -> None:
        """Stop tracking"""
        self.is_active = False
        self.callbacks.clear()

# Global session-based tracker registry
_active_trackers: Dict[str, TokenTracker] = {}

# Global tenant-level token aggregation
_tenant_usage: Dict[str, TokenUsage] = {}

def get_token_tracker(tenant_id: str, user_id: str, session_id: str) -> TokenTracker:
    """Get or create token tracker for session"""
    tracker_key = f"{tenant_id}:{user_id}:{session_id}"
    
    if tracker_key not in _active_trackers:
        _active_trackers[tracker_key] = TokenTracker(tenant_id, user_id, session_id)
        
    return _active_trackers[tracker_key]

def get_tenant_usage(tenant_id: str) -> TokenUsage:
    """Get aggregated token usage for a tenant"""
    if tenant_id in _tenant_usage:
        return _tenant_usage[tenant_id]
    return TokenUsage()

def cleanup_tracker(tenant_id: str, user_id: str, session_id: str) -> None:
    """Clean up tracker when session ends"""
    tracker_key = f"{tenant_id}:{user_id}:{session_id}"
    
    if tracker_key in _active_trackers:
        _active_trackers[tracker_key].stop()
        del _active_trackers[tracker_key]
        
    # Update tenant usage after cleanup
    _update_tenant_aggregate(tenant_id)

def _update_tenant_aggregate(tenant_id: str) -> None:
    """Update tenant-level aggregated usage after changes"""
    tenant_total = TokenUsage()
    for tracker_key, tracker in _active_trackers.items():
        if tracker.tenant_id == tenant_id and tracker.is_active:
            tenant_total.input_tokens += tracker.usage.input_tokens
            tenant_total.output_tokens += tracker.usage.output_tokens
            tenant_total.total_tokens += tracker.usage.total_tokens
            tenant_total.cached_tokens += tracker.usage.cached_tokens
            tenant_total.reasoning_tokens += tracker.usage.reasoning_tokens
            tenant_total.audio_tokens += tracker.usage.audio_tokens
            tenant_total.cache_write_tokens += tracker.usage.cache_write_tokens
            tenant_total.cache_read_tokens += tracker.usage.cache_read_tokens
    
    _tenant_usage[tenant_id] = tenant_total

def create_agno_agent_wrapper(agent_class):
    """Decorator to wrap AGNO agents with token tracking"""
    
    class TrackedAgent(agent_class):
        def __init__(self, *args, token_tracker: Optional[TokenTracker] = None, **kwargs):
            super().__init__(*args, **kwargs)
            self.token_tracker = token_tracker
        
        def run(self, *args, **kwargs):
            # Execute the original run method
            result = super().run(*args, **kwargs)
            
            # Track tokens after run completes
            if self.token_tracker:
                self.token_tracker.track_agno_run(self)
                
            return result
        
        async def arun(self, *args, **kwargs):
            # Execute the original async run method
            result = await super().arun(*args, **kwargs)
            
            # Track tokens after run completes
            if self.token_tracker:
                self.token_tracker.track_agno_run(self)
                
            return result
    
    return TrackedAgent