"""
Modular RAG Service - Core Integration Layer
===========================================

This service provides a clean interface to the modular Agentic RAG system.
It handles the "Lego" swapping logic and integrates with the rest of Kiff AI.

Usage:
    # Use default RAG (ARAG v1)
    rag_service = ModularRAGService()
    
    # Or specify implementation
    rag_service = ModularRAGService(implementation="arag_v2")
    
    # Easy swapping
    rag_service.switch_implementation("arag_v3")
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, AsyncGenerator
import time

from app.knowledge.interfaces.agentic_rag_interface import (
    AgenticRAGInterface,
    RAGMetrics,
    DomainConfig,
    ProcessedChunk,
    create_rag,
    get_available_rags
)

# Import implementations to register them
from app.knowledge.implementations import arag_v1

logger = logging.getLogger(__name__)


class ModularRAGService:
    """
    Core service for modular Agentic RAG operations.
    
    This is your main interface to the RAG system - it handles
    implementation swapping, initialization, and provides a
    clean API for the rest of Kiff AI.
    """
    
    def __init__(self, implementation: str = None, **kwargs):
        self.current_implementation: Optional[str] = implementation
        self.rag: Optional[AgenticRAGInterface] = None
        self.init_kwargs = kwargs
        self._initialized = False
    
    async def initialize(self) -> bool:
        """Initialize the RAG service with the current implementation"""
        try:
            logger.info(f"🚀 Initializing Modular RAG Service...")
            
            # Create RAG implementation
            self.rag = await create_rag(self.current_implementation, **self.init_kwargs)
            
            self._initialized = True
            logger.info(f"✅ RAG Service initialized with {self.rag.name} v{self.rag.version}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize RAG Service: {e}")
            return False
    
    async def switch_implementation(self, new_implementation: str, **kwargs) -> bool:
        """
        Switch to a different RAG implementation (the "Lego" swap).
        
        Args:
            new_implementation: Name of the new RAG implementation
            **kwargs: Additional arguments for the new implementation
            
        Returns:
            bool: True if switch successful
        """
        try:
            logger.info(f"🔄 Switching RAG implementation from {self.current_implementation} to {new_implementation}")
            
            # Cleanup current implementation
            if self.rag:
                await self.rag.cleanup()
            
            # Create new implementation
            old_implementation = self.current_implementation
            self.current_implementation = new_implementation
            self.init_kwargs.update(kwargs)
            
            # Initialize new RAG
            self.rag = await create_rag(new_implementation, **self.init_kwargs)
            
            logger.info(f"✅ Successfully switched from {old_implementation} to {self.rag.name} v{self.rag.version}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to switch RAG implementation: {e}")
            # Try to restore previous implementation
            try:
                self.current_implementation = old_implementation if 'old_implementation' in locals() else None
                if self.current_implementation:
                    self.rag = await create_rag(self.current_implementation, **self.init_kwargs)
            except:
                pass
            return False
    
    async def process_domain(
        self, 
        domain_config: DomainConfig,
        progress_callback: Optional[callable] = None
    ) -> AsyncGenerator[RAGMetrics, None]:
        """Process a domain through the current RAG implementation"""
        
        if not self._initialized or not self.rag:
            raise RuntimeError("RAG Service not initialized. Call initialize() first.")
        
        logger.info(f"🔍 Processing domain '{domain_config.name}' with {self.rag.name}")
        
        async for metrics in self.rag.process_domain(domain_config, progress_callback):
            yield metrics
    
    async def search_knowledge(
        self, 
        domain: str, 
        query: str, 
        limit: int = 5
    ) -> List[ProcessedChunk]:
        """Search knowledge using the current RAG implementation"""
        
        if not self._initialized or not self.rag:
            raise RuntimeError("RAG Service not initialized. Call initialize() first.")
        
        logger.debug(f"🔍 Searching '{query}' in domain '{domain}' using {self.rag.name}")
        
        return await self.rag.search_knowledge(domain, query, limit)
    
    async def get_current_metrics(self, domain: Optional[str] = None) -> Dict[str, RAGMetrics]:
        """Get current processing metrics"""
        
        if not self._initialized or not self.rag:
            return {}
        
        return await self.rag.get_metrics(domain)
    
    async def health_check(self) -> Dict[str, Any]:
        """Get health status of the RAG service"""
        
        health = {
            "service": "Modular RAG Service",
            "initialized": self._initialized,
            "current_implementation": self.current_implementation,
            "timestamp": time.time()
        }
        
        if self._initialized and self.rag:
            rag_health = await self.rag.health_check()
            health["rag_implementation"] = rag_health
            health["status"] = "healthy" if rag_health.get("status") == "healthy" else "degraded"
        else:
            health["status"] = "not_initialized"
        
        return health
    
    def get_available_implementations(self) -> Dict[str, str]:
        """Get all available RAG implementations"""
        return get_available_rags()
    
    def get_current_implementation_info(self) -> Dict[str, str]:
        """Get information about the current implementation"""
        if self.rag:
            return {
                "name": self.rag.name,
                "version": self.rag.version,
                "implementation_key": self.current_implementation
            }
        return {}
    
    async def cleanup(self) -> bool:
        """Clean up the RAG service"""
        try:
            if self.rag:
                await self.rag.cleanup()
            
            self._initialized = False
            logger.info("✅ Modular RAG Service cleanup completed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to cleanup RAG Service: {e}")
            return False


# Global service instance
_rag_service: Optional[ModularRAGService] = None


async def get_rag_service(implementation: str = None, **kwargs) -> ModularRAGService:
    """
    Get the global RAG service instance.
    
    Args:
        implementation: RAG implementation to use (None for default)
        **kwargs: Additional arguments for RAG initialization
        
    Returns:
        ModularRAGService: Initialized RAG service
    """
    global _rag_service
    
    if _rag_service is None:
        _rag_service = ModularRAGService(implementation, **kwargs)
        await _rag_service.initialize()
    
    return _rag_service


async def switch_global_rag(implementation: str, **kwargs) -> bool:
    """
    Switch the global RAG service to a different implementation.
    
    Args:
        implementation: New RAG implementation name
        **kwargs: Additional arguments for the new implementation
        
    Returns:
        bool: True if switch successful
    """
    global _rag_service
    
    if _rag_service is None:
        _rag_service = ModularRAGService(implementation, **kwargs)
        return await _rag_service.initialize()
    
    return await _rag_service.switch_implementation(implementation, **kwargs)


# Convenience functions for easy integration
async def search_rag(domain: str, query: str, limit: int = 5) -> List[ProcessedChunk]:
    """Quick search function using the global RAG service"""
    service = await get_rag_service()
    return await service.search_knowledge(domain, query, limit)


async def process_domain_rag(domain_config: DomainConfig) -> AsyncGenerator[RAGMetrics, None]:
    """Quick domain processing using the global RAG service"""
    service = await get_rag_service()
    async for metrics in service.process_domain(domain_config):
        yield metrics


def list_available_rags() -> Dict[str, str]:
    """List all available RAG implementations"""
    return get_available_rags()


# Example usage and testing
async def main():
    """Example usage of the Modular RAG Service"""
    logging.basicConfig(level=logging.INFO)
    
    try:
        # Initialize with default implementation (ARAG v1)
        service = ModularRAGService()
        await service.initialize()
        
        # Check health
        health = await service.health_check()
        print(f"Health: {health}")
        
        # List available implementations
        implementations = service.get_available_implementations()
        print(f"Available RAG implementations: {implementations}")
        
        # Example domain config
        domain_config = DomainConfig(
            name="test_domain",
            display_name="Test Domain",
            description="Test domain for RAG processing",
            sources=["https://example.com/docs"]
        )
        
        # Process domain (this would normally take time)
        print("Processing domain...")
        async for metrics in service.process_domain(domain_config):
            print(f"Stage: {metrics.stage.value}, Status: {metrics.status}")
        
        # Search knowledge
        results = await service.search_knowledge("test_domain", "example query")
        print(f"Search results: {len(results)} chunks found")
        
        # Cleanup
        await service.cleanup()
        
    except Exception as e:
        logger.error(f"Example failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())
