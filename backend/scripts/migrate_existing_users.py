#!/usr/bin/env python3
"""
Migration script to create tenants for existing users who don't have them yet.
This handles the transition from single-tenant to multi-tenant architecture.

Usage:
    python scripts/migrate_existing_users.py [--dry-run]
"""

import asyncio
import logging
import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select, text
from app.core.database import get_db
from app.core.multi_tenant_db import mt_db_manager
from app.models.models import User

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def migrate_existing_users(dry_run: bool = False):
    """
    Create tenants for existing users who don't have them yet.
    
    Args:
        dry_run: If True, only show what would be done without making changes
    """
    logger.info("Starting migration of existing users to multi-tenant architecture")
    
    if dry_run:
        logger.info("DRY RUN MODE - No changes will be made")
    
    # Get database session
    async for db in get_db():
        try:
            # Find all users who don't have tenants yet (excluding admin users)
            result = await db.execute(
                select(User).where(
                    User.tenant_id.is_(None),
                    User.role.in_(['user'])  # Only regular users, not admin/superadmin
                )
            )
            users_without_tenants = result.scalars().all()
            
            logger.info(f"Found {len(users_without_tenants)} users without tenants")
            
            if not users_without_tenants:
                logger.info("No users need migration - all users already have tenants")
                return
            
            # Process each user
            migrated_count = 0
            failed_count = 0
            
            for user in users_without_tenants:
                try:
                    logger.info(f"Processing user: {user.email} (ID: {user.id})")
                    
                    if dry_run:
                        logger.info(f"  [DRY RUN] Would create tenant for {user.email}")
                        continue
                    
                    # Generate tenant name and slug from user info
                    tenant_name = f"{user.full_name or user.username}'s Workspace"
                    tenant_slug = f"user-{user.id}-{user.username.lower().replace('_', '-')}"
                    
                    # Check if tenant already exists
                    with mt_db_manager.master_engine.connect() as conn:
                        from sqlalchemy import text
                        result = conn.execute(text(
                            "SELECT id FROM tenants WHERE slug = :slug"
                        ), {"slug": tenant_slug})
                        existing_tenant = result.fetchone()
                    
                    if existing_tenant:
                        tenant_id = str(existing_tenant[0])
                        logger.info(f"  Using existing tenant: {tenant_id} for {user.email}")
                    else:
                        # Create tenant using the multi-tenant manager
                        tenant_info = await mt_db_manager.create_tenant(
                            name=tenant_name,
                            slug=tenant_slug,
                            admin_email=user.email
                        )
                        tenant_id = tenant_info["tenant_id"]
                        logger.info(f"  Created tenant: {tenant_id} for {user.email}")
                    
                    # Associate user with the new tenant
                    with mt_db_manager.master_engine.connect() as conn:
                        conn.execute(text("""
                            INSERT INTO tenant_users (tenant_id, user_id, role, joined_at)
                            VALUES (:tenant_id, :user_id, :role, NOW())
                            ON CONFLICT (tenant_id, user_id) DO NOTHING
                        """), {
                            "tenant_id": tenant_id,
                            "user_id": user.id,
                            "role": "admin"  # User is admin of their own workspace
                        })
                        conn.commit()
                    
                    # Update user record with tenant_id (cast to UUID for PostgreSQL)
                    from sqlalchemy import text
                    await db.execute(text(
                        "UPDATE users SET tenant_id = CAST(:tenant_id AS uuid) WHERE id = :user_id"
                    ), {"tenant_id": tenant_id, "user_id": user.id})
                    await db.commit()
                    
                    logger.info(f"  Successfully migrated user {user.email} to tenant {tenant_id}")
                    migrated_count += 1
                    
                except Exception as e:
                    logger.error(f"  Failed to migrate user {user.email}: {e}")
                    failed_count += 1
                    continue
            
            logger.info(f"Migration completed:")
            logger.info(f"  Successfully migrated: {migrated_count} users")
            logger.info(f"  Failed migrations: {failed_count} users")
            
            if failed_count > 0:
                logger.warning("Some users failed to migrate. Check logs above for details.")
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise
        finally:
            await db.close()


async def check_admin_users():
    """Check and report on admin users (who should not get isolated tenants)"""
    logger.info("Checking admin users...")
    
    async for db in get_db():
        try:
            # Find admin/superadmin users
            result = await db.execute(
                select(User).where(User.role.in_(['admin', 'superadmin']))
            )
            admin_users = result.scalars().all()
            
            logger.info(f"Found {len(admin_users)} admin users:")
            for user in admin_users:
                tenant_status = "has tenant" if user.tenant_id else "no tenant"
                logger.info(f"  {user.email} ({user.role}) - {tenant_status}")
            
            if admin_users:
                logger.info("Admin users will have global access to all tenants (no isolated workspace)")
            
        except Exception as e:
            logger.error(f"Failed to check admin users: {e}")
        finally:
            await db.close()


def main():
    """Main entry point for the migration script"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate existing users to multi-tenant architecture")
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--check-admins",
        action="store_true",
        help="Check admin users status"
    )
    
    args = parser.parse_args()
    
    if args.check_admins:
        asyncio.run(check_admin_users())
    else:
        asyncio.run(migrate_existing_users(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
