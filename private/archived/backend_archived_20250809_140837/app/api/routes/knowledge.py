"""
Knowledge Management Routes
==========================

REST API endpoints for the Knowledge Management system.
Provides access to knowledge bases, domain management, and cross-domain search.
"""

from fastapi import APIRouter, HTTPException, Query, Header
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

# In-memory tenant-aware storage for knowledge bases
# In production, this would be replaced with database storage
TENANT_KNOWLEDGE_BASES: Dict[str, List[Dict]] = {}


class KnowledgeBaseResponse(BaseModel):
    """Response model for knowledge base information"""
    id: str
    name: str
    description: str
    domain: str
    status: str
    created_at: str
    last_updated: str
    document_count: int
    vector_count: int


class KnowledgeBasesListResponse(BaseModel):
    """Response model for knowledge bases list"""
    knowledge_bases: List[KnowledgeBaseResponse]
    total_count: int


@router.get("/bases", response_model=KnowledgeBasesListResponse)
async def get_knowledge_bases(x_tenant_id: Optional[str] = Header(None)):
    """Get all knowledge bases for a tenant"""
    try:
        tenant_id = x_tenant_id or "default"
        
        # Initialize empty knowledge bases for tenant if not exists (no mock data)
        if tenant_id not in TENANT_KNOWLEDGE_BASES:
            TENANT_KNOWLEDGE_BASES[tenant_id] = []
        
        # Get tenant's knowledge bases
        tenant_bases = TENANT_KNOWLEDGE_BASES[tenant_id]
        mock_bases = [KnowledgeBaseResponse(**base) for base in tenant_bases]
        
        response = KnowledgeBasesListResponse(
            knowledge_bases=mock_bases,
            total_count=len(mock_bases)
        )
        
        logger.info(f"📚 Retrieved {len(mock_bases)} knowledge bases for tenant {tenant_id}")
        return response
        
    except Exception as e:
        logger.error(f"❌ Failed to get knowledge bases: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve knowledge bases: {str(e)}")


@router.get("/bases/{base_id}")
async def get_knowledge_base(base_id: str):
    """Get details of a specific knowledge base"""
    try:
        # Mock response for now
        if base_id == "agno_framework":
            return KnowledgeBaseResponse(
                id="agno_framework",
                name="AGNO Framework",
                description="Comprehensive AGNO framework documentation and examples",
                domain="ai_framework",
                status="indexed",
                created_at=datetime.now().isoformat(),
                last_updated=datetime.now().isoformat(),
                document_count=45,
                vector_count=1250
            )
        else:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get knowledge base {base_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve knowledge base: {str(e)}")


@router.delete("/bases/{base_id}")
async def delete_knowledge_base(base_id: str, x_tenant_id: Optional[str] = Header(None)):
    """Delete a knowledge base for a tenant"""
    try:
        tenant_id = x_tenant_id or "default"
        logger.info(f"🗑️ Deleting knowledge base: {base_id} for tenant: {tenant_id}")
        
        # Check if tenant has knowledge bases
        if tenant_id not in TENANT_KNOWLEDGE_BASES:
            raise HTTPException(status_code=404, detail="No knowledge bases found for tenant")
        
        # Find and remove the knowledge base
        tenant_bases = TENANT_KNOWLEDGE_BASES[tenant_id]
        original_count = len(tenant_bases)
        
        # Remove the knowledge base with matching ID
        TENANT_KNOWLEDGE_BASES[tenant_id] = [
            base for base in tenant_bases if base["id"] != base_id
        ]
        
        # Check if anything was actually deleted
        new_count = len(TENANT_KNOWLEDGE_BASES[tenant_id])
        if original_count == new_count:
            raise HTTPException(status_code=404, detail=f"Knowledge base '{base_id}' not found")
        
        # Simulate some processing time
        import asyncio
        await asyncio.sleep(0.5)
        
        logger.info(f"✅ Successfully deleted knowledge base: {base_id} for tenant: {tenant_id}")
        
        return {
            "status": "success",
            "message": f"Knowledge base '{base_id}' has been permanently deleted",
            "deleted_at": datetime.now().isoformat(),
            "tenant_id": tenant_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete knowledge base {base_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete knowledge base: {str(e)}")


@router.get("/health")
async def knowledge_health():
    """Health check for Knowledge Management system"""
    return {
        "status": "healthy",
        "service": "knowledge-management",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }


# Export router
__all__ = ["router"]
