# embedder_cache.py
"""
Centralized Embedder Cache for TradeForge AI
Single source of truth for all embedder instances to avoid duplicate HF downloads.
Based on the proven Julia BFF pattern.
"""

from typing import Optional
from agno.embedder.sentence_transformer import SentenceTransformerEmbedder
import logging

logger = logging.getLogger(__name__)

# Local embedder setup using proven i2c local caching patterns
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

# Global caches - single instance for entire application
_embed_model_cache: Optional[SentenceTransformerEmbedder] = None
_raw_model_cache = None

def get_raw_model():
    """Get raw SentenceTransformer model using local cache (i2c proven pattern)"""
    global _raw_model_cache
    if _raw_model_cache is None:
        try:
            # Fix tokenizers parallelism warning
            import os
            os.environ["TOKENIZERS_PARALLELISM"] = "false"
            
            from sentence_transformers import SentenceTransformer
            logger.info(f"[EMBEDDER_CACHE] Loading raw SentenceTransformer: {EMBEDDING_MODEL_NAME}")
            _raw_model_cache = SentenceTransformer(EMBEDDING_MODEL_NAME)
            logger.info(f"[EMBEDDER_CACHE] ✅ Raw model loaded successfully (locally cached)")
        except Exception as e:
            logger.error(f"[EMBEDDER_CACHE] ❌ Raw model failed: {e}")
            return None
    else:
        logger.info(f"[EMBEDDER_CACHE] ✅ Using cached raw model (no download)")
    return _raw_model_cache

def get_embedder() -> Optional[SentenceTransformerEmbedder]:
    """Get the single global AGNO embedder instance (cached)"""
    global _embed_model_cache
    if _embed_model_cache is None:
        try:
            logger.info(f"[EMBEDDER_CACHE] 🔄 Creating new AGNO embedder with cached model...")
            # Use cached raw model to avoid duplicate loading/downloading
            raw_model = get_raw_model()
            if raw_model:
                _embed_model_cache = SentenceTransformerEmbedder(
                    id=EMBEDDING_MODEL_NAME,
                    sentence_transformer_client=raw_model  # Pass cached model
                )
                logger.info(f"[EMBEDDER_CACHE] ✅ AGNO embedder created with cached model")
            else:
                # Fallback if raw model fails
                logger.warning(f"[EMBEDDER_CACHE] ⚠️ Trying fallback AGNO embedder creation...")
                _embed_model_cache = SentenceTransformerEmbedder(id=EMBEDDING_MODEL_NAME)
                logger.info(f"[EMBEDDER_CACHE] ✅ Fallback AGNO embedder created")
        except Exception as e:
            logger.error(f"[EMBEDDER_CACHE] ❌ All embedder creation failed: {e}")
            return None
    else:
        logger.info(f"[EMBEDDER_CACHE] ✅ Reusing cached AGNO embedder (no model loading)")
    return _embed_model_cache

def clear_cache():
    """Clear all embedding caches (for debugging)"""
    global _embed_model_cache, _raw_model_cache
    _embed_model_cache = None
    _raw_model_cache = None
    logger.info("[EMBEDDER_CACHE] All caches cleared")

def get_cache_stats():
    """Get cache statistics for debugging"""
    return {
        "embed_model_cached": _embed_model_cache is not None,
        "raw_model_cached": _raw_model_cache is not None,
        "embedding_model": EMBEDDING_MODEL_NAME
    }
