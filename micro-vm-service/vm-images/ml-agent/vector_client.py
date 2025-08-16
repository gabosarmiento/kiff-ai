"""
Vector Store Client - Connect to external vector database

This client connects to the vector store that's warmed by your main application.
"""

import asyncio
import httpx
import os
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class VectorServiceConfig:
    """Configuration for vector service connection"""
    base_url: str
    timeout: float = 30.0
    max_retries: int = 3
    api_key: Optional[str] = None

class VectorServiceClient:
    """Client for connecting to external vector store"""
    
    def __init__(self, config: VectorServiceConfig):
        self.config = config
        self.client = None
        self.vm_id = os.getenv("VM_ID", "unknown")
        self._collections_cache = {}
        
    async def __aenter__(self):
        """Async context manager entry"""
        await self.initialize()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
    
    async def initialize(self):
        """Initialize HTTP client with optimized settings"""
        timeout = httpx.Timeout(self.config.timeout, connect=5.0)
        limits = httpx.Limits(max_keepalive_connections=3, max_connections=6)
        
        headers = {"X-VM-ID": self.vm_id}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        
        self.client = httpx.AsyncClient(
            base_url=self.config.base_url,
            timeout=timeout,
            limits=limits,
            headers=headers,
            verify=False  # For internal services
        )
        
        # Test connection and cache collections
        await self.health_check()
        await self._cache_collections()
        logger.info(f"Vector Service Client initialized for VM {self.vm_id}")
    
    async def health_check(self) -> bool:
        """Check if vector service is healthy"""
        try:
            response = await self.client.get("/health")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Vector service health check failed: {e}")
            return False
    
    async def _cache_collections(self):
        """Cache available collections for faster access"""
        try:
            collections = await self.list_collections()
            if "collections" in collections:
                self._collections_cache = {
                    coll["name"]: coll for coll in collections["collections"]
                }
        except Exception as e:
            logger.warning(f"Failed to cache collections: {e}")
    
    async def semantic_search(self, query: str, collection: str, 
                             limit: int = 10, threshold: float = 0.0) -> Dict[str, Any]:
        """Perform semantic search using text query"""
        try:
            data = {
                "query_text": query,
                "collection": collection,
                "limit": limit,
                "threshold": threshold,
                "vm_id": self.vm_id
            }
            
            response = await self.client.post("/search/semantic", json=data)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return {"error": str(e), "success": False}
    
    async def similarity_search(self, query_vector: List[float], collection: str, 
                               limit: int = 10, threshold: float = 0.0) -> Dict[str, Any]:
        """Perform similarity search using vector query"""
        try:
            data = {
                "query_vector": query_vector,
                "collection": collection,
                "limit": limit,
                "threshold": threshold,
                "vm_id": self.vm_id
            }
            
            response = await self.client.post("/search/similarity", json=data)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return {"error": str(e), "success": False}
    
    async def hybrid_search(self, query: str, filters: Dict[str, Any], 
                           collection: str, limit: int = 10) -> Dict[str, Any]:
        """Perform hybrid search with text query and metadata filters"""
        try:
            data = {
                "query_text": query,
                "filters": filters,
                "collection": collection,
                "limit": limit,
                "vm_id": self.vm_id
            }
            
            response = await self.client.post("/search/hybrid", json=data)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Hybrid search failed: {e}")
            return {"error": str(e), "success": False}
    
    async def get_document(self, collection: str, document_id: str) -> Dict[str, Any]:
        """Retrieve a specific document by ID"""
        try:
            response = await self.client.get(f"/collections/{collection}/documents/{document_id}")
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Failed to get document: {e}")
            return {"error": str(e), "success": False}
    
    async def list_collections(self) -> Dict[str, Any]:
        """Get list of available collections"""
        try:
            response = await self.client.get("/collections")
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Failed to list collections: {e}")
            return {"error": str(e), "success": False}
    
    async def get_collection_info(self, collection: str) -> Dict[str, Any]:
        """Get information about a specific collection"""
        try:
            response = await self.client.get(f"/collections/{collection}")
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Failed to get collection info: {e}")
            return {"error": str(e), "success": False}
    
    async def batch_search(self, queries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Perform multiple searches in batch"""
        try:
            data = {
                "queries": queries,
                "vm_id": self.vm_id
            }
            
            response = await self.client.post("/search/batch", json=data, timeout=60.0)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Batch search failed: {e}")
            return {"error": str(e), "success": False}
    
    async def add_documents(self, collection: str, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Add documents to collection (if VM has write permissions)"""
        try:
            data = {
                "collection": collection,
                "documents": documents,
                "vm_id": self.vm_id
            }
            
            response = await self.client.post("/documents", json=data)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Failed to add documents: {e}")
            return {"error": str(e), "success": False}
    
    def get_cached_collections(self) -> Dict[str, Any]:
        """Get cached collection information"""
        return self._collections_cache
    
    async def close(self):
        """Close HTTP client"""
        if self.client:
            await self.client.aclose()

# Convenience function for creating client
def create_vector_client() -> VectorServiceClient:
    """Create vector client with default configuration"""
    config = VectorServiceConfig(
        base_url=os.getenv("VECTOR_SERVICE_URL", "http://localhost:8003"),
        timeout=float(os.getenv("VECTOR_TIMEOUT", "30.0")),
        api_key=os.getenv("VECTOR_API_KEY")
    )
    return VectorServiceClient(config)

# Global client instance for easy use in agent code
vector_client = None

async def get_vector_client() -> VectorServiceClient:
    """Get or create global vector client instance"""
    global vector_client
    if vector_client is None:
        vector_client = create_vector_client()
        await vector_client.initialize()
    return vector_client