"""
ARAG v1 - Multi-Agent Knowledge Processing Pipeline
=================================================

This is the first implementation of the Agentic RAG interface, wrapping the existing
sophisticated multi-agent pipeline from knowledge_management_engine.py.

Features:
- 4 specialized agents (URL prioritizer, content analyzer, chunker, verifier)
- Domain-agnostic processing
- Real-time metrics and progress tracking
- LanceDB vectorization
- Quality scoring and validation
"""

import asyncio
import logging
import time
from typing import Dict, List, Any, Optional, AsyncGenerator
from pathlib import Path

from app.knowledge.interfaces.agentic_rag_interface import (
    AgenticRAGInterface, 
    RAGMetrics, 
    RAGProcessingStage, 
    DomainConfig, 
    ProcessedChunk,
    RAGFactory
)
from app.knowledge.engine.knowledge_management_engine import (
    KnowledgeManagementEngine,
    DomainAgenticPipeline
)

logger = logging.getLogger(__name__)


class ARAG_V1(AgenticRAGInterface):
    """
    ARAG Version 1 - Multi-Agent Pipeline Implementation
    
    This wraps the existing sophisticated knowledge management engine
    with the new modular interface for easy swapping.
    """
    
    def __init__(self, knowledge_base_dir: str = None):
        self.knowledge_base_dir = knowledge_base_dir
        self.engine: Optional[KnowledgeManagementEngine] = None
        self.active_pipelines: Dict[str, DomainAgenticPipeline] = {}
        self._initialized = False
    
    @property
    def version(self) -> str:
        return "1.0.0"
    
    @property
    def name(self) -> str:
        return "Multi-Agent Knowledge Pipeline (ARAG v1)"
    
    async def initialize(self, **kwargs) -> bool:
        """Initialize the multi-agent RAG system"""
        try:
            logger.info(f"🚀 Initializing {self.name} v{self.version}")
            
            # Initialize the knowledge management engine
            self.engine = KnowledgeManagementEngine(self.knowledge_base_dir)
            
            self._initialized = True
            logger.info(f"✅ {self.name} initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize {self.name}: {e}")
            return False
    
    async def process_domain(
        self, 
        domain_config: DomainConfig,
        progress_callback: Optional[callable] = None
    ) -> AsyncGenerator[RAGMetrics, None]:
        """Process a domain through the multi-agent pipeline"""
        
        if not self._initialized:
            raise RuntimeError("ARAG v1 not initialized. Call initialize() first.")
        
        pipeline_id = f"{domain_config.name}_{int(time.time())}"
        
        try:
            # Convert our DomainConfig to the engine's format
            engine_config = self._convert_domain_config(domain_config)
            
            # Track metrics throughout the process
            current_metrics = RAGMetrics(
                pipeline_id=pipeline_id,
                domain=domain_config.name,
                stage=RAGProcessingStage.URL_PRIORITIZATION,
                start_time=time.time()
            )
            
            # Yield initial metrics
            yield current_metrics
            
            # Create progress callback wrapper
            async def wrapped_progress_callback(stage: str, progress: Dict[str, Any]):
                nonlocal current_metrics
                
                # Update metrics based on stage
                stage_mapping = {
                    "url_prioritization": RAGProcessingStage.URL_PRIORITIZATION,
                    "content_analysis": RAGProcessingStage.CONTENT_ANALYSIS,
                    "chunking": RAGProcessingStage.CHUNKING,
                    "quality_verification": RAGProcessingStage.QUALITY_VERIFICATION,
                    "vectorization": RAGProcessingStage.VECTORIZATION,
                    "indexing": RAGProcessingStage.INDEXING
                }
                
                current_metrics.stage = stage_mapping.get(stage, current_metrics.stage)
                current_metrics.urls_processed = progress.get("urls_processed", 0)
                current_metrics.chunks_created = progress.get("chunks_created", 0)
                current_metrics.tokens_used = progress.get("tokens_used", 0)
                current_metrics.quality_score = progress.get("quality_score", 0.0)
                current_metrics.processing_time_seconds = time.time() - current_metrics.start_time
                
                # Call original callback if provided
                if progress_callback:
                    await progress_callback(stage, progress)
                
                # Yield updated metrics
                yield current_metrics
            
            # Process through the engine
            result = await self.engine.create_domain_knowledge_base(
                engine_config,
                progress_callback=wrapped_progress_callback
            )
            
            # Final metrics
            current_metrics.status = "completed"
            current_metrics.end_time = time.time()
            current_metrics.processing_time_seconds = current_metrics.end_time - current_metrics.start_time
            
            yield current_metrics
            
            logger.info(f"✅ Domain '{domain_config.name}' processed successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to process domain '{domain_config.name}': {e}")
            
            # Error metrics
            error_metrics = RAGMetrics(
                pipeline_id=pipeline_id,
                domain=domain_config.name,
                stage=current_metrics.stage if 'current_metrics' in locals() else RAGProcessingStage.URL_PRIORITIZATION,
                start_time=current_metrics.start_time if 'current_metrics' in locals() else time.time(),
                end_time=time.time(),
                status="error",
                error_message=str(e)
            )
            
            yield error_metrics
    
    async def search_knowledge(
        self, 
        domain: str, 
        query: str, 
        limit: int = 5
    ) -> List[ProcessedChunk]:
        """Search the processed knowledge base"""
        
        if not self._initialized:
            raise RuntimeError("ARAG v1 not initialized. Call initialize() first.")
        
        try:
            # Get cross-domain tools from the engine
            domain_names = [domain] if domain in self.engine.knowledge_bases else list(self.engine.knowledge_bases.keys())
            
            if not domain_names:
                logger.warning(f"No knowledge bases available for domain '{domain}'")
                return []
            
            cross_domain_tools = self.engine.create_cross_domain_tools(domain_names)
            
            # Search using the cross-domain tools
            if domain in self.engine.knowledge_bases:
                results = await cross_domain_tools.search_domain_knowledge(domain, query, limit)
            else:
                results = await cross_domain_tools.search_all_domains(query, limit)
            
            # Convert results to ProcessedChunk format
            processed_chunks = []
            for result in results:
                chunk = ProcessedChunk(
                    content=result.get("content", ""),
                    metadata=result.get("metadata", {}),
                    quality_score=result.get("quality_score", 0.0),
                    chunk_type=result.get("chunk_type", "unknown"),
                    source_url=result.get("source_url", ""),
                    domain=domain,
                    embedding=result.get("embedding")
                )
                processed_chunks.append(chunk)
            
            return processed_chunks
            
        except Exception as e:
            logger.error(f"❌ Failed to search knowledge for '{query}' in domain '{domain}': {e}")
            return []
    
    async def get_metrics(self, domain: Optional[str] = None) -> Dict[str, RAGMetrics]:
        """Get current processing metrics"""
        
        if not self._initialized:
            return {}
        
        try:
            # Get metrics from the engine
            engine_metrics = self.engine.get_processing_metrics(domain)
            
            # Convert to our RAG metrics format
            rag_metrics = {}
            for domain_name, metrics in engine_metrics.items():
                rag_metric = RAGMetrics(
                    pipeline_id=f"{domain_name}_{int(metrics.start_time)}",
                    domain=domain_name,
                    stage=RAGProcessingStage.INDEXING,  # Default stage
                    start_time=metrics.start_time,
                    end_time=metrics.end_time,
                    status=metrics.status,
                    urls_processed=metrics.urls_processed,
                    chunks_created=metrics.chunks_created,
                    tokens_used=metrics.tokens_used,
                    processing_time_seconds=metrics.processing_time_seconds,
                    error_message=metrics.error_message
                )
                
                rag_metrics[rag_metric.pipeline_id] = rag_metric
            
            return rag_metrics
            
        except Exception as e:
            logger.error(f"❌ Failed to get metrics: {e}")
            return {}
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health status of ARAG v1"""
        
        health_status = {
            "implementation": self.name,
            "version": self.version,
            "initialized": self._initialized,
            "timestamp": time.time()
        }
        
        if self._initialized and self.engine:
            try:
                # Check engine health
                available_domains = self.engine.get_available_domains()
                active_extractions = len(self.engine.active_extractions)
                
                health_status.update({
                    "status": "healthy",
                    "available_domains": len(available_domains),
                    "active_extractions": active_extractions,
                    "knowledge_bases": list(self.engine.knowledge_bases.keys())
                })
                
            except Exception as e:
                health_status.update({
                    "status": "unhealthy",
                    "error": str(e)
                })
        else:
            health_status["status"] = "not_initialized"
        
        return health_status
    
    async def cleanup(self) -> bool:
        """Clean up resources"""
        try:
            if self.engine:
                # Cancel any active extractions
                for task in self.engine.active_extractions.values():
                    if not task.done():
                        task.cancel()
                
                # Clear resources
                self.engine.knowledge_bases.clear()
                self.engine.processing_metrics.clear()
                self.engine.active_extractions.clear()
            
            self._initialized = False
            logger.info(f"✅ {self.name} cleanup completed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to cleanup {self.name}: {e}")
            return False
    
    def _convert_domain_config(self, domain_config: DomainConfig):
        """Convert our DomainConfig to the engine's format"""
        from app.knowledge.engine.knowledge_management_engine import DomainConfig as EngineDomainConfig
        
        return EngineDomainConfig(
            name=domain_config.name,
            display_name=domain_config.display_name,
            description=domain_config.description,
            sources=domain_config.sources,
            priority=domain_config.priority,
            extraction_strategy=domain_config.extraction_strategy,
            keywords=domain_config.keywords or []
        )


# Register ARAG v1 as the default implementation
RAGFactory.register("arag_v1", ARAG_V1, is_default=True)

# Also register with alternative names
RAGFactory.register("multi_agent", ARAG_V1)
RAGFactory.register("default", ARAG_V1)

logger.info("🧱 ARAG v1 (Multi-Agent Pipeline) registered as default implementation")
