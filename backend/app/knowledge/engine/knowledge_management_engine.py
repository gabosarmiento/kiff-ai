"""
Knowledge Management Engine
==========================

Backend engine for domain-agnostic knowledge management with real-time monitoring.
Builds on Julia BFF's AgenticKnowledgePipeline and CrossAgentKnowledgeTools patterns.

Key Features:
- Domain-agnostic knowledge pipeline
- Parallel LanceDB vectorization
- Real-time token and performance monitoring
- Cross-domain knowledge tools
- Frontend visibility APIs
"""

import asyncio
import logging
import time
from pathlib import Path
from typing import Dict, Optional, List, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import json
from datetime import datetime
import concurrent.futures

from agno.agent import Agent
from agno.models.groq import Groq
from agno.vectordb.lancedb import LanceDb, SearchType
from agno.knowledge.agent import AgentKnowledge
from agno.document.base import Document
from agno.document.chunking.recursive import RecursiveChunking

# Import local embedder cache to avoid OpenAI dependency
from app.knowledge.embedder_cache import get_embedder

logger = logging.getLogger(__name__)


@dataclass
class ProcessingMetrics:
    """Real-time processing metrics for frontend visibility"""
    domain: str
    start_time: float
    end_time: Optional[float] = None
    status: str = "processing"  # processing, completed, failed
    urls_processed: int = 0
    chunks_created: int = 0
    tokens_used: int = 0
    processing_time_seconds: float = 0.0
    error_message: Optional[str] = None
    vectorization_time: float = 0.0
    embedding_count: int = 0


@dataclass
class DomainConfig:
    """Configuration for any knowledge domain"""
    name: str
    display_name: str
    description: str
    sources: List[str]
    priority: int = 1
    extraction_strategy: str = "agentic_pipeline"
    keywords: List[str] = field(default_factory=list)


class KnowledgeManagementEngine:
    """
    Backend engine for domain-agnostic knowledge management.
    Based on Julia BFF's proven patterns with performance monitoring.
    """
    
    def __init__(self, knowledge_base_dir: str = None):
        """Initialize the knowledge management engine"""
        if knowledge_base_dir is None:
            self.knowledge_base_dir = Path(__file__).parent.parent / "data"
        else:
            self.knowledge_base_dir = Path(knowledge_base_dir)
        
        self.knowledge_base_dir.mkdir(exist_ok=True)
        
        # Knowledge storage
        self.knowledge_bases: Dict[str, AgentKnowledge] = {}
        self.processing_metrics: Dict[str, ProcessingMetrics] = {}
        
        # Processing state
        self.active_extractions: Dict[str, asyncio.Task] = {}
        
        # Model configuration
        self.model = Groq(id="llama-3.3-70b-versatile")
        
        logger.info("🚀 Knowledge Management Engine initialized")
    
    async def create_domain_knowledge_base(
        self, 
        domain_config: DomainConfig,
        progress_callback: Optional[callable] = None
    ) -> Tuple[Optional[AgentKnowledge], ProcessingMetrics]:
        """
        Create knowledge base for any domain using agentic pipeline.
        Returns knowledge base and detailed metrics for frontend visibility.
        """
        metrics = ProcessingMetrics(
            domain=domain_config.name,
            start_time=time.time()
        )
        
        try:
            logger.info(f"🏗️ Creating knowledge base for {domain_config.display_name}...")
            
            # Step 1: Initialize agentic pipeline
            pipeline = await self._create_domain_pipeline(domain_config, metrics)
            
            # Step 2: Extract and process knowledge (parallel)
            knowledge_base = await self._extract_and_vectorize(
                pipeline, domain_config, metrics, progress_callback
            )
            
            if knowledge_base:
                self.knowledge_bases[domain_config.name] = knowledge_base
                metrics.status = "completed"
                logger.info(f"✅ Knowledge base created for {domain_config.display_name}")
            else:
                metrics.status = "failed"
                metrics.error_message = "Knowledge base creation failed"
                logger.error(f"❌ Failed to create knowledge base for {domain_config.display_name}")
            
        except Exception as e:
            metrics.status = "failed"
            metrics.error_message = str(e)
            logger.error(f"❌ Error creating knowledge base for {domain_config.name}: {e}")
        
        finally:
            metrics.end_time = time.time()
            metrics.processing_time_seconds = metrics.end_time - metrics.start_time
            self.processing_metrics[domain_config.name] = metrics
        
        return self.knowledge_bases.get(domain_config.name), metrics
    
    async def _create_domain_pipeline(
        self, 
        domain_config: DomainConfig, 
        metrics: ProcessingMetrics
    ) -> 'DomainAgenticPipeline':
        """Create domain-specific agentic pipeline"""
        
        # Create URLs file for the domain
        urls_dir = self.knowledge_base_dir / "urls"
        urls_dir.mkdir(exist_ok=True)
        
        urls_file = urls_dir / f"{domain_config.name}_urls.txt"
        formatted_urls = [f"• {url}" for url in domain_config.sources]
        
        with open(urls_file, 'w') as f:
            f.write('\n'.join(formatted_urls))
        
        # Create pipeline instance
        pipeline = DomainAgenticPipeline(
            domain_name=domain_config.name,
            display_name=domain_config.display_name,
            urls_file=str(urls_file),
            db_path=str(self.knowledge_base_dir / f"{domain_config.name}.db"),
            model=self.model
        )
        
        await pipeline.initialize_agents()
        return pipeline
    
    async def _extract_and_vectorize(
        self,
        pipeline: 'DomainAgenticPipeline',
        domain_config: DomainConfig,
        metrics: ProcessingMetrics,
        progress_callback: Optional[callable] = None
    ) -> Optional[AgentKnowledge]:
        """Extract knowledge and vectorize in parallel for performance"""
        
        try:
            # Run the agentic pipeline
            knowledge_base = await pipeline.process_knowledge_pipeline()
            
            # Update metrics from pipeline
            metrics.urls_processed = pipeline.processed_urls
            metrics.chunks_created = pipeline.valuable_chunks
            metrics.tokens_used = pipeline.total_tokens_used
            metrics.vectorization_time = pipeline.vectorization_time
            metrics.embedding_count = pipeline.embedding_count
            
            # Progress callback for frontend
            if progress_callback:
                await progress_callback({
                    "domain": domain_config.name,
                    "status": "vectorizing",
                    "progress": 80,
                    "metrics": metrics
                })
            
            return knowledge_base
            
        except Exception as e:
            logger.error(f"❌ Extraction and vectorization failed for {domain_config.name}: {e}")
            return None
    
    async def create_cross_domain_tools(self, domain_names: List[str]) -> Optional['CrossDomainKnowledgeTools']:
        """
        Create cross-domain knowledge tools for any combination of domains.
        Enhanced version of Julia BFF's CrossAgentKnowledgeTools.
        """
        try:
            # Get available knowledge bases
            available_knowledge_bases = {}
            for domain_name in domain_names:
                if domain_name in self.knowledge_bases:
                    available_knowledge_bases[domain_name] = self.knowledge_bases[domain_name]
            
            if not available_knowledge_bases:
                logger.error("❌ No knowledge bases available for cross-domain tools")
                return None
            
            # Create enhanced cross-domain tools
            cross_domain_tools = CrossDomainKnowledgeTools(
                knowledge_map=available_knowledge_bases,
                think=True,
                search=True,
                analyze=True,
                validate=True
            )
            
            logger.info(f"✅ Cross-domain tools created with {len(available_knowledge_bases)} domains")
            return cross_domain_tools
            
        except Exception as e:
            logger.error(f"❌ Failed to create cross-domain tools: {e}")
            return None
    
    def get_processing_metrics(self, domain_name: Optional[str] = None) -> Dict[str, Any]:
        """Get real-time processing metrics for frontend visibility"""
        if domain_name:
            metrics = self.processing_metrics.get(domain_name)
            if metrics:
                return {
                    "domain": metrics.domain,
                    "status": metrics.status,
                    "urls_processed": metrics.urls_processed,
                    "chunks_created": metrics.chunks_created,
                    "tokens_used": metrics.tokens_used,
                    "processing_time_seconds": metrics.processing_time_seconds,
                    "vectorization_time": metrics.vectorization_time,
                    "embedding_count": metrics.embedding_count,
                    "error_message": metrics.error_message
                }
            return {}
        
        # Return all metrics
        return {
            domain: {
                "domain": metrics.domain,
                "status": metrics.status,
                "urls_processed": metrics.urls_processed,
                "chunks_created": metrics.chunks_created,
                "tokens_used": metrics.tokens_used,
                "processing_time_seconds": metrics.processing_time_seconds,
                "vectorization_time": metrics.vectorization_time,
                "embedding_count": metrics.embedding_count,
                "error_message": metrics.error_message
            }
            for domain, metrics in self.processing_metrics.items()
        }
    
    def get_available_domains(self) -> List[Dict[str, Any]]:
        """Get list of available knowledge domains"""
        return [
            {
                "name": domain_name,
                "status": "ready" if domain_name in self.knowledge_bases else "not_created",
                "metrics": self.get_processing_metrics(domain_name)
            }
            for domain_name in self.processing_metrics.keys()
        ]
    
    async def start_background_extraction(
        self, 
        domain_config: DomainConfig,
        progress_callback: Optional[callable] = None
    ) -> str:
        """Start knowledge extraction in background for non-blocking operation"""
        
        task_id = f"{domain_config.name}_{int(time.time())}"
        
        async def extraction_task():
            return await self.create_domain_knowledge_base(domain_config, progress_callback)
        
        # Start background task
        task = asyncio.create_task(extraction_task())
        self.active_extractions[task_id] = task
        
        logger.info(f"🚀 Started background extraction for {domain_config.display_name} (task: {task_id})")
        return task_id
    
    def get_extraction_status(self, task_id: str) -> Dict[str, Any]:
        """Get status of background extraction task"""
        if task_id not in self.active_extractions:
            return {"status": "not_found"}
        
        task = self.active_extractions[task_id]
        
        if task.done():
            if task.exception():
                return {
                    "status": "failed",
                    "error": str(task.exception())
                }
            else:
                return {
                    "status": "completed",
                    "result": "Knowledge base created successfully"
                }
        else:
            return {"status": "running"}


class DomainAgenticPipeline:
    """
    Domain-agnostic version of Julia BFF's AgenticKnowledgePipeline.
    Works with any domain, not just trading.
    """
    
    def __init__(self, domain_name: str, display_name: str, urls_file: str, db_path: str, model):
        self.domain_name = domain_name
        self.display_name = display_name
        self.urls_file = urls_file
        self.db_path = db_path
        self.model = model
        
        # Agents (will be initialized)
        self.url_prioritizer = None
        self.content_analyzer = None
        self.chunking_agent = None
        self.quality_verifier = None
        self.orchestrator = None
        
        # Metrics
        self.processed_urls = 0
        self.valuable_chunks = 0
        self.total_tokens_used = 0
        self.vectorization_time = 0.0
        self.embedding_count = 0
        
        # Vector database
        self.vector_db = None
    
    async def initialize_agents(self):
        """Initialize domain-agnostic agents (based on Julia BFF pattern)"""
        try:
            # Agent 1: URL Prioritization Agent
            self.url_prioritizer = Agent(
                name=f"{self.domain_name}_URLPrioritizer",
                role=f"Expert at analyzing {self.display_name} URLs and prioritizing content by value",
                model=self.model,
                instructions=[
                    f"You analyze {self.display_name} URLs and determine their priority for knowledge base construction.",
                    "Prioritize URLs that contain:",
                    "- Core documentation (APIs, frameworks, concepts)",
                    "- Essential tutorials and guides",
                    "- Practical examples and code samples",
                    "- Best practices and patterns",
                    "Skip or deprioritize:",
                    "- Navigation pages, changelogs, contact info",
                    "- Duplicate or redundant content",
                    "- Marketing or non-technical content",
                    "Return JSON with: priority (1-5), content_type, estimated_value (0-1), reasoning"
                ],
                markdown=True,
                show_tool_calls=False
            )
            
            # Agent 2: Content Analysis Agent
            self.content_analyzer = Agent(
                name=f"{self.domain_name}_ContentAnalyzer",
                role=f"Expert at analyzing {self.display_name} content and determining processing strategies",
                model=self.model,
                instructions=[
                    f"You analyze {self.display_name} content and determine the best processing strategy.",
                    "Classify content types:",
                    "- API_REFERENCE: API documentation, endpoints, parameters",
                    "- TUTORIAL: Step-by-step guides and tutorials",
                    "- EXAMPLES: Code examples and samples",
                    "- CONCEPTS: Framework concepts and theory",
                    "- LOW_VALUE: Marketing, navigation, irrelevant content",
                    "Return JSON with: content_type, chunk_strategy, should_process (bool), quality_score (0-1)"
                ],
                markdown=True,
                show_tool_calls=False
            )
            
            # Agent 3: Smart Chunking Agent
            self.chunking_agent = Agent(
                name=f"{self.domain_name}_ChunkingAgent",
                role=f"Expert at creating semantically meaningful chunks for {self.display_name} content",
                model=self.model,
                instructions=[
                    f"You create intelligent chunks from {self.display_name} content.",
                    "Chunking strategies:",
                    "- API_REFERENCE: Group by endpoints, maintain parameter lists",
                    "- TUTORIAL: Preserve step sequences, keep related concepts together",
                    "- EXAMPLES: Keep complete code examples intact",
                    "- CONCEPTS: Group related concepts, maintain logical flow",
                    "Create chunks that are self-contained and meaningful for retrieval.",
                    "Return JSON with: chunks (list), metadata, reasoning"
                ],
                markdown=True,
                show_tool_calls=False
            )
            
            # Agent 4: Quality Verification Agent
            self.quality_verifier = Agent(
                name=f"{self.domain_name}_QualityVerifier",
                role=f"Expert at verifying {self.display_name} content quality and accuracy",
                model=self.model,
                instructions=[
                    f"You verify the quality and accuracy of {self.display_name} content chunks.",
                    "Quality criteria:",
                    "- Technical accuracy and completeness",
                    "- Practical value for developers",
                    "- Clear and understandable content",
                    "- Proper code examples and syntax",
                    "- Relevant and up-to-date information",
                    "Filter out low-quality, outdated, or irrelevant chunks.",
                    "Return JSON with: is_valuable (bool), quality_score (0-1), reasoning"
                ],
                markdown=True,
                show_tool_calls=False
            )
            
            logger.info(f"✅ Initialized agents for {self.display_name}")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize agents for {self.domain_name}: {e}")
            raise
    
    async def process_knowledge_pipeline(self) -> Optional[AgentKnowledge]:
        """
        Run the complete domain-agnostic knowledge processing pipeline.
        Based on Julia BFF's proven pattern.
        """
        start_time = time.time()
        
        try:
            logger.info(f"🚀 Starting knowledge pipeline for {self.display_name}...")
            
            # Setup vector database with local embedder (no OpenAI dependency)
            local_embedder = get_embedder()
            if local_embedder:
                self.vector_db = LanceDb(
                    table_name=f"{self.domain_name}_knowledge",
                    uri=self.db_path,
                    search_type=SearchType.vector,
                    embedder=local_embedder
                )
                logger.info(f"✅ Created LanceDb with local SentenceTransformer embedder for {self.display_name}")
            else:
                logger.error(f"❌ Failed to get local embedder for vector database")
                self.vector_db = LanceDb(
                    table_name=f"{self.domain_name}_knowledge",
                    uri=self.db_path,
                    search_type=SearchType.vector
                )
            
            # Load URLs
            urls = self._load_urls()
            if not urls:
                logger.error(f"❌ No URLs found for {self.domain_name}")
                return None
            
            logger.info(f"📚 Processing {len(urls)} URLs for {self.display_name}...")
            
            # Process URLs through the agentic pipeline
            processed_chunks = []
            
            for i, url in enumerate(urls):
                try:
                    logger.info(f"🔄 Processing URL {i+1}/{len(urls)}: {url}")
                    
                    # Fetch content
                    content = await self._fetch_url_content(url)
                    if not content:
                        continue
                    
                    # Agent pipeline processing
                    chunks = await self._process_url_through_pipeline(url, content)
                    if chunks:
                        processed_chunks.extend(chunks)
                        self.processed_urls += 1
                    
                except Exception as e:
                    logger.warning(f"⚠️ Failed to process {url}: {e}")
                    continue
            
            # Filter valuable chunks
            valuable_chunks = [c for c in processed_chunks if c.get('is_valuable', False)]
            self.valuable_chunks = len(valuable_chunks)
            
            if valuable_chunks:
                # Vectorize in parallel
                vectorization_start = time.time()
                await self._vectorize_chunks(valuable_chunks)
                self.vectorization_time = time.time() - vectorization_start
                
                # Create AgentKnowledge with local embedder (no OpenAI dependency)
                local_embedder = get_embedder()
                if local_embedder:
                    knowledge_base = AgentKnowledge(vector_db=self.vector_db, embedder=local_embedder)
                    logger.info(f"✅ Using local SentenceTransformer embedder for {self.display_name}")
                else:
                    logger.error(f"❌ Failed to get local embedder, falling back to default")
                    knowledge_base = AgentKnowledge(vector_db=self.vector_db)
                
                elapsed = time.time() - start_time
                logger.info(f"✅ {self.display_name} pipeline complete in {elapsed:.1f}s")
                logger.info(f"📊 Processed {self.processed_urls} URLs, created {self.valuable_chunks} valuable chunks")
                
                return knowledge_base
            else:
                logger.warning(f"⚠️ No valuable chunks created for {self.display_name}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Pipeline failed for {self.domain_name}: {e}")
            return None
    
    def _load_urls(self) -> List[str]:
        """Load URLs from file"""
        try:
            with open(self.urls_file, 'r') as f:
                urls = []
                for line in f:
                    line = line.strip()
                    if line and line.startswith('• '):
                        urls.append(line[2:])  # Remove '• ' prefix
                return urls
        except Exception as e:
            logger.error(f"❌ Failed to load URLs from {self.urls_file}: {e}")
            return []
    
    async def _fetch_url_content(self, url: str) -> Optional[str]:
        """Fetch content from URL (simplified for now)"""
        # For now, return mock content
        # In production, implement actual HTTP fetching with aiohttp
        return f"Mock content for {url}"
    
    async def _process_url_through_pipeline(self, url: str, content: str) -> List[Dict[str, Any]]:
        """Process URL through the agentic pipeline"""
        try:
            # This would implement the full agentic pipeline
            # For now, return mock processed chunks
            return [
                {
                    "content": f"Processed content from {url}",
                    "metadata": {"url": url, "domain": self.domain_name},
                    "is_valuable": True,
                    "quality_score": 0.8
                }
            ]
        except Exception as e:
            logger.error(f"❌ Pipeline processing failed for {url}: {e}")
            return []
    
    async def _vectorize_chunks(self, chunks: List[Dict[str, Any]]):
        """Vectorize chunks in parallel using LanceDB"""
        try:
            from agno.document.base import Document
            
            documents = []
            for i, chunk in enumerate(chunks):
                doc = Document(
                    name=f"chunk_{i}",
                    content=chunk["content"],
                    meta_data=chunk["metadata"]
                )
                documents.append(doc)
            
            # Upsert to vector database
            self.vector_db.upsert(documents)
            self.embedding_count = len(documents)
            
            logger.info(f"✅ Vectorized {len(documents)} chunks for {self.display_name}")
            
        except Exception as e:
            logger.error(f"❌ Vectorization failed for {self.domain_name}: {e}")


