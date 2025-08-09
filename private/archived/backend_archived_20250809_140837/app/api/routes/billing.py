from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
import csv
import io

from app.core.database import get_db
from app.core.auth import get_current_admin_user
from app.models.models import User, Tenant, BillingRecord, Subscription
from app.schemas.billing import (
    BillingRecordResponse,
    BillingSummaryResponse,
    RefundRequest,
    BillingExportRequest
)

router = APIRouter()

@router.get("/summary", response_model=dict)
async def get_billing_summary(
    days: int = Query(30, description="Number of days to analyze"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get billing analytics summary"""
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Total revenue (all time)
        total_revenue = db.query(func.sum(BillingRecord.amount)).filter(
            BillingRecord.payment_status == 'paid'
        ).scalar() or 0
        
        # Monthly revenue (current period)
        monthly_revenue = db.query(func.sum(BillingRecord.amount)).filter(
            and_(
                BillingRecord.payment_status == 'paid',
                BillingRecord.created_at >= start_date
            )
        ).scalar() or 0
        
        # Pending and failed payments
        pending_payments = db.query(func.count(BillingRecord.id)).filter(
            BillingRecord.payment_status == 'pending'
        ).scalar() or 0
        
        failed_payments = db.query(func.count(BillingRecord.id)).filter(
            BillingRecord.payment_status == 'failed'
        ).scalar() or 0
        
        # Customer metrics
        total_customers = db.query(func.count(Tenant.id)).filter(
            Tenant.status == 'active'
        ).scalar() or 0
        
        active_subscriptions = db.query(func.count(Subscription.id)).filter(
            Subscription.status == 'active'
        ).scalar() or 0
        
        # Calculate churn rate (simplified)
        total_tenants = db.query(func.count(Tenant.id)).scalar() or 1
        suspended_tenants = db.query(func.count(Tenant.id)).filter(
            Tenant.status == 'suspended'
        ).scalar() or 0
        churn_rate = (suspended_tenants / total_tenants) * 100 if total_tenants > 0 else 0
        
        # Average revenue per user
        avg_revenue_per_user = total_revenue / total_customers if total_customers > 0 else 0
        
        return {
            "status": "success",
            "data": {
                "total_revenue": float(total_revenue),
                "monthly_revenue": float(monthly_revenue),
                "pending_payments": pending_payments,
                "failed_payments": failed_payments,
                "total_customers": total_customers,
                "active_subscriptions": active_subscriptions,
                "churn_rate": float(churn_rate),
                "avg_revenue_per_user": float(avg_revenue_per_user)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching billing summary: {str(e)}")

@router.get("/records", response_model=dict)
async def get_billing_records(
    days: int = Query(30, description="Number of days to fetch"),
    status: Optional[str] = Query(None, description="Filter by payment status"),
    search: Optional[str] = Query(None, description="Search term"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Records per page"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get billing records with filtering and pagination"""
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Base query
        query = db.query(BillingRecord).join(Tenant).filter(
            BillingRecord.created_at >= start_date
        )
        
        # Apply filters
        if status:
            query = query.filter(BillingRecord.payment_status == status)
        
        if search:
            query = query.filter(
                or_(
                    Tenant.name.ilike(f"%{search}%"),
                    Tenant.slug.ilike(f"%{search}%"),
                    BillingRecord.transaction_id.ilike(f"%{search}%")
                )
            )
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        records = query.offset(offset).limit(limit).all()
        
        # Format response
        billing_records = []
        for record in records:
            tenant = record.tenant
            billing_records.append({
                "id": record.id,
                "tenant_name": tenant.name,
                "tenant_slug": tenant.slug,
                "amount": float(record.amount),
                "currency": record.currency,
                "billing_period_start": record.billing_period_start.isoformat(),
                "billing_period_end": record.billing_period_end.isoformat(),
                "payment_status": record.payment_status,
                "payment_method": record.payment_method,
                "transaction_id": record.transaction_id,
                "created_at": record.created_at.isoformat(),
                "paid_at": record.paid_at.isoformat() if record.paid_at else None
            })
        
        return {
            "status": "success",
            "data": billing_records,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching billing records: {str(e)}")

@router.post("/refund/{record_id}", response_model=dict)
async def process_refund(
    record_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Process a refund for a billing record"""
    try:
        # Find the billing record
        record = db.query(BillingRecord).filter(BillingRecord.id == record_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Billing record not found")
        
        if record.payment_status != 'paid':
            raise HTTPException(status_code=400, detail="Can only refund paid records")
        
        # Update record status
        record.payment_status = 'refunded'
        record.updated_at = datetime.utcnow()
        
        # Log the refund action (you might want to create an audit log entry here)
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Refund processed successfully",
            "data": {
                "record_id": record_id,
                "refunded_amount": float(record.amount),
                "currency": record.currency
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing refund: {str(e)}")

@router.get("/export", response_class=Response)
async def export_billing_data(
    days: int = Query(30, description="Number of days to export"),
    status: Optional[str] = Query(None, description="Filter by payment status"),
    format: str = Query("csv", description="Export format"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Export billing data as CSV"""
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Base query
        query = db.query(BillingRecord).join(Tenant).filter(
            BillingRecord.created_at >= start_date
        )
        
        # Apply filters
        if status:
            query = query.filter(BillingRecord.payment_status == status)
        
        records = query.all()
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Record ID', 'Tenant Name', 'Tenant Slug', 'Amount', 'Currency',
            'Payment Status', 'Payment Method', 'Transaction ID',
            'Billing Period Start', 'Billing Period End', 'Created At', 'Paid At'
        ])
        
        # Write data
        for record in records:
            tenant = record.tenant
            writer.writerow([
                record.id,
                tenant.name,
                tenant.slug,
                record.amount,
                record.currency,
                record.payment_status,
                record.payment_method,
                record.transaction_id,
                record.billing_period_start.isoformat(),
                record.billing_period_end.isoformat(),
                record.created_at.isoformat(),
                record.paid_at.isoformat() if record.paid_at else ''
            ])
        
        # Prepare response
        output.seek(0)
        content = output.getvalue()
        output.close()
        
        filename = f"billing-export-{datetime.now().strftime('%Y%m%d')}.csv"
        
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting billing data: {str(e)}")
