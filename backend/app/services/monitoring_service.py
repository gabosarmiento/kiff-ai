"""
Real-Time Monitoring Service
System metrics collection, processing, and real-time updates for TradeForge AI
"""

import asyncio
import psutil
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import text, func
import json

from app.core.database import get_db
from app.core.multi_tenant_db import mt_db_manager
from app.models.models import User, UsageRecord
from app.models.admin_models import SystemMetrics

logger = logging.getLogger(__name__)

class MonitoringService:
    """
    Real-time monitoring service for system health, performance, and tenant metrics
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.metrics_cache = {}
        self.alert_thresholds = {
            "cpu_usage": 80.0,
            "memory_usage": 85.0,
            "disk_usage": 90.0,
            "database_connections": 80,
            "response_time": 2000,  # ms
            "error_rate": 5.0  # %
        }
    
    async def collect_system_metrics(self) -> Dict[str, Any]:
        """Collect comprehensive system metrics"""
        try:
            # System resource metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Network statistics
            network = psutil.net_io_counters()
            
            # Process information
            process_count = len(psutil.pids())
            
            # Database metrics
            db_metrics = await self._collect_database_metrics()
            
            # Application metrics
            app_metrics = await self._collect_application_metrics()
            
            # Tenant metrics
            tenant_metrics = await self._collect_tenant_metrics()
            
            metrics = {
                "timestamp": datetime.utcnow().isoformat(),
                "system": {
                    "cpu_usage": cpu_percent,
                    "memory": {
                        "total": memory.total,
                        "available": memory.available,
                        "used": memory.used,
                        "percentage": memory.percent
                    },
                    "disk": {
                        "total": disk.total,
                        "used": disk.used,
                        "free": disk.free,
                        "percentage": (disk.used / disk.total) * 100
                    },
                    "network": {
                        "bytes_sent": network.bytes_sent,
                        "bytes_recv": network.bytes_recv,
                        "packets_sent": network.packets_sent,
                        "packets_recv": network.packets_recv
                    },
                    "processes": process_count
                },
                "database": db_metrics,
                "application": app_metrics,
                "tenants": tenant_metrics,
                "alerts": self._generate_alerts(cpu_percent, memory.percent, 
                                              (disk.used / disk.total) * 100, db_metrics)
            }
            
            # Cache metrics for quick access
            self.metrics_cache = metrics
            
            # Store in database
            await self._store_metrics(metrics)
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Error collecting system metrics: {e}")
            return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}
    
    async def _collect_database_metrics(self) -> Dict[str, Any]:
        """Collect database performance metrics"""
        try:
            with mt_db_manager.master_engine.connect() as conn:
                # Connection count
                result = conn.execute(text("""
                    SELECT count(*) as active_connections
                    FROM pg_stat_activity 
                    WHERE state = 'active'
                """))
                active_connections = result.fetchone()[0]
                
                # Database size
                result = conn.execute(text("""
                    SELECT pg_size_pretty(pg_database_size(current_database())) as db_size,
                           pg_database_size(current_database()) as db_size_bytes
                """))
                size_info = result.fetchone()
                
                # Query performance
                result = conn.execute(text("""
                    SELECT 
                        round(avg(mean_exec_time)::numeric, 2) as avg_query_time,
                        sum(calls) as total_queries,
                        count(*) as unique_queries
                    FROM pg_stat_statements 
                    WHERE calls > 0
                """))
                query_stats = result.fetchone()
                
                # Table statistics
                result = conn.execute(text("""
                    SELECT 
                        schemaname,
                        tablename,
                        n_tup_ins + n_tup_upd + n_tup_del as total_modifications,
                        n_tup_ins as inserts,
                        n_tup_upd as updates,
                        n_tup_del as deletes,
                        seq_scan + idx_scan as total_scans
                    FROM pg_stat_user_tables 
                    ORDER BY total_modifications DESC 
                    LIMIT 10
                """))
                table_stats = [dict(row._mapping) for row in result]
                
                return {
                    "active_connections": active_connections,
                    "database_size": size_info[0] if size_info else "Unknown",
                    "database_size_bytes": size_info[1] if size_info else 0,
                    "avg_query_time_ms": float(query_stats[0]) if query_stats and query_stats[0] else 0,
                    "total_queries": int(query_stats[1]) if query_stats and query_stats[1] else 0,
                    "unique_queries": int(query_stats[2]) if query_stats and query_stats[2] else 0,
                    "table_activity": table_stats,
                    "health_status": "healthy" if active_connections < 50 else "warning"
                }
                
        except Exception as e:
            self.logger.error(f"Error collecting database metrics: {e}")
            return {
                "error": str(e),
                "health_status": "error"
            }
    
    async def _collect_application_metrics(self) -> Dict[str, Any]:
        """Collect application-specific metrics"""
        try:
            # API endpoint performance (would integrate with FastAPI metrics)
            api_metrics = {
                "total_requests": 0,
                "avg_response_time": 0,
                "error_rate": 0,
                "active_websockets": 0
            }
            
            # Background task status
            task_metrics = {
                "running_tasks": 0,
                "completed_tasks": 0,
                "failed_tasks": 0
            }
            
            # Cache metrics (Redis if implemented)
            cache_metrics = {
                "hit_rate": 0,
                "memory_usage": 0,
                "keys_count": 0
            }
            
            return {
                "api": api_metrics,
                "background_tasks": task_metrics,
                "cache": cache_metrics,
                "health_status": "healthy"
            }
            
        except Exception as e:
            self.logger.error(f"Error collecting application metrics: {e}")
            return {"error": str(e), "health_status": "error"}
    
    async def _collect_tenant_metrics(self) -> Dict[str, Any]:
        """Collect tenant-specific metrics"""
        try:
            tenants = mt_db_manager.list_tenants()
            tenant_summary = {
                "total_tenants": len(tenants),
                "active_tenants": len([t for t in tenants if t["status"] == "active"]),
                "suspended_tenants": len([t for t in tenants if t["status"] == "suspended"]),
                "tenant_details": []
            }
            
            # Collect metrics for each active tenant
            for tenant in tenants[:10]:  # Limit to first 10 for performance
                try:
                    tenant_id = tenant["tenant_id"]
                    analytics = mt_db_manager.get_tenant_analytics(tenant_id, days=1)
                    
                    tenant_summary["tenant_details"].append({
                        "tenant_id": tenant_id,
                        "slug": tenant["slug"],
                        "name": tenant["name"],
                        "status": tenant["status"],
                        "tier": tenant["tier"],
                        "users": analytics["users"],
                        "sandboxes": analytics["sandboxes"],
                        "daily_usage": analytics["usage"]
                    })
                    
                except Exception as e:
                    self.logger.error(f"Error collecting metrics for tenant {tenant['slug']}: {e}")
                    continue
            
            return tenant_summary
            
        except Exception as e:
            self.logger.error(f"Error collecting tenant metrics: {e}")
            return {"error": str(e)}
    
    def _generate_alerts(self, cpu: float, memory: float, disk: float, 
                        db_metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate alerts based on metric thresholds"""
        alerts = []
        
        if cpu > self.alert_thresholds["cpu_usage"]:
            alerts.append({
                "type": "warning",
                "category": "system",
                "message": f"High CPU usage: {cpu:.1f}%",
                "threshold": self.alert_thresholds["cpu_usage"],
                "current_value": cpu,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        if memory > self.alert_thresholds["memory_usage"]:
            alerts.append({
                "type": "warning",
                "category": "system",
                "message": f"High memory usage: {memory:.1f}%",
                "threshold": self.alert_thresholds["memory_usage"],
                "current_value": memory,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        if disk > self.alert_thresholds["disk_usage"]:
            alerts.append({
                "type": "critical",
                "category": "system",
                "message": f"High disk usage: {disk:.1f}%",
                "threshold": self.alert_thresholds["disk_usage"],
                "current_value": disk,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        if db_metrics.get("active_connections", 0) > self.alert_thresholds["database_connections"]:
            alerts.append({
                "type": "warning",
                "category": "database",
                "message": f"High database connections: {db_metrics['active_connections']}",
                "threshold": self.alert_thresholds["database_connections"],
                "current_value": db_metrics["active_connections"],
                "timestamp": datetime.utcnow().isoformat()
            })
        
        return alerts
    
    async def _store_metrics(self, metrics: Dict[str, Any]):
        """Store metrics in database for historical analysis"""
        try:
            with mt_db_manager.master_engine.connect() as conn:
                conn.execute(text("""
                    INSERT INTO system_metrics (
                        timestamp, cpu_usage, memory_usage, disk_usage, 
                        database_connections, system_status, metrics_data
                    ) VALUES (
                        :timestamp, :cpu, :memory, :disk, :db_conn, :status, :data
                    )
                """), {
                    "timestamp": datetime.utcnow(),
                    "cpu": metrics["system"]["cpu_usage"],
                    "memory": metrics["system"]["memory"]["percentage"],
                    "disk": metrics["system"]["disk"]["percentage"],
                    "db_conn": metrics["database"].get("active_connections", 0),
                    "status": "healthy" if not metrics["alerts"] else "warning",
                    "data": json.dumps(metrics)
                })
                conn.commit()
                
        except Exception as e:
            self.logger.error(f"Error storing metrics: {e}")
    
    async def get_historical_metrics(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get historical metrics for charts and analysis"""
        try:
            since_time = datetime.utcnow() - timedelta(hours=hours)
            
            with mt_db_manager.master_engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT timestamp, cpu_usage, memory_usage, disk_usage,
                           database_connections, system_status
                    FROM system_metrics 
                    WHERE timestamp >= :since_time
                    ORDER BY timestamp ASC
                """), {"since_time": since_time})
                
                return [
                    {
                        "timestamp": row[0].isoformat(),
                        "cpu_usage": row[1],
                        "memory_usage": row[2],
                        "disk_usage": row[3],
                        "database_connections": row[4],
                        "system_status": row[5]
                    }
                    for row in result
                ]
                
        except Exception as e:
            self.logger.error(f"Error getting historical metrics: {e}")
            return []
    
    async def get_tenant_health_summary(self) -> Dict[str, Any]:
        """Get health summary for all tenants"""
        try:
            tenants = mt_db_manager.list_tenants()
            health_summary = {
                "total_tenants": len(tenants),
                "healthy_tenants": 0,
                "warning_tenants": 0,
                "error_tenants": 0,
                "tenant_status": []
            }
            
            for tenant in tenants:
                try:
                    # Check tenant database health
                    from app.middleware.tenant_middleware import check_tenant_health
                    health = await check_tenant_health(tenant["tenant_id"])
                    
                    if health["database_status"] == "healthy":
                        health_summary["healthy_tenants"] += 1
                        status = "healthy"
                    elif health["database_status"] == "unhealthy":
                        health_summary["warning_tenants"] += 1
                        status = "warning"
                    else:
                        health_summary["error_tenants"] += 1
                        status = "error"
                    
                    health_summary["tenant_status"].append({
                        "tenant_id": tenant["tenant_id"],
                        "slug": tenant["slug"],
                        "name": tenant["name"],
                        "status": status,
                        "last_check": health["timestamp"]
                    })
                    
                except Exception as e:
                    health_summary["error_tenants"] += 1
                    health_summary["tenant_status"].append({
                        "tenant_id": tenant["tenant_id"],
                        "slug": tenant["slug"],
                        "name": tenant["name"],
                        "status": "error",
                        "error": str(e)
                    })
            
            return health_summary
            
        except Exception as e:
            self.logger.error(f"Error getting tenant health summary: {e}")
            return {"error": str(e)}
    
    async def cleanup_old_metrics(self, days: int = 30):
        """Clean up old metrics data to manage database size"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            with mt_db_manager.master_engine.connect() as conn:
                result = conn.execute(text("""
                    DELETE FROM system_metrics 
                    WHERE timestamp < :cutoff_date
                """), {"cutoff_date": cutoff_date})
                
                deleted_count = result.rowcount
                conn.commit()
                
                self.logger.info(f"Cleaned up {deleted_count} old metric records")
                return deleted_count
                
        except Exception as e:
            self.logger.error(f"Error cleaning up metrics: {e}")
            return 0

# Global monitoring service instance
monitoring_service = MonitoringService()

# Background task for continuous monitoring
async def start_monitoring_loop():
    """Start continuous monitoring loop - TEMPORARILY DISABLED"""
    # Temporarily disabled to fix database table issues
    logger.info("Monitoring service temporarily disabled - database tables need to be created")
    return

# Start continuous monitoring loop - TEMPORARILY DISABLED
# start_monitoring_loop()
