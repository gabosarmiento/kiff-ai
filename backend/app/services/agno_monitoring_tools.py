"""
AGNO-Native Monitoring Tools for kiff Platform
==============================================

Custom tools for user activity tracking and behavioral analysis using AGNO's native capabilities.
"""

from agno.tools import tool
from agno.storage.postgres import PostgresStorage
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json
import logging
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User

logger = logging.getLogger(__name__)

# AGNO Storage for activity tracking
try:
    from app.core.config import settings
    activity_storage = PostgresStorage(
        table_name="agno_user_activity",
        db_url=settings.DATABASE_URL
    )
    alert_storage = PostgresStorage(
        table_name="agno_admin_alerts", 
        db_url=settings.DATABASE_URL
    )
except Exception as e:
    logger.warning(f"AGNO storage initialization failed: {e}")
    activity_storage = None
    alert_storage = None

@tool
def log_user_activity(
    user_id: str, 
    action: str, 
    prompt: str = None, 
    app_name: str = None,
    error_message: str = None,
    duration_ms: int = None,
    metadata: dict = None
) -> str:
    """
    Log user activity for monitoring purposes.
    
    Args:
        user_id: ID of the user performing the action
        action: Type of action (prompt_submitted, app_build_requested, build_failed, etc.)
        prompt: User's prompt text (if applicable)
        app_name: Name of app being built (if applicable)
        error_message: Error details (if applicable)
        duration_ms: Time taken for the action
        metadata: Additional context data
    
    Returns:
        Confirmation message
    """
    if not activity_storage:
        return "Activity logging unavailable - storage not initialized"
    
    try:
        activity_log = {
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "prompt": prompt,
            "app_name": app_name,
            "error_message": error_message,
            "duration_ms": duration_ms,
            "metadata": metadata or {}
        }
        
        # Store in AGNO storage
        session_id = f"activity_{user_id}_{datetime.utcnow().timestamp()}"
        activity_storage.upsert(session_id=session_id, data=activity_log)
        
        logger.info(f"Activity logged: {action} for user {user_id}")
        return f"Activity logged: {action} for user {user_id}"
        
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")
        return f"Failed to log activity: {str(e)}"

@tool
def detect_user_patterns(user_id: str, lookback_hours: int = 2) -> str:
    """
    Analyze user patterns and detect issues like repeated failures or stuck behavior.
    
    Args:
        user_id: ID of the user to analyze
        lookback_hours: How many hours back to analyze
    
    Returns:
        Analysis results and any detected issues
    """
    if not activity_storage:
        return "Pattern detection unavailable - storage not initialized"
    
    try:
        # Get user's recent activities
        cutoff_time = datetime.utcnow() - timedelta(hours=lookback_hours)
        all_sessions = activity_storage.get_all_session_ids()
        user_activities = []
        
        for session_id in all_sessions:
            if f"activity_{user_id}" in session_id:
                try:
                    data = activity_storage.read(session_id)
                    if data and 'timestamp' in data:
                        activity_time = datetime.fromisoformat(data['timestamp'])
                        if activity_time >= cutoff_time:
                            user_activities.append(data)
                except Exception:
                    continue
        
        if not user_activities:
            return f"No recent activity found for user {user_id}"
        
        # Sort by timestamp
        user_activities.sort(key=lambda x: x['timestamp'])
        
        # Analyze patterns
        issues = []
        
        # Check for repeated prompts
        prompts = [act.get('prompt') for act in user_activities if act.get('prompt')]
        if len(prompts) >= 3:
            recent_prompts = prompts[-3:]
            if len(set(recent_prompts)) == 1:
                issues.append(f"REPEATED_PROMPTS: User repeating same prompt: '{recent_prompts[0][:100]}...'")
        
        # Check for build failures
        failures = [act for act in user_activities if act.get('action') == 'build_failed']
        if len(failures) >= 2:
            issues.append(f"MULTIPLE_FAILURES: User had {len(failures)} build failures")
        
        # Check for abandonment (prompts without completion)
        has_prompts = any(act.get('action') == 'prompt_submitted' for act in user_activities)
        has_completion = any(act.get('action') == 'app_generated' for act in user_activities)
        if has_prompts and not has_completion:
            issues.append("POTENTIAL_ABANDONMENT: User submitted prompts but no apps generated")
        
        # Check for long duration issues
        long_durations = [act for act in user_activities if act.get('duration_ms', 0) > 60000]  # > 1 minute
        if len(long_durations) >= 2:
            issues.append(f"PERFORMANCE_ISSUES: {len(long_durations)} actions took over 1 minute")
        
        if issues:
            return f"ISSUES_DETECTED for user {user_id}: " + "; ".join(issues)
        else:
            return f"User {user_id} behavior appears normal ({len(user_activities)} activities analyzed)"
            
    except Exception as e:
        logger.error(f"Pattern detection failed: {e}")
        return f"Pattern detection failed: {str(e)}"

@tool
def generate_platform_insights(timeframe_hours: int = 24) -> str:
    """
    Generate insights about user behavior patterns across the entire platform.
    
    Args:
        timeframe_hours: How many hours back to analyze
    
    Returns:
        Platform-wide insights and recommendations
    """
    if not activity_storage:
        return "Platform insights unavailable - storage not initialized"
    
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=timeframe_hours)
        all_sessions = activity_storage.get_all_session_ids()
        
        platform_activities = []
        user_stats = {}
        
        for session_id in all_sessions:
            try:
                data = activity_storage.read(session_id)
                if data and 'timestamp' in data:
                    activity_time = datetime.fromisoformat(data['timestamp'])
                    if activity_time >= cutoff_time:
                        platform_activities.append(data)
                        
                        user_id = data.get('user_id')
                        if user_id not in user_stats:
                            user_stats[user_id] = {
                                'total_actions': 0,
                                'prompts': 0,
                                'failures': 0,
                                'completions': 0
                            }
                        
                        user_stats[user_id]['total_actions'] += 1
                        if data.get('action') == 'prompt_submitted':
                            user_stats[user_id]['prompts'] += 1
                        elif data.get('action') == 'build_failed':
                            user_stats[user_id]['failures'] += 1
                        elif data.get('action') == 'app_generated':
                            user_stats[user_id]['completions'] += 1
            except Exception:
                continue
        
        if not platform_activities:
            return f"No platform activity found in the last {timeframe_hours} hours"
        
        # Generate insights
        insights = []
        
        # Overall stats
        total_users = len(user_stats)
        total_activities = len(platform_activities)
        insights.append(f"Platform activity: {total_activities} actions by {total_users} users")
        
        # Users needing attention
        struggling_users = []
        for user_id, stats in user_stats.items():
            if stats['failures'] >= 2 and stats['completions'] == 0:
                struggling_users.append(user_id)
        
        if struggling_users:
            insights.append(f"ATTENTION_NEEDED: {len(struggling_users)} users with multiple failures and no completions")
        
        # Success rate
        total_prompts = sum(stats['prompts'] for stats in user_stats.values())
        total_completions = sum(stats['completions'] for stats in user_stats.values())
        if total_prompts > 0:
            success_rate = (total_completions / total_prompts) * 100
            insights.append(f"Platform success rate: {success_rate:.1f}% ({total_completions}/{total_prompts})")
        
        return "PLATFORM_INSIGHTS: " + "; ".join(insights)
        
    except Exception as e:
        logger.error(f"Platform insights generation failed: {e}")
        return f"Platform insights generation failed: {str(e)}"

@tool
def send_admin_alert(
    user_id: str, 
    issue_type: str, 
    description: str, 
    suggested_action: str,
    priority: str = "medium"
) -> str:
    """
    Send alert to admin dashboard about user issues.
    
    Args:
        user_id: ID of the user with issues
        issue_type: Type of issue (repeated_failures, prompt_confusion, etc.)
        description: Detailed description of the issue
        suggested_action: Recommended action for admin
        priority: Alert priority (low, medium, high, critical)
    
    Returns:
        Confirmation message
    """
    if not alert_storage:
        return "Alert system unavailable - storage not initialized"
    
    try:
        alert = {
            "user_id": user_id,
            "issue_type": issue_type,
            "description": description,
            "suggested_action": suggested_action,
            "priority": priority,
            "timestamp": datetime.utcnow().isoformat(),
            "resolved": False
        }
        
        # Store alert in AGNO storage
        alert_id = f"alert_{user_id}_{datetime.utcnow().timestamp()}"
        alert_storage.upsert(session_id=alert_id, data=alert)
        
        logger.info(f"Admin alert sent: {issue_type} for user {user_id}")
        return f"Admin alert sent: {issue_type} for user {user_id} (Priority: {priority})"
        
    except Exception as e:
        logger.error(f"Failed to send admin alert: {e}")
        return f"Failed to send admin alert: {str(e)}"

@tool
def get_admin_alerts(hours_back: int = 24, resolved: bool = False) -> str:
    """
    Retrieve admin alerts for the dashboard.
    
    Args:
        hours_back: How many hours back to retrieve alerts
        resolved: Whether to include resolved alerts
    
    Returns:
        JSON string of alerts for admin dashboard
    """
    if not alert_storage:
        return "Alert retrieval unavailable - storage not initialized"
    
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)
        all_sessions = alert_storage.get_all_session_ids()
        
        alerts = []
        for session_id in all_sessions:
            try:
                data = alert_storage.read(session_id)
                if data and 'timestamp' in data:
                    alert_time = datetime.fromisoformat(data['timestamp'])
                    if alert_time >= cutoff_time:
                        if resolved or not data.get('resolved', False):
                            alerts.append(data)
            except Exception:
                continue
        
        # Sort by timestamp (newest first)
        alerts.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return json.dumps(alerts, indent=2)
        
    except Exception as e:
        logger.error(f"Failed to retrieve admin alerts: {e}")
        return f"Failed to retrieve admin alerts: {str(e)}"

@tool
def resolve_admin_alert(alert_user_id: str, alert_timestamp: str) -> str:
    """
    Mark an admin alert as resolved.
    
    Args:
        alert_user_id: User ID from the alert
        alert_timestamp: Timestamp of the alert to resolve
    
    Returns:
        Confirmation message
    """
    if not alert_storage:
        return "Alert resolution unavailable - storage not initialized"
    
    try:
        all_sessions = alert_storage.get_all_session_ids()
        
        for session_id in all_sessions:
            try:
                data = alert_storage.read(session_id)
                if (data and 
                    data.get('user_id') == alert_user_id and 
                    data.get('timestamp') == alert_timestamp):
                    
                    # Mark as resolved
                    data['resolved'] = True
                    data['resolved_at'] = datetime.utcnow().isoformat()
                    alert_storage.upsert(session_id=session_id, data=data)
                    
                    return f"Alert resolved for user {alert_user_id}"
            except Exception:
                continue
        
        return f"Alert not found for user {alert_user_id} at {alert_timestamp}"
        
    except Exception as e:
        logger.error(f"Failed to resolve alert: {e}")
        return f"Failed to resolve alert: {str(e)}"
