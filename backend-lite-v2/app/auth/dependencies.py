"""
Authentication dependencies for the backend
"""

from fastapi import HTTPException, Header, Depends
from typing import Optional


class MockUser:
    """Mock user for development"""
    def __init__(self, user_id: str = "user_123", tenant_id: str = "tenant_123", is_admin: bool = False):
        self.id = user_id
        self.tenant_id = tenant_id
        self.is_admin = is_admin


async def get_current_user(
    authorization: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")
) -> MockUser:
    """
    Get current user from authorization header
    This is a simplified implementation for development
    """
    
    # For development, return a mock user
    # In production, you would validate the token and get real user data
    if not x_tenant_id:
        x_tenant_id = "tenant_123"  # Default tenant for development
    
    return MockUser(
        user_id="user_123",
        tenant_id=x_tenant_id,
        is_admin=True  # For development, make all users admin
    )


async def require_auth(current_user: MockUser = Depends(get_current_user)) -> MockUser:
    """Require authenticated user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return current_user


# For backwards compatibility
async def require_admin(current_user: MockUser = Depends(get_current_user)) -> MockUser:
    """Require admin user (simplified for development)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # For development, all users are admin
    # In production, check current_user.is_admin
    return current_user