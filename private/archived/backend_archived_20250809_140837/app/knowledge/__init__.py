"""
Kiff Knowledge System
====================

Domain-agnostic Agentic RAG (Retrieval-Augmented Generation) system for API documentation extraction and intelligent code generation.

Core Components:
- Knowledge Management Engine: Domain-agnostic knowledge processing and vectorization
- Agentic Sitemap Extractor: Automated URL discovery for any API documentation
- Julia BFF Knowledge Engine: Multi-agent knowledge processing with LanceDB

Features:
- Multi-tenant knowledge sharing (index once, serve many clients)
- Always up-to-date API documentation refresh
- LanceDB vectorization for efficient retrieval
- Domain-adaptive knowledge extraction
- API Gallery system for popular APIs

Usage:
    from app.knowledge.engine import (
        get_knowledge_engine,
        AgenticSitemapExtractor,
        JuliaBFFKnowledgeEngine
    )
    
    # Get the knowledge management engine
    engine = get_knowledge_engine()
    
    # Extract API documentation
    extractor = AgenticSitemapExtractor()
    urls = await extractor.extract_api_urls(domain="stripe.com")
"""

# Import core knowledge management components
from .engine.knowledge_management_engine import get_knowledge_engine
from .engine.agentic_sitemap_extractor import AgenticSitemapExtractor
from .engine.julia_bff_knowledge_engine import JuliaBFFKnowledgeEngine

__all__ = [
    "get_knowledge_engine",
    "AgenticSitemapExtractor", 
    "JuliaBFFKnowledgeEngine"
]
