"""
Real Account Management API Routes for TradeForge AI
Production-ready user registration, verification, and lifecycle management
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import logging

from app.core.database import get_db
from app.core.auth import get_current_user
from app.services.real_account_service import account_service
from app.models.models import User

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

# ============================================================================
# REQUEST/RESPONSE SCHEMAS
# ============================================================================

class UserRegistrationRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=100)
    marketing_consent: bool = Field(default=False)

class EmailVerificationRequest(BaseModel):
    token: str = Field(..., min_length=1)

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)

class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=500)
    settings: Optional[Dict[str, Any]] = None

class AccountDeletionRequest(BaseModel):
    password: str = Field(..., min_length=1)
    reason: Optional[str] = Field(None, max_length=500)

class ResendVerificationRequest(BaseModel):
    email: EmailStr

# Response Models
class UserProfileResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    avatar_url: Optional[str]
    is_active: bool
    is_verified: bool
    settings: Dict[str, Any]
    created_at: str
    last_login: Optional[str]
    email_verified_at: Optional[str]
    subscription: Dict[str, Any]
    usage_stats: Dict[str, Any]

class RegistrationResponse(BaseModel):
    user_id: int
    email: EmailStr
    message: str
    verification_required: bool

class StandardResponse(BaseModel):
    message: str

# ============================================================================
# REGISTRATION & VERIFICATION ENDPOINTS
# ============================================================================

@router.post("/register", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    registration_data: UserRegistrationRequest,
    background_tasks: BackgroundTasks
):
    """Register a new user account with email verification"""
    try:
        result = await account_service.register_user(
            email=registration_data.email,
            password=registration_data.password,
            full_name=registration_data.full_name,
            marketing_consent=registration_data.marketing_consent
        )
        
        return RegistrationResponse(**result)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/verify-email", response_model=StandardResponse)
async def verify_email(verification_data: EmailVerificationRequest):
    """Verify user email with token"""
    try:
        result = await account_service.verify_email(verification_data.token)
        return StandardResponse(message=result["message"])
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Email verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email verification failed"
        )

@router.post("/resend-verification", response_model=StandardResponse)
async def resend_verification_email(resend_data: ResendVerificationRequest):
    """Resend email verification"""
    try:
        result = await account_service.resend_verification_email(resend_data.email)
        return StandardResponse(message=result["message"])
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Resend verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resend verification email"
        )

# ============================================================================
# PASSWORD MANAGEMENT ENDPOINTS
# ============================================================================

@router.post("/request-password-reset", response_model=StandardResponse)
async def request_password_reset(reset_request: PasswordResetRequest):
    """Request password reset"""
    try:
        result = await account_service.request_password_reset(reset_request.email)
        return StandardResponse(message=result["message"])
        
    except Exception as e:
        logger.error(f"Password reset request error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process password reset request"
        )

@router.post("/reset-password", response_model=StandardResponse)
async def reset_password(reset_data: PasswordResetConfirmRequest):
    """Reset password with token"""
    try:
        result = await account_service.reset_password(
            token=reset_data.token,
            new_password=reset_data.new_password
        )
        return StandardResponse(message=result["message"])
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Password reset error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed"
        )

@router.post("/change-password", response_model=StandardResponse)
async def change_password(
    password_data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user)
):
    """Change password with current password verification"""
    try:
        result = await account_service.change_password(
            user_id=current_user.id,
            current_password=password_data.current_password,
            new_password=password_data.new_password
        )
        return StandardResponse(message=result["message"])
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Password change error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )

# ============================================================================
# PROFILE MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/profile", response_model=UserProfileResponse)
async def get_user_profile(current_user: User = Depends(get_current_user)):
    """Get comprehensive user profile"""
    try:
        profile = await account_service.get_user_profile(current_user.id)
        return UserProfileResponse(**profile)
        
    except Exception as e:
        logger.error(f"Get profile error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve profile"
        )

@router.put("/profile", response_model=StandardResponse)
async def update_user_profile(
    profile_data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Update user profile information"""
    try:
        # Convert to dict and remove None values
        updates = {k: v for k, v in profile_data.dict().items() if v is not None}
        
        result = await account_service.update_user_profile(
            user_id=current_user.id,
            updates=updates
        )
        return StandardResponse(message=result["message"])
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Profile update error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update failed"
        )

