"""
Kiff Packs API Routes
====================

API endpoints for managing tenant-wide kiff packs including creation,
retrieval, rating, and administrative functions.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc
from typing import List, Optional, Dict, Any
import json
from datetime import datetime
import os

from app.db_core import SessionLocal
from app.models.kiff_packs import KiffPack, PackUsage, PackRating, PackRequest
from app.services.pack_processor import PackProcessor
from app.services.vector_storage import VectorStorageService

router = APIRouter(prefix="/api/packs", tags=["kiff-packs"])


def _require_tenant(x_tenant_id: Optional[str]):
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="Tenant not specified")
    return x_tenant_id


class PackCreateRequest:
    def __init__(self, data: dict):
        self.name = data.get('name')
        self.display_name = data.get('display_name')
        self.description = data.get('description')
        self.category = data.get('category')
        self.api_url = data.get('api_url')
        self.additional_urls = data.get('additional_urls', [])
        self.make_public = data.get('make_public', True)
        self.request_verification = data.get('request_verification', False)


@router.get("/")
async def get_tenant_packs(
    search: Optional[str] = Query(None, description="Search by name, category, or description"),
    category: Optional[str] = Query("all", description="Filter by category"),
    sort: Optional[str] = Query("most_used", description="Sort order"),
    limit: Optional[int] = Query(50, description="Maximum number of results"),
    offset: Optional[int] = Query(0, description="Offset for pagination"),
    x_tenant_id: str = Header(None)
):
    """Get all packs available to the user's tenant"""
    
    tenant_id = _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        # Base query for tenant's public packs
        query = db.query(KiffPack).filter(
            and_(
                KiffPack.tenant_id == tenant_id,
                KiffPack.is_public == True,
                KiffPack.is_active == True
            )
        )
        
        # Apply search filter
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    KiffPack.name.ilike(search_term),
                    KiffPack.display_name.ilike(search_term),
                    KiffPack.description.ilike(search_term),
                    KiffPack.category.ilike(search_term)
                )
            )
        
        # Apply category filter
        if category and category != "all":
            query = query.filter(KiffPack.category == category)
        
        # Apply sorting
        if sort == "most_used":
            query = query.order_by(desc(KiffPack.usage_count))
        elif sort == "newest":
            query = query.order_by(desc(KiffPack.created_at))
        elif sort == "highest_rated":
            query = query.order_by(desc(KiffPack.avg_rating))
        elif sort == "alphabetical":
            query = query.order_by(asc(KiffPack.display_name))
        else:
            query = query.order_by(desc(KiffPack.usage_count))
        
        # Get total count for pagination
        total_count = query.count()
        
        # Apply pagination
        packs = query.offset(offset).limit(limit).all()
        
        # Enhance pack data with basic information
        enhanced_packs = []
        for pack in packs:
            pack_dict = pack.to_dict()
            
            # Add creator name (you might want to join with user table)
            pack_dict['created_by_name'] = pack.created_by  # TODO: Replace with actual user name lookup
            
            # Note: User-specific ratings would require user authentication
            pack_dict['user_rating'] = None
            
            enhanced_packs.append(pack_dict)
        
        return {
            "packs": enhanced_packs,
            "total": total_count,
            "offset": offset,
            "limit": limit,
            "has_more": offset + limit < total_count
        }
    finally:
        db.close()


@router.get("/categories")
async def get_pack_categories(
    x_tenant_id: str = Header(None)
):
    """Get list of categories used in tenant's packs"""
    
    tenant_id = _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        categories = db.query(KiffPack.category).filter(
            and_(
                KiffPack.tenant_id == tenant_id,
                KiffPack.is_public == True,
                KiffPack.is_active == True
            )
        ).distinct().all()
        
        return {
            "categories": [cat[0] for cat in categories if cat[0]]
        }
    finally:
        db.close()


