"""
Vercel-optimized FastAPI application
Simplified version without WebSocket and background tasks for serverless deployment
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import logging
import os

from app.core.config_vercel import vercel_settings
from app.core.database_vercel import check_database_health

# Import only essential routes for Vercel deployment
try:
    from app.api.routes import auth, health
    auth_available = True
except ImportError as e:
    logger.warning(f"Auth routes not available: {e}")
    auth_available = False

try:
    from app.api.routes import accounts
    accounts_available = True
except ImportError as e:
    logger.warning(f"Accounts routes not available: {e}")
    accounts_available = False

# Simplified middleware - exclude complex tenant middleware for now
try:
    from app.middleware.tenant_middleware import MultiTenantMiddleware
    tenant_middleware_available = True
except ImportError as e:
    logger.warning(f"Tenant middleware not available: {e}")
    tenant_middleware_available = False

# Configure logging for Vercel
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app - Simplified for Vercel
app = FastAPI(
    title="Kiff AI API",
    description="AI-powered application generation platform API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=vercel_settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add simplified middleware
if tenant_middleware_available:
    app.add_middleware(MultiTenantMiddleware)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include essential API routes only
if auth_available:
    app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])

if accounts_available:
    app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])

# Basic health endpoint
@app.get("/api/health")
async def api_health_check():
    """API health check endpoint"""
    db_health = await check_database_health()
    return {
        "status": "healthy",
        "message": "Kiff AI API is running on Vercel",
        "database": db_health,
        "environment": vercel_settings.VERCEL_ENV
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Kiff AI API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running",
        "environment": "vercel"
    }

@app.get("/health")
async def health_check():
    """Basic health check"""
    return {"status": "healthy", "message": "Kiff AI API is running on Vercel"}

@app.get("/api/health/simple")
async def simple_health_check():
    """Simplified health check for monitoring"""
    return {"status": "ok", "service": "kiff-ai-api", "version": "1.0.0"}

# Database health check
@app.get("/health/database")
async def database_health_check():
    """Check database connectivity"""
    db_health = await check_database_health()
    return {
        "service": "database",
        **db_health
    }