"""
Agentic RAG Implementations Package
==================================

This package contains all available Agentic RAG implementations.
Each implementation follows the AgenticRAGInterface contract for easy swapping.

Available Implementations:
- ARAG v1: Multi-agent knowledge processing pipeline (default)
- Future: ARAG v2, ARAG v3, etc.

The implementations are automatically registered with the RAGFactory
when imported, enabling the "Lego" swapping functionality.
"""

# Import all implementations to register them with RAGFactory
from . import arag_v1

__all__ = [
    "arag_v1"
]
