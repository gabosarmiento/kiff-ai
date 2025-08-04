"""
Real-Time Monitoring API Routes
System health, performance metrics, and tenant monitoring endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging
import asyncio
import json

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import User
from app.services.agentic_monitoring_service import (
    AgenticMonitoringService,
    track_user_event,
    analyze_user_behavior
)

from app.services.monitoring_service import monitoring_service
from app.core.admin_auth import get_current_admin_user, require_permission
from app.models.admin_models import AdminUser

router = APIRouter()

# WebSocket connection manager for real-time monitoring
class MonitoringWebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    
    async def broadcast_metrics(self, metrics: Dict[str, Any]):
        """Broadcast metrics to all connected clients"""
        if not self.active_connections:
            return
        
        message = json.dumps({
            "type": "metrics_update",
            "data": metrics,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Send to all connected clients
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.append(connection)
        
        # Remove disconnected clients
        for connection in disconnected:
            self.disconnect(connection)

# Global WebSocket manager
ws_manager = MonitoringWebSocketManager()

@router.get("/metrics/current")
async def get_current_metrics(
    admin_user: AdminUser = Depends(require_permission("monitoring_read"))
):
    """Get current system metrics"""
    try:
        metrics = await monitoring_service.collect_system_metrics()
        return {
            "status": "success",
            "data": metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to collect metrics: {str(e)}")

@router.get("/metrics/historical")
async def get_historical_metrics(
    hours: int = 24,
    admin_user: AdminUser = Depends(require_permission("monitoring_read"))
):
    """Get historical metrics for charts and analysis"""
    try:
        if hours > 168:  # Limit to 1 week
            hours = 168
        
        metrics = await monitoring_service.get_historical_metrics(hours=hours)
        return {
            "status": "success",
            "data": metrics,
            "period_hours": hours,
            "total_points": len(metrics)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get historical metrics: {str(e)}")

@router.get("/health/system")
async def get_system_health(
    admin_user: AdminUser = Depends(require_permission("monitoring_read"))
):
    """Get comprehensive system health status"""
    try:
        metrics = await monitoring_service.collect_system_metrics()
        
        # Calculate health score
        health_score = 100
        alerts = metrics.get("alerts", [])
        
        for alert in alerts:
            if alert["type"] == "critical":
                health_score -= 20
            elif alert["type"] == "warning":
                health_score -= 10
        
        health_status = "healthy"
        if health_score < 70:
            health_status = "critical"
        elif health_score < 85:
            health_status = "warning"
        
        return {
            "status": "success",
            "data": {
                "health_status": health_status,
                "health_score": max(0, health_score),
                "alerts": alerts,
                "system_metrics": {
                    "cpu_usage": metrics["system"]["cpu_usage"],
                    "memory_usage": metrics["system"]["memory"]["percentage"],
                    "disk_usage": metrics["system"]["disk"]["percentage"],
                    "database_connections": metrics["database"].get("active_connections", 0)
                },
                "last_updated": metrics["timestamp"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get system health: {str(e)}")

@router.get("/health/tenants")
async def get_tenant_health(
    admin_user: AdminUser = Depends(require_permission("monitoring_read"))
):
    """Get health status for all tenants"""
    try:
        health_summary = await monitoring_service.get_tenant_health_summary()
        return {
            "status": "success",
            "data": health_summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tenant health: {str(e)}")

@router.get("/alerts")
async def get_active_alerts(
    admin_user: AdminUser = Depends(require_permission("monitoring_read"))
):
    """Get all active system alerts"""
    try:
        metrics = await monitoring_service.collect_system_metrics()
        alerts = metrics.get("alerts", [])
        
        return {
            "status": "success",
            "data": {
                "total_alerts": len(alerts),
                "critical_alerts": len([a for a in alerts if a["type"] == "critical"]),
                "warning_alerts": len([a for a in alerts if a["type"] == "warning"]),
                "alerts": alerts
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get alerts: {str(e)}")

@router.get("/performance/database")
async def get_database_performance(
    admin_user: AdminUser = Depends(require_permission("monitoring_read"))
):
    """Get detailed database performance metrics"""
    try:
        metrics = await monitoring_service.collect_system_metrics()
        db_metrics = metrics.get("database", {})
        
        return {
            "status": "success",
            "data": db_metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get database performance: {str(e)}")

@router.get("/performance/tenants")
async def get_tenant_performance(
    admin_user: AdminUser = Depends(require_permission("monitoring_read"))
):
    """Get performance metrics for all tenants"""
    try:
        metrics = await monitoring_service.collect_system_metrics()
        tenant_metrics = metrics.get("tenants", {})
        
        return {
            "status": "success",
            "data": tenant_metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tenant performance: {str(e)}")

@router.post("/cleanup/metrics")
async def cleanup_old_metrics(
    days: int = 30,
    admin_user: AdminUser = Depends(require_permission("monitoring_admin"))
):
    """Clean up old metrics data"""
    try:
        if days < 7:
            raise HTTPException(status_code=400, detail="Cannot delete metrics newer than 7 days")
        
        deleted_count = await monitoring_service.cleanup_old_metrics(days=days)
        
        return {
            "status": "success",
            "message": f"Cleaned up {deleted_count} old metric records",
            "deleted_records": deleted_count,
            "retention_days": days
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cleanup metrics: {str(e)}")

@router.get("/dashboard/summary")
async def get_dashboard_summary(
    admin_user: AdminUser = Depends(require_permission("monitoring_read"))
):
    """Get comprehensive dashboard summary for admin interface"""
    try:
        # Collect all metrics
        current_metrics = await monitoring_service.collect_system_metrics()
        tenant_health = await monitoring_service.get_tenant_health_summary()
        
        # Calculate summary statistics
        system_health = "healthy"
        if current_metrics.get("alerts"):
            critical_alerts = [a for a in current_metrics["alerts"] if a["type"] == "critical"]
            if critical_alerts:
                system_health = "critical"
            else:
                system_health = "warning"
        
        # Resource utilization summary
        resources = {
            "cpu": current_metrics["system"]["cpu_usage"],
            "memory": current_metrics["system"]["memory"]["percentage"],
            "disk": current_metrics["system"]["disk"]["percentage"],
            "database_connections": current_metrics["database"].get("active_connections", 0)
        }
        
        # Tenant summary
        tenant_summary = {
            "total": tenant_health["total_tenants"],
            "healthy": tenant_health["healthy_tenants"],
            "warning": tenant_health["warning_tenants"],
            "error": tenant_health["error_tenants"]
        }
        
        return {
            "status": "success",
            "data": {
                "system_health": system_health,
                "resources": resources,
                "tenants": tenant_summary,
                "alerts": {
                    "total": len(current_metrics.get("alerts", [])),
                    "critical": len([a for a in current_metrics.get("alerts", []) if a["type"] == "critical"]),
                    "warning": len([a for a in current_metrics.get("alerts", []) if a["type"] == "warning"])
                },
                "last_updated": current_metrics["timestamp"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard summary: {str(e)}")

# WebSocket endpoint for real-time monitoring
@router.websocket("/ws/metrics")
async def websocket_metrics(websocket: WebSocket):
    """WebSocket endpoint for real-time metrics streaming"""
    await ws_manager.connect(websocket)
    
    try:
        # Send initial metrics
        initial_metrics = await monitoring_service.collect_system_metrics()
        await websocket.send_text(json.dumps({
            "type": "initial_metrics",
            "data": initial_metrics,
            "timestamp": datetime.utcnow().isoformat()
        }))
        
        # Keep connection alive and send periodic updates
        while True:
            try:
                # Wait for any client messages (ping/pong, etc.)
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                # Send periodic metrics update
                current_metrics = await monitoring_service.collect_system_metrics()
                await websocket.send_text(json.dumps({
                    "type": "metrics_update",
                    "data": current_metrics,
                    "timestamp": datetime.utcnow().isoformat()
                }))
            except WebSocketDisconnect:
                break
                
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket)

# Background task to broadcast metrics to all connected clients
async def start_metrics_broadcasting():
    """Start background task to broadcast metrics to WebSocket clients"""
    while True:
        try:
            if ws_manager.active_connections:
                metrics = await monitoring_service.collect_system_metrics()
                await ws_manager.broadcast_metrics(metrics)
            
            await asyncio.sleep(30)  # Broadcast every 30 seconds
        except Exception as e:
            print(f"Error in metrics broadcasting: {e}")
            await asyncio.sleep(30)

# Utility endpoints for monitoring configuration
@router.get("/config/thresholds")
async def get_alert_thresholds(
    admin_user: AdminUser = Depends(require_permission("monitoring_read"))
):
    """Get current alert thresholds"""
    return {
        "status": "success",
        "data": monitoring_service.alert_thresholds
    }

@router.put("/config/thresholds")
async def update_alert_thresholds(
    thresholds: Dict[str, float],
    admin_user: AdminUser = Depends(require_permission("monitoring_admin"))
):
    """Update alert thresholds"""
    try:
        # Validate thresholds
        valid_keys = {"cpu_usage", "memory_usage", "disk_usage", "database_connections", "response_time", "error_rate"}
        for key in thresholds:
            if key not in valid_keys:
                raise HTTPException(status_code=400, detail=f"Invalid threshold key: {key}")
            if not isinstance(thresholds[key], (int, float)) or thresholds[key] < 0:
                raise HTTPException(status_code=400, detail=f"Invalid threshold value for {key}")
        
        # Update thresholds
        monitoring_service.alert_thresholds.update(thresholds)
        
        return {
            "status": "success",
            "message": "Alert thresholds updated successfully",
            "data": monitoring_service.alert_thresholds
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update thresholds: {str(e)}")

# AGNO-Native Monitoring Endpoints
@router.post("/agno/run-cycle")
async def run_agno_monitoring_cycle(
    background_tasks: BackgroundTasks,
    admin_user: AdminUser = Depends(require_permission("monitoring_admin"))
):
    """Trigger an AGNO monitoring cycle"""
    try:
        monitoring_service = AgenticMonitoringService()
        result = await monitoring_service.run_monitoring_cycle()
        
        return {
            "status": "success",
            "message": "AGNO monitoring cycle completed",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AGNO monitoring cycle failed: {str(e)}")

@router.post("/agno/track-event")
async def track_agno_event(
    user_id: str,
    action: str,
    prompt: Optional[str] = None,
    app_name: Optional[str] = None,
    error_message: Optional[str] = None,
    duration_ms: Optional[int] = None,
    current_user: User = Depends(get_current_user)
):
    """Track user activity event using AGNO tools"""
    try:
        result = await track_user_event(
            user_id=user_id,
            action=action,
            prompt=prompt,
            app_name=app_name,
            error_message=error_message,
            duration_ms=duration_ms
        )
        
        return {
            "status": "success",
            "message": "Event tracked successfully",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to track event: {str(e)}")

@router.get("/agno/analyze-user/{user_id}")
async def analyze_user_with_agno(
    user_id: str,
    admin_user: AdminUser = Depends(require_permission("monitoring_read"))
):
    """Analyze user behavior patterns using AGNO tools"""
    try:
        result = await analyze_user_behavior(user_id)
        
        return {
            "status": "success",
            "message": "User analysis completed",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze user: {str(e)}")

@router.get("/agno/alerts")
async def get_agno_alerts(
    hours_back: int = 24,
    admin_user: AdminUser = Depends(require_permission("monitoring_read"))
):
    """Get admin alerts using AGNO tools"""
    try:
        monitoring_service = AgenticMonitoringService()
        result = await monitoring_service.get_admin_alerts(hours_back=hours_back)
        
        return {
            "status": "success",
            "message": "AGNO alerts retrieved",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get AGNO alerts: {str(e)}")

@router.post("/agno/resolve-alert")
async def resolve_agno_alert(
    user_id: str,
    timestamp: str,
    admin_user: AdminUser = Depends(require_permission("monitoring_admin"))
):
    """Resolve an admin alert using AGNO tools"""
    try:
        monitoring_service = AgenticMonitoringService()
        result = await monitoring_service.resolve_alert(user_id=user_id, timestamp=timestamp)
        
        return {
            "status": "success",
            "message": "Alert resolved successfully",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resolve alert: {str(e)}")
