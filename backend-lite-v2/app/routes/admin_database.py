"""
Admin Database Management Routes
===============================

Administrative endpoints for database operations like table creation and migration.
These endpoints are protected and should only be accessible to admin users.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import inspect
from typing import Dict, List, Any

from ..db_core import engine
from ..models_kiffs import Base as KiffsBase
from ..models.kiff_packs import Base as PacksBase

router = APIRouter(prefix="/api/admin/database", tags=["admin_database"])

@router.post("/init")
async def initialize_database():
    """
    Initialize the database by creating all required tables.
    This is a one-time operation that should be run after deployment.
    """
    try:
        print("🗄️ Initializing database tables...")
        
        # Create all tables from both model modules
        KiffsBase.metadata.create_all(bind=engine)
        PacksBase.metadata.create_all(bind=engine)
        
        # Get the list of created tables
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        
        result = {
            "status": "success",
            "message": f"Successfully created {len(table_names)} tables",
            "tables_created": sorted(table_names)
        }
        
        print(f"✅ Database initialization complete! Created {len(table_names)} tables.")
        return result
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize database: {str(e)}"
        )

@router.get("/status")
async def database_status():
    """
    Get the current status of the database including table count and connection info.
    """
    try:
        # Get database info
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        
        # Check if core tables exist
        core_tables = {"kiff_packs", "kiffs", "users", "kiff_chat_sessions"}
        existing_core_tables = core_tables.intersection(set(table_names))
        missing_core_tables = core_tables - existing_core_tables
        
        return {
            "status": "connected",
            "total_tables": len(table_names),
            "tables": sorted(table_names),
            "core_tables_status": {
                "existing": sorted(existing_core_tables),
                "missing": sorted(missing_core_tables),
                "all_present": len(missing_core_tables) == 0
            },
            "database_engine": str(engine.url).split("://")[0]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get database status: {str(e)}"
        )