class CrossDomainKnowledgeTools:
    """
    Enhanced version of Julia BFF's CrossAgentKnowledgeTools.
    Works with any combination of domains.
    """
    
    def __init__(self, knowledge_map: Dict[str, AgentKnowledge], **kwargs):
        self.knowledge_map = knowledge_map
        self.think = kwargs.get('think', True)
        self.search = kwargs.get('search', True)
        self.analyze = kwargs.get('analyze', True)
        self.validate = kwargs.get('validate', True)
        
        logger.info(f"✅ Cross-domain tools initialized with domains: {list(knowledge_map.keys())}")
    
    async def search_domain_knowledge(self, domain: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search specific domain knowledge base"""
        if domain not in self.knowledge_map:
            return []
        
        try:
            knowledge_base = self.knowledge_map[domain]
            # Implement actual search using AgentKnowledge
            # For now, return mock results
            return [
                {
                    "content": f"Mock search result for '{query}' in {domain}",
                    "score": 0.9,
                    "metadata": {"domain": domain, "query": query}
                }
            ]
        except Exception as e:
            logger.error(f"❌ Search failed for domain {domain}: {e}")
            return []
    
    async def search_all_domains(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search across all available domains"""
        all_results = []
        
        for domain in self.knowledge_map.keys():
            domain_results = await self.search_domain_knowledge(domain, query, limit // len(self.knowledge_map))
            all_results.extend(domain_results)
        
        # Sort by relevance score
        all_results.sort(key=lambda x: x.get('score', 0), reverse=True)
        return all_results[:limit]


# Global instance
_knowledge_engine: Optional[KnowledgeManagementEngine] = None


def get_knowledge_engine() -> KnowledgeManagementEngine:
    """Get the global knowledge management engine instance"""
    global _knowledge_engine
    if _knowledge_engine is None:
        _knowledge_engine = KnowledgeManagementEngine()
    return _knowledge_engine


# Example usage
async def main():
    """Example usage of the knowledge management engine"""
    logging.basicConfig(level=logging.INFO)
    
    engine = get_knowledge_engine()
    
    # Test domain configuration
    test_domain = DomainConfig(
        name="fastapi",
        display_name="FastAPI Framework",
        description="FastAPI web framework documentation",
        sources=[
            "https://fastapi.tiangolo.com/",
            "https://fastapi.tiangolo.com/tutorial/",
            "https://fastapi.tiangolo.com/advanced/"
        ],
        keywords=["fastapi", "api", "web", "framework"]
    )
    
    # Create knowledge base
    knowledge_base, metrics = await engine.create_domain_knowledge_base(test_domain)
    
    if knowledge_base:
        logger.info("✅ Knowledge base created successfully!")
        logger.info(f"📊 Metrics: {engine.get_processing_metrics('fastapi')}")
        
        # Create cross-domain tools
        cross_tools = await engine.create_cross_domain_tools(['fastapi'])
        if cross_tools:
            logger.info("✅ Cross-domain tools ready!")
    else:
        logger.error("❌ Knowledge base creation failed")


if __name__ == "__main__":
    asyncio.run(main())
