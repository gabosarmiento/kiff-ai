#!/usr/bin/env python3
"""
Database Migration Script
=========================

This script adds missing columns to existing tables and creates new tables
for the Kiff Packs feature.
"""

import os
import sys
import sqlite3
from pathlib import Path

# Add the app directory to Python path
sys.path.append(str(Path(__file__).parent / "app"))

from app.db_core import engine, DATABASE_URL
from app.models_kiffs import Base as KiffBase
from app.models.kiff_packs import Base as PackBase
from sqlalchemy import text, inspect


def migrate_database():
    """Run database migrations"""
    
    print("🔧 Starting database migration...")
    
    # Get database URL
    db_url = DATABASE_URL
    print(f"📊 Database: {db_url}")
    
    if db_url.startswith("sqlite"):
        migrate_sqlite()
    else:
        migrate_postgres()
    
    print("✅ Migration completed successfully!")


def migrate_sqlite():
    """Migrate SQLite database"""
    
    # Extract database path from URL
    db_path = DATABASE_URL.replace("sqlite:///", "")
    
    print(f"📁 SQLite database path: {db_path}")
    
    # Connect to SQLite
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check existing tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        existing_tables = [row[0] for row in cursor.fetchall()]
        print(f"📋 Existing tables: {existing_tables}")
        
        # 1. Add session_id column to kiff_messages if it doesn't exist
        if 'kiff_messages' in existing_tables:
            cursor.execute("PRAGMA table_info(kiff_messages);")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'session_id' not in columns:
                print("➕ Adding session_id column to kiff_messages...")
                cursor.execute("""
                    ALTER TABLE kiff_messages 
                    ADD COLUMN session_id TEXT REFERENCES kiff_chat_sessions(id) ON DELETE CASCADE;
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_kiff_messages_session_id ON kiff_messages(session_id);")
            else:
                print("✓ session_id column already exists in kiff_messages")
        
        # 2. Create kiff_chat_sessions table if it doesn't exist
        if 'kiff_chat_sessions' not in existing_tables:
            print("➕ Creating kiff_chat_sessions table...")
            cursor.execute("""
                CREATE TABLE kiff_chat_sessions (
                    id TEXT PRIMARY KEY,
                    kiff_id TEXT NOT NULL REFERENCES kiffs(id) ON DELETE CASCADE,
                    tenant_id TEXT NOT NULL,
                    user_id TEXT,
                    agent_state TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cursor.execute("CREATE INDEX idx_kiff_chat_sessions_kiff_id ON kiff_chat_sessions(kiff_id);")
            cursor.execute("CREATE INDEX idx_kiff_chat_sessions_tenant_id ON kiff_chat_sessions(tenant_id);")
            cursor.execute("CREATE INDEX idx_kiff_chat_sessions_user_id ON kiff_chat_sessions(user_id);")
        else:
            print("✓ kiff_chat_sessions table already exists")
        
        # 3. Create Kiff Packs tables
        create_kiff_packs_tables(cursor, existing_tables)
        
        # Commit changes
        conn.commit()
        print("💾 SQLite migration completed")
        
    except Exception as e:
        print(f"❌ Error during SQLite migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


def migrate_postgres():
    """Migrate PostgreSQL database using SQLAlchemy"""
    
    print("🐘 Migrating PostgreSQL database...")
    
    # Use SQLAlchemy for PostgreSQL
    with engine.connect() as conn:
        try:
            # Check if tables exist
            inspector = inspect(engine)
            existing_tables = inspector.get_table_names()
            print(f"📋 Existing tables: {existing_tables}")
            
            # Add session_id column if missing
            if 'kiff_messages' in existing_tables:
                columns = [col['name'] for col in inspector.get_columns('kiff_messages')]
                if 'session_id' not in columns:
                    print("➕ Adding session_id column to kiff_messages...")
                    conn.execute(text("""
                        ALTER TABLE kiff_messages 
                        ADD COLUMN session_id VARCHAR REFERENCES kiff_chat_sessions(id) ON DELETE CASCADE;
                    """))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_kiff_messages_session_id ON kiff_messages(session_id);"))
                else:
                    print("✓ session_id column already exists in kiff_messages")
            
            # Create all missing tables using SQLAlchemy
            print("➕ Creating missing tables...")
            KiffBase.metadata.create_all(engine)
            PackBase.metadata.create_all(engine)
            
            conn.commit()
            print("💾 PostgreSQL migration completed")
            
        except Exception as e:
            print(f"❌ Error during PostgreSQL migration: {e}")
            conn.rollback()
            raise


def create_kiff_packs_tables(cursor, existing_tables):
    """Create Kiff Packs tables in SQLite"""
    
    # 1. Kiff Packs table
    if 'kiff_packs' not in existing_tables:
        print("➕ Creating kiff_packs table...")
        cursor.execute("""
            CREATE TABLE kiff_packs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                created_by TEXT NOT NULL,
                api_url TEXT NOT NULL,
                documentation_urls TEXT DEFAULT '[]',
                api_structure TEXT DEFAULT '{}',
                code_examples TEXT DEFAULT '{}',
                integration_patterns TEXT DEFAULT '[]',
                usage_count INTEGER DEFAULT 0,
                total_users_used INTEGER DEFAULT 0,
                avg_rating REAL DEFAULT 0.0,
                is_public BOOLEAN DEFAULT 1,
                is_verified BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                tags TEXT DEFAULT '[]',
                processing_status TEXT DEFAULT 'pending',
                processing_error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_used_at TIMESTAMP
            );
        """)
        
        # Create indexes
        cursor.execute("CREATE INDEX idx_kiff_packs_tenant_category ON kiff_packs(tenant_id, category);")
        cursor.execute("CREATE INDEX idx_kiff_packs_tenant_public ON kiff_packs(tenant_id, is_public);")
        cursor.execute("CREATE INDEX idx_kiff_packs_usage_count ON kiff_packs(usage_count);")
        cursor.execute("CREATE INDEX idx_kiff_packs_avg_rating ON kiff_packs(avg_rating);")
    else:
        print("✓ kiff_packs table already exists")
    
    # 2. Pack Usage table
    if 'pack_usage' not in existing_tables:
        print("➕ Creating pack_usage table...")
        cursor.execute("""
            CREATE TABLE pack_usage (
                id TEXT PRIMARY KEY,
                pack_id TEXT NOT NULL REFERENCES kiff_packs(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                kiff_id TEXT,
                usage_context TEXT,
                usage_type TEXT DEFAULT 'generation',
                usage_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        cursor.execute("CREATE INDEX idx_pack_usage_pack_usage_timestamp ON pack_usage(pack_id, usage_timestamp);")
        cursor.execute("CREATE INDEX idx_pack_usage_user_usage_timestamp ON pack_usage(user_id, usage_timestamp);")
        cursor.execute("CREATE INDEX idx_pack_usage_tenant_usage_timestamp ON pack_usage(tenant_id, usage_timestamp);")
    else:
        print("✓ pack_usage table already exists")
    
    # 3. Pack Ratings table
    if 'pack_ratings' not in existing_tables:
        print("➕ Creating pack_ratings table...")
        cursor.execute("""
            CREATE TABLE pack_ratings (
                id TEXT PRIMARY KEY,
                pack_id TEXT NOT NULL REFERENCES kiff_packs(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                rating INTEGER NOT NULL,
                feedback_comment TEXT,
                kiff_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        cursor.execute("CREATE UNIQUE INDEX idx_pack_ratings_unique_user_pack ON pack_ratings(user_id, pack_id);")
        cursor.execute("CREATE INDEX idx_pack_ratings_pack_rating ON pack_ratings(pack_id, rating);")
    else:
        print("✓ pack_ratings table already exists")
    
    # 4. Pack Requests table
    if 'pack_requests' not in existing_tables:
        print("➕ Creating pack_requests table...")
        cursor.execute("""
            CREATE TABLE pack_requests (
                id TEXT PRIMARY KEY,
                api_name TEXT NOT NULL,
                api_url TEXT,
                use_case TEXT NOT NULL,
                priority TEXT DEFAULT 'medium',
                requested_by TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                status TEXT DEFAULT 'open',
                assigned_to TEXT,
                fulfilled_pack_id TEXT,
                upvotes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        cursor.execute("CREATE INDEX idx_pack_requests_tenant_status ON pack_requests(tenant_id, status);")
        cursor.execute("CREATE INDEX idx_pack_requests_priority_upvotes ON pack_requests(priority, upvotes);")
    else:
        print("✓ pack_requests table already exists")


if __name__ == "__main__":
    try:
        migrate_database()
    except Exception as e:
        print(f"💥 Migration failed: {e}")
        sys.exit(1)