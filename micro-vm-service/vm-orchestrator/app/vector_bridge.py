"""
Vector Store Bridge - Connect micro VMs to external vector database

Provides access to the vector store that's warmed by your main application,
without duplicating vector data or storage resources.
"""

import asyncio
import httpx
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class VectorStoreBridge:
    """Bridge to connect VMs with external vector store"""
    
    def __init__(self, vector_service_url: str):
        self.vector_service_url = vector_service_url.rstrip('/')
        self.client = None
        self.vm_connections: Dict[str, dict] = {}
        self.connection_pool_size = 5
        
    async def initialize(self):
        """Initialize the vector store bridge"""
        try:
            # Create HTTP client with connection pooling
            timeout = httpx.Timeout(30.0, connect=5.0)
            limits = httpx.Limits(
                max_keepalive_connections=self.connection_pool_size,
                max_connections=self.connection_pool_size * 2
            )
            
            self.client = httpx.AsyncClient(
                timeout=timeout,
                limits=limits,
                verify=False  # For internal services
            )
            
            # Test connection to vector service
            await self.health_check()
            logger.info(f"Vector Store Bridge initialized: {self.vector_service_url}")
            
        except Exception as e:
            logger.error(f"Failed to initialize Vector Store Bridge: {e}")
            raise
    
    async def health_check(self) -> bool:
        """Check if vector store service is available"""
        try:
            if not self.client:
                return False
                
            # Try to reach vector service health endpoint
            response = await self.client.get(f"{self.vector_service_url}/health")
            return response.status_code == 200
            
        except Exception as e:
            logger.warning(f"Vector service health check failed: {e}")
            return False
    
    async def warm_connection(self, vm_id: str):
        """Pre-warm vector store connection for a VM"""
        try:
            # Test connectivity and get available collections
            collections = await self.list_collections(vm_id)
            
            if "error" not in collections:
                self.vm_connections[vm_id] = {
                    "warmed_at": datetime.utcnow(),
                    "status": "ready",
                    "last_used": datetime.utcnow(),
                    "available_collections": collections.get("collections", [])
                }
                logger.info(f"Warmed vector connection for VM {vm_id}")
            else:
                raise Exception(f"Vector service error: {collections['error']}")
                
        except Exception as e:
            logger.error(f"Failed to warm vector connection for VM {vm_id}: {e}")
            self.vm_connections[vm_id] = {
                "warmed_at": datetime.utcnow(),
                "status": "error",
                "error": str(e)
            }
    
    async def search(self, vm_id: str, search_data: dict) -> dict:
        """Perform vector search on behalf of a VM"""
        try:
            # Update last used timestamp
            if vm_id in self.vm_connections:
                self.vm_connections[vm_id]["last_used"] = datetime.utcnow()
            
            # Add VM context to the search request
            enhanced_search = {
                **search_data,
                "vm_context": {
                    "vm_id": vm_id,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
            
            # Make request to vector service
            response = await self.client.post(
                f"{self.vector_service_url}/search",
                json=enhanced_search,
                headers={"X-VM-ID": vm_id}
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.debug(f"Vector search successful for VM {vm_id}")
                return result
            else:
                error_msg = f"Vector service error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return {"error": error_msg, "status_code": response.status_code}
                
        except Exception as e:
            logger.error(f"Vector search failed for VM {vm_id}: {e}")
            return {"error": str(e), "vm_id": vm_id}
    
    async def similarity_search(self, vm_id: str, query_vector: List[float], 
                               collection: str, limit: int = 10, 
                               threshold: float = 0.0) -> dict:
        """Perform similarity search using query vector"""
        search_data = {
            "type": "similarity",
            "query_vector": query_vector,
            "collection": collection,
            "limit": limit,
            "threshold": threshold
        }
        return await self.search(vm_id, search_data)
    
    async def semantic_search(self, vm_id: str, query_text: str, 
                             collection: str, limit: int = 10) -> dict:
        """Perform semantic search using text query"""
        search_data = {
            "type": "semantic",
            "query_text": query_text,
            "collection": collection,
            "limit": limit
        }
        return await self.search(vm_id, search_data)
    
    async def hybrid_search(self, vm_id: str, query_text: str, 
                           filters: dict, collection: str, 
                           limit: int = 10) -> dict:
        """Perform hybrid search with text and metadata filters"""
        search_data = {
            "type": "hybrid",
            "query_text": query_text,
            "filters": filters,
            "collection": collection,
            "limit": limit
        }
        return await self.search(vm_id, search_data)
    
    async def list_collections(self, vm_id: str) -> dict:
        """Get list of available vector collections"""
        try:
            response = await self.client.get(
                f"{self.vector_service_url}/collections",
                headers={"X-VM-ID": vm_id}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"Failed to get collections: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Failed to get collections for VM {vm_id}: {e}")
            return {"error": str(e)}
    
    async def get_collection_info(self, vm_id: str, collection: str) -> dict:
        """Get information about a specific collection"""
        try:
            response = await self.client.get(
                f"{self.vector_service_url}/collections/{collection}",
                headers={"X-VM-ID": vm_id}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"Failed to get collection info: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Failed to get collection info for VM {vm_id}: {e}")
            return {"error": str(e)}
    
    async def add_documents(self, vm_id: str, collection: str, 
                           documents: List[dict]) -> dict:
        """Add documents to a vector collection (if VM has write permissions)"""
        try:
            data = {
                "collection": collection,
                "documents": documents,
                "vm_id": vm_id
            }
            
            response = await self.client.post(
                f"{self.vector_service_url}/documents",
                json=data,
                headers={"X-VM-ID": vm_id}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"Failed to add documents: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Failed to add documents for VM {vm_id}: {e}")
            return {"error": str(e)}
    
    async def batch_search(self, vm_id: str, queries: List[dict]) -> dict:
        """Perform multiple searches in batch"""
        try:
            data = {
                "type": "batch",
                "queries": queries,
                "vm_id": vm_id
            }
            
            response = await self.client.post(
                f"{self.vector_service_url}/batch_search",
                json=data,
                headers={"X-VM-ID": vm_id},
                timeout=60.0  # Longer timeout for batch operations
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"Batch search failed: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Batch search failed for VM {vm_id}: {e}")
            return {"error": str(e)}
    
    async def get_document_by_id(self, vm_id: str, collection: str, 
                                document_id: str) -> dict:
        """Retrieve a specific document by ID"""
        try:
            response = await self.client.get(
                f"{self.vector_service_url}/collections/{collection}/documents/{document_id}",
                headers={"X-VM-ID": vm_id}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"Failed to get document: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Failed to get document for VM {vm_id}: {e}")
            return {"error": str(e)}
    
    async def get_vm_connection_status(self, vm_id: str) -> dict:
        """Get connection status for a specific VM"""
        if vm_id in self.vm_connections:
            return {
                "vm_id": vm_id,
                "vector_connection": self.vm_connections[vm_id]
            }
        else:
            return {
                "vm_id": vm_id,
                "vector_connection": {"status": "not_warmed"}
            }
    
    async def cleanup_vm_connection(self, vm_id: str):
        """Clean up connection resources for a VM"""
        if vm_id in self.vm_connections:
            del self.vm_connections[vm_id]
            logger.info(f"Cleaned up vector connection for VM {vm_id}")
    
    async def get_connection_stats(self) -> dict:
        """Get overall connection statistics"""
        active_connections = len(self.vm_connections)
        healthy_connections = sum(
            1 for conn in self.vm_connections.values() 
            if conn.get("status") == "ready"
        )
        
        total_collections = 0
        for conn in self.vm_connections.values():
            if "available_collections" in conn:
                total_collections += len(conn["available_collections"])
        
        return {
            "vector_service_url": self.vector_service_url,
            "vector_service_healthy": await self.health_check(),
            "active_vm_connections": active_connections,
            "healthy_connections": healthy_connections,
            "total_collections_accessible": total_collections,
            "connection_pool_size": self.connection_pool_size
        }
    
    async def close(self):
        """Close the HTTP client and cleanup resources"""
        if self.client:
            await self.client.aclose()
            logger.info("Vector Store Bridge closed")