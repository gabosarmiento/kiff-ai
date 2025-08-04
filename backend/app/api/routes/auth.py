from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from datetime import datetime, timedelta
from typing import Optional
import secrets
import logging

from app.core.database import get_db
from app.core.auth import (
    authenticate_user, 
    create_user_token, 
    get_password_hash, 
    verify_password,
    get_current_user
)
from app.core.multi_tenant_db import mt_db_manager
from app.models.models import User
from app.services.email_service import email_service
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    PasswordResetRequest,
    PasswordResetConfirm,
    EmailVerificationRequest,
    UserProfileUpdate
)
from sqlalchemy import select

router = APIRouter()
logger = logging.getLogger(__name__)


async def ensure_user_has_tenant(user: User) -> str:
    """Ensure user has appropriate tenant access based on role"""
    try:
        # Admin and superadmin users should have access to all tenants, not isolated workspaces
        if user.role in ['admin', 'superadmin']:
            logger.info(f"Admin user {user.email} ({user.role}) - no isolated tenant needed")
            # Return a special marker for admin users to indicate global access
            return "*"  # Special value indicating admin access to all tenants
        
        # For regular users, check if they already have a tenant
        with mt_db_manager.master_engine.connect() as conn:
            from sqlalchemy import text
            result = conn.execute(text("""
                SELECT t.id FROM tenants t 
                JOIN tenant_users tu ON t.id = tu.tenant_id 
                WHERE tu.user_id = :user_id
            """), {"user_id": user.id})
            
            existing_tenant = result.fetchone()
            if existing_tenant:
                logger.info(f"User {user.email} already has tenant: {existing_tenant[0]}")
                return str(existing_tenant[0])
        
        # Create new tenant for user
        logger.info(f"Creating new tenant for user: {user.email}")
        
        # Generate tenant name and slug from user info
        tenant_name = f"{user.full_name or user.username}'s Workspace"
        tenant_slug = f"user-{user.id}-{user.username.lower().replace('_', '-')}"
        
        # Create tenant using the multi-tenant manager
        tenant_info = await mt_db_manager.create_tenant(
            name=tenant_name,
            slug=tenant_slug,
            admin_email=user.email
        )
        
        tenant_id = tenant_info["tenant_id"]
        
        # Associate user with the new tenant
        with mt_db_manager.master_engine.connect() as conn:
            from sqlalchemy import text
            conn.execute(text("""
                INSERT INTO tenant_users (tenant_id, user_id, role, joined_at)
                VALUES (:tenant_id, :user_id, :role, NOW())
                ON CONFLICT (tenant_id, user_id) DO NOTHING
            """), {
                "tenant_id": tenant_id,
                "user_id": user.id,
                "role": "admin"  # User is admin of their own workspace
            })
            conn.commit()
        
        logger.info(f"Created tenant {tenant_id} for user {user.email}")
        return tenant_id
        
    except Exception as e:
        logger.error(f"Error ensuring tenant for user {user.email}: {e}")
        # Fallback: try to find any existing tenant or create a simple one
        try:
            # Try to find default tenant as fallback
            with mt_db_manager.master_engine.connect() as conn:
                from sqlalchemy import text
                result = conn.execute(text("SELECT id FROM tenants WHERE slug = 'default' LIMIT 1"))
                default_tenant = result.fetchone()
                if default_tenant:
                    return str(default_tenant[0])
        except:
            pass
        
        # If all else fails, raise the original error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user workspace"
        )

@router.post("/register", response_model=dict)
async def register_user(
    user_data: UserRegister,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user with email verification"""
    try:
        # Check if user already exists
        result = await db.execute(
            select(User).filter(
                (User.email == user_data.email) | (User.username == user_data.username)
            )
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            if existing_user.email == user_data.email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )
        
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        verification_token = secrets.token_urlsafe(32)
        
        user = User(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            is_active=True,
            is_verified=False,
            role='user',
            created_at=datetime.utcnow(),
            settings={
                "verification_token": verification_token,
                "verification_expires": (datetime.utcnow() + timedelta(hours=24)).isoformat()
            }
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        # Send welcome email with verification
        try:
            await email_service.send_welcome_email(
                user_email=user.email,
                user_name=user.full_name or user.username,
                verification_token=verification_token
            )
        except Exception as e:
            logger.warning(f"Failed to send welcome email to {user.email}: {str(e)}")
        
        return {
            "status": "success",
            "message": "User registered successfully. Please check your email to verify your account.",
            "data": {
                "user_id": user.id,
                "email": user.email,
                "username": user.username,
                "verification_required": True
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/login", response_model=TokenResponse)
async def login_user(
    user_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and return access token"""
    try:
        user = await authenticate_user(db, user_data.email, user_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is deactivated"
            )
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()
        
        # Ensure user has a tenant (automatic tenant creation for SaaS isolation)
        tenant_id = await ensure_user_has_tenant(user)
        
        # Create access token with tenant information
        token_data = create_user_token(user)
        
        # Add tenant information to the response
        token_response = TokenResponse(**token_data)
        token_response.tenant_id = tenant_id  # Add tenant_id to response
        
        return token_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/verify-email", response_model=dict)
async def verify_email(
    verification_data: EmailVerificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """Verify user email address"""
    try:
        # Find user with verification token
        result = await db.execute(select(User).filter(User.is_verified == False))
        users = result.scalars().all()
        user = None
        
        for u in users:
            if u.settings and u.settings.get("verification_token") == verification_data.token:
                # Check if token is expired
                expires_str = u.settings.get("verification_expires")
                if expires_str:
                    expires = datetime.fromisoformat(expires_str)
                    if datetime.utcnow() > expires:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Verification token has expired"
                        )
                user = u
                break
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token"
            )
        
        # Verify the user
        user.is_verified = True
        if user.settings:
            user.settings.pop("verification_token", None)
            user.settings.pop("verification_expires", None)
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Email verified successfully",
            "data": {
                "user_id": user.id,
                "email": user.email,
                "verified": True
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email verification failed"
        )

