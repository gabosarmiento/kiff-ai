"""
Vercel-optimized database configuration
Handles connection pooling and serverless-friendly database operations
"""

import os
import logging
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from typing import AsyncGenerator
from contextlib import asynccontextmanager

from app.core.config_vercel import vercel_settings

logger = logging.getLogger(__name__)

# Create the declarative base
Base = declarative_base()

# Database URL with connection pooling disabled for serverless
DATABASE_URL = vercel_settings.DATABASE_URL

# Use NullPool for serverless environments to avoid connection pooling issues
if DATABASE_URL:
    # Convert sync URL to async URL if needed
    if DATABASE_URL.startswith("postgresql://"):
        ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    elif DATABASE_URL.startswith("postgresql+psycopg2://"):
        ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
    else:
        ASYNC_DATABASE_URL = DATABASE_URL
    
    # Create async engine with serverless-friendly settings
    engine = create_async_engine(
        ASYNC_DATABASE_URL,
        poolclass=NullPool,  # No connection pooling for serverless
        pool_pre_ping=True,  # Validate connections
        pool_recycle=300,    # Recycle connections every 5 minutes
        connect_args={
            "server_settings": {
                "application_name": "kiff-ai-vercel",
            }
        },
        echo=False  # Set to True for debugging
    )
    
    # Create session factory
    async_session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    logger.info("Database engine configured for Vercel deployment")
else:
    logger.warning("No DATABASE_URL provided - database operations will fail")
    engine = None
    async_session_factory = None

# Dependency to get database session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session for dependency injection"""
    if not async_session_factory:
        raise ValueError("Database not configured - check DATABASE_URL environment variable")
    
    async with async_session_factory() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            await session.close()

# Health check function
async def check_database_health() -> dict:
    """Check database connectivity and health"""
    if not engine:
        return {
            "status": "error",
            "message": "Database not configured"
        }
    
    try:
        async with engine.begin() as conn:
            result = await conn.execute("SELECT 1 as health_check")
            row = result.fetchone()
            
            if row and row[0] == 1:
                return {
                    "status": "healthy",
                    "message": "Database connection successful"
                }
            else:
                return {
                    "status": "error", 
                    "message": "Database query failed"
                }
                
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "error",
            "message": f"Database connection failed: {str(e)}"
        }

# Initialize database tables (for first-time setup)
async def init_database():
    """Initialize database tables - only call this once during setup"""
    if not engine:
        logger.error("Cannot initialize database - no engine configured")
        return False
    
    try:
        # Import all models to ensure they're registered
        from app.models.models import User  # Add other models as needed
        
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database tables initialized successfully")
        return True
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        return False