from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.auth import get_current_admin_user, get_current_user
from app.models.models import User, Tenant, SupportTicket, TicketResponse
from app.services.email_service import email_service
from app.schemas.support import (
    SupportTicketCreate,
    SupportTicketResponse,
    TicketResponseCreate,
    TicketResponseResponse,
    TicketStatusUpdate,
    TicketPriorityUpdate,
    TicketAssignmentUpdate
)

router = APIRouter()

@router.get("/tickets", response_model=dict)
async def get_support_tickets(
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    search: Optional[str] = Query(None, description="Search term"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Tickets per page"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get support tickets with filtering and pagination"""
    try:
        # Base query
        query = db.query(SupportTicket).join(User).join(Tenant)
        
        # Apply filters
        if status:
            query = query.filter(SupportTicket.status == status)
        
        if priority:
            query = query.filter(SupportTicket.priority == priority)
        
        if search:
            query = query.filter(
                or_(
                    SupportTicket.subject.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%"),
                    Tenant.name.ilike(f"%{search}%")
                )
            )
        
        # Get total count
        total = query.count()
        
        # Apply pagination and ordering
        offset = (page - 1) * limit
        tickets = query.order_by(SupportTicket.created_at.desc()).offset(offset).limit(limit).all()
        
        # Format response
        ticket_list = []
        for ticket in tickets:
            user = ticket.user
            tenant = user.tenant if hasattr(user, 'tenant') else None
            
            # Get response count
            response_count = db.query(func.count(TicketResponse.id)).filter(
                TicketResponse.ticket_id == ticket.id
            ).scalar() or 0
            
            # Get assigned admin info
            assigned_admin = None
            if ticket.assigned_admin_id:
                assigned_admin = db.query(User).filter(User.id == ticket.assigned_admin_id).first()
            
            ticket_list.append({
                "id": ticket.id,
                "user_id": ticket.user_id,
                "user_email": user.email,
                "tenant_name": tenant.name if tenant else "N/A",
                "subject": ticket.subject,
                "description": ticket.description,
                "status": ticket.status,
                "priority": ticket.priority,
                "category": ticket.category,
                "assigned_admin_id": ticket.assigned_admin_id,
                "assigned_admin_name": assigned_admin.full_name if assigned_admin else None,
                "created_at": ticket.created_at.isoformat(),
                "updated_at": ticket.updated_at.isoformat(),
                "last_response_at": ticket.last_response_at.isoformat() if ticket.last_response_at else None,
                "response_count": response_count
            })
        
        return {
            "status": "success",
            "data": ticket_list,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching support tickets: {str(e)}")

@router.get("/tickets/{ticket_id}/responses", response_model=dict)
async def get_ticket_responses(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all responses for a specific ticket"""
    try:
        # Verify ticket exists
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Get responses
        responses = db.query(TicketResponse).filter(
            TicketResponse.ticket_id == ticket_id
        ).order_by(TicketResponse.created_at.asc()).all()
        
        # Format response
        response_list = []
        for response in responses:
            admin_user = None
            user = None
            
            if response.admin_id:
                admin_user = db.query(User).filter(User.id == response.admin_id).first()
            elif response.user_id:
                user = db.query(User).filter(User.id == response.user_id).first()
            
            response_list.append({
                "id": response.id,
                "ticket_id": response.ticket_id,
                "admin_id": response.admin_id,
                "admin_name": admin_user.full_name if admin_user else None,
                "user_id": response.user_id,
                "user_email": user.email if user else None,
                "message": response.message,
                "is_internal": response.is_internal,
                "created_at": response.created_at.isoformat(),
                "attachments": response.attachments or []
            })
        
        return {
            "status": "success",
            "data": response_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching ticket responses: {str(e)}")

@router.post("/tickets/{ticket_id}/responses", response_model=dict)
async def create_ticket_response(
    ticket_id: str,
    response_data: TicketResponseCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Create a new response to a support ticket"""
    try:
        # Verify ticket exists
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Create response
        response = TicketResponse(
            ticket_id=ticket_id,
            admin_id=current_admin.id,
            message=response_data.message,
            is_internal=response_data.is_internal,
            created_at=datetime.utcnow()
        )
        
        db.add(response)
        
        # Update ticket's last response time
        ticket.last_response_at = datetime.utcnow()
        ticket.updated_at = datetime.utcnow()
        
        # If not internal, update status to in_progress if it was open
        if not response_data.is_internal and ticket.status == 'open':
            ticket.status = 'in_progress'
        
        db.commit()
        
        # Send email notification to user if not internal
        if not response_data.is_internal:
            user = ticket.user
            try:
                await email_service.send_support_response_notification(
                    user_email=user.email,
                    user_name=user.full_name or user.username,
                    ticket_id=ticket_id,
                    ticket_subject=ticket.subject,
                    admin_name=current_admin.full_name or current_admin.username,
                    response_message=response_data.message
                )
            except Exception as e:
                logger.warning(f"Failed to send email notification: {str(e)}")
        
        return {
            "status": "success",
            "message": "Response created successfully",
            "data": {
                "response_id": response.id,
                "ticket_id": ticket_id,
                "is_internal": response_data.is_internal
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating ticket response: {str(e)}")

@router.put("/tickets/{ticket_id}/status", response_model=dict)
async def update_ticket_status(
    ticket_id: str,
    status_update: TicketStatusUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update the status of a support ticket"""
    try:
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        old_status = ticket.status
        ticket.status = status_update.status
        ticket.updated_at = datetime.utcnow()
        
        # If assigning to current admin and not already assigned
        if not ticket.assigned_admin_id and status_update.status == 'in_progress':
            ticket.assigned_admin_id = current_admin.id
        
        db.commit()
        
        return {
            "status": "success",
            "message": f"Ticket status updated from {old_status} to {status_update.status}",
            "data": {
                "ticket_id": ticket_id,
                "old_status": old_status,
                "new_status": status_update.status
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating ticket status: {str(e)}")

@router.put("/tickets/{ticket_id}/priority", response_model=dict)
async def update_ticket_priority(
    ticket_id: str,
    priority_update: TicketPriorityUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update the priority of a support ticket"""
    try:
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        old_priority = ticket.priority
        ticket.priority = priority_update.priority
        ticket.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "status": "success",
            "message": f"Ticket priority updated from {old_priority} to {priority_update.priority}",
            "data": {
                "ticket_id": ticket_id,
                "old_priority": old_priority,
                "new_priority": priority_update.priority
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating ticket priority: {str(e)}")

@router.put("/tickets/{ticket_id}/assign", response_model=dict)
async def assign_ticket(
    ticket_id: str,
    assignment_update: TicketAssignmentUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Assign a support ticket to an administrator"""
    try:
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Verify the admin exists
        assigned_admin = db.query(User).filter(
            and_(User.id == assignment_update.admin_id, User.role == 'admin')
        ).first()
        if not assigned_admin:
            raise HTTPException(status_code=404, detail="Admin user not found")
        
        old_admin_id = ticket.assigned_admin_id
        ticket.assigned_admin_id = assignment_update.admin_id
        ticket.updated_at = datetime.utcnow()
        
        # Update status to in_progress if it was open
        if ticket.status == 'open':
            ticket.status = 'in_progress'
        
        db.commit()
        
        return {
            "status": "success",
            "message": f"Ticket assigned to {assigned_admin.full_name}",
            "data": {
                "ticket_id": ticket_id,
                "old_admin_id": old_admin_id,
                "new_admin_id": assignment_update.admin_id,
                "assigned_admin_name": assigned_admin.full_name
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error assigning ticket: {str(e)}")

@router.post("/tickets", response_model=dict)
async def create_support_ticket(
    ticket_data: SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new support ticket (for regular users)"""
    try:
        ticket = SupportTicket(
            user_id=current_user.id,
            subject=ticket_data.subject,
            description=ticket_data.description,
            priority=ticket_data.priority or 'medium',
            category=ticket_data.category or 'general',
            status='open',
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(ticket)
        db.commit()
        
        # Send email notification to admins for high/urgent priority tickets
        if ticket.priority in ['high', 'urgent']:
            try:
                # Get all admin users
                admin_users = db.query(User).filter(User.role.in_(['admin', 'superadmin'])).all()
                
                for admin in admin_users:
                    await email_service.send_support_ticket_notification(
                        admin_email=admin.email,
                        admin_name=admin.full_name or admin.username,
                        ticket_id=ticket.id,
                        ticket_subject=ticket.subject,
                        user_email=current_user.email,
                        priority=ticket.priority
                    )
            except Exception as e:
                logger.warning(f"Failed to send admin notification emails: {str(e)}")
        
        return {
            "status": "success",
            "message": "Support ticket created successfully",
            "data": {
                "ticket_id": ticket.id,
                "subject": ticket.subject,
                "status": ticket.status,
                "priority": ticket.priority
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating support ticket: {str(e)}")