@router.post("/create")
async def create_kiff_pack(
    pack_data: dict,
    background_tasks: BackgroundTasks,
    x_tenant_id: str = Header(None)
):
    """Create a new kiff pack"""
    
    tenant_id = _require_tenant(x_tenant_id)
    # Use tenant_id as default user for now - in real system you'd get this from session
    user_id = f"user@{tenant_id}"
    
    db: Session = SessionLocal()
    try:
        # Validate and parse request
        request_data = PackCreateRequest(pack_data)
        
        if not all([request_data.name, request_data.display_name, request_data.description, request_data.api_url]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Check if pack name already exists in tenant
        existing_pack = db.query(KiffPack).filter(
            and_(
                KiffPack.tenant_id == tenant_id,
                KiffPack.name == request_data.name
            )
        ).first()
        
        if existing_pack:
            raise HTTPException(status_code=409, detail="Pack with this name already exists")
        
        # Create pack record
        pack = KiffPack(
            name=request_data.name,
            display_name=request_data.display_name,
            description=request_data.description,
            category=request_data.category,
            tenant_id=tenant_id,
            created_by=user_id,
            api_url=request_data.api_url,
            documentation_urls=[request_data.api_url] + request_data.additional_urls,
            is_public=request_data.make_public,
            is_verified=False,  # Admin verification required
            processing_status="pending"
        )
        
        db.add(pack)
        db.commit()
        db.refresh(pack)
        
        # Process pack content in background
        background_tasks.add_task(
            process_pack_content,
            pack.id,
            tenant_id
        )
        
        return {
            "pack_id": pack.id,
            "message": "Pack created successfully. Processing API documentation...",
            "status": "processing"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating pack: {str(e)}")
    finally:
        db.close()


@router.post("/{pack_id}/add-url")
async def add_pack_url(
    pack_id: str,
    payload: dict,
    background_tasks: BackgroundTasks,
    x_tenant_id: str = Header(None)
):
    """Add an API/documentation URL to an existing pack and trigger reprocessing.

    Body supports either:
    - {"api_url": "https://..."}
    - {"additional_urls": ["https://...", ...]}
    Both may be provided; they will be merged into documentation_urls (deduped).
    """
    tenant_id = _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        pack = db.query(KiffPack).filter(
            and_(KiffPack.id == pack_id, KiffPack.tenant_id == tenant_id, KiffPack.is_active == True)
        ).first()
        if not pack:
            raise HTTPException(status_code=404, detail="Pack not found")

        new_primary = payload.get("api_url")
        extra = payload.get("additional_urls", []) or []
        if not new_primary and not extra:
            raise HTTPException(status_code=400, detail="Provide api_url and/or additional_urls")

        # Merge and dedupe documentation URLs
        doc_urls = list(pack.documentation_urls or [])
        if new_primary:
            if not pack.api_url:
                pack.api_url = new_primary
            doc_urls.append(new_primary)
        for u in extra:
            doc_urls.append(u)
        # Dedupe while preserving order
        seen = set()
        merged = []
        for u in doc_urls:
            if not isinstance(u, str):
                continue
            if u not in seen:
                seen.add(u)
                merged.append(u)
        pack.documentation_urls = merged

        # Set status to pending and clear error to trigger reprocessing
        pack.processing_status = "pending"
        pack.processing_error = None

        db.commit()
        db.refresh(pack)

        # Trigger background processing
        background_tasks.add_task(process_pack_content, pack.id, tenant_id)

        return {
            "pack_id": pack.id,
            "message": "URL(s) added. Reprocessing started.",
            "status": pack.processing_status,
            "documentation_urls": pack.documentation_urls,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating pack: {e}")
    finally:
        db.close()


@router.post("/{pack_id}/reprocess")
async def reprocess_pack(
    pack_id: str,
    background_tasks: BackgroundTasks,
    x_tenant_id: str = Header(None)
):
    """Explicitly trigger reprocessing of a pack's content."""
    tenant_id = _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        pack = db.query(KiffPack).filter(
            and_(KiffPack.id == pack_id, KiffPack.tenant_id == tenant_id, KiffPack.is_active == True)
        ).first()
        if not pack:
            raise HTTPException(status_code=404, detail="Pack not found")

        pack.processing_status = "pending"
        pack.processing_error = None
        db.commit()
        db.refresh(pack)

        background_tasks.add_task(process_pack_content, pack.id, tenant_id)

        return {"pack_id": pack.id, "status": pack.processing_status, "message": "Reprocessing started"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error reprocessing pack: {e}")
    finally:
        db.close()


@router.get("/{pack_id}")
async def get_pack_details(
    pack_id: str,
    x_tenant_id: str = Header(None)
):
    """Get detailed information about a specific pack"""
    
    tenant_id = _require_tenant(x_tenant_id)
    user_id = f"user@{tenant_id}"  # Default user for tracking
    
    db: Session = SessionLocal()
    try:
        pack = db.query(KiffPack).filter(
            and_(
                KiffPack.id == pack_id,
                KiffPack.tenant_id == tenant_id,
                KiffPack.is_active == True
            )
        ).first()
        
        if not pack:
            raise HTTPException(status_code=404, detail="Pack not found")
        
        # Track pack access
        track_pack_access(pack_id, user_id, tenant_id, db)
        
        # Get pack details including content
        pack_details = pack.to_dict_detailed()
        
        # Add creator name
        pack_details['created_by_name'] = pack.created_by  # TODO: Replace with actual user lookup
        
        # Get recent ratings and feedback
        recent_ratings = db.query(PackRating).filter(
            PackRating.pack_id == pack_id
        ).order_by(desc(PackRating.created_at)).limit(10).all()
        
        pack_details['recent_ratings'] = [
            {
                "rating": rating.rating,
                "comment": rating.feedback_comment,
                "user_id": rating.user_id,  # TODO: Replace with user name
                "created_at": rating.created_at.isoformat()
            }
            for rating in recent_ratings
        ]
        
        return pack_details
    finally:
        db.close()


@router.get("/{pack_id}/status")
async def get_pack_status(
    pack_id: str,
    x_tenant_id: str = Header(None)
):
    """Lightweight status endpoint for polling pack processing state.

    Always returns basic information for an existing pack, including
    processing_state and optional error, without loading heavy content.
    """
    tenant_id = _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        pack = db.query(KiffPack).filter(
            and_(
                KiffPack.id == pack_id,
                KiffPack.tenant_id == tenant_id,
                KiffPack.is_active == True
            )
        ).first()

        if not pack:
            # Preserve 404 only when the pack truly does not exist for this tenant
            raise HTTPException(status_code=404, detail="Pack not found")

        return {
            "id": pack.id,
            "name": pack.name,
            "display_name": pack.display_name,
            "processing_status": pack.processing_status,
            "processing_error": pack.processing_error,
            "updated_at": pack.updated_at.isoformat() if pack.updated_at else None,
        }
    finally:
        db.close()


@router.post("/{pack_id}/rate")
async def rate_pack(
    pack_id: str,
    rating_data: dict,
    x_tenant_id: str = Header(None)
):
    """Rate a pack and provide feedback"""
    
    tenant_id = _require_tenant(x_tenant_id)
    user_id = f"user@{tenant_id}"  # Default user for rating
    
    db: Session = SessionLocal()
    try:
        pack = db.query(KiffPack).filter(
            and_(
                KiffPack.id == pack_id,
                KiffPack.tenant_id == tenant_id
            )
        ).first()
        
        if not pack:
            raise HTTPException(status_code=404, detail="Pack not found")
        
        rating_value = rating_data.get('rating')
        if not rating_value or rating_value < 1 or rating_value > 5:
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        
        # Update or create rating
        existing_rating = db.query(PackRating).filter(
            and_(
                PackRating.pack_id == pack_id,
                PackRating.user_id == user_id
            )
        ).first()
        
        if existing_rating:
            existing_rating.rating = rating_value
            existing_rating.feedback_comment = rating_data.get('comment')
            existing_rating.updated_at = datetime.utcnow()
        else:
            new_rating = PackRating(
                pack_id=pack_id,
                user_id=user_id,
                tenant_id=tenant_id,
                rating=rating_value,
                feedback_comment=rating_data.get('comment'),
                kiff_id=rating_data.get('kiff_id')
            )
            db.add(new_rating)
        
        # Update pack's average rating
        all_ratings = db.query(PackRating.rating).filter(PackRating.pack_id == pack_id).all()
        if all_ratings:
            pack.avg_rating = sum(r[0] for r in all_ratings) / len(all_ratings)
        
        db.commit()
        
        return {"message": "Rating submitted successfully"}
    finally:
        db.close()


@router.post("/{pack_id}/use")
async def track_pack_usage(
    pack_id: str,
    usage_data: dict,
    x_tenant_id: str = Header(None)
):
    """Track when a pack is used in kiff generation"""
    
    tenant_id = _require_tenant(x_tenant_id)
    user_id = f"user@{tenant_id}"  # Default user for usage tracking
    
    db: Session = SessionLocal()
    try:
        pack = db.query(KiffPack).filter(
            and_(
                KiffPack.id == pack_id,
                KiffPack.tenant_id == tenant_id
            )
        ).first()
        
        if not pack:
            raise HTTPException(status_code=404, detail="Pack not found")
        
        # Record usage
        usage = PackUsage(
            pack_id=pack_id,
            user_id=user_id,
            tenant_id=tenant_id,
            kiff_id=usage_data.get('kiff_id'),
            usage_context=usage_data.get('context'),
            usage_type=usage_data.get('type', 'generation')
        )
        db.add(usage)
        
        # Update pack metrics
        pack.usage_count += 1
        pack.last_used_at = datetime.utcnow()
        
        # Update unique users count
        unique_users = db.query(PackUsage.user_id).filter(
            PackUsage.pack_id == pack_id
        ).distinct().count()
        pack.total_users_used = unique_users
        
        db.commit()
        
        return {"message": "Usage tracked successfully"}
    finally:
        db.close()


@router.get("/suggest")
async def suggest_packs(
    context: str = Query(..., description="User's idea or context for suggestions"),
    limit: int = Query(5, description="Number of suggestions"),
    x_tenant_id: str = Header(None)
):
    """Get pack suggestions based on user's idea context"""
    
    tenant_id = _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        try:
            # Use vector similarity search if available
            vector_service = VectorStorageService()
            suggested_packs = await vector_service.search_similar_packs(
                context, 
                tenant_id, 
                limit
            )
            
            if suggested_packs:
                return {"suggested_packs": suggested_packs}
            
        except Exception as e:
            print(f"Vector search failed: {e}")
        
        # Fallback to keyword-based search
        search_terms = context.lower().split()
        suggested = []
        
        for term in search_terms[:3]:  # Use first 3 terms
            packs = db.query(KiffPack).filter(
                and_(
                    KiffPack.tenant_id == tenant_id,
                    KiffPack.is_public == True,
                    KiffPack.is_active == True,
                    or_(
                        KiffPack.name.ilike(f"%{term}%"),
                        KiffPack.description.ilike(f"%{term}%"),
                        KiffPack.category.ilike(f"%{term}%")
                    )
                )
            ).order_by(desc(KiffPack.avg_rating)).limit(limit).all()
            
            suggested.extend([pack.to_dict() for pack in packs])
        
        # Remove duplicates and limit results
        seen_ids = set()
        unique_suggestions = []
        for pack in suggested:
            if pack['id'] not in seen_ids:
                seen_ids.add(pack['id'])
                unique_suggestions.append(pack)
                if len(unique_suggestions) >= limit:
                    break
        
        return {"suggested_packs": unique_suggestions}
    finally:
        db.close()


@router.get("/stats")
async def get_pack_stats(
    x_tenant_id: str = Header(None)
):
    """Get pack statistics for tenant"""
    
    tenant_id = _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        # Get all tenant packs
        all_packs = db.query(KiffPack).filter(
            and_(
                KiffPack.tenant_id == tenant_id,
                KiffPack.is_public == True
            )
        ).all()
        
        if not all_packs:
            return {
                "total_packs": 0,
                "categories": {},
                "total_usage": 0,
                "avg_rating": 0.0,
                "verified_packs": 0,
                "top_pack": None
            }
        
        # Calculate statistics
        categories = {}
        total_usage = 0
        total_ratings = []
        verified_count = 0
        top_pack = None
        max_usage = 0
        
        for pack in all_packs:
            # Categories
            if pack.category in categories:
                categories[pack.category] += 1
            else:
                categories[pack.category] = 1
            
            # Usage
            total_usage += pack.usage_count
            
            # Ratings
            if pack.avg_rating > 0:
                total_ratings.append(pack.avg_rating)
            
            # Verified
            if pack.is_verified:
                verified_count += 1
            
            # Top pack
            if pack.usage_count > max_usage:
                max_usage = pack.usage_count
                top_pack = {
                    "name": pack.display_name,
                    "usage_count": pack.usage_count
                }
        
        avg_rating = sum(total_ratings) / len(total_ratings) if total_ratings else 0.0
        
        return {
            "total_packs": len(all_packs),
            "categories": categories,
            "total_usage": total_usage,
            "avg_rating": avg_rating,
            "verified_packs": verified_count,
            "top_pack": top_pack
        }
    finally:
        db.close()


@router.get("/admin/stats")
async def get_admin_pack_stats(
    x_tenant_id: str = Header(None)
):
    """Admin: Get detailed pack statistics"""
    
    tenant_id = _require_tenant(x_tenant_id)
    # Note: Admin permission checking would require session authentication
    # For now, this endpoint is available to all tenant users
    
    db: Session = SessionLocal()
    try:
        # Get all tenant packs including inactive
        all_packs = db.query(KiffPack).filter(
            KiffPack.tenant_id == tenant_id
        ).all()
        
        # Calculate admin statistics
        stats = {
            "total_packs": len(all_packs),
            "verified_packs": sum(1 for p in all_packs if p.is_verified),
            "pending_verification": sum(1 for p in all_packs if not p.is_verified and p.processing_status == 'ready'),
            "failed_processing": sum(1 for p in all_packs if p.processing_status == 'failed'),
            "total_usage": sum(p.usage_count for p in all_packs),
            "avg_rating": sum(p.avg_rating for p in all_packs if p.avg_rating > 0) / max(1, len([p for p in all_packs if p.avg_rating > 0]))
        }
        
        return stats
    finally:
        db.close()


# Admin endpoints
@router.get("/admin/all")
async def get_all_packs_admin(
    status: Optional[str] = Query(None),
    x_tenant_id: str = Header(None)
):
    """Admin: Get all packs across tenant with admin details"""
    
    tenant_id = _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        query = db.query(KiffPack).filter(KiffPack.tenant_id == tenant_id)
        
        if status:
            if status == "pending_verification":
                query = query.filter(KiffPack.is_verified == False)
            elif status == "verified":
                query = query.filter(KiffPack.is_verified == True)
            elif status == "inactive":
                query = query.filter(KiffPack.is_active == False)
        
        packs = query.order_by(desc(KiffPack.created_at)).all()
        
        return {
            "packs": [pack.to_dict_detailed() for pack in packs],
            "total": len(packs)
        }
    finally:
        db.close()


@router.post("/{pack_id}/verify")
async def verify_pack(
    pack_id: str,
    x_tenant_id: str = Header(None)
):
    """Admin: Verify a pack for quality"""
    
    tenant_id = _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        pack = db.query(KiffPack).filter(
            and_(
                KiffPack.id == pack_id,
                KiffPack.tenant_id == tenant_id
            )
        ).first()
        
        if not pack:
            raise HTTPException(status_code=404, detail="Pack not found")
        
        pack.is_verified = True
        db.commit()
        
        return {"message": "Pack verified successfully"}
    finally:
        db.close()


@router.delete("/{pack_id}")
async def delete_pack(
    pack_id: str,
    x_tenant_id: str = Header(None)
):
    """Delete a pack (admin or pack creator only)"""
    
    tenant_id = _require_tenant(x_tenant_id)
    user_id = f"user@{tenant_id}"  # Default user for permission checking
    
    db: Session = SessionLocal()
    try:
        pack = db.query(KiffPack).filter(
            and_(
                KiffPack.id == pack_id,
                KiffPack.tenant_id == tenant_id
            )
        ).first()
        
        if not pack:
            raise HTTPException(status_code=404, detail="Pack not found")
        
        # Note: In a real system, you'd check if user_id matches pack.created_by or has admin role
        # For now, allowing deletion by any tenant user
        # if pack.created_by != user_id:
        #     raise HTTPException(status_code=403, detail="Not authorized to delete this pack")
        
        # Soft delete by deactivating
        pack.is_active = False
        db.commit()
        
        # Remove from vector storage
        try:
            vector_service = VectorStorageService()
            await vector_service.remove_pack_vectors(pack_id, tenant_id)
        except Exception as e:
            print(f"Error removing pack vectors: {e}")
        
        return {"message": "Pack deleted successfully"}
    finally:
        db.close()


# Helper functions
def track_pack_access(pack_id: str, user_id: str, tenant_id: str, db: Session):
    """Track when a user accesses a pack for analytics"""
    # This could be used for recommendations and analytics
    pass


async def process_pack_content(pack_id: str, tenant_id: str):
    """Background task to process pack content with Agno"""
    try:
        processor = PackProcessor()
        await processor.process_pack(pack_id, tenant_id)
    except Exception as e:
        print(f"Error processing pack {pack_id}: {e}")
        # Update pack status to failed
        # This would require database session management in background task