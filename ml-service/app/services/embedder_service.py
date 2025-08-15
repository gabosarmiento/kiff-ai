"""
Embedder Service - Text to Vector Conversion
Extracted from the main backend for faster builds
"""

import os
import asyncio
from typing import List
from sentence_transformers import SentenceTransformer

class EmbedderService:
    """Service for generating text embeddings using sentence-transformers"""
    
    def __init__(self):
        # Use the same model as the original backend
        self.model_name = "all-MiniLM-L6-v2"
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """Load the sentence transformer model"""
        try:
            print(f"[EMBEDDER] Loading model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            print(f"[EMBEDDER] ✅ Model loaded successfully")
        except Exception as e:
            print(f"[EMBEDDER] ❌ Failed to load model: {e}")
            raise
    
    async def embed_text(self, text: str) -> List[float]:
        """Generate embedding for text"""
        if not self.model:
            raise RuntimeError("Embedder model not loaded")
        
        try:
            # Run in thread to avoid blocking
            embedding = await asyncio.to_thread(
                self.model.encode, 
                text, 
                convert_to_numpy=True
            )
            return embedding.tolist()
        except Exception as e:
            print(f"[EMBEDDER] Error embedding text: {e}")
            raise
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        if not self.model:
            raise RuntimeError("Embedder model not loaded")
        
        try:
            # Batch processing for efficiency
            embeddings = await asyncio.to_thread(
                self.model.encode,
                texts,
                convert_to_numpy=True,
                batch_size=32
            )
            return embeddings.tolist()
        except Exception as e:
            print(f"[EMBEDDER] Error embedding batch: {e}")
            raise