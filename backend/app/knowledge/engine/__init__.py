"""
Knowledge Management Engine
==========================

Backend engine for domain-agnostic knowledge management with real-time monitoring.
Built on Julia BFF's proven AgenticKnowledgePipeline and CrossAgentKnowledgeTools patterns.

Key Features:
- Domain-agnostic knowledge pipeline
- Real-time token and performance monitoring  
- Parallel LanceDB vectorization
- Cross-domain knowledge tools
- Frontend visibility APIs

Usage:
    from app.knowledge.engine import get_knowledge_engine, DomainConfig
    
    # Get the global engine instance
    engine = get_knowledge_engine()
    
    # Create a domain configuration
    domain = DomainConfig(
        name="fastapi",
        display_name="FastAPI Framework", 
        description="FastAPI web framework documentation",
        sources=["https://fastapi.tiangolo.com/"]
    )
    
    # Create knowledge base with metrics
    knowledge_base, metrics = await engine.create_domain_knowledge_base(domain)
"""

from .knowledge_management_engine import (
    KnowledgeManagementEngine,
    get_knowledge_engine,
    DomainConfig,
    ProcessingMetrics,
    DomainAgenticPipeline,
    CrossDomainKnowledgeTools
)

__all__ = [
    "KnowledgeManagementEngine",
    "get_knowledge_engine", 
    "DomainConfig",
    "ProcessingMetrics",
    "DomainAgenticPipeline",
    "CrossDomainKnowledgeTools"
]
