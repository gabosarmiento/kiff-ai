from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging
import json
from typing import Dict, List

from app.api.routes import (
    auth, accounts, logs, health, tenant_management, support, audit, kiff, api_gallery, knowledge
)
from app.api.routes import analytics
from app.api import knowledge_management
from app.core.config import settings
from app.core.database import engine, Base
from sqlalchemy import text
from app.core.websocket import ConnectionManager
from app.middleware.tenant_middleware import (
    MultiTenantMiddleware, 
    TenantContextMiddleware,
    TenantUsageTrackingMiddleware,
    TenantSecurityMiddleware
)
from app.core.multi_tenant_db import mt_db_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# WebSocket connection manager
manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting TradeForge AI application...")
    
    # Initialize database tables
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        logger.warning(f"Database initialization warning: {e}")
        # For development, try to continue anyway
        if settings.DEBUG:
            logger.info("Continuing in debug mode despite database issues...")
    
    # Start monitoring background tasks
    from app.services.monitoring_service import start_monitoring_loop
    from app.api.routes.monitoring import start_metrics_broadcasting
    import asyncio
    
    # Start monitoring loop
    asyncio.create_task(start_monitoring_loop())
    
    # Start metrics broadcasting for WebSocket clients
    asyncio.create_task(start_metrics_broadcasting())
    
    logger.info("TradeForge AI application started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down TradeForge AI application...")

# Remove duplicate lifespan function

# Create FastAPI app
app = FastAPI(
    title="TradeForge AI API",
    description="AI-powered trading automation platform API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware (must be first for browser requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Multi-tenant middleware (order matters!)
app.add_middleware(TenantSecurityMiddleware)
app.add_middleware(TenantUsageTrackingMiddleware)
app.add_middleware(TenantContextMiddleware)
app.add_middleware(MultiTenantMiddleware)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include API routes
# Authentication routes (public)
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])

# User routes (authenticated)
app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])


# Kiff routes - Main functionality for adaptive API documentation extraction
app.include_router(kiff.router, prefix="/api/kiff", tags=["kiff"])

# API Gallery routes - Curated API documentation collection
app.include_router(api_gallery.router, tags=["api-gallery"])

# Knowledge Management routes - Knowledge bases and domain management
app.include_router(knowledge.router, tags=["knowledge"])

app.include_router(logs.router, prefix="/api/logs", tags=["logs"])
app.include_router(health.router, prefix="/api/health", tags=["health"])

# Multi-tenant management routes (admin only)
app.include_router(tenant_management.router, prefix="/api/tenant-management", tags=["tenant-management"])

# Monitoring routes (admin only)


# Knowledge Management API routes
app.include_router(knowledge_management.router, tags=["knowledge-management"])

# Admin UI API routes (admin only)
# billing.router removed - billing functionality disabled for live trading demo
app.include_router(support.router, prefix="/api/admin/support", tags=["admin-support"])
app.include_router(audit.router, prefix="/api/admin/audit", tags=["admin-audit"])

# Analytics routes (admin only) - Agentic monitoring and insights
from app.api.routes import admin  # Re-enabled with proper admin infrastructure
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(analytics.router, prefix="/api/admin/analytics", tags=["admin-analytics"])

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "TradeForge AI API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "TradeForge AI API is running"}

@app.get("/health/tenants")
async def tenant_health_check():
    """Check health of all active tenants"""
    try:
        tenants = mt_db_manager.list_tenants()
        health_status = []
        
        for tenant in tenants[:10]:  # Limit to first 10 for performance
            from app.middleware.tenant_middleware import check_tenant_health
            tenant_health = await check_tenant_health(tenant["tenant_id"])
            health_status.append(tenant_health)
        
        return {
            "status": "healthy",
            "total_tenants": len(tenants),
            "checked_tenants": len(health_status),
            "tenant_health": health_status
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error checking tenant health: {str(e)}"
        }

@app.websocket("/ws/logs/{agent_id}")
async def websocket_logs(websocket: WebSocket, agent_id: str):
    """WebSocket endpoint for real-time logs"""
    await manager.connect(websocket, agent_id)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Echo back for testing
            await manager.send_personal_message(
                json.dumps({"type": "echo", "data": message}),
                websocket
            )
    except WebSocketDisconnect:
        manager.disconnect(websocket, agent_id)
        logger.info(f"WebSocket disconnected for agent {agent_id}")

@app.websocket("/ws/market/{symbol}")
async def websocket_market_data(websocket: WebSocket, symbol: str):
    """WebSocket endpoint for real-time market data"""
    await manager.connect(websocket)
    try:
        while True:
            # Simulate market data
            import random
            import asyncio
            
            price = round(random.uniform(100, 200), 2)
            volume = random.randint(1000, 10000)
            
            data = {
                "symbol": symbol,
                "price": price,
                "volume": volume,
                "timestamp": "2024-01-01T00:00:00Z"
            }
            
            await manager.send_personal_message(json.dumps(data), websocket)
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Direct WebSocket endpoint for project creation (bypasses middleware)
@app.websocket("/ws/create-project")
async def websocket_create_project_direct(websocket: WebSocket):
    """Direct WebSocket endpoint for project creation that bypasses tenant middleware"""
    await websocket.accept()
    logger.info("WebSocket connection accepted")
    
    try:
        # Wait for project creation request
        data = await websocket.receive_text()
        logger.info(f"Received WebSocket data: {data}")
        
        request_data = json.loads(data)
        request_text = request_data.get("request", "")
        
        if not request_text:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "No request provided"
            }))
            return
        
        # Send initial status
        await websocket.send_text(json.dumps({
            "type": "status",
            "message": "🚀 Starting project creation...",
            "stage": "initializing"
        }))
        
        # Simulate some progress
        import asyncio
        await asyncio.sleep(1)
        
        await websocket.send_text(json.dumps({
            "type": "progress",
            "message": "📝 Analyzing request...",
            "stage": "analysis"
        }))
        
        await asyncio.sleep(1)
        
        await websocket.send_text(json.dumps({
            "type": "file_created",
            "message": "📄 Created main.py",
            "stage": "generation",
            "file_name": "main.py"
        }))
        
        await asyncio.sleep(1)
        
        await websocket.send_text(json.dumps({
            "type": "completed",
            "message": "✅ Project creation completed!",
            "stage": "completed",
            "app_path": "/generated_apps/test_app",
            "app_name": "test_app",
            "files_created": 1
        }))
        
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected during project creation")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Connection error: {str(e)}"
            }))
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_excludes=["generated_apps/*"],
        log_level="info"
    )
