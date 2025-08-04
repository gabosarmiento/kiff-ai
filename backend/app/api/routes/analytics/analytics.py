"""
Analytics API Routes
===================

API endpoints for agentic monitoring and user activity analytics.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging

from app.core.database import get_db
from app.core.auth import get_current_admin_user
from app.models.analytics_models import (
    UserActivityEvent, AgenticInsight, MonitoringAgentRun,
    UserBehaviorPattern, EventType, AlertSeverity
)
from app.models.admin_models import AdminUser
from app.services.agentic_monitoring_service import (
    AgenticMonitoringService, track_user_event
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================================
# ADMIN ANALYTICS DASHBOARD
# ============================================================================

@router.get("/insights", response_model=List[Dict[str, Any]])
async def get_agentic_insights(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    severity: Optional[AlertSeverity] = Query(None),
    resolved: Optional[bool] = Query(None),
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin_user)
):
    """Get agentic insights for admin dashboard"""
    
    since = datetime.utcnow() - timedelta(days=days)
    
    query = select(AgenticInsight).where(AgenticInsight.created_at >= since)
    
    if severity:
        query = query.where(AgenticInsight.severity == severity.value)
    
    if resolved is not None:
        query = query.where(AgenticInsight.is_resolved == resolved)
    
    query = query.order_by(desc(AgenticInsight.created_at)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    insights = result.scalars().all()
    
    return [
        {
            "id": insight.id,
            "issue_type": insight.issue_type,
            "severity": insight.severity,
            "title": insight.title,
            "description": insight.description,
            "suggested_action": insight.suggested_action,
            "user_id": insight.user_id,
            "confidence_score": insight.confidence_score,
            "is_resolved": insight.is_resolved,
            "created_at": insight.created_at,
            "events_analyzed": insight.events_analyzed
        } for insight in insights
    ]

@router.post("/insights/{insight_id}/resolve")
async def resolve_insight(
    insight_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin_user)
):
    """Mark an insight as resolved"""
    
    query = select(AgenticInsight).where(AgenticInsight.id == insight_id)
    result = await db.execute(query)
    insight = result.scalar_one_or_none()
    
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    
    insight.is_resolved = True
    insight.resolved_at = datetime.utcnow()
    insight.resolved_by = current_admin.id
    
    await db.commit()
    
    return {"message": "Insight marked as resolved"}

@router.get("/monitoring-runs", response_model=List[Dict[str, Any]])
async def get_monitoring_runs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin_user)
):
    """Get monitoring agent execution history"""
    
    query = select(MonitoringAgentRun).order_by(desc(MonitoringAgentRun.started_at)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    runs = result.scalars().all()
    
    return [
        {
            "id": run.id,
            "run_id": run.run_id,
            "status": run.status,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
            "events_processed": run.events_processed,
            "insights_generated": run.insights_generated,
            "execution_time_ms": run.execution_time_ms,
            "error_message": run.error_message
        } for run in runs
    ]

@router.post("/trigger-monitoring")
async def trigger_monitoring_cycle(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin_user)
):
    """Manually trigger a monitoring cycle"""
    
    async def run_monitoring():
        service = AgenticMonitoringService()
        await service.run_monitoring_cycle()
    
    background_tasks.add_task(run_monitoring)
    
    return {"message": "Monitoring cycle triggered"}

@router.get("/user-activity", response_model=List[Dict[str, Any]])
async def get_user_activity(
    user_id: Optional[int] = Query(None),
    event_type: Optional[EventType] = Query(None),
    hours: int = Query(24, ge=1, le=168),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin_user)
):
    """Get user activity events for analysis"""
    
    since = datetime.utcnow() - timedelta(hours=hours)
    
    query = select(UserActivityEvent).where(UserActivityEvent.timestamp >= since)
    
    if user_id:
        query = query.where(UserActivityEvent.user_id == user_id)
    
    if event_type:
        query = query.where(UserActivityEvent.event_type == event_type.value)
    
    query = query.order_by(desc(UserActivityEvent.timestamp)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    events = result.scalars().all()
    
    return [
        {
            "id": event.id,
            "event_id": event.event_id,
            "user_id": event.user_id,
            "event_type": event.event_type,
            "prompt_text": event.prompt_text,
            "app_name": event.app_name,
            "error_message": event.error_message,
            "duration_ms": event.duration_ms,
            "timestamp": event.timestamp,
            "event_metadata": event.event_metadata
        } for event in events
    ]

@router.get("/activity-summary", response_model=Dict[str, Any])
async def get_activity_summary(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin_user)
):
    """Get activity summary statistics"""
    
    since = datetime.utcnow() - timedelta(hours=hours)
    
    # Total events
    total_events_query = select(func.count(UserActivityEvent.id)).where(
        UserActivityEvent.timestamp >= since
    )
    total_events_result = await db.execute(total_events_query)
    total_events = total_events_result.scalar()
    
    # Active users
    active_users_query = select(func.count(func.distinct(UserActivityEvent.user_id))).where(
        UserActivityEvent.timestamp >= since
    )
    active_users_result = await db.execute(active_users_query)
    active_users = active_users_result.scalar()
    
    # Event type breakdown
    event_types_query = select(
        UserActivityEvent.event_type,
        func.count(UserActivityEvent.id).label('count')
    ).where(
        UserActivityEvent.timestamp >= since
    ).group_by(UserActivityEvent.event_type)
    
    event_types_result = await db.execute(event_types_query)
    event_types = {row.event_type: row.count for row in event_types_result}
    
    # Recent insights
    recent_insights_query = select(func.count(AgenticInsight.id)).where(
        and_(
            AgenticInsight.created_at >= since,
            AgenticInsight.is_resolved == False
        )
    )
    recent_insights_result = await db.execute(recent_insights_query)
    unresolved_insights = recent_insights_result.scalar()
    
    return {
        "period_hours": hours,
        "total_events": total_events,
        "active_users": active_users,
        "event_type_breakdown": event_types,
        "unresolved_insights": unresolved_insights,
        "generated_at": datetime.utcnow()
    }

# ============================================================================
# EVENT TRACKING ENDPOINTS (for frontend integration)
# ============================================================================

@router.post("/track-event")
async def track_event(
    event_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Track a user activity event (called by frontend)"""
    
    try:
        # Extract required fields
        user_id = event_data.get("user_id")
        tenant_id = event_data.get("tenant_id", "default")
        event_type = event_data.get("event_type")
        session_id = event_data.get("session_id", "unknown")
        
        if not all([user_id, event_type]):
            raise HTTPException(status_code=400, detail="Missing required fields: user_id, event_type")
        
        # Validate event type
        try:
            event_type_enum = EventType(event_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid event_type: {event_type}")
        
        # Track the event
        await track_user_event(
            user_id=user_id,
            tenant_id=tenant_id,
            event_type=event_type_enum,
            session_id=session_id,
            prompt_text=event_data.get("prompt_text"),
            app_name=event_data.get("app_name"),
            error_message=event_data.get("error_message"),
            duration_ms=event_data.get("duration_ms"),
            event_metadata=event_data.get("event_metadata"),
            user_agent=event_data.get("user_agent"),
            ip_address=event_data.get("ip_address")
        )
        
        return {"message": "Event tracked successfully"}
        
    except Exception as e:
        logger.error(f"Failed to track event: {e}")
        raise HTTPException(status_code=500, detail="Failed to track event")

# ============================================================================
# BEHAVIOR PATTERNS
# ============================================================================

@router.get("/behavior-patterns", response_model=List[Dict[str, Any]])
async def get_behavior_patterns(
    user_id: Optional[int] = Query(None),
    pattern_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin_user)
):
    """Get detected user behavior patterns"""
    
    query = select(UserBehaviorPattern)
    
    if user_id:
        query = query.where(UserBehaviorPattern.user_id == user_id)
    
    if pattern_type:
        query = query.where(UserBehaviorPattern.pattern_type == pattern_type)
    
    query = query.order_by(desc(UserBehaviorPattern.last_seen)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    patterns = result.scalars().all()
    
    return [
        {
            "id": pattern.id,
            "pattern_id": pattern.pattern_id,
            "user_id": pattern.user_id,
            "pattern_type": pattern.pattern_type,
            "pattern_name": pattern.pattern_name,
            "description": pattern.description,
            "frequency": pattern.frequency,
            "avg_duration_minutes": pattern.avg_duration_minutes,
            "success_rate": pattern.success_rate,
            "confidence_score": pattern.confidence_score,
            "first_detected": pattern.first_detected,
            "last_seen": pattern.last_seen
        } for pattern in patterns
    ]
