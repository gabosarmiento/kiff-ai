from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import List, Optional
import os
import base64
from cryptography.fernet import Fernet
import logging

logger = logging.getLogger(__name__)

class EncryptionManager:
    """Handles API key encryption and decryption"""
    
    def __init__(self, encryption_key: Optional[str] = None):
        if encryption_key:
            self.fernet = Fernet(encryption_key.encode())
        else:
            # Generate a key if none provided (for development)
            key = Fernet.generate_key()
            self.fernet = Fernet(key)
            logger.warning("Using auto-generated encryption key. Set ENCRYPTION_KEY in production.")
    
    def encrypt_api_key(self, api_key: str) -> str:
        """Encrypt an API key"""
        if not api_key:
            return ""
        return self.fernet.encrypt(api_key.encode()).decode()
    
    def decrypt_api_key(self, encrypted_key: str) -> str:
        """Decrypt an API key"""
        if not encrypted_key:
            return ""
        try:
            return self.fernet.decrypt(encrypted_key.encode()).decode()
        except Exception as e:
            logger.error(f"Failed to decrypt API key: {e}")
            return ""

class Settings(BaseSettings):
    """Application settings"""
    
    # App settings
    APP_NAME: str = "TradeForge AI"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/tradeforge"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_SECRET_KEY: str = "your_jwt_secret_key_here"
    ENCRYPTION_KEY: str = "your_encryption_key_here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    ALLOWED_HOSTS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # LLM APIs
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    EXA_API_KEY: str = ""
    
    # Trading APIs
    BINANCE_API_KEY: str = ""
    BINANCE_SECRET_KEY: str = ""
    BINANCE_TESTNET: bool = True
    
    COINBASE_API_KEY: str = ""
    COINBASE_SECRET_KEY: str = ""
    
    # Interactive Brokers
    IB_HOST: str = "localhost"
    IB_PORT: int = 7497
    IB_CLIENT_ID: int = 1
    
    # Daytona Sandbox
    DAYTONA_API_URL: str = "http://localhost:8080"
    DAYTONA_API_KEY: str = ""
    
    # Email Service (Resend)
    RESEND_API_KEY: str = ""
    DEFAULT_FROM_EMAIL: str = "noreply@tradeforge.ai"
    FRONTEND_URL: str = "http://localhost:3000"
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    model_config = ConfigDict(
        env_file="../.env",
        case_sensitive=True,
        extra="ignore"  # Ignore extra environment variables like VITE_API_BASE_URL
    )

# Create settings instance
settings = Settings()

# Validate required settings
def validate_settings():
    """Validate critical settings"""
    if not settings.SECRET_KEY or settings.SECRET_KEY == "your-secret-key-change-in-production":
        if not settings.DEBUG:
            raise ValueError("SECRET_KEY must be set in production")
    
    if not settings.DATABASE_URL:
        raise ValueError("DATABASE_URL must be set")

# Run validation
validate_settings()
