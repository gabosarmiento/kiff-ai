"""
Multi-Tenant FastAPI Middleware
Handles tenant resolution and request routing for schema-per-tenant architecture
"""

from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging
from typing import Optional

from app.core.multi_tenant_db import mt_db_manager, TenantMiddleware, TenantStatus

logger = logging.getLogger(__name__)

class MultiTenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle multi-tenant request routing and tenant resolution
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.excluded_paths = {
            "/docs", "/redoc", "/openapi.json", "/health",
            "/api/admin", "/api/tenant-management", "/api/resolve-tenant",
            "/api/auth",  # Allow admin login without tenant context
            "/api/kiff",  # Bypass multi-tenancy for kiff MVP
            "/api/gallery",  # Bypass multi-tenancy for API Gallery testing
            "/api/stripe-subscription",  # Bypass multi-tenancy for Stripe payments
            "/api/agno-chat"  # Bypass multi-tenancy for AGNO agent chat
        }
    
    async def dispatch(self, request: Request, call_next):
        # Skip tenant resolution for excluded paths
        if any(request.url.path.startswith(path) for path in self.excluded_paths):
            return await call_next(request)
        
        # Skip for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        try:
            logger.info(f"Processing request: {request.method} {request.url.path}")
            
            # Resolve tenant from request
            tenant_id = TenantMiddleware.get_tenant_from_request(request)
            logger.info(f"Resolved tenant_id: {tenant_id}")
            
            # Handle admin users with global access (tenant_id = "*")
            if tenant_id == "*":
                logger.info("Admin user with global tenant access - bypassing tenant validation")
                request.state.tenant_id = "*"
                request.state.tenant_info = {
                    "id": "*",
                    "name": "Global Admin Access",
                    "slug": "admin",
                    "status": "active",
                    "is_admin": True
                }
                response = await call_next(request)
                response.headers["X-Tenant-ID"] = "*"
                return response
            
            if not tenant_id:
                # For API endpoints that require tenant context
                if request.url.path.startswith("/api/"):
                    logger.warning(f"No tenant context for API endpoint: {request.url.path}")
                    return JSONResponse(
                        status_code=400,
                        content={
                            "detail": "Tenant not specified. Use subdomain, X-Tenant-ID header, or /tenant/{slug} path prefix."
                        }
                    )
                # For non-API requests, continue without tenant context
                logger.info("No tenant context, continuing without tenant")
                return await call_next(request)
            
            # Validate tenant exists and is active
            logger.info(f"Looking up tenant info for: {tenant_id}")
            tenant_info = mt_db_manager.get_tenant_info(tenant_id)
            logger.info(f"Tenant info result: {tenant_info}")
            
            if not tenant_info:
                logger.error(f"Tenant not found: {tenant_id}")
                return JSONResponse(
                    status_code=404,
                    content={"detail": "Tenant not found"}
                )
            
            if tenant_info["status"] == TenantStatus.SUSPENDED.value:
                logger.warning(f"Tenant suspended: {tenant_id}")
                return JSONResponse(
                    status_code=403,
                    content={
                        "detail": "Tenant account is suspended. Please contact support.",
                        "tenant_slug": tenant_info["slug"]
                    }
                )
            
            if tenant_info["status"] == TenantStatus.ARCHIVED.value:
                logger.warning(f"Tenant archived: {tenant_id}")
                return JSONResponse(
                    status_code=410,
                    content={
                        "detail": "Tenant account has been archived.",
                        "tenant_slug": tenant_info["slug"]
                    }
                )
            
            # Add tenant context to request state
            logger.info(f"Adding tenant context to request state")
            request.state.tenant_id = tenant_id
            request.state.tenant_info = tenant_info
            
            # Add tenant headers to response
            logger.info(f"Calling next middleware/handler")
            response = await call_next(request)
            logger.info(f"Got response, adding tenant headers")
            
            response.headers["X-Tenant-ID"] = tenant_id
            response.headers["X-Tenant-Slug"] = tenant_info["slug"]
            
            logger.info(f"Returning response with tenant context")
            return response
            
        except Exception as e:
            logger.error(f"Error in tenant middleware: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return JSONResponse(
                status_code=500,
                content={"detail": f"Internal server error in tenant resolution: {str(e)}"}
            )

class TenantContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware to inject tenant context into database sessions
    """
    
    async def dispatch(self, request: Request, call_next):
        # Set tenant context for database operations
        tenant_id = getattr(request.state, 'tenant_id', None)
        
        if tenant_id:
            # Store tenant ID in context for database session dependency
            import contextvars
            tenant_context = contextvars.ContextVar('tenant_id', default=None)
            tenant_context.set(tenant_id)
            
            # Add to request for easy access
            request.state.db_tenant_id = tenant_id
        
        return await call_next(request)

# Dependency to get current tenant from request
def get_current_tenant(request: Request) -> Optional[dict]:
    """Get current tenant info from request state"""
    return getattr(request.state, 'tenant_info', None)

def get_current_tenant_id(request: Request) -> Optional[str]:
    """Get current tenant ID from request state"""
    return getattr(request.state, 'tenant_id', None)

def require_tenant(request: Request) -> dict:
    """Require tenant context (raise exception if not found)"""
    tenant_info = get_current_tenant(request)
    if not tenant_info:
        raise HTTPException(
            status_code=400,
            detail="Tenant context required for this operation"
        )
    return tenant_info

# Tenant-aware database session dependency
def get_tenant_db(request: Request):
    """Get tenant-specific database session"""
    tenant_id = get_current_tenant_id(request)
    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context required for database operations"
        )
    
    with mt_db_manager.get_tenant_session(tenant_id) as session:
        try:
            yield session
        finally:
            session.close()

# Rate limiting per tenant
class TenantRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware with per-tenant limits
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.rate_limits = {}  # tenant_id -> rate limit tracker
    
    async def dispatch(self, request: Request, call_next):
        tenant_id = getattr(request.state, 'tenant_id', None)
        
        if tenant_id:
            # Check tenant-specific rate limits
            tenant_info = getattr(request.state, 'tenant_info', {})
            resource_limits = tenant_info.get('resource_limits', {})
            
            # Implement rate limiting logic based on tenant tier
            # This is a placeholder - implement with Redis or similar
            pass
        
        return await call_next(request)

# Usage tracking middleware
class TenantUsageTrackingMiddleware(BaseHTTPMiddleware):
    """
    Track API usage per tenant for billing and analytics
    """
    
    async def dispatch(self, request: Request, call_next):
        tenant_id = getattr(request.state, 'tenant_id', None)
        start_time = None
        
        if tenant_id and request.url.path.startswith("/api/"):
            import time
            start_time = time.time()
        
        response = await call_next(request)
        
        if tenant_id and start_time and request.url.path.startswith("/api/"):
            # Track usage asynchronously
            import asyncio
            asyncio.create_task(
                self._track_usage(tenant_id, request, response, start_time)
            )
        
        return response
    
    async def _track_usage(self, tenant_id: str, request: Request, 
                          response: Response, start_time: float):
        """Track API usage for tenant"""
        try:
            import time
            from datetime import datetime
            
            duration = time.time() - start_time
            
            # Create usage record
            with mt_db_manager.get_tenant_session(tenant_id) as session:
                from app.models.models import UsageRecord
                
                usage_record = UsageRecord(
                    user_id=getattr(request.state, 'current_user_id', None),
                    resource_type="api_call",
                    tokens_used=0,  # Calculate based on request/response size
                    api_calls=1,
                    additional_data={
                        "method": request.method,
                        "path": request.url.path,
                        "resource_name": f"{request.method} {request.url.path}",
                        "status_code": response.status_code,
                        "duration_ms": round(duration * 1000, 2),
                        "user_agent": request.headers.get("user-agent", ""),
                        "ip_address": request.client.host if request.client else None
                    }
                )
                
                session.add(usage_record)
                session.commit()
                
        except Exception as e:
            logger.error(f"Error tracking usage for tenant {tenant_id}: {e}")

# Security middleware for tenant isolation
class TenantSecurityMiddleware(BaseHTTPMiddleware):
    """
    Additional security checks for tenant isolation
    """
    
    async def dispatch(self, request: Request, call_next):
        tenant_id = getattr(request.state, 'tenant_id', None)
        
        if tenant_id:
            # Add security headers
            response = await call_next(request)
            
            # Prevent tenant data leakage
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            
            # Add tenant-specific CSP if needed
            tenant_info = getattr(request.state, 'tenant_info', {})
            if tenant_info.get('settings', {}).get('strict_csp', False):
                response.headers["Content-Security-Policy"] = "default-src 'self'"
            
            return response
        
        return await call_next(request)

# Health check for tenant database connections
async def check_tenant_health(tenant_id: str) -> dict:
    """Check health of tenant database connection"""
    try:
        with mt_db_manager.get_tenant_session(tenant_id) as session:
            # Simple query to test connection
            result = session.execute("SELECT 1").fetchone()
            
            if result:
                return {
                    "tenant_id": tenant_id,
                    "database_status": "healthy",
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                return {
                    "tenant_id": tenant_id,
                    "database_status": "unhealthy",
                    "error": "Query returned no results",
                    "timestamp": datetime.utcnow().isoformat()
                }
                
    except Exception as e:
        return {
            "tenant_id": tenant_id,
            "database_status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