@router.post("/password-reset-request", response_model=dict)
async def request_password_reset(
    reset_data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    """Request password reset email"""
    try:
        result = await db.execute(select(User).filter(User.email == reset_data.email))
        user = result.scalar_one_or_none()
        
        # Always return success to prevent email enumeration
        if not user:
            return {
                "status": "success",
                "message": "If the email exists, a password reset link has been sent."
            }
        
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        reset_expires = datetime.utcnow() + timedelta(hours=1)
        
        # Update user settings
        if not user.settings:
            user.settings = {}
        
        user.settings["reset_token"] = reset_token
        user.settings["reset_expires"] = reset_expires.isoformat()
        
        db.commit()
        
        # Send password reset email
        try:
            await email_service.send_password_reset_email(
                user_email=user.email,
                user_name=user.full_name or user.username,
                reset_token=reset_token
            )
        except Exception as e:
            logger.warning(f"Failed to send password reset email to {user.email}: {str(e)}")
        
        return {
            "status": "success",
            "message": "If the email exists, a password reset link has been sent."
        }
        
    except Exception as e:
        logger.error(f"Password reset request error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset request failed"
        )

@router.post("/password-reset-confirm", response_model=dict)
async def confirm_password_reset(
    reset_data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db)
):
    """Confirm password reset with token"""
    try:
        # Find user with reset token
        result = await db.execute(select(User))
        users = result.scalars().all()
        user = None
        
        for u in users:
            if u.settings and u.settings.get("reset_token") == reset_data.token:
                # Check if token is expired
                expires_str = u.settings.get("reset_expires")
                if expires_str:
                    expires = datetime.fromisoformat(expires_str)
                    if datetime.utcnow() > expires:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Reset token has expired"
                        )
                user = u
                break
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token"
            )
        
        # Update password
        user.hashed_password = get_password_hash(reset_data.new_password)
        
        # Clear reset token
        if user.settings:
            user.settings.pop("reset_token", None)
            user.settings.pop("reset_expires", None)
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Password reset successfully",
            "data": {
                "user_id": user.id,
                "email": user.email
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset confirmation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed"
        )

@router.get("/me", response_model=dict)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information"""
    return {
        "status": "success",
        "data": {
            "id": current_user.id,
            "email": current_user.email,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "role": current_user.role,
            "is_active": current_user.is_active,
            "is_verified": current_user.is_verified,
            "created_at": current_user.created_at.isoformat(),
            "last_login": current_user.last_login.isoformat() if current_user.last_login else None
        }
    }

@router.patch("/update-profile", response_model=dict)
async def update_user_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user profile information"""
    try:
        # Email changes are not allowed - it's the account identifier
        if profile_data.email and profile_data.email != current_user.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email cannot be changed as it's the account identifier"
            )
        
        # Check if username is being updated and if it's already taken
        if profile_data.username and profile_data.username != current_user.username:
            result = await db.execute(
                select(User).filter(User.username == profile_data.username, User.id != current_user.id)
            )
            existing_user = result.scalar_one_or_none()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )
        
        # Update user fields (only full_name and username allowed)
        if profile_data.full_name is not None:
            current_user.full_name = profile_data.full_name
        
        if profile_data.username is not None:
            current_user.username = profile_data.username
        
        if profile_data.settings is not None:
            if current_user.settings:
                current_user.settings.update(profile_data.settings)
            else:
                current_user.settings = profile_data.settings
        
        current_user.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(current_user)
        
        return {
            "status": "success",
            "message": "Profile updated successfully",
            "data": {
                "id": current_user.id,
                "email": current_user.email,
                "username": current_user.username,
                "full_name": current_user.full_name,
                "role": current_user.role,
                "is_active": current_user.is_active,
                "is_verified": current_user.is_verified,
                "created_at": current_user.created_at.isoformat(),
                "updated_at": current_user.updated_at.isoformat() if current_user.updated_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Profile update error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update failed"
        )

@router.delete("/delete-account", response_model=dict)
async def delete_user_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete current user account and all associated data"""
    try:
        # Check if user is an admin - prevent deletion of admin accounts via this endpoint
        if current_user.role in ['admin', 'superadmin']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin accounts cannot be deleted via this endpoint"
            )
        
        # TODO: Add cleanup of user-related data:
        # - User's agents
        # - User's applications
        # - User's tenant data
        # - File uploads
        # - Any other associated resources
        
        # For now, we'll just deactivate the account to prevent data loss
        # In a production system, you'd want to implement a proper deletion workflow
        current_user.is_active = False
        current_user.email = f"deleted_{current_user.id}_{current_user.email}"
        current_user.username = f"deleted_{current_user.id}_{current_user.username}"
        current_user.updated_at = datetime.utcnow()
        
        # Add deletion timestamp to settings
        if not current_user.settings:
            current_user.settings = {}
        current_user.settings["deleted_at"] = datetime.utcnow().isoformat()
        current_user.settings["deletion_reason"] = "user_requested"
        
        await db.commit()
        
        return {
            "status": "success",
            "message": "Account has been successfully deleted",
            "data": {
                "deleted_at": datetime.utcnow().isoformat(),
                "user_id": current_user.id
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Account deletion error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account deletion failed"
        )
