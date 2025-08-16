"""
ML Service Bridge - Connect micro VMs to existing ML infrastructure

Reuses your existing torch/transformers service running on port 8001
without duplicating ML models or resources.
"""

import asyncio
import httpx
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class MLServiceBridge:
    """Bridge to connect VMs with existing ML service"""
    
    def __init__(self, ml_service_url: str):
        self.ml_service_url = ml_service_url.rstrip('/')
        self.client = None
        self.vm_connections: Dict[str, dict] = {}
        self.connection_pool_size = 10
        
    async def initialize(self):
        """Initialize the ML service bridge"""
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
            
            # Test connection to ML service
            await self.health_check()
            logger.info(f"ML Service Bridge initialized: {self.ml_service_url}")
            
        except Exception as e:
            logger.error(f"Failed to initialize ML Service Bridge: {e}")
            raise
    
    async def health_check(self) -> bool:
        """Check if ML service is available"""
        try:
            if not self.client:
                return False
                
            response = await self.client.get(f"{self.ml_service_url}/health")
            return response.status_code == 200
            
        except Exception as e:
            logger.warning(f"ML service health check failed: {e}")
            return False
    
    async def warm_connection(self, vm_id: str):
        """Pre-warm ML service connection for a VM"""
        try:
            # Test basic connectivity
            response = await self.client.get(f"{self.ml_service_url}/health")
            
            if response.status_code == 200:
                self.vm_connections[vm_id] = {
                    "warmed_at": datetime.utcnow(),
                    "status": "ready",
                    "last_used": datetime.utcnow()
                }
                logger.info(f"Warmed ML connection for VM {vm_id}")
            else:
                raise Exception(f"ML service not healthy: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Failed to warm ML connection for VM {vm_id}: {e}")
            self.vm_connections[vm_id] = {
                "warmed_at": datetime.utcnow(),
                "status": "error",
                "error": str(e)
            }
    
    async def query(self, vm_id: str, query_data: dict) -> dict:
        """Execute ML query on behalf of a VM"""
        try:
            # Update last used timestamp
            if vm_id in self.vm_connections:
                self.vm_connections[vm_id]["last_used"] = datetime.utcnow()
            
            # Determine the ML endpoint based on query type
            endpoint = self._get_ml_endpoint(query_data)
            
            # Add VM context to the request
            enhanced_query = {
                **query_data,
                "vm_context": {
                    "vm_id": vm_id,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
            
            # Make request to ML service
            response = await self.client.post(
                f"{self.ml_service_url}{endpoint}",
                json=enhanced_query,
                headers={"X-VM-ID": vm_id}
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.debug(f"ML query successful for VM {vm_id}")
                return result
            else:
                error_msg = f"ML service error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return {"error": error_msg, "status_code": response.status_code}
                
        except Exception as e:
            logger.error(f"ML query failed for VM {vm_id}: {e}")
            return {"error": str(e), "vm_id": vm_id}
    
    def _get_ml_endpoint(self, query_data: dict) -> str:
        """Determine the appropriate ML endpoint based on query"""
        query_type = query_data.get("type", "embedding")
        
        # Map query types to your existing ML service endpoints
        endpoint_map = {
            "embedding": "/embeddings",
            "text_generation": "/generate",
            "classification": "/classify",
            "summarization": "/summarize",
            "translation": "/translate",
            "health": "/health"
        }
        
        return endpoint_map.get(query_type, "/embeddings")
    
    async def get_available_models(self, vm_id: str) -> dict:
        """Get list of available models from ML service"""
        try:
            response = await self.client.get(
                f"{self.ml_service_url}/models",
                headers={"X-VM-ID": vm_id}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"Failed to get models: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Failed to get available models for VM {vm_id}: {e}")
            return {"error": str(e)}
    
    async def generate_embedding(self, vm_id: str, text: str, model: str = "default") -> dict:
        """Generate embeddings using the ML service"""
        query_data = {
            "type": "embedding",
            "text": text,
            "model": model
        }
        return await self.query(vm_id, query_data)
    
    async def generate_text(self, vm_id: str, prompt: str, model: str = "default", 
                          max_tokens: int = 100) -> dict:
        """Generate text using the ML service"""
        query_data = {
            "type": "text_generation",
            "prompt": prompt,
            "model": model,
            "max_tokens": max_tokens
        }
        return await self.query(vm_id, query_data)
    
    async def classify_text(self, vm_id: str, text: str, categories: list, 
                           model: str = "default") -> dict:
        """Classify text using the ML service"""
        query_data = {
            "type": "classification",
            "text": text,
            "categories": categories,
            "model": model
        }
        return await self.query(vm_id, query_data)
    
    async def batch_process(self, vm_id: str, items: list, operation: str) -> dict:
        """Process multiple items in batch"""
        try:
            query_data = {
                "type": "batch",
                "operation": operation,
                "items": items,
                "vm_id": vm_id
            }
            
            response = await self.client.post(
                f"{self.ml_service_url}/batch",
                json=query_data,
                headers={"X-VM-ID": vm_id},
                timeout=120.0  # Longer timeout for batch operations
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"Batch processing failed: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Batch processing failed for VM {vm_id}: {e}")
            return {"error": str(e)}
    
    async def get_vm_connection_status(self, vm_id: str) -> dict:
        """Get connection status for a specific VM"""
        if vm_id in self.vm_connections:
            return {
                "vm_id": vm_id,
                "ml_connection": self.vm_connections[vm_id]
            }
        else:
            return {
                "vm_id": vm_id,
                "ml_connection": {"status": "not_warmed"}
            }
    
    async def cleanup_vm_connection(self, vm_id: str):
        """Clean up connection resources for a VM"""
        if vm_id in self.vm_connections:
            del self.vm_connections[vm_id]
            logger.info(f"Cleaned up ML connection for VM {vm_id}")
    
    async def get_connection_stats(self) -> dict:
        """Get overall connection statistics"""
        active_connections = len(self.vm_connections)
        healthy_connections = sum(
            1 for conn in self.vm_connections.values() 
            if conn.get("status") == "ready"
        )
        
        return {
            "ml_service_url": self.ml_service_url,
            "ml_service_healthy": await self.health_check(),
            "active_vm_connections": active_connections,
            "healthy_connections": healthy_connections,
            "connection_pool_size": self.connection_pool_size
        }
    
    async def close(self):
        """Close the HTTP client and cleanup resources"""
        if self.client:
            await self.client.aclose()
            logger.info("ML Service Bridge closed")