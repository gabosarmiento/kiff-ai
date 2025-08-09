"""
Tenant Management API Routes
Multi-tenant administration and tenant lifecycle management
"""

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.multi_tenant_db import (
    mt_db_manager, TenantStatus, TenantTier, TenantMiddleware
)
from app.core.admin_auth import get_current_admin_user, require_permission
from app.models.admin_models import AdminUser

router = APIRouter()

# Pydantic models for tenant management
class TenantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=50, pattern=r'^[a-z0-9-]+$')
    tier: TenantTier = TenantTier.STARTER
    admin_email: Optional[str] = Field(None, pattern=r'^[^@]+@[^@]+\.[^@]+$')
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict)

class TenantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    tier: Optional[TenantTier] = None
    status: Optional[TenantStatus] = None
    admin_email: Optional[str] = Field(None, pattern=r'^[^@]+@[^@]+\.[^@]+$')
    settings: Optional[Dict[str, Any]] = None
    resource_limits: Optional[Dict[str, Any]] = None

class TenantResponse(BaseModel):
    tenant_id: str
    name: str
    slug: str
    schema_name: str
    status: str
    tier: str
    created_at: str
    contact_email: Optional[str]
    settings: Dict[str, Any]
    resource_limits: Dict[str, Any]

class TenantListResponse(BaseModel):
    tenant_id: str
    name: str
    slug: str
    status: str
    tier: str
    created_at: str
    contact_email: Optional[str]

class TenantAnalytics(BaseModel):
    tenant_id: str
    period_days: int
    users: int
    sandboxes: Dict[str, int]
    usage: Dict[str, int]

@router.post("/tenants", response_model=TenantResponse)
async def create_tenant(
    tenant_data: TenantCreate,
    background_tasks: BackgroundTasks,
    admin_user: AdminUser = Depends(require_permission("tenant_create"))
):
    """Create a new tenant with isolated schema"""
    try:
        # Create tenant
        tenant_info = await mt_db_manager.create_tenant(
            name=tenant_data.name,
            slug=tenant_data.slug,
            tier=tenant_data.tier,
            admin_email=tenant_data.admin_email,
            settings=tenant_data.settings
        )
        
        # Schedule background tasks
        background_tasks.add_task(
            _setup_tenant_defaults,
            tenant_info["tenant_id"]
        )
        
        # Log admin action
        background_tasks.add_task(
            _log_admin_action,
            admin_user.id,
            "tenant_created",
            "tenant",
            tenant_info["tenant_id"],
            {"name": tenant_data.name, "slug": tenant_data.slug}
        )
        
        # Get full tenant info
        full_info = mt_db_manager.get_tenant_info(tenant_info["tenant_id"])
        return TenantResponse(**full_info)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create tenant: {str(e)}")

@router.get("/tenants", response_model=List[TenantListResponse])
async def list_tenants(
    status: Optional[TenantStatus] = None,
    admin_user: AdminUser = Depends(require_permission("tenant_read"))
):
    """List all tenants with optional status filter"""
    try:
        tenants = mt_db_manager.list_tenants(status=status)
        return [TenantListResponse(**tenant) for tenant in tenants]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list tenants: {str(e)}")

@router.get("/tenants/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: str,
    admin_user: AdminUser = Depends(require_permission("tenant_read"))
):
    """Get detailed tenant information"""
    tenant_info = mt_db_manager.get_tenant_info(tenant_id)
    if not tenant_info:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return TenantResponse(**tenant_info)

@router.get("/tenants/slug/{slug}", response_model=TenantResponse)
async def get_tenant_by_slug(
    slug: str,
    admin_user: AdminUser = Depends(require_permission("tenant_read"))
):
    """Get tenant information by slug"""
    tenant_info = mt_db_manager.get_tenant_by_slug(slug)
    if not tenant_info:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return TenantResponse(**tenant_info)

