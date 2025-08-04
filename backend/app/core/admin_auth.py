"""
Admin Authentication and Authorization System for TradeForge AI
Role-based access control for SaaS backoffice
"""

from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, List
from enum import Enum
import logging

from app.core.database import get_db
from app.core.config import settings
from app.models.admin_models import AdminUser, AdminRole

logger = logging.getLogger(__name__)
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AdminPermission(str, Enum):
    # User Management
    READ_USERS = "read_users"
    MANAGE_USERS = "manage_users"
    DELETE_USERS = "delete_users"
    
    # Sandbox Management
    VIEW_SANDBOXES = "view_sandboxes"
    MANAGE_SANDBOXES = "manage_sandboxes"
    
    # System Management
    VIEW_SYSTEM = "view_system"
    MANAGE_SYSTEM = "manage_system"
    
    # Billing & Revenue
    VIEW_BILLING = "view_billing"
    MANAGE_BILLING = "manage_billing"
    
    # Support
    VIEW_SUPPORT = "view_support"
    MANAGE_SUPPORT = "manage_support"
    
    # Audit & Security
    VIEW_AUDIT_LOGS = "view_audit_logs"
    MANAGE_SECURITY = "manage_security"
    
    # Content Management
    MANAGE_CONTENT = "manage_content"
    
    # Feature Flags
    MANAGE_FEATURES = "manage_features"

# Role-based permissions mapping
ROLE_PERMISSIONS = {
    AdminRole.SUPER_ADMIN: [
        # Super admin has all permissions
        AdminPermission.READ_USERS,
        AdminPermission.MANAGE_USERS,
        AdminPermission.DELETE_USERS,
        AdminPermission.VIEW_SANDBOXES,
        AdminPermission.MANAGE_SANDBOXES,
        AdminPermission.VIEW_SYSTEM,
        AdminPermission.MANAGE_SYSTEM,
        AdminPermission.VIEW_BILLING,
        AdminPermission.MANAGE_BILLING,
        AdminPermission.VIEW_SUPPORT,
        AdminPermission.MANAGE_SUPPORT,
        AdminPermission.VIEW_AUDIT_LOGS,
        AdminPermission.MANAGE_SECURITY,
        AdminPermission.MANAGE_CONTENT,
        AdminPermission.MANAGE_FEATURES,
    ],
    AdminRole.ADMIN: [
        # Admin has most permissions except critical system operations
        AdminPermission.READ_USERS,
        AdminPermission.MANAGE_USERS,
        AdminPermission.VIEW_SANDBOXES,
        AdminPermission.MANAGE_SANDBOXES,
        AdminPermission.VIEW_SYSTEM,
        AdminPermission.VIEW_BILLING,
        AdminPermission.MANAGE_BILLING,
        AdminPermission.VIEW_SUPPORT,
        AdminPermission.MANAGE_SUPPORT,
        AdminPermission.VIEW_AUDIT_LOGS,
        AdminPermission.MANAGE_CONTENT,
        AdminPermission.MANAGE_FEATURES,
    ],
    AdminRole.SUPPORT: [
        # Support staff can manage users and support tickets
        AdminPermission.READ_USERS,
        AdminPermission.MANAGE_USERS,
        AdminPermission.VIEW_SANDBOXES,
        AdminPermission.VIEW_SUPPORT,
        AdminPermission.MANAGE_SUPPORT,
        AdminPermission.MANAGE_CONTENT,
    ],
    AdminRole.VIEWER: [
        # Viewers can only read data
        AdminPermission.READ_USERS,
        AdminPermission.VIEW_SANDBOXES,
        AdminPermission.VIEW_SYSTEM,
        AdminPermission.VIEW_BILLING,
        AdminPermission.VIEW_SUPPORT,
        AdminPermission.VIEW_AUDIT_LOGS,
    ]
}

