"""
Railway Configuration for LanceDB
=================================

Configuration for LanceDB to work with Railway's persistent volumes.
"""

import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class RailwayConfig:
    """Configuration for Railway deployment"""
    
    @staticmethod
    def get_lancedb_path() -> str:
        """Get LanceDB storage path for Railway"""
        
        # Railway provides persistent volumes at /app/data or custom mount paths
        railway_volume = os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
        
        if railway_volume:
            # Use Railway's mounted volume
            lancedb_path = os.path.join(railway_volume, "lancedb")
            logger.info(f"🚂 Using Railway persistent volume: {lancedb_path}")
        else:
            # Fallback paths for Railway
            possible_paths = [
                "/app/data/lancedb",  # Railway default persistent path
                "/tmp/lancedb",       # Temporary fallback
                "./tmp/lancedb"       # Local development fallback
            ]
            
            lancedb_path = possible_paths[0]  # Default to /app/data/lancedb
            logger.info(f"🚂 Using Railway default path: {lancedb_path}")
        
        # Ensure directory exists
        Path(lancedb_path).mkdir(parents=True, exist_ok=True)
        
        return lancedb_path
    
    @staticmethod
    def get_embeddings_cache_path() -> str:
        """Get embeddings cache path for Railway"""
        
        railway_volume = os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
        
        if railway_volume:
            cache_path = os.path.join(railway_volume, "embeddings_cache")
        else:
            cache_path = "/app/data/embeddings_cache"
        
        Path(cache_path).mkdir(parents=True, exist_ok=True)
        return cache_path
    
    @staticmethod
    def is_railway_environment() -> bool:
        """Check if running on Railway"""
        return os.getenv("RAILWAY_ENVIRONMENT") is not None or os.getenv("PORT") is not None
    
    @staticmethod
    def get_database_url() -> str:
        """Get database URL for Railway"""
        # Railway provides DATABASE_URL automatically for PostgreSQL
        return os.getenv("DATABASE_URL", "sqlite:///./app.db")
    
    @staticmethod
    def configure_for_railway():
        """Apply Railway-specific configurations"""
        
        if RailwayConfig.is_railway_environment():
            logger.info("🚂 Configuring for Railway deployment...")
            
            # Set up LanceDB paths
            lancedb_path = RailwayConfig.get_lancedb_path()
            os.environ["LANCEDB_URI"] = lancedb_path
            
            # Set up embeddings cache
            cache_path = RailwayConfig.get_embeddings_cache_path()
            os.environ["EMBEDDINGS_CACHE_PATH"] = cache_path
            
            # Configure for production
            os.environ["ENVIRONMENT"] = "production"
            
            logger.info(f"✅ Railway configuration complete:")
            logger.info(f"  - LanceDB Path: {lancedb_path}")
            logger.info(f"  - Cache Path: {cache_path}")
            logger.info(f"  - Database: {RailwayConfig.get_database_url()}")
        
        else:
            logger.info("💻 Running in local development mode")

# Initialize Railway configuration
railway_config = RailwayConfig()