@router.put("/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: str,
    tenant_update: TenantUpdate,
    background_tasks: BackgroundTasks,
    admin_user: AdminUser = Depends(require_permission("tenant_update"))
):
    """Update tenant information"""
    # Check if tenant exists
    tenant_info = mt_db_manager.get_tenant_info(tenant_id)
    if not tenant_info:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    try:
        with mt_db_manager.master_engine.connect() as conn:
            # Build update query
            updates = []
            params = {"tenant_id": tenant_id}
            
            if tenant_update.name is not None:
                updates.append("name = :name")
                params["name"] = tenant_update.name
            
            if tenant_update.tier is not None:
                updates.append("tier = :tier")
                params["tier"] = tenant_update.tier.value
                
                # Update resource limits based on tier
                new_limits = mt_db_manager._get_default_resource_limits(tenant_update.tier)
                updates.append("resource_limits = :limits")
                params["limits"] = new_limits
            
            if tenant_update.status is not None:
                updates.append("status = :status")
                params["status"] = tenant_update.status.value
            
            if tenant_update.admin_email is not None:
                updates.append("contact_email = :email")
                params["email"] = tenant_update.admin_email
            
            if tenant_update.settings is not None:
                updates.append("settings = :settings")
                params["settings"] = tenant_update.settings
            
            if tenant_update.resource_limits is not None:
                updates.append("resource_limits = :limits")
                params["limits"] = tenant_update.resource_limits
            
            if updates:
                updates.append("updated_at = NOW()")
                query = f"UPDATE tenants SET {', '.join(updates)} WHERE id = :tenant_id"
                
                from sqlalchemy import text
                conn.execute(text(query), params)
                conn.commit()
        
        # Log admin action
        background_tasks.add_task(
            _log_admin_action,
            admin_user.id,
            "tenant_updated",
            "tenant",
            tenant_id,
            tenant_update.dict(exclude_unset=True)
        )
        
        # Return updated tenant info
        updated_info = mt_db_manager.get_tenant_info(tenant_id)
        return TenantResponse(**updated_info)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update tenant: {str(e)}")

@router.post("/tenants/{tenant_id}/suspend")
async def suspend_tenant(
    tenant_id: str,
    background_tasks: BackgroundTasks,
    admin_user: AdminUser = Depends(require_permission("tenant_suspend"))
):
    """Suspend tenant (disable access but keep data)"""
    success = await mt_db_manager.update_tenant_status(tenant_id, TenantStatus.SUSPENDED)
    if not success:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    background_tasks.add_task(
        _log_admin_action,
        admin_user.id,
        "tenant_suspended",
        "tenant",
        tenant_id,
        {}
    )
    
    return {"message": "Tenant suspended successfully"}

@router.post("/tenants/{tenant_id}/activate")
async def activate_tenant(
    tenant_id: str,
    background_tasks: BackgroundTasks,
    admin_user: AdminUser = Depends(require_permission("tenant_activate"))
):
    """Activate suspended tenant"""
    success = await mt_db_manager.update_tenant_status(tenant_id, TenantStatus.ACTIVE)
    if not success:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    background_tasks.add_task(
        _log_admin_action,
        admin_user.id,
        "tenant_activated",
        "tenant",
        tenant_id,
        {}
    )
    
    return {"message": "Tenant activated successfully"}

@router.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    background_tasks: BackgroundTasks,
    force: bool = False,
    admin_user: AdminUser = Depends(require_permission("tenant_delete"))
):
    """Delete tenant and all associated data"""
    # Get tenant info for logging
    tenant_info = mt_db_manager.get_tenant_info(tenant_id)
    if not tenant_info:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    try:
        success = await mt_db_manager.delete_tenant(tenant_id, force=force)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete tenant")
        
        background_tasks.add_task(
            _log_admin_action,
            admin_user.id,
            "tenant_deleted",
            "tenant",
            tenant_id,
            {"name": tenant_info["name"], "slug": tenant_info["slug"], "force": force}
        )
        
        return {"message": "Tenant deleted successfully"}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete tenant: {str(e)}")

