"""
Multi-Tenant Database Architecture for TradeForge AI
Schema-per-tenant approach with strict data isolation and easy management
"""

import logging
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
from sqlalchemy import create_engine, text, MetaData, inspect
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
import uuid
from enum import Enum

from app.core.config import settings
from app.core.database import Base
from app.models.models import User, APIKey, UsageRecord
# MarketData and TradingSandbox models removed - legacy trading functionality cleaned up
from app.models.admin_models import UserManagement, SystemMetrics
# BillingRecord import removed - model deleted for live trading demo

logger = logging.getLogger(__name__)

class TenantStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    MIGRATING = "migrating"
    ARCHIVED = "archived"

class TenantTier(str, Enum):
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"
    CUSTOM = "custom"

class MultiTenantDatabaseManager:
    """
    Manages multi-tenant database architecture with schema-per-tenant isolation
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Master database for tenant management
        self.master_engine = create_engine(
            settings.DATABASE_URL,
            poolclass=QueuePool,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            pool_recycle=3600
        )
        
        # Tenant connection cache
        self.tenant_engines: Dict[str, Engine] = {}
        self.tenant_sessions: Dict[str, sessionmaker] = {}
        
        # Initialize master database
        self._initialize_master_database()
    
    def _initialize_master_database(self):
        """Initialize master database with tenant management tables"""
        with self.master_engine.connect() as conn:
            # Create tenant management table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS tenants (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(100) NOT NULL UNIQUE,
                    slug VARCHAR(50) NOT NULL UNIQUE,
                    schema_name VARCHAR(63) NOT NULL UNIQUE,
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    tier VARCHAR(20) NOT NULL DEFAULT 'starter',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    settings JSONB DEFAULT '{}',
                    resource_limits JSONB DEFAULT '{}',
                    billing_info JSONB DEFAULT '{}',
                    contact_email VARCHAR(255),
                    admin_user_id INTEGER,
                    
                    CONSTRAINT chk_tenant_status CHECK (status IN ('active', 'suspended', 'migrating', 'archived')),
                    CONSTRAINT chk_tenant_tier CHECK (tier IN ('starter', 'professional', 'enterprise', 'custom')),
                    CONSTRAINT chk_schema_name_format CHECK (schema_name ~ '^tenant_[a-z0-9_]+$')
                )
            """))
            
            # Create tenant users mapping table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS tenant_users (
                    id SERIAL PRIMARY KEY,
                    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'member',
                    permissions JSONB DEFAULT '[]',
                    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    
                    UNIQUE(tenant_id, user_id),
                    CONSTRAINT chk_tenant_user_role CHECK (role IN ('owner', 'admin', 'member', 'viewer'))
                )
            """))
            
            # Create tenant analytics table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS tenant_analytics (
                    id SERIAL PRIMARY KEY,
                    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    date DATE NOT NULL,
                    metrics JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    
                    UNIQUE(tenant_id, date)
                )
            """))
            
            # Create indexes
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tenant_analytics_tenant_date ON tenant_analytics(tenant_id, date)"))
            
            conn.commit()
    
    async def create_tenant(self, name: str, slug: str, tier: TenantTier = TenantTier.STARTER,
                           admin_email: str = None, settings: Dict = None) -> Dict[str, Any]:
        """Create a new tenant with isolated schema"""
        try:
            # Generate schema name
            schema_name = f"tenant_{slug.lower().replace('-', '_')}"
            
            # Validate schema name
            if not self._is_valid_schema_name(schema_name):
                raise ValueError(f"Invalid schema name: {schema_name}")
            
            with self.master_engine.connect() as conn:
                # Check if tenant already exists
                result = conn.execute(text(
                    "SELECT id FROM tenants WHERE slug = :slug OR schema_name = :schema"
                ), {"slug": slug, "schema": schema_name})
                
                if result.fetchone():
                    raise ValueError(f"Tenant with slug '{slug}' already exists")
                
                # Create tenant record
                tenant_id = str(uuid.uuid4())
                import json
                conn.execute(text("""
                    INSERT INTO tenants (id, name, slug, schema_name, tier, contact_email, settings, resource_limits)
                    VALUES (:id, :name, :slug, :schema, :tier, :email, :settings, :limits)
                """), {
                    "id": tenant_id,
                    "name": name,
                    "slug": slug,
                    "schema": schema_name,
                    "tier": tier.value,
                    "email": admin_email,
                    "settings": json.dumps(settings or {}),
                    "limits": json.dumps(self._get_default_resource_limits(tier))
                })
                
                # Create schema
                conn.execute(text(f'CREATE SCHEMA "{schema_name}"'))
                
                conn.commit()
            
            # Initialize tenant schema with tables
            await self._initialize_tenant_schema(schema_name)
            
            # Create tenant connection
            self._create_tenant_connection(tenant_id, schema_name)
            
            self.logger.info(f"Created tenant: {name} ({slug}) with schema: {schema_name}")
            
            return {
                "tenant_id": tenant_id,
                "name": name,
                "slug": slug,
                "schema_name": schema_name,
                "tier": tier.value,
                "status": TenantStatus.ACTIVE.value
            }
            
        except Exception as e:
            self.logger.error(f"Error creating tenant: {e}")
            # Cleanup on failure
            try:
                with self.master_engine.connect() as conn:
                    conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
                    conn.execute(text("DELETE FROM tenants WHERE slug = :slug"), {"slug": slug})
                    conn.commit()
            except:
                pass
            raise
    
    async def _initialize_tenant_schema(self, schema_name: str):
        """Initialize tenant schema with all required tables"""
        # Create tenant-specific engine
        tenant_url = f"{settings.DATABASE_URL.split('?')[0]}?options=-csearch_path%3D{schema_name}"
        tenant_engine = create_engine(tenant_url, pool_size=5, max_overflow=10)
        
        try:
            # Create all tables in tenant schema
            Base.metadata.create_all(bind=tenant_engine)
            
            # Create tenant-specific indexes and constraints
            with tenant_engine.connect() as conn:
                # Add tenant-specific optimizations for kiff system
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON users(email);
                    CREATE INDEX IF NOT EXISTS idx_tenant_users_created_at ON users(created_at);
                    CREATE INDEX IF NOT EXISTS idx_tenant_agents_user_id ON agents(user_id);
                    CREATE INDEX IF NOT EXISTS idx_tenant_agents_created_at ON agents(created_at);
                    CREATE INDEX IF NOT EXISTS idx_tenant_usage_timestamp ON usage_records(timestamp);
                """))
                conn.commit()
                
        finally:
            tenant_engine.dispose()
    
    def _create_tenant_connection(self, tenant_id: str, schema_name: str):
        """Create and cache tenant database connection"""
        tenant_url = f"{settings.DATABASE_URL.split('?')[0]}?options=-csearch_path%3D{schema_name}"
        
        engine = create_engine(
            tenant_url,
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=3600
        )
        
        session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        self.tenant_engines[tenant_id] = engine
        self.tenant_sessions[tenant_id] = session_factory
    
    @contextmanager
    def get_tenant_session(self, tenant_id: str) -> Session:
        """Get database session for specific tenant"""
        if tenant_id not in self.tenant_sessions:
            # Load tenant info and create connection
            tenant_info = self.get_tenant_info(tenant_id)
            if not tenant_info:
                raise ValueError(f"Tenant not found: {tenant_id}")
            
            self._create_tenant_connection(tenant_id, tenant_info["schema_name"])
        
        session = self.tenant_sessions[tenant_id]()
        try:
            yield session
        finally:
            session.close()
    
    def get_tenant_info(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get tenant information from master database"""
        with self.master_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT id, name, slug, schema_name, status, tier, created_at, 
                       settings, resource_limits, contact_email
                FROM tenants WHERE id = :tenant_id
            """), {"tenant_id": tenant_id})
            
            row = result.fetchone()
            if not row:
                return None
            
            return {
                "tenant_id": str(row[0]),
                "name": row[1],
                "slug": row[2],
                "schema_name": row[3],
                "status": row[4],
                "tier": row[5],
                "created_at": row[6].isoformat(),
                "settings": row[7],
                "resource_limits": row[8],
                "contact_email": row[9]
            }
    
    def get_tenant_by_slug(self, slug: str) -> Optional[Dict[str, Any]]:
        """Get tenant information by slug"""
        with self.master_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT id, name, slug, schema_name, status, tier, created_at,
                       settings, resource_limits, contact_email
                FROM tenants WHERE slug = :slug
            """), {"slug": slug})
            
            row = result.fetchone()
            if not row:
                return None
            
            return {
                "tenant_id": str(row[0]),
                "name": row[1],
                "slug": row[2],
                "schema_name": row[3],
                "status": row[4],
                "tier": row[5],
                "created_at": row[6].isoformat(),
                "settings": row[7],
                "resource_limits": row[8],
                "contact_email": row[9]
            }
    
    def list_tenants(self, status: Optional[TenantStatus] = None) -> List[Dict[str, Any]]:
        """List all tenants with optional status filter"""
        with self.master_engine.connect() as conn:
            query = "SELECT id, name, slug, status, tier, created_at, contact_email FROM tenants"
            params = {}
            
            if status:
                query += " WHERE status = :status"
                params["status"] = status.value
            
            query += " ORDER BY created_at DESC"
            
            result = conn.execute(text(query), params)
            
            return [
                {
                    "tenant_id": str(row[0]),
                    "name": row[1],
                    "slug": row[2],
                    "status": row[3],
                    "tier": row[4],
                    "created_at": row[5].isoformat(),
                    "contact_email": row[6]
                }
                for row in result
            ]
    
    async def update_tenant_status(self, tenant_id: str, status: TenantStatus) -> bool:
        """Update tenant status"""
        try:
            with self.master_engine.connect() as conn:
                result = conn.execute(text("""
                    UPDATE tenants 
                    SET status = :status, updated_at = NOW()
                    WHERE id = :tenant_id
                """), {"status": status.value, "tenant_id": tenant_id})
                
                conn.commit()
                return result.rowcount > 0
                
        except Exception as e:
            self.logger.error(f"Error updating tenant status: {e}")
            return False
    
    async def delete_tenant(self, tenant_id: str, force: bool = False) -> bool:
        """Delete tenant and all associated data"""
        try:
            tenant_info = self.get_tenant_info(tenant_id)
            if not tenant_info:
                return False
            
            schema_name = tenant_info["schema_name"]
            
            # Check if tenant can be deleted
            if not force and tenant_info["status"] == TenantStatus.ACTIVE.value:
                raise ValueError("Cannot delete active tenant. Suspend first or use force=True")
            
            with self.master_engine.connect() as conn:
                # Drop schema and all data
                conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
                
                # Remove tenant record
                conn.execute(text("DELETE FROM tenants WHERE id = :tenant_id"), 
                           {"tenant_id": tenant_id})
                
                conn.commit()
            
            # Clean up cached connections
            if tenant_id in self.tenant_engines:
                self.tenant_engines[tenant_id].dispose()
                del self.tenant_engines[tenant_id]
                del self.tenant_sessions[tenant_id]
            
            self.logger.info(f"Deleted tenant: {tenant_id} (schema: {schema_name})")
            return True
            
        except Exception as e:
            self.logger.error(f"Error deleting tenant: {e}")
            return False
    
    async def backup_tenant(self, tenant_id: str) -> str:
        """Create backup of tenant data"""
        tenant_info = self.get_tenant_info(tenant_id)
        if not tenant_info:
            raise ValueError(f"Tenant not found: {tenant_id}")
        
        schema_name = tenant_info["schema_name"]
        backup_name = f"tenant_{tenant_info['slug']}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # Use pg_dump to backup specific schema
        import subprocess
        import os
        
        backup_dir = "/tmp/tenant_backups"
        os.makedirs(backup_dir, exist_ok=True)
        backup_file = f"{backup_dir}/{backup_name}.sql"
        
        # Parse database URL for pg_dump
        db_url = settings.DATABASE_URL
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "")
        
        parts = db_url.split("@")
        user_pass = parts[0].split(":")
        host_db = parts[1].split("/")
        
        user = user_pass[0]
        password = user_pass[1] if len(user_pass) > 1 else ""
        host = host_db[0].split(":")[0]
        port = host_db[0].split(":")[1] if ":" in host_db[0] else "5432"
        database = host_db[1].split("?")[0]
        
        env = os.environ.copy()
        if password:
            env["PGPASSWORD"] = password
        
        cmd = [
            "pg_dump",
            "-h", host,
            "-p", port,
            "-U", user,
            "-d", database,
            "--schema", schema_name,
            "--no-owner",
            "--no-privileges",
            "-f", backup_file
        ]
        
        result = subprocess.run(cmd, env=env, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception(f"Backup failed: {result.stderr}")
        
        self.logger.info(f"Created tenant backup: {backup_file}")
        return backup_file
    
    def get_tenant_analytics(self, tenant_id: str, days: int = 30) -> Dict[str, Any]:
        """Get tenant usage analytics"""
        with self.get_tenant_session(tenant_id) as session:
            # Get user count
            user_count = session.query(User).count()
            
            # Get sandbox count
            # TradingSandbox model removed - legacy trading functionality cleaned up
            # For kiff system, this would track generated apps instead
            sandbox_count = 0  # Placeholder for generated apps count
            active_sandboxes = 0  # Placeholder for active app generation processes
            
            # Get usage statistics
            from sqlalchemy import func
            from datetime import timedelta
            
            since_date = datetime.utcnow() - timedelta(days=days)
            usage_stats = session.query(
                func.sum(UsageRecord.tokens_used).label("total_tokens"),
                func.sum(UsageRecord.api_calls).label("total_api_calls"),
                func.count(UsageRecord.id).label("total_operations")
            ).filter(UsageRecord.timestamp >= since_date).first()
            
            return {
                "tenant_id": tenant_id,
                "period_days": days,
                "users": user_count,
                "sandboxes": {
                    "total": sandbox_count,
                    "active": active_sandboxes
                },
                "usage": {
                    "tokens_used": usage_stats.total_tokens or 0,
                    "api_calls": usage_stats.total_api_calls or 0,
                    "operations": usage_stats.total_operations or 0
                }
            }
    
    def _is_valid_schema_name(self, schema_name: str) -> bool:
        """Validate schema name format"""
        import re
        return bool(re.match(r'^tenant_[a-z0-9_]+$', schema_name)) and len(schema_name) <= 63
    
    def _get_default_resource_limits(self, tier: TenantTier) -> Dict[str, Any]:
        """Get default resource limits for tenant tier"""
        limits = {
            TenantTier.STARTER: {
                "max_users": 5,
                "max_sandboxes": 10,
                "monthly_tokens": 100000,
                "monthly_api_calls": 10000,
                "storage_gb": 1
            },
            TenantTier.PROFESSIONAL: {
                "max_users": 25,
                "max_sandboxes": 50,
                "monthly_tokens": 1000000,
                "monthly_api_calls": 100000,
                "storage_gb": 10
            },
            TenantTier.ENTERPRISE: {
                "max_users": 100,
                "max_sandboxes": 200,
                "monthly_tokens": 10000000,
                "monthly_api_calls": 1000000,
                "storage_gb": 100
            },
            TenantTier.CUSTOM: {
                "max_users": -1,  # Unlimited
                "max_sandboxes": -1,
                "monthly_tokens": -1,
                "monthly_api_calls": -1,
                "storage_gb": -1
            }
        }
        
        return limits.get(tier, limits[TenantTier.STARTER])

# Global multi-tenant database manager
mt_db_manager = MultiTenantDatabaseManager()

# Tenant-aware session dependency
def get_tenant_db_session(tenant_id: str):
    """Dependency to get tenant-specific database session"""
    with mt_db_manager.get_tenant_session(tenant_id) as session:
        yield session

# Middleware for tenant resolution
class TenantMiddleware:
    """Middleware to resolve tenant from request"""
    
    @staticmethod
    def get_tenant_from_request(request) -> Optional[str]:
        """Extract tenant ID from request (subdomain, header, or path)"""
        # Method 1: Subdomain (e.g., acme.tradeforge.ai)
        host = request.headers.get("host", "")
        if "." in host:
            subdomain = host.split(".")[0]
            if subdomain != "www" and subdomain != "api":
                tenant_info = mt_db_manager.get_tenant_by_slug(subdomain)
                if tenant_info:
                    return tenant_info["tenant_id"]
        
        # Method 2: X-Tenant-ID header (can be UUID or slug)
        tenant_id = request.headers.get("x-tenant-id")
        if tenant_id:
            # Check if it's a valid UUID format
            try:
                uuid.UUID(tenant_id)
                # It's a valid UUID, return as-is
                return tenant_id
            except ValueError:
                # It's not a UUID, treat as slug and resolve to UUID
                tenant_info = mt_db_manager.get_tenant_by_slug(tenant_id)
                if tenant_info:
                    return tenant_info["tenant_id"]
                # If slug not found, return None (will be handled by middleware)
        
        # Method 3: Path prefix (e.g., /tenant/acme/api/...)
        path = request.url.path
        if path.startswith("/tenant/"):
            parts = path.split("/")
            if len(parts) >= 3:
                tenant_slug = parts[2]
                tenant_info = mt_db_manager.get_tenant_by_slug(tenant_slug)
                if tenant_info:
                    return tenant_info["tenant_id"]
        
        return None
