from fastapi import APIRouter, Depends, HTTPException, Query, Response, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
import csv
import io
import json

from app.core.database import get_db
from app.core.auth import get_current_admin_user
from app.models.models import User, AuditLog
from app.schemas.audit import AuditLogResponse, AuditSummaryResponse

router = APIRouter()

def create_audit_log(
    db: Session,
    admin_user_id: int,
    action: str,
    target_type: str,
    target_id: str,
    details: dict,
    severity: str = 'medium',
    ip_address: str = None,
    user_agent: str = None
):
    """Helper function to create audit log entries"""
    try:
        audit_log = AuditLog(
            admin_user_id=admin_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
            severity=severity,
            ip_address=ip_address,
            user_agent=user_agent,
            timestamp=datetime.utcnow()
        )
        db.add(audit_log)
        db.commit()
        return audit_log
    except Exception as e:
        db.rollback()
        raise e

@router.get("/summary", response_model=dict)
async def get_audit_summary(
    days: int = Query(7, description="Number of days to analyze"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get audit log analytics summary"""
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Total actions in period
        total_actions = db.query(func.count(AuditLog.id)).filter(
            AuditLog.timestamp >= start_date
        ).scalar() or 0
        
        # Unique administrators
        unique_admins = db.query(func.count(func.distinct(AuditLog.admin_user_id))).filter(
            AuditLog.timestamp >= start_date
        ).scalar() or 0
        
        # Critical actions
        critical_actions = db.query(func.count(AuditLog.id)).filter(
            and_(
                AuditLog.timestamp >= start_date,
                AuditLog.severity == 'critical'
            )
        ).scalar() or 0
        
        # Recent logins
        recent_logins = db.query(func.count(AuditLog.id)).filter(
            and_(
                AuditLog.timestamp >= start_date,
                AuditLog.action.like('%login%')
            )
        ).scalar() or 0
        
        # Failed attempts (login failures, etc.)
        failed_attempts = db.query(func.count(AuditLog.id)).filter(
            and_(
                AuditLog.timestamp >= start_date,
                or_(
                    AuditLog.action.like('%failed%'),
                    AuditLog.action.like('%error%')
                )
            )
        ).scalar() or 0
        
        # Data modifications
        data_modifications = db.query(func.count(AuditLog.id)).filter(
            and_(
                AuditLog.timestamp >= start_date,
                or_(
                    AuditLog.action.like('%create%'),
                    AuditLog.action.like('%update%'),
                    AuditLog.action.like('%delete%'),
                    AuditLog.action.like('%modify%')
                )
            )
        ).scalar() or 0
        
        return {
            "status": "success",
            "data": {
                "total_actions": total_actions,
                "unique_admins": unique_admins,
                "critical_actions": critical_actions,
                "recent_logins": recent_logins,
                "failed_attempts": failed_attempts,
                "data_modifications": data_modifications
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching audit summary: {str(e)}")

@router.get("/logs", response_model=dict)
async def get_audit_logs(
    days: int = Query(7, description="Number of days to fetch"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    search: Optional[str] = Query(None, description="Search term"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Logs per page"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get audit logs with filtering and pagination"""
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Base query
        query = db.query(AuditLog).join(User).filter(
            AuditLog.timestamp >= start_date
        )
        
        # Apply filters
        if action:
            query = query.filter(AuditLog.action.ilike(f"%{action}%"))
        
        if severity:
            query = query.filter(AuditLog.severity == severity)
        
        if search:
            query = query.filter(
                or_(
                    User.full_name.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%"),
                    AuditLog.action.ilike(f"%{search}%"),
                    AuditLog.target_type.ilike(f"%{search}%"),
                    AuditLog.target_id.ilike(f"%{search}%")
                )
            )
        
        # Get total count
        total = query.count()
        
        # Apply pagination and ordering
        offset = (page - 1) * limit
        logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
        
        # Format response
        audit_logs = []
        for log in logs:
            admin_user = log.admin_user
            audit_logs.append({
                "id": log.id,
                "admin_user_id": log.admin_user_id,
                "admin_name": admin_user.full_name,
                "admin_email": admin_user.email,
                "action": log.action,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "details": log.details,
                "severity": log.severity,
                "timestamp": log.timestamp.isoformat(),
                "ip_address": log.ip_address,
                "user_agent": log.user_agent
            })
        
        return {
            "status": "success",
            "data": {
                "logs": audit_logs,
                "total": total
            },
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching audit logs: {str(e)}")

@router.get("/export", response_class=Response)
async def export_audit_logs(
    days: int = Query(7, description="Number of days to export"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    format: str = Query("csv", description="Export format"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Export audit logs as CSV"""
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Base query
        query = db.query(AuditLog).join(User).filter(
            AuditLog.timestamp >= start_date
        )
        
        # Apply filters
        if action:
            query = query.filter(AuditLog.action.ilike(f"%{action}%"))
        
        if severity:
            query = query.filter(AuditLog.severity == severity)
        
        logs = query.order_by(AuditLog.timestamp.desc()).all()
        
        # Create audit log for export action
        create_audit_log(
            db=db,
            admin_user_id=current_admin.id,
            action="audit_log_export",
            target_type="audit_logs",
            target_id=f"export_{len(logs)}_records",
            details={
                "exported_records": len(logs),
                "date_range": f"{start_date.isoformat()} to {end_date.isoformat()}",
                "filters": {
                    "action": action,
                    "severity": severity
                }
            },
            severity="medium"
        )
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Timestamp', 'Admin Name', 'Admin Email', 'Action', 'Target Type',
            'Target ID', 'Severity', 'IP Address', 'User Agent', 'Details'
        ])
        
        # Write data
        for log in logs:
            admin_user = log.admin_user
            writer.writerow([
                log.timestamp.isoformat(),
                admin_user.full_name,
                admin_user.email,
                log.action,
                log.target_type,
                log.target_id,
                log.severity,
                log.ip_address or '',
                log.user_agent or '',
                json.dumps(log.details) if log.details else ''
            ])
        
        # Prepare response
        output.seek(0)
        content = output.getvalue()
        output.close()
        
        filename = f"audit-log-export-{datetime.now().strftime('%Y%m%d')}.csv"
        
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting audit logs: {str(e)}")

@router.post("/log", response_model=dict)
async def create_audit_log_entry(
    request: Request,
    action: str,
    target_type: str,
    target_id: str,
    details: dict,
    severity: str = "medium",
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Create a new audit log entry"""
    try:
        # Get client info
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        
        audit_log = create_audit_log(
            db=db,
            admin_user_id=current_admin.id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
            severity=severity,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return {
            "status": "success",
            "message": "Audit log entry created successfully",
            "data": {
                "log_id": audit_log.id,
                "action": action,
                "severity": severity,
                "timestamp": audit_log.timestamp.isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating audit log entry: {str(e)}")

@router.delete("/logs/cleanup", response_model=dict)
async def cleanup_old_audit_logs(
    days: int = Query(90, description="Delete logs older than this many days"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Clean up old audit logs (admin only)"""
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Count logs to be deleted
        count = db.query(func.count(AuditLog.id)).filter(
            AuditLog.timestamp < cutoff_date
        ).scalar() or 0
        
        if count == 0:
            return {
                "status": "success",
                "message": "No old audit logs to clean up",
                "data": {"deleted_count": 0}
            }
        
        # Create audit log for cleanup action
        create_audit_log(
            db=db,
            admin_user_id=current_admin.id,
            action="audit_log_cleanup",
            target_type="audit_logs",
            target_id=f"cleanup_{count}_records",
            details={
                "deleted_count": count,
                "cutoff_date": cutoff_date.isoformat(),
                "retention_days": days
            },
            severity="high"
        )
        
        # Delete old logs
        deleted = db.query(AuditLog).filter(
            AuditLog.timestamp < cutoff_date
        ).delete()
        
        db.commit()
        
        return {
            "status": "success",
            "message": f"Cleaned up {deleted} old audit log entries",
            "data": {
                "deleted_count": deleted,
                "cutoff_date": cutoff_date.isoformat()
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error cleaning up audit logs: {str(e)}")
