"""
ML Service Client - Connect to existing torch/transformers service

This client connects to your existing ML service without duplicating models.
"""

import asyncio
import httpx
import os
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class MLServiceConfig:
    """Configuration for ML service connection"""
    base_url: str
    timeout: float = 30.0
    max_retries: int = 3
    api_key: Optional[str] = None

class MLServiceClient:
    """Client for connecting to the existing ML infrastructure"""
    
    def __init__(self, config: MLServiceConfig):
        self.config = config
        self.client = None
        self.vm_id = os.getenv("VM_ID", "unknown")
        
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
        limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
        
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
        
        # Test connection
        await self.health_check()
        logger.info(f"ML Service Client initialized for VM {self.vm_id}")
    
    async def health_check(self) -> bool:
        """Check if ML service is healthy"""
        try:
            response = await self.client.get("/health")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"ML service health check failed: {e}")
            return False
    
    async def generate_embedding(self, text: str, model: str = "default") -> Dict[str, Any]:
        """Generate text embeddings"""
        try:
            data = {
                "text": text,
                "model": model,
                "vm_id": self.vm_id
            }
            
            response = await self.client.post("/embeddings", json=data)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return {"error": str(e), "success": False}
    
    async def generate_text(self, prompt: str, model: str = "default", 
                           max_tokens: int = 100, temperature: float = 0.7) -> Dict[str, Any]:
        """Generate text using language models"""
        try:
            data = {
                "prompt": prompt,
                "model": model,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "vm_id": self.vm_id
            }
            
            response = await self.client.post("/generate", json=data)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Text generation failed: {e}")
            return {"error": str(e), "success": False}
    
    async def classify_text(self, text: str, categories: List[str], 
                           model: str = "default") -> Dict[str, Any]:
        """Classify text into categories"""
        try:
            data = {
                "text": text,
                "categories": categories,
                "model": model,
                "vm_id": self.vm_id
            }
            
            response = await self.client.post("/classify", json=data)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Text classification failed: {e}")
            return {"error": str(e), "success": False}
    
    async def summarize_text(self, text: str, max_length: int = 100, 
                            model: str = "default") -> Dict[str, Any]:
        """Summarize text content"""
        try:
            data = {
                "text": text,
                "max_length": max_length,
                "model": model,
                "vm_id": self.vm_id
            }
            
            response = await self.client.post("/summarize", json=data)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Text summarization failed: {e}")
            return {"error": str(e), "success": False}
    
    async def batch_process(self, requests: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process multiple requests in batch for efficiency"""
        try:
            data = {
                "requests": requests,
                "vm_id": self.vm_id
            }
            
            response = await self.client.post("/batch", json=data, timeout=120.0)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Batch processing failed: {e}")
            return {"error": str(e), "success": False}
    
    async def get_available_models(self) -> Dict[str, Any]:
        """Get list of available models"""
        try:
            response = await self.client.get("/models")
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Failed to get available models: {e}")
            return {"error": str(e), "success": False}
    
    async def close(self):
        """Close HTTP client"""
        if self.client:
            await self.client.aclose()

# Convenience function for creating client
def create_ml_client() -> MLServiceClient:
    """Create ML client with default configuration"""
    config = MLServiceConfig(
        base_url=os.getenv("ML_SERVICE_URL", "http://localhost:8001"),
        timeout=float(os.getenv("ML_TIMEOUT", "30.0")),
        api_key=os.getenv("ML_API_KEY")
    )
    return MLServiceClient(config)

# Global client instance for easy use in agent code
ml_client = None

async def get_ml_client() -> MLServiceClient:
    """Get or create global ML client instance"""
    global ml_client
    if ml_client is None:
        ml_client = create_ml_client()
        await ml_client.initialize()
    return ml_client