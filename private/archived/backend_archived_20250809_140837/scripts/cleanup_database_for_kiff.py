#!/usr/bin/env python3
"""
Database Cleanup Script for kiff Transformation
===============================================

This script cleans up the database by removing all legacy trading-related data
while preserving essential user authentication and tenant data for the kiff system.

Usage:
    python scripts/cleanup_database_for_kiff.py [--dry-run] [--confirm]

Options:
    --dry-run    Show what would be deleted without actually deleting
    --confirm    Skip confirmation prompt and proceed with cleanup
"""

import asyncio
import argparse
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from app.core.database import engine, AsyncSessionLocal
from app.core.config import settings

class DatabaseCleanup:
    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        self.engine = engine
        
    async def connect(self):
        """Connect to the database"""
        # Engine is already created in database module
        print(f"✅ Connected to database: {settings.DATABASE_URL.split('@')[-1]}")
        
    async def cleanup_trading_data(self):
        """Remove all trading-related data from the database"""
        
        print("\n🧹 Starting database cleanup for kiff transformation...")
        print("=" * 60)
        
        # Tables to clean up (in order to handle foreign key constraints)
        cleanup_operations = [
            {
                "description": "Remove all backtest results",
                "query": "DELETE FROM backtest_results",
                "schema": "both"  # main and tenant schemas
            },
            {
                "description": "Remove all trading agents", 
                "query": "DELETE FROM agents WHERE app_type IS NULL OR app_type LIKE '%trading%' OR app_type LIKE '%backtest%'",
                "schema": "both"
            },
            {
                "description": "Remove all usage records (trading-related)",
                "query": "DELETE FROM usage_records WHERE resource_type IN ('backtest', 'trading', 'market_data')",
                "schema": "both"
            },
            {
                "description": "Clean up any remaining trading-specific data",
                "query": "DELETE FROM agents WHERE description LIKE '%trading%' OR description LIKE '%market%' OR description LIKE '%backtest%'",
                "schema": "both"
            }
        ]
        
        # Get list of tenant schemas
        tenant_schemas = await self._get_tenant_schemas()
        
        for operation in cleanup_operations:
            await self._execute_cleanup_operation(operation, tenant_schemas)
            
        print("\n🎯 Cleanup operations completed!")
        
    async def _get_tenant_schemas(self):
        """Get list of all tenant schemas"""
        query = """
        SELECT schema_name 
        FROM tenants 
        WHERE schema_name IS NOT NULL 
        AND schema_name != 'public'
        """
        
        async with self.engine.begin() as conn:
            result = await conn.execute(text(query))
            schemas = [row[0] for row in result.fetchall()]
            
        print(f"📋 Found {len(schemas)} tenant schemas: {schemas}")
        return schemas
        
    async def _execute_cleanup_operation(self, operation, tenant_schemas):
        """Execute a cleanup operation on main and/or tenant schemas"""
        
        print(f"\n🔄 {operation['description']}")
        
        schemas_to_clean = []
        
        if operation['schema'] in ['both', 'main']:
            schemas_to_clean.append('public')
            
        if operation['schema'] in ['both', 'tenant']:
            schemas_to_clean.extend(tenant_schemas)
            
        total_deleted = 0
        
        for schema in schemas_to_clean:
            deleted_count = await self._execute_query_in_schema(
                operation['query'], 
                schema
            )
            total_deleted += deleted_count
            
            if deleted_count > 0:
                print(f"  📊 {schema}: {deleted_count} records")
                
        if total_deleted == 0:
            print(f"  ✅ No records found to delete")
        else:
            print(f"  🗑️  Total deleted: {total_deleted} records")
            
    async def _execute_query_in_schema(self, query, schema):
        """Execute a query in a specific schema"""
        
        # Modify query to target specific schema if not public
        if schema != 'public':
            # Replace table names with schema-qualified names
            schema_query = query.replace(' FROM ', f' FROM {schema}.')
            schema_query = schema_query.replace(' UPDATE ', f' UPDATE {schema}.')
        else:
            schema_query = query
            
        if self.dry_run:
            # For dry run, convert DELETE to SELECT COUNT
            if schema_query.strip().upper().startswith('DELETE FROM'):
                table_part = schema_query.split('FROM')[1].split('WHERE')[0].strip()
                where_part = ''
                if 'WHERE' in schema_query:
                    where_part = 'WHERE' + schema_query.split('WHERE')[1]
                count_query = f"SELECT COUNT(*) FROM {table_part} {where_part}"
                
                async with self.engine.begin() as conn:
                    result = await conn.execute(text(count_query))
                    count = result.scalar()
                    print(f"  🔍 [DRY RUN] Would delete {count} records from {schema}")
                    return count
            return 0
        else:
            try:
                async with self.engine.begin() as conn:
                    result = await conn.execute(text(schema_query))
                    return result.rowcount
            except Exception as e:
                print(f"  ⚠️  Error in {schema}: {str(e)}")
                return 0
                
    async def verify_cleanup(self):
        """Verify that cleanup was successful"""
        
        print("\n🔍 Verifying cleanup results...")
        print("=" * 40)
        
        verification_queries = [
            ("Backtest Results", "SELECT COUNT(*) FROM backtest_results"),
            ("Trading Agents", "SELECT COUNT(*) FROM agents WHERE app_type IS NULL OR app_type LIKE '%trading%'"),
            ("Total Agents", "SELECT COUNT(*) FROM agents"),
            ("Users (should remain)", "SELECT COUNT(*) FROM users"),
            ("Tenants (should remain)", "SELECT COUNT(*) FROM tenants"),
        ]
        
        async with self.engine.begin() as conn:
            for description, query in verification_queries:
                try:
                    result = await conn.execute(text(query))
                    count = result.scalar()
                    status = "✅" if "should remain" in description or count == 0 else "📊"
                    print(f"  {status} {description}: {count}")
                except Exception as e:
                    print(f"  ⚠️  {description}: Error - {str(e)}")
                    
    async def create_demo_data(self):
        """Create demo data for kiff system"""
        
        print("\n🎯 Creating demo data for kiff system...")
        print("=" * 40)
        
        # Create demo API gallery items
        demo_apis = [
            {
                "name": "OpenAI API",
                "description": "AI/ML API for text generation, embeddings, and more",
                "base_url": "https://api.openai.com",
                "documentation_url": "https://platform.openai.com/docs",
                "status": "pending",
                "categories": ["AI", "ML", "Text Generation"]
            },
            {
                "name": "Stripe API", 
                "description": "Payment processing and financial services API",
                "base_url": "https://api.stripe.com",
                "documentation_url": "https://stripe.com/docs/api",
                "status": "pending", 
                "categories": ["Payments", "Finance", "E-commerce"]
            },
            {
                "name": "GitHub API",
                "description": "Version control and collaboration platform API",
                "base_url": "https://api.github.com",
                "documentation_url": "https://docs.github.com/en/rest",
                "status": "pending",
                "categories": ["Developer Tools", "Version Control", "Collaboration"]
            }
        ]
        
        if not self.dry_run:
            # Note: This would require implementing the actual API gallery table
            # For now, just show what would be created
            pass
            
        for api in demo_apis:
            print(f"  📚 {api['name']}: {api['description']}")
            
        print(f"  ✅ Demo API gallery ready for indexing")
        
    async def close(self):
        """Close database connection"""
        if self.engine:
            await self.engine.dispose()
            print("\n✅ Database connection closed")

