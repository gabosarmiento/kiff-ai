"""
Production Database Management System for TradeForge AI
Handles migrations, backups, monitoring, and multi-tenancy
"""

import os
import logging
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, text, inspect, MetaData
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import boto3
from pathlib import Path
import json
import subprocess

from app.core.config import settings
from app.core.database import Base, get_db
from app.models.models import User, APIKey, UsageRecord
# MarketData model removed - legacy trading functionality cleaned up
from app.models.admin_models import (
    AdminUser, UserManagement, SystemMetrics,
    AdminAuditLog, SystemAnnouncement, SupportTicket, UsageAlert
)

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Comprehensive database management for production SaaS"""
    
    def __init__(self):
        self.engine = create_engine(
            settings.DATABASE_URL,
            poolclass=QueuePool,
            pool_size=20,
            max_overflow=30,
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=settings.DEBUG
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.migration_dir = Path(__file__).parent.parent / "migrations"
        self.migration_dir.mkdir(exist_ok=True)
        
    def create_database_if_not_exists(self):
        """Create database if it doesn't exist"""
        try:
            # Parse database URL to get database name
            db_url_parts = settings.DATABASE_URL.split('/')
            db_name = db_url_parts[-1].split('?')[0]
            base_url = '/'.join(db_url_parts[:-1])
            
            # Connect to postgres database to create our database
            conn = psycopg2.connect(f"{base_url}/postgres")
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            cursor = conn.cursor()
            
            # Check if database exists
            cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s", (db_name,))
            exists = cursor.fetchone()
            
            if not exists:
                cursor.execute(f'CREATE DATABASE "{db_name}"')
                logger.info(f"Created database: {db_name}")
            
            cursor.close()
            conn.close()
            
        except Exception as e:
            logger.error(f"Error creating database: {e}")
            raise
    
    def initialize_database(self):
        """Initialize database with all tables and extensions"""
        try:
            self.create_database_if_not_exists()
            
            # Create pgvector extension
            with self.engine.connect() as conn:
                try:
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                    conn.commit()
                    logger.info("Created pgvector extension")
                except Exception as e:
                    logger.warning(f"Could not create pgvector extension: {e}")
            
            # Create all tables
            Base.metadata.create_all(bind=self.engine)
            logger.info("Created all database tables")
            
            # Initialize migration tracking
            self._initialize_migration_table()
            
            # Create initial admin user if none exists
            self._create_initial_admin()
            
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
            raise
    
    def _initialize_migration_table(self):
        """Create migration tracking table"""
        with self.engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS database_migrations (
                    id SERIAL PRIMARY KEY,
                    migration_name VARCHAR(255) NOT NULL UNIQUE,
                    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    checksum VARCHAR(64),
                    execution_time_ms INTEGER
                )
            """))
            conn.commit()
    
    def _create_initial_admin(self):
        """Create initial super admin user"""
        db = self.SessionLocal()
        try:
            # Check if any admin users exist
            existing_admin = db.query(AdminUser).first()
            if existing_admin:
                return
            
            from app.core.admin_auth import AdminAuthService
            from app.models.admin_models import AdminRole
            
            # Create initial super admin
            admin_user = AdminUser(
                email="admin@tradeforge.ai",
                hashed_password=AdminAuthService.get_password_hash("admin123!"),
                full_name="System Administrator",
                role=AdminRole.SUPER_ADMIN,
                is_active=True
            )
            
            db.add(admin_user)
            db.commit()
            
            logger.info("Created initial admin user: admin@tradeforge.ai / admin123!")
            
        except Exception as e:
            logger.error(f"Error creating initial admin: {e}")
            db.rollback()
        finally:
            db.close()
    
    def run_migrations(self) -> List[str]:
        """Run pending database migrations"""
        applied_migrations = []
        
        try:
            migration_files = sorted([
                f for f in self.migration_dir.glob("*.sql")
                if f.is_file()
            ])
            
            with self.engine.connect() as conn:
                # Get applied migrations
                result = conn.execute(text(
                    "SELECT migration_name FROM database_migrations ORDER BY applied_at"
                ))
                applied = {row[0] for row in result}
                
                for migration_file in migration_files:
                    migration_name = migration_file.stem
                    
                    if migration_name in applied:
                        continue
                    
                    logger.info(f"Applying migration: {migration_name}")
                    start_time = datetime.utcnow()
                    
                    # Read and execute migration
                    migration_sql = migration_file.read_text()
                    conn.execute(text(migration_sql))
                    
                    # Record migration
                    execution_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
                    conn.execute(text("""
                        INSERT INTO database_migrations (migration_name, execution_time_ms)
                        VALUES (:name, :time)
                    """), {"name": migration_name, "time": execution_time})
                    
                    conn.commit()
                    applied_migrations.append(migration_name)
                    logger.info(f"Applied migration {migration_name} in {execution_time}ms")
            
        except Exception as e:
            logger.error(f"Error running migrations: {e}")
            raise
        
        return applied_migrations
    
    def create_migration(self, name: str, sql_content: str) -> str:
        """Create a new migration file"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        migration_name = f"{timestamp}_{name}"
        migration_file = self.migration_dir / f"{migration_name}.sql"
        
        migration_content = f"""-- Migration: {migration_name}
-- Created: {datetime.utcnow().isoformat()}
-- Description: {name}

{sql_content}
"""
        
        migration_file.write_text(migration_content)
        logger.info(f"Created migration: {migration_file}")
        return str(migration_file)
    
    def backup_database(self, backup_name: Optional[str] = None) -> str:
        """Create database backup"""
        if not backup_name:
            backup_name = f"tradeforge_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        backup_dir = Path("/tmp/db_backups")
        backup_dir.mkdir(exist_ok=True)
        backup_file = backup_dir / f"{backup_name}.sql"
        
        try:
            # Parse database connection info
            db_url = settings.DATABASE_URL
            if db_url.startswith("postgresql://"):
                db_url = db_url.replace("postgresql://", "")
            
            # Extract connection details
            parts = db_url.split("@")
            user_pass = parts[0].split(":")
            host_db = parts[1].split("/")
            
            user = user_pass[0]
            password = user_pass[1] if len(user_pass) > 1 else ""
            host = host_db[0].split(":")[0]
            port = host_db[0].split(":")[1] if ":" in host_db[0] else "5432"
            database = host_db[1].split("?")[0]
            
            # Run pg_dump
            env = os.environ.copy()
            if password:
                env["PGPASSWORD"] = password
            
            cmd = [
                "pg_dump",
                "-h", host,
                "-p", port,
                "-U", user,
                "-d", database,
                "--no-password",
                "--verbose",
                "--clean",
                "--if-exists",
                "--create",
                "-f", str(backup_file)
            ]
            
            result = subprocess.run(cmd, env=env, capture_output=True, text=True)
            
            if result.returncode != 0:
                raise Exception(f"pg_dump failed: {result.stderr}")
            
            logger.info(f"Database backup created: {backup_file}")
            
            # Upload to S3 if configured
            if hasattr(settings, 'AWS_S3_BUCKET') and settings.AWS_S3_BUCKET:
                self._upload_backup_to_s3(backup_file, backup_name)
            
            return str(backup_file)
            
        except Exception as e:
            logger.error(f"Error creating backup: {e}")
            raise
    
    def _upload_backup_to_s3(self, backup_file: Path, backup_name: str):
        """Upload backup to S3"""
        try:
            s3_client = boto3.client('s3')
            s3_key = f"database-backups/{backup_name}.sql"
            
            s3_client.upload_file(
                str(backup_file),
                settings.AWS_S3_BUCKET,
                s3_key,
                ExtraArgs={'ServerSideEncryption': 'AES256'}
            )
            
            logger.info(f"Backup uploaded to S3: s3://{settings.AWS_S3_BUCKET}/{s3_key}")
            
        except Exception as e:
            logger.error(f"Error uploading backup to S3: {e}")
    
    def get_database_stats(self) -> Dict[str, Any]:
        """Get comprehensive database statistics"""
        stats = {}
        
        try:
            with self.engine.connect() as conn:
                # Database size
                result = conn.execute(text("""
                    SELECT pg_size_pretty(pg_database_size(current_database())) as size,
                           pg_database_size(current_database()) as size_bytes
                """))
                db_size = result.fetchone()
                stats['database_size'] = {
                    'formatted': db_size[0],
                    'bytes': db_size[1]
                }
                
                # Table sizes
                result = conn.execute(text("""
                    SELECT 
                        schemaname,
                        tablename,
                        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
                    FROM pg_tables 
                    WHERE schemaname = 'public'
                    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                """))
                
                stats['table_sizes'] = [
                    {
                        'table': row[1],
                        'size_formatted': row[2],
                        'size_bytes': row[3]
                    }
                    for row in result
                ]
                
                # Connection stats
                result = conn.execute(text("""
                    SELECT 
                        count(*) as total_connections,
                        count(*) FILTER (WHERE state = 'active') as active_connections,
                        count(*) FILTER (WHERE state = 'idle') as idle_connections
                    FROM pg_stat_activity 
                    WHERE datname = current_database()
                """))
                
                conn_stats = result.fetchone()
                stats['connections'] = {
                    'total': conn_stats[0],
                    'active': conn_stats[1],
                    'idle': conn_stats[2]
                }
                
                # Record counts
                stats['record_counts'] = {}
                for table_name in ['users', 'trading_sandboxes', 'admin_users', 'billing_records']:
                    try:
                        result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                        stats['record_counts'][table_name] = result.scalar()
                    except:
                        stats['record_counts'][table_name] = 0
                
        except Exception as e:
            logger.error(f"Error getting database stats: {e}")
            stats['error'] = str(e)
        
        return stats
    
    def health_check(self) -> Dict[str, Any]:
        """Comprehensive database health check"""
        health = {
            'status': 'healthy',
            'checks': {},
            'timestamp': datetime.utcnow().isoformat()
        }
        
        try:
            with self.engine.connect() as conn:
                # Connection test
                start_time = datetime.utcnow()
                conn.execute(text("SELECT 1"))
                connection_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                
                health['checks']['connection'] = {
                    'status': 'pass',
                    'response_time_ms': connection_time
                }
                
                # Check critical tables exist
                inspector = inspect(self.engine)
                required_tables = ['users', 'admin_users', 'trading_sandboxes', 'user_management']
                missing_tables = []
                
                for table in required_tables:
                    if not inspector.has_table(table):
                        missing_tables.append(table)
                
                if missing_tables:
                    health['checks']['schema'] = {
                        'status': 'fail',
                        'missing_tables': missing_tables
                    }
                    health['status'] = 'unhealthy'
                else:
                    health['checks']['schema'] = {'status': 'pass'}
                
                # Check database size (warn if > 10GB)
                result = conn.execute(text("SELECT pg_database_size(current_database())"))
                db_size_bytes = result.scalar()
                db_size_gb = db_size_bytes / (1024**3)
                
                health['checks']['storage'] = {
                    'status': 'warn' if db_size_gb > 10 else 'pass',
                    'size_gb': round(db_size_gb, 2)
                }
                
                # Check for long-running queries
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM pg_stat_activity 
                    WHERE state = 'active' 
                    AND query_start < NOW() - INTERVAL '5 minutes'
                    AND datname = current_database()
                """))
                
                long_queries = result.scalar()
                health['checks']['performance'] = {
                    'status': 'warn' if long_queries > 0 else 'pass',
                    'long_running_queries': long_queries
                }
                
        except Exception as e:
            health['status'] = 'unhealthy'
            health['error'] = str(e)
            logger.error(f"Database health check failed: {e}")
        
        return health
    
    def cleanup_old_data(self, days_to_keep: int = 90):
        """Clean up old data to manage database size"""
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        
        db = self.SessionLocal()
        try:
            # Clean old system metrics (keep last 90 days)
            deleted_metrics = db.query(SystemMetrics).filter(
                SystemMetrics.timestamp < cutoff_date
            ).delete()
            
            # Clean old audit logs (keep last 90 days)
            deleted_audits = db.query(AdminAuditLog).filter(
                AdminAuditLog.timestamp < cutoff_date
            ).delete()
            
            # Clean old usage records (keep last 90 days)
            deleted_usage = db.query(UsageRecord).filter(
                UsageRecord.timestamp < cutoff_date
            ).delete()
            
            db.commit()
            
            logger.info(f"Cleaned up old data: {deleted_metrics} metrics, {deleted_audits} audits, {deleted_usage} usage records")
            
        except Exception as e:
            logger.error(f"Error cleaning up old data: {e}")
            db.rollback()
        finally:
            db.close()

# Global database manager instance
db_manager = DatabaseManager()

# Database management CLI commands
async def init_database():
    """Initialize database for first time setup"""
    logger.info("Initializing database...")
    db_manager.initialize_database()
    logger.info("Database initialization complete")

async def run_migrations():
    """Run pending migrations"""
    logger.info("Running database migrations...")
    applied = db_manager.run_migrations()
    if applied:
        logger.info(f"Applied {len(applied)} migrations: {', '.join(applied)}")
    else:
        logger.info("No pending migrations")

async def backup_database():
    """Create database backup"""
    logger.info("Creating database backup...")
    backup_file = db_manager.backup_database()
    logger.info(f"Backup created: {backup_file}")

async def database_health():
    """Check database health"""
    health = db_manager.health_check()
    print(json.dumps(health, indent=2, default=str))

if __name__ == "__main__":
    import sys
    
    commands = {
        "init": init_database,
        "migrate": run_migrations,
        "backup": backup_database,
        "health": database_health,
    }
    
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        print(f"Usage: python database_manager.py [{'/'.join(commands.keys())}]")
        sys.exit(1)
    
    asyncio.run(commands[sys.argv[1]]())