@router.post("/tenants/{tenant_id}/backup")
async def backup_tenant(
    tenant_id: str,
    background_tasks: BackgroundTasks,
    admin_user: AdminUser = Depends(require_permission("tenant_backup"))
):
    """Create backup of tenant data"""
    try:
        backup_file = await mt_db_manager.backup_tenant(tenant_id)
        
        background_tasks.add_task(
            _log_admin_action,
            admin_user.id,
            "tenant_backup_created",
            "tenant",
            tenant_id,
            {"backup_file": backup_file}
        )
        
        return {
            "message": "Tenant backup created successfully",
            "backup_file": backup_file
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to backup tenant: {str(e)}")

@router.get("/tenants/{tenant_id}/analytics", response_model=TenantAnalytics)
async def get_tenant_analytics(
    tenant_id: str,
    days: int = 30,
    admin_user: AdminUser = Depends(require_permission("tenant_read"))
):
    """Get tenant usage analytics"""
    # Check if tenant exists
    tenant_info = mt_db_manager.get_tenant_info(tenant_id)
    if not tenant_info:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    try:
        analytics = mt_db_manager.get_tenant_analytics(tenant_id, days=days)
        return TenantAnalytics(**analytics)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")

@router.get("/tenants/{tenant_id}/users")
async def get_tenant_users(
    tenant_id: str,
    admin_user: AdminUser = Depends(require_permission("tenant_read"))
):
    """Get list of users in tenant"""
    # Check if tenant exists
    tenant_info = mt_db_manager.get_tenant_info(tenant_id)
    if not tenant_info:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    try:
        with mt_db_manager.get_tenant_session(tenant_id) as session:
            from app.models.models import User
            users = session.query(User).all()
            
            return [
                {
                    "id": user.id,
                    "email": user.email,
                    "is_active": user.is_active,
                    "is_verified": user.is_verified,
                    "created_at": user.created_at.isoformat(),
                    "last_login": user.last_login.isoformat() if user.last_login else None
                }
                for user in users
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tenant users: {str(e)}")

@router.get("/tenants/{tenant_id}/sandboxes")
async def get_tenant_sandboxes(
    tenant_id: str,
    admin_user: AdminUser = Depends(require_permission("tenant_read"))
):
    """Get list of sandboxes in tenant"""
    # Check if tenant exists
    tenant_info = mt_db_manager.get_tenant_info(tenant_id)
    if not tenant_info:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    try:
        with mt_db_manager.get_tenant_session(tenant_id) as session:
            # TradingSandbox model removed - legacy trading functionality cleaned up
            # For kiff system, this would query generated apps instead
            sandboxes = []  # Placeholder for generated apps query
            
            return [
                {
                    "sandbox_id": sandbox.sandbox_id,
                    "user_id": sandbox.user_id,
                    "name": sandbox.name,
                    "status": sandbox.status,
                    "created_at": sandbox.created_at.isoformat(),
                    "last_activity": sandbox.last_activity.isoformat() if sandbox.last_activity else None
                }
                for sandbox in sandboxes
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tenant sandboxes: {str(e)}")

# Tenant resolution endpoint for middleware
@router.get("/resolve-tenant")
async def resolve_tenant(request: Request):
    """Resolve tenant from request (for middleware/frontend)"""
    tenant_id = TenantMiddleware.get_tenant_from_request(request)
    
    if not tenant_id:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenant_info = mt_db_manager.get_tenant_info(tenant_id)
    if not tenant_info:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return {
        "tenant_id": tenant_id,
        "slug": tenant_info["slug"],
        "name": tenant_info["name"],
        "status": tenant_info["status"]
    }

# Background task helpers
async def _setup_tenant_defaults(tenant_id: str):
    """Set up default data for new tenant"""
    try:
        with mt_db_manager.get_tenant_session(tenant_id) as session:
            # Create default admin user if needed
            # Add default templates, configurations, etc.
            pass
    except Exception as e:
        print(f"Error setting up tenant defaults: {e}")

async def _log_admin_action(admin_user_id: int, action: str, target_type: str, 
                          target_id: str, details: Dict[str, Any]):
    """Log admin action to audit trail"""
    try:
        # This would integrate with your admin audit logging system
        from app.models.admin_models import AdminAuditLog
        from app.core.database import get_db
        
        # Log to master database
        with mt_db_manager.master_engine.connect() as conn:
            from sqlalchemy import text
            conn.execute(text("""
                INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, details, timestamp)
                VALUES (:admin_id, :action, :target_type, :target_id, :details, NOW())
            """), {
                "admin_id": admin_user_id,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "details": details
            })
            conn.commit()
    except Exception as e:
        print(f"Error logging admin action: {e}")