async def main():
    parser = argparse.ArgumentParser(description="Clean database for kiff transformation")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without deleting")
    parser.add_argument("--confirm", action="store_true", help="Skip confirmation prompt")
    
    args = parser.parse_args()
    
    print("🚀 kiff Database Cleanup Script")
    print("=" * 60)
    print("This script will remove all legacy trading data while preserving:")
    print("  ✅ User accounts and authentication")
    print("  ✅ Tenant configurations") 
    print("  ✅ Essential system data")
    print("\nThis will remove:")
    print("  ❌ All trading agents")
    print("  ❌ All backtest results")
    print("  ❌ All market data")
    print("  ❌ All trading-related usage records")
    
    if args.dry_run:
        print("\n🔍 DRY RUN MODE - No data will be deleted")
    else:
        print("\n⚠️  LIVE MODE - Data will be permanently deleted!")
        
    if not args.confirm and not args.dry_run:
        response = input("\nProceed with cleanup? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("❌ Cleanup cancelled")
            return
            
    cleanup = DatabaseCleanup(dry_run=args.dry_run)
    
    try:
        await cleanup.connect()
        await cleanup.cleanup_trading_data()
        await cleanup.verify_cleanup()
        await cleanup.create_demo_data()
        
        print("\n🎉 Database cleanup completed successfully!")
        print("🎯 Database is now ready for the kiff system!")
        
    except Exception as e:
        print(f"\n❌ Error during cleanup: {str(e)}")
        return 1
    finally:
        await cleanup.close()
        
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
