"""
Account Management API Routes
Handles user registration, profile management, secure deletion, and usage tracking
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Dict, Any, Optional
import logging

from app.services.account_service import AccountService
from app.core.security import verify_token

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

# Pydantic models for request/response
class UserRegistration(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class AccountDeletion(BaseModel):
    password: str
    confirmation: str = "DELETE"

# Dependency to get current user
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Get current authenticated user"""
    user_id = verify_token(credentials.credentials)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    return user_id

# Initialize account service
account_service = AccountService()

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserRegistration):
    """Register a new user account"""
    try:
        result = await account_service.create_user(
            email=user_data.email,
            username=user_data.username,
            password=user_data.password,
            full_name=user_data.full_name
        )
        return {
            "message": "User account created successfully",
            "user": result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create user account")

@router.get("/profile")
async def get_profile(current_user: str = Depends(get_current_user)):
    """Get current user profile with usage statistics"""
    try:
        profile = await account_service.get_user_profile(current_user)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Profile retrieval error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve profile")

@router.put("/profile")
async def update_profile(
    updates: UserProfileUpdate,
    current_user: str = Depends(get_current_user)
):
    """Update user profile information"""
    try:
        updated_profile = await account_service.update_user_profile(
            current_user, 
            updates.dict(exclude_unset=True)
        )
        return {
            "message": "Profile updated successfully",
            "user": updated_profile
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Profile update error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")

@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: str = Depends(get_current_user)
):
    """Change user password"""
    try:
        success = await account_service.change_password(
            current_user,
            password_data.current_password,
            password_data.new_password
        )
        return {"message": "Password changed successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Password change error: {e}")
        raise HTTPException(status_code=500, detail="Failed to change password")

@router.get("/usage")
async def get_usage_summary(
    days: int = 30,
    current_user: str = Depends(get_current_user)
):
    """Get detailed usage summary for the user"""
    try:
        usage_summary = await account_service.get_usage_summary(current_user, days)
        return usage_summary
    except Exception as e:
        logger.error(f"Usage summary error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve usage summary")

@router.post("/track-usage")
async def track_usage(
    resource_type: str,
    tokens_used: int = 0,
    api_calls: int = 0,
    metadata: Optional[Dict[str, Any]] = None,
    current_user: str = Depends(get_current_user)
):
    """Track resource usage for the current user"""
    try:
        await account_service.track_usage(
            current_user,
            resource_type,
            tokens_used,
            api_calls,
            metadata
        )
        return {"message": "Usage tracked successfully"}
    except Exception as e:
        logger.error(f"Usage tracking error: {e}")
        raise HTTPException(status_code=500, detail="Failed to track usage")

@router.delete("/delete-account")
async def delete_account(
    deletion_data: AccountDeletion,
    current_user: str = Depends(get_current_user)
):
    """Securely delete user account and all associated data"""
    try:
        # Verify confirmation
        if deletion_data.confirmation != "DELETE":
            raise HTTPException(
                status_code=400, 
                detail="Account deletion requires confirmation field to be 'DELETE'"
            )
        
        result = await account_service.delete_account(
            current_user,
            deletion_data.password
        )
        
        return {
            "message": "Account deleted successfully",
            "deletion_summary": result
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Account deletion error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account")

@router.get("/usage/export")
async def export_usage_data(
    format: str = "json",
    current_user: str = Depends(get_current_user)
):
    """Export user usage data (for GDPR compliance)"""
    try:
        if format not in ["json", "csv"]:
            raise HTTPException(status_code=400, detail="Format must be 'json' or 'csv'")
        
        # Get comprehensive usage data
        usage_data = await account_service.get_usage_summary(current_user, days=365)  # Full year
        
        return {
            "format": format,
            "export_timestamp": "2024-01-01T00:00:00Z",  # Current timestamp
            "user_id": current_user,
            "data": usage_data
        }
        
    except Exception as e:
        logger.error(f"Usage export error: {e}")
        raise HTTPException(status_code=500, detail="Failed to export usage data")
