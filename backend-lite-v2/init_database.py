#!/usr/bin/env python3
"""
Initialize PostgreSQL database with all required tables.
This script creates all the missing tables for the Kiff platform.
"""

import os
import sys
from pathlib import Path

# Add the app directory to Python path
app_dir = Path(__file__).parent / "app"
sys.path.insert(0, str(app_dir))

# Import all the models to ensure they're registered
from app.db_core import engine
from app.models_kiffs import Base as KiffsBase
from app.models.kiff_packs import Base as PacksBase

def init_database():
    """Initialize all tables in the database"""
    print("🗄️  Initializing PostgreSQL database...")
    print(f"Database URL: {os.getenv('DATABASE_URL', 'Not set')[:30]}...")
    
    try:
        # Create all tables from both model modules
        print("Creating tables from models_kiffs...")
        KiffsBase.metadata.create_all(bind=engine)
        
        print("Creating tables from kiff_packs models...")
        PacksBase.metadata.create_all(bind=engine)
        
        print("✅ Successfully created all database tables:")
        
        # List the created tables
        from sqlalchemy import inspect
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        
        print("📋 Created tables:")
        for table_name in sorted(table_names):
            print(f"  - {table_name}")
        
        print(f"\n🎉 Database initialization complete! Created {len(table_names)} tables.")
        return True
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = init_database()
    if not success:
        sys.exit(1)