"""
Railway-optimized FastAPI Application
====================================

Optimized version of the FastAPI app for Railway deployment with LanceDB support.
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Configure Railway environment early
from app.knowledge.railway_config import railway_config
railway_config.configure_for_railway()

# Import routes and middleware
from app.middleware.tenant_middleware import TenantMiddleware
from app.api.routes import (
    auth, health, kiff, agno_generation, advanced_agno_generation,
    feature_flags, billing_consumption, token_tracking, knowledge,
    idea_generator
)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("🚂 Starting Kiff AI on Railway...")
    
    # Railway-specific startup
    if railway_config.is_railway_environment():
        logger.info("🚂 Railway environment detected")
        logger.info(f"🚂 Port: {os.getenv('PORT', 'Not set')}")
        logger.info(f"🚂 Railway Service: {os.getenv('RAILWAY_SERVICE_NAME', 'Unknown')}")
        
        # Warm up AGNO generator
        try:
            from app.services.agno_application_generator import agno_app_generator
            await agno_app_generator.warmup_knowledge_base()
            logger.info("🔥 AGNO generator warmed up successfully")
        except Exception as e:
            logger.warning(f"⚠️ AGNO warmup failed (non-critical): {e}")
    
    yield
    
    logger.info("🚂 Shutting down Kiff AI...")

# Create FastAPI app optimized for Railway
app = FastAPI(
    title="Kiff AI - Railway",
    description="Knowledge-driven AI application generation platform - Railway deployment",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS for Railway
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://*.vercel.app",
        "https://*.railway.app", 
        "http://localhost:3000",
        "http://localhost:5173",
        "https://kiff-ai.vercel.app"  # Add your Vercel domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add tenant middleware
app.add_middleware(TenantMiddleware)

# Global exception handler for Railway
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"🚂 Railway error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "railway": True}
    )

# Include API routes
app.include_router(health.router, tags=["health"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(kiff.router, prefix="/api/kiff", tags=["kiff"])
app.include_router(agno_generation.router, prefix="/api/agno-generation", tags=["agno-generation"])
app.include_router(advanced_agno_generation.router, prefix="/api/advanced-agno-generation", tags=["advanced-generation"])
app.include_router(feature_flags.router, prefix="/api/admin/feature-flags", tags=["admin"])
app.include_router(billing_consumption.router, prefix="/api/billing", tags=["billing"])
app.include_router(token_tracking.router, prefix="/api/token-tracking", tags=["token-tracking"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["knowledge"])
app.include_router(idea_generator.router, prefix="/api/ideas", tags=["idea-generator"])

@app.get("/")
async def root():
    """Railway health check endpoint"""
    return {
        "message": "🚂 Kiff AI running on Railway!",
        "status": "healthy",
        "environment": "railway",
        "version": "1.0.0"
    }

@app.get("/railway-status")
async def railway_status():
    """Railway-specific status endpoint"""
    return {
        "service": os.getenv("RAILWAY_SERVICE_NAME", "kiff-ai-backend"),
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "production"),
        "deployment_id": os.getenv("RAILWAY_DEPLOYMENT_ID", "unknown"),
        "replica_id": os.getenv("RAILWAY_REPLICA_ID", "unknown"),
        "lancedb_path": os.getenv("LANCEDB_URI", "not_configured"),
        "database_configured": bool(os.getenv("DATABASE_URL")),
        "port": os.getenv("PORT", "8000")
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "app.main_railway:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )