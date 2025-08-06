"""
Feature Flag Admin API Routes
============================

Admin endpoints for managing feature flags to control frontend UI sections.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Dict, Any, Optional
import logging

from app.core.database import get_db
from app.models.models import User
from app.models.admin_models import FeatureFlag
from app.schemas.admin_schemas import (
    FeatureFlagResponse, 
    FeatureFlagCreate, 
    FeatureFlagUpdate
)

# Simple admin check function - bypass auth for now
def get_current_admin_user():
    """Simple admin user bypass - no authentication required"""
    return None

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/feature-flags", tags=["admin-feature-flags"])

@router.get("/", response_model=List[FeatureFlagResponse])
async def get_feature_flags(
    db: AsyncSession = Depends(get_db),
    enabled_only: bool = Query(False, description="Return only enabled flags")
):
    """Get all feature flags"""
    try:
        query = select(FeatureFlag).order_by(desc(FeatureFlag.created_at))
        
        if enabled_only:
            query = query.where(FeatureFlag.is_enabled == True)
        
        result = await db.execute(query)
        flags = result.scalars().all()
        
        return [
            FeatureFlagResponse(
                id=flag.id,
                name=flag.name,
                description=flag.description,
                is_enabled=flag.is_enabled,
                rollout_percentage=flag.rollout_percentage,
                target_user_segments=flag.target_user_segments,
                created_at=flag.created_at
            )
            for flag in flags
        ]
        
    except Exception as e:
        logger.error(f"❌ Failed to get feature flags: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=FeatureFlagResponse)
async def create_feature_flag(
    flag_data: FeatureFlagCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create new feature flag"""
    try:
        # Check if flag name already exists
        existing_flag = await db.execute(
            select(FeatureFlag).where(FeatureFlag.name == flag_data.name)
        )
        if existing_flag.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Feature flag '{flag_data.name}' already exists")
        
        # Create new flag
        new_flag = FeatureFlag(
            name=flag_data.name,
            description=flag_data.description,
            is_enabled=flag_data.is_enabled,
            rollout_percentage=flag_data.rollout_percentage,
            target_user_segments=flag_data.target_user_segments,
            created_by=None
        )
        
        db.add(new_flag)
        await db.commit()
        await db.refresh(new_flag)
        
        logger.info(f"✅ Created feature flag: {flag_data.name}")
        
        return FeatureFlagResponse(
            id=new_flag.id,
            name=new_flag.name,
            description=new_flag.description,
            is_enabled=new_flag.is_enabled,
            rollout_percentage=new_flag.rollout_percentage,
            target_user_segments=new_flag.target_user_segments,
            created_at=new_flag.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to create feature flag: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{flag_id}", response_model=FeatureFlagResponse)
async def update_feature_flag(
    flag_id: int,
    flag_data: FeatureFlagUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update feature flag"""
    try:
        # Get existing flag
        result = await db.execute(
            select(FeatureFlag).where(FeatureFlag.id == flag_id)
        )
        flag = result.scalar_one_or_none()
        
        if not flag:
            raise HTTPException(status_code=404, detail="Feature flag not found")
        
        # Update fields
        if flag_data.description is not None:
            flag.description = flag_data.description
        if flag_data.is_enabled is not None:
            flag.is_enabled = flag_data.is_enabled
        if flag_data.rollout_percentage is not None:
            flag.rollout_percentage = flag_data.rollout_percentage
        if flag_data.target_user_segments is not None:
            flag.target_user_segments = flag_data.target_user_segments
        
        await db.commit()
        await db.refresh(flag)
        
        logger.info(f"✅ Updated feature flag: {flag.name}")
        
        return FeatureFlagResponse(
            id=flag.id,
            name=flag.name,
            description=flag.description,
            is_enabled=flag.is_enabled,
            rollout_percentage=flag.rollout_percentage,
            target_user_segments=flag.target_user_segments,
            created_at=flag.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to update feature flag: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{flag_id}")
async def delete_feature_flag(
    flag_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete feature flag"""
    try:
        # Get existing flag
        result = await db.execute(
            select(FeatureFlag).where(FeatureFlag.id == flag_id)
        )
        flag = result.scalar_one_or_none()
        
        if not flag:
            raise HTTPException(status_code=404, detail="Feature flag not found")
        
        flag_name = flag.name
        await db.delete(flag)
        await db.commit()
        
        logger.info(f"✅ Deleted feature flag: {flag_name}")
        
        return {"message": f"Feature flag '{flag_name}' deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete feature flag: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{flag_id}/toggle")
async def toggle_feature_flag(
    flag_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Quick toggle feature flag on/off"""
    try:
        # Get existing flag
        result = await db.execute(
            select(FeatureFlag).where(FeatureFlag.id == flag_id)
        )
        flag = result.scalar_one_or_none()
        
        if not flag:
            raise HTTPException(status_code=404, detail="Feature flag not found")
        
        # Toggle the flag
        flag.is_enabled = not flag.is_enabled
        await db.commit()
        await db.refresh(flag)
        
        status = "enabled" if flag.is_enabled else "disabled"
        logger.info(f"✅ Toggled feature flag: {flag.name} to {status}")
        
        return {
            "message": f"Feature flag '{flag.name}' {status}",
            "is_enabled": flag.is_enabled
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to toggle feature flag: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Public endpoint for frontend to check feature flags
@router.get("/public/enabled", response_model=Dict[str, bool])
async def get_enabled_feature_flags(
    db: AsyncSession = Depends(get_db)
):
    """Get all enabled feature flags for frontend use"""
    try:
        result = await db.execute(
            select(FeatureFlag).where(FeatureFlag.is_enabled == True)
        )
        flags = result.scalars().all()
        
        # Return simple name -> enabled mapping
        return {flag.name: flag.is_enabled for flag in flags}
        
    except Exception as e:
        logger.error(f"❌ Failed to get enabled feature flags: {e}")
        raise HTTPException(status_code=500, detail=str(e))