class AdminAuthService:
    """Service for admin authentication and authorization"""
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    @staticmethod
    def create_admin_access_token(admin_user: AdminUser) -> str:
        """Create JWT access token for admin user"""
        to_encode = {
            "sub": str(admin_user.id),
            "email": admin_user.email,
            "role": admin_user.role.value,
            "type": "admin",
            "exp": datetime.utcnow() + timedelta(hours=8)  # Admin tokens expire in 8 hours
        }
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    
    @staticmethod
    def authenticate_admin(db: Session, email: str, password: str) -> Optional[AdminUser]:
        """Authenticate admin user with email and password"""
        admin_user = db.query(AdminUser).filter(
            AdminUser.email == email,
            AdminUser.is_active == True
        ).first()
        
        if not admin_user:
            return None
        
        if not AdminAuthService.verify_password(password, admin_user.hashed_password):
            return None
        
        # Update last login
        admin_user.last_login = datetime.utcnow()
        db.commit()
        
        return admin_user
    
    @staticmethod
    def has_permission(admin_user: AdminUser, permission: AdminPermission) -> bool:
        """Check if admin user has specific permission"""
        user_permissions = ROLE_PERMISSIONS.get(admin_user.role, [])
        return permission in user_permissions
    
    @staticmethod
    def get_user_permissions(admin_user: AdminUser) -> List[AdminPermission]:
        """Get all permissions for admin user"""
        return ROLE_PERMISSIONS.get(admin_user.role, [])

async def get_current_admin_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> AdminUser:
    """Get current authenticated admin user from JWT token"""
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate admin credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=["HS256"])
        admin_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if admin_id is None or token_type != "admin":
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    
    admin_user = db.query(AdminUser).filter(
        AdminUser.id == int(admin_id),
        AdminUser.is_active == True
    ).first()
    
    if admin_user is None:
        raise credentials_exception
    
    return admin_user

def require_admin_permission(permission: AdminPermission):
    """Decorator to require specific admin permission"""
    
    def permission_checker(
        current_admin: AdminUser = Depends(get_current_admin_user)
    ) -> AdminUser:
        if not AdminAuthService.has_permission(current_admin, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {permission.value}"
            )
        return current_admin
    
    return permission_checker

def require_admin_role(required_role: AdminRole):
    """Decorator to require specific admin role or higher"""
    
    # Define role hierarchy (higher number = more permissions)
    role_hierarchy = {
        AdminRole.VIEWER: 1,
        AdminRole.SUPPORT: 2,
        AdminRole.ADMIN: 3,
        AdminRole.SUPER_ADMIN: 4
    }
    
    def role_checker(
        current_admin: AdminUser = Depends(get_current_admin_user)
    ) -> AdminUser:
        user_level = role_hierarchy.get(current_admin.role, 0)
        required_level = role_hierarchy.get(required_role, 999)
        
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient role. Required: {required_role.value} or higher"
            )
        return current_admin
    
    return role_checker

# Alias for backward compatibility
require_permission = require_admin_permission

# Admin login endpoint
from fastapi import APIRouter
from app.schemas.admin_schemas import AdminUserResponse

admin_auth_router = APIRouter()

@admin_auth_router.post("/admin/login")
async def admin_login(
    email: str,
    password: str,
    db: Session = Depends(get_db)
):
    """Admin login endpoint"""
    
    admin_user = AdminAuthService.authenticate_admin(db, email, password)
    if not admin_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = AdminAuthService.create_admin_access_token(admin_user)
    permissions = AdminAuthService.get_user_permissions(admin_user)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "admin_user": AdminUserResponse(
            id=admin_user.id,
            email=admin_user.email,
            full_name=admin_user.full_name,
            role=admin_user.role,
            is_active=admin_user.is_active,
            last_login=admin_user.last_login,
            created_at=admin_user.created_at
        ),
        "permissions": [p.value for p in permissions]
    }

@admin_auth_router.get("/admin/me", response_model=AdminUserResponse)
async def get_current_admin_profile(
    current_admin: AdminUser = Depends(get_current_admin_user)
):
    """Get current admin user profile"""
    return AdminUserResponse(
        id=current_admin.id,
        email=current_admin.email,
        full_name=current_admin.full_name,
        role=current_admin.role,
        is_active=current_admin.is_active,
        last_login=current_admin.last_login,
        created_at=current_admin.created_at
    )

@admin_auth_router.post("/admin/logout")
async def admin_logout(
    current_admin: AdminUser = Depends(get_current_admin_user)
):
    """Admin logout endpoint (client should discard token)"""
    return {"message": "Successfully logged out"}
