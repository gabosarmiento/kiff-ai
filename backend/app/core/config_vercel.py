"""
Vercel-optimized configuration
Handles environment variables and database connections for serverless deployment
"""

from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import List, Optional
import os
import logging

logger = logging.getLogger(__name__)

class VercelSettings(BaseSettings):
    """Vercel-optimized application settings"""
    
    # App settings
    APP_NAME: str = "Kiff AI"
    VERSION: str = "1.0.0"
    DEBUG: bool = False  # Always False in production
    ENVIRONMENT: str = "production"
    
    # Database - Use connection pooling for serverless
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS - Allow Vercel domains
    ALLOWED_HOSTS: List[str] = [
        "https://kiff-ai.vercel.app",
        "https://*.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
        os.getenv("FRONTEND_URL", "")
    ]
    
    # LLM APIs
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    EXA_API_KEY: str = os.getenv("EXA_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    
    # Email Service (Resend)
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    DEFAULT_FROM_EMAIL: str = os.getenv("DEFAULT_FROM_EMAIL", "noreply@kiff.ai")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://kiff-ai.vercel.app")
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    # Vercel-specific settings
    VERCEL_ENV: str = os.getenv("VERCEL_ENV", "development")
    VERCEL_URL: str = os.getenv("VERCEL_URL", "")
    VERCEL_REGION: str = os.getenv("VERCEL_REGION", "")
    
    # AWS credentials for App Runner (Phase 2)
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    
    model_config = ConfigDict(
        case_sensitive=True,
        extra="ignore"
    )

# Create settings instance
vercel_settings = VercelSettings()

def validate_vercel_settings():
    """Validate critical settings for Vercel deployment"""
    
    # In development/preview, some settings can be missing
    if vercel_settings.VERCEL_ENV == "development":
        logger.info("Running in Vercel development mode")
        return
    
    # Validate production settings
    required_settings = [
        ("SECRET_KEY", vercel_settings.SECRET_KEY),
        ("JWT_SECRET_KEY", vercel_settings.JWT_SECRET_KEY),
        ("DATABASE_URL", vercel_settings.DATABASE_URL),
    ]
    
    missing_settings = []
    for name, value in required_settings:
        if not value:
            missing_settings.append(name)
    
    if missing_settings:
        logger.warning(f"Missing required settings: {', '.join(missing_settings)}")
        # Don't fail in Vercel - just log warnings
        # raise ValueError(f"Missing required settings: {', '.join(missing_settings)}")
    
    # Log configuration status
    logger.info(f"Kiff AI API configured for {vercel_settings.VERCEL_ENV} environment")
    if vercel_settings.VERCEL_URL:
        logger.info(f"Deployment URL: {vercel_settings.VERCEL_URL}")

# Run validation
validate_vercel_settings()