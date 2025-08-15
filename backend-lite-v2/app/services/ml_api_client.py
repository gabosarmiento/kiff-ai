"""
ML API Client
=============

Client for communicating with the ML service that handles
embeddings, vector search, and agent operations.
"""

import os
import json
import asyncio
import aiohttp
from typing import Dict, Any, List, Optional

class MLAPIClient:
    """Client for the ML service API"""
    
    def __init__(self):
        # Get ML service URL from environment
        # In production, this would be the internal service URL
        # For local development, use localhost
        self.base_url = os.getenv("ML_SERVICE_URL", "http://localhost:8001")
        self.timeout = aiohttp.ClientTimeout(total=300)  # 5 minute timeout for large operations
        print(f"[ML_CLIENT] Configured to use ML service at: {self.base_url}")
        
    async def health_check(self) -> Dict[str, Any]:
        """Check if ML service is healthy"""
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.get(f"{self.base_url}/health") as response:
                return await response.json()
    
    async def embed_text(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.post(
                f"{self.base_url}/embed",
                json={"text": text}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return result["embedding"]
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.post(
                f"{self.base_url}/embed",
                json={"texts": texts}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return result["embeddings"]
    
    async def search_vectors(
        self, 
        query: str, 
        tenant_id: str, 
        pack_ids: Optional[List[str]] = None,
        limit: int = 4
    ) -> List[Dict[str, Any]]:
        """Search for similar vectors"""
        payload = {
            "query": query,
            "tenant_id": tenant_id,
            "limit": limit
        }
        if pack_ids:
            payload["pack_ids"] = pack_ids
            
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.post(
                f"{self.base_url}/search",
                json=payload
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return result["results"]
    
    async def index_pack(
        self, 
        pack_id: str, 
        tenant_id: str, 
        display_name: str, 
        api_url: str, 
        description: str
    ) -> Dict[str, Any]:
        """Index a pack's documentation into vectors"""
        payload = {
            "pack_id": pack_id,
            "tenant_id": tenant_id,
            "display_name": display_name,
            "api_url": api_url,
            "description": description
        }
        
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.post(
                f"{self.base_url}/index-pack",
                json=payload
            ) as response:
                response.raise_for_status()
                return await response.json()
    
    async def run_agent(
        self, 
        message: str, 
        tenant_id: str, 
        selected_packs: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Run agent with knowledge integration"""
        payload = {
            "message": message,
            "tenant_id": tenant_id
        }
        if selected_packs:
            payload["selected_packs"] = selected_packs
            
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.post(
                f"{self.base_url}/agent/run",
                json=payload
            ) as response:
                response.raise_for_status()
                return await response.json()

# Singleton instance
ml_client = MLAPIClient()