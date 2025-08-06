"""
Agentic RAG Interface - Modular "Lego" Architecture
==================================================

This interface defines the contract for swappable Agentic RAG implementations.
You can easily plug in ARAG1 → ARAG2 → ARAG3 without changing core code.

Design Philosophy:
- Interface-based design for easy swapping
- Metrics and monitoring built-in
- Async-first for performance
- Domain-agnostic for flexibility
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, AsyncGenerator
from dataclasses import dataclass
from enum import Enum
import asyncio
import logging

logger = logging.getLogger(__name__)


class RAGProcessingStage(Enum):
    """Stages of RAG processing pipeline"""
    URL_PRIORITIZATION = "url_prioritization"
    CONTENT_ANALYSIS = "content_analysis"
    CHUNKING = "chunking"
    QUALITY_VERIFICATION = "quality_verification"
    VECTORIZATION = "vectorization"
    INDEXING = "indexing"


@dataclass
class RAGMetrics:
    """Real-time RAG processing metrics"""
    pipeline_id: str
    domain: str
    stage: RAGProcessingStage
    start_time: float
    end_time: Optional[float] = None
    status: str = "processing"
    urls_processed: int = 0
    chunks_created: int = 0
    tokens_used: int = 0
    processing_time_seconds: float = 0.0
    error_message: Optional[str] = None
    quality_score: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary for API responses"""
        return {
            "pipeline_id": self.pipeline_id,
            "domain": self.domain,
            "stage": self.stage.value,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "status": self.status,
            "urls_processed": self.urls_processed,
            "chunks_created": self.chunks_created,
            "tokens_used": self.tokens_used,
            "processing_time_seconds": self.processing_time_seconds,
            "error_message": self.error_message,
            "quality_score": self.quality_score
        }


@dataclass
class DomainConfig:
    """Configuration for any knowledge domain"""
    name: str
    display_name: str
    description: str
    sources: List[str]
    priority: int = 1
    extraction_strategy: str = "agentic_pipeline"
    keywords: List[str] = None
    
    def __post_init__(self):
        if self.keywords is None:
            self.keywords = []


@dataclass
class ProcessedChunk:
    """Represents a processed knowledge chunk"""
    content: str
    metadata: Dict[str, Any]
    quality_score: float
    chunk_type: str
    source_url: str
    domain: str
    embedding: Optional[List[float]] = None


class AgenticRAGInterface(ABC):
    """
    Abstract interface for Agentic RAG implementations.
    
    This allows you to swap between different RAG approaches:
    - ARAG1: Current multi-agent pipeline
    - ARAG2: Future enhanced version
    - ARAG3: Experimental approaches
    """
    
    @property
    @abstractmethod
    def version(self) -> str:
        """Version identifier for this RAG implementation"""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name for this RAG implementation"""
        pass
    
    @abstractmethod
    async def initialize(self, **kwargs) -> bool:
        """
        Initialize the RAG system.
        
        Returns:
            bool: True if initialization successful
        """
        pass
    
    @abstractmethod
    async def process_domain(
        self, 
        domain_config: DomainConfig,
        progress_callback: Optional[callable] = None
    ) -> AsyncGenerator[RAGMetrics, None]:
        """
        Process a domain through the RAG pipeline.
        
        Args:
            domain_config: Configuration for the domain to process
            progress_callback: Optional callback for real-time progress updates
            
        Yields:
            RAGMetrics: Real-time processing metrics
        """
        pass
    
    @abstractmethod
    async def search_knowledge(
        self, 
        domain: str, 
        query: str, 
        limit: int = 5
    ) -> List[ProcessedChunk]:
        """
        Search processed knowledge base.
        
        Args:
            domain: Domain to search in
            query: Search query
            limit: Maximum results to return
            
        Returns:
            List[ProcessedChunk]: Relevant knowledge chunks
        """
        pass
    
    @abstractmethod
    async def get_metrics(self, domain: Optional[str] = None) -> Dict[str, RAGMetrics]:
        """
        Get current processing metrics.
        
        Args:
            domain: Optional domain filter
            
        Returns:
            Dict[str, RAGMetrics]: Current metrics by pipeline ID
        """
        pass
    
    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """
        Check health status of the RAG system.
        
        Returns:
            Dict[str, Any]: Health status information
        """
        pass
    
    @abstractmethod
    async def cleanup(self) -> bool:
        """
        Clean up resources and shutdown gracefully.
        
        Returns:
            bool: True if cleanup successful
        """
        pass


class RAGFactory:
    """
    Factory for creating and managing RAG implementations.
    
    This is your "Lego" connector - easily swap implementations:
    
    ```python
    # Switch from ARAG1 to ARAG2
    rag = RAGFactory.create("arag_v2")
    
    # Or use the latest
    rag = RAGFactory.create_latest()
    ```
    """
    
    _implementations: Dict[str, type] = {}
    _default_implementation: Optional[str] = None
    
    @classmethod
    def register(cls, name: str, implementation: type, is_default: bool = False):
        """
        Register a new RAG implementation.
        
        Args:
            name: Unique name for this implementation
            implementation: Class implementing AgenticRAGInterface
            is_default: Whether this should be the default implementation
        """
        if not issubclass(implementation, AgenticRAGInterface):
            raise ValueError(f"Implementation must inherit from AgenticRAGInterface")
        
        cls._implementations[name] = implementation
        
        if is_default or cls._default_implementation is None:
            cls._default_implementation = name
        
        logger.info(f"🧱 Registered RAG implementation: {name}")
    
    @classmethod
    def create(cls, name: Optional[str] = None, **kwargs) -> AgenticRAGInterface:
        """
        Create a RAG implementation instance.
        
        Args:
            name: Name of implementation to create (uses default if None)
            **kwargs: Arguments to pass to implementation constructor
            
        Returns:
            AgenticRAGInterface: RAG implementation instance
        """
        if name is None:
            name = cls._default_implementation
        
        if name not in cls._implementations:
            available = list(cls._implementations.keys())
            raise ValueError(f"Unknown RAG implementation '{name}'. Available: {available}")
        
        implementation_class = cls._implementations[name]
        return implementation_class(**kwargs)
    
    @classmethod
    def create_latest(cls, **kwargs) -> AgenticRAGInterface:
        """Create the latest/default RAG implementation"""
        return cls.create(None, **kwargs)
    
    @classmethod
    def list_implementations(cls) -> Dict[str, str]:
        """
        List all registered implementations.
        
        Returns:
            Dict[str, str]: Implementation names and their versions
        """
        result = {}
        for name, impl_class in cls._implementations.items():
            # Create temporary instance to get version
            try:
                temp_instance = impl_class()
                result[name] = temp_instance.version
            except Exception:
                result[name] = "unknown"
        
        return result


# Convenience functions for easy usage
async def create_rag(implementation: str = None, **kwargs) -> AgenticRAGInterface:
    """
    Create and initialize a RAG implementation.
    
    Args:
        implementation: RAG implementation name (uses default if None)
        **kwargs: Arguments for RAG initialization
        
    Returns:
        AgenticRAGInterface: Initialized RAG instance
    """
    rag = RAGFactory.create(implementation)
    await rag.initialize(**kwargs)
    return rag


def get_available_rags() -> Dict[str, str]:
    """Get all available RAG implementations"""
    return RAGFactory.list_implementations()