# ============================================================================
# USAGE & ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/usage-summary")
async def get_usage_summary(
    days: int = 30,
    current_user: User = Depends(get_current_user)
):
    """Get detailed usage summary"""
    try:
        if days < 1 or days > 365:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Days must be between 1 and 365"
            )
        
        summary = await account_service.get_usage_summary(
            user_id=current_user.id,
            days=days
        )
        return summary
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Usage summary error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve usage summary"
        )

@router.post("/track-usage")
async def track_usage(
    resource_type: str,
    tokens_used: int = 0,
    api_calls: int = 0,
    metadata: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user)
):
    """Track resource usage (internal endpoint)"""
    try:
        await account_service.track_usage(
            user_id=current_user.id,
            resource_type=resource_type,
            tokens_used=tokens_used,
            api_calls=api_calls,
            metadata=metadata
        )
        return {"message": "Usage tracked successfully"}
        
    except Exception as e:
        logger.error(f"Usage tracking error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to track usage"
        )

# ============================================================================
# ACCOUNT DELETION ENDPOINTS (GDPR COMPLIANCE)
# ============================================================================

@router.post("/request-deletion")
async def request_account_deletion(
    deletion_data: AccountDeletionRequest,
    current_user: User = Depends(get_current_user)
):
    """Request account deletion with 30-day grace period"""
    try:
        result = await account_service.request_account_deletion(
            user_id=current_user.id,
            password=deletion_data.password,
            reason=deletion_data.reason
        )
        return result
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Account deletion request error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process deletion request"
        )

@router.post("/cancel-deletion", response_model=StandardResponse)
async def cancel_account_deletion(current_user: User = Depends(get_current_user)):
    """Cancel pending account deletion"""
    try:
        result = await account_service.cancel_account_deletion(current_user.id)
        return StandardResponse(message=result["message"])
        
    except Exception as e:
        logger.error(f"Cancel deletion error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel deletion"
        )

# ============================================================================
# ACCOUNT STATUS ENDPOINTS
# ============================================================================

@router.get("/status")
async def get_account_status(current_user: User = Depends(get_current_user)):
    """Get account status and verification state"""
    try:
        return {
            "user_id": current_user.id,
            "email": current_user.email,
            "is_active": current_user.is_active,
            "is_verified": current_user.is_verified,
            "email_verified_at": current_user.email_verified_at.isoformat() if current_user.email_verified_at else None,
            "created_at": current_user.created_at.isoformat(),
            "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
            "deletion_requested": current_user.deletion_requested_at is not None,
            "deletion_date": (current_user.deletion_requested_at + timedelta(days=30)).isoformat() if current_user.deletion_requested_at else None
        }
        
    except Exception as e:
        logger.error(f"Account status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve account status"
        )

# ============================================================================
# HEALTH CHECK ENDPOINT
# ============================================================================

@router.get("/health")
async def account_service_health():
    """Health check for account service"""
    return {
        "status": "healthy",
        "service": "account_management",
        "timestamp": datetime.utcnow().isoformat()
    }

# ============================================================================
# BACKGROUND TASKS
# ============================================================================

async def cleanup_expired_tokens():
    """Background task to cleanup expired tokens"""
    try:
        current_time = datetime.utcnow()
        
        # Clean up expired password reset tokens
        expired_tokens = []
        for token, data in account_service.password_reset_tokens.items():
            if current_time > data["expires_at"]:
                expired_tokens.append(token)
        
        for token in expired_tokens:
            del account_service.password_reset_tokens[token]
        
        if expired_tokens:
            logger.info(f"Cleaned up {len(expired_tokens)} expired password reset tokens")
            
    except Exception as e:
        logger.error(f"Token cleanup error: {e}")

async def process_pending_deletions():
    """Background task to process accounts marked for deletion"""
    try:
        from datetime import timedelta
        
        db = next(get_db())
        
        # Find accounts that should be deleted (30 days after request)
        deletion_cutoff = datetime.utcnow() - timedelta(days=30)
        
        users_to_delete = db.query(User).filter(
            User.deletion_requested_at <= deletion_cutoff
        ).all()
        
        for user in users_to_delete:
            try:
                await account_service.permanently_delete_account(user.id)
                logger.info(f"Automatically deleted expired account: {user.email}")
            except Exception as e:
                logger.error(f"Failed to auto-delete account {user.id}: {e}")
        
        db.close()
        
    except Exception as e:
        logger.error(f"Pending deletions processing error: {e}")

# Import datetime for background tasks
from datetime import datetime, timedelta
