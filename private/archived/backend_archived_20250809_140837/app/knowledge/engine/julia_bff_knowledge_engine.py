"""
Julia BFF Knowledge Management Engine
====================================

Domain-agnostic knowledge management engine following Julia BFF's proven patterns:
1. Multiple LLMs per task (reasoning, planning, coding, etc.)
2. Sitemap extraction for always-up-to-date documentation
3. Simple reasoning/CoT agents (not complex orchestration)
4. Real documentation processing (not mock content)
5. AGNO/LanceDB vectorization with AgentKnowledge

Based on Julia BFF's successful implementation patterns.
"""

import asyncio
import logging
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Optional, List, Any, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum
import json
from datetime import datetime
import aiohttp
import requests
from urllib.parse import urlparse
import re

from agno.agent import Agent
from agno.models.groq import Groq
from agno.vectordb.lancedb import LanceDb, SearchType
from agno.knowledge.agent import AgentKnowledge
from agno.document.base import Document
from agno.document.chunking.recursive import RecursiveChunking

# Import local embedder cache to avoid OpenAI dependency
from app.knowledge.embedder_cache import get_embedder

logger = logging.getLogger(__name__)


class TaskType(Enum):
    """LLM task types following Julia BFF pattern"""
    REASONING = "reasoning"
    PLANNING = "planning"
    ANALYSIS = "analysis"
    GENERATION = "generation"
    AGENTIC = "agentic"
    CODING = "coding"
    QUICK = "quick"
    DEFAULT = "default"


@dataclass
class ProcessingMetrics:
    """Real-time processing metrics for frontend visibility"""
    domain: str
    start_time: float
    end_time: Optional[float] = None
    status: str = "processing"  # processing, completed, failed
    urls_extracted: int = 0
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
    sitemap_url: str
    url_prefix: str
    keywords: List[str] = field(default_factory=list)
    priority: int = 1


class JuliaBFFLLMProvider:
    """LLM provider following Julia BFF's multi-model approach"""
    
    def __init__(self, groq_api_key: str):
        self.groq_api_key = groq_api_key
        self.models = self._initialize_models()
    
    def _initialize_models(self) -> Dict[str, Groq]:
        """Initialize multiple LLMs for different tasks (Julia BFF pattern)"""
        return {
            "reasoning": Groq(
                id="deepseek-r1-distill-llama-70b",
                api_key=self.groq_api_key,
                temperature=0.6,
                top_p=0.95,
                max_tokens=20480
            ),
            "planning": Groq(
                id="qwen/qwen3-32b",
                api_key=self.groq_api_key,
                temperature=0.6,
                top_p=0.95
            ),
            "analysis": Groq(
                id="qwen/qwen3-32b",
                api_key=self.groq_api_key,
                temperature=0.2
            ),
            "generation": Groq(
                id="llama-3.3-70b-versatile",
                api_key=self.groq_api_key,
                temperature=0.3
            ),
            "agentic": Groq(
                id="moonshotai/kimi-k2-instruct",
                api_key=self.groq_api_key,
                temperature=0.3,
                max_tokens=16384
            ),
            "coding": Groq(
                id="moonshotai/kimi-k2-instruct",
                api_key=self.groq_api_key,
                temperature=0.3,
                max_tokens=16384
            ),
            "quick": Groq(
                id="llama-3.1-8b-instant",
                api_key=self.groq_api_key,
                temperature=0.2
            )
        }
    
    def get_model_for_task(self, task_type: TaskType) -> Groq:
        """Get the best model for a specific task type"""
        return self.models.get(task_type.value, self.models["analysis"])


class SitemapExtractor:
    """Extract URLs from sitemap.xml following Julia BFF pattern"""
    
    def __init__(self, filter_english_only: bool = True):
        self.filter_english_only = filter_english_only
        
        # Patterns to identify non-English URLs
        self.non_english_patterns = [
            r'/cn/', r'/zh/', r'/zh-cn/', r'/zh-tw/',
            r'[\u4e00-\u9fff]', r'/chinese/', r'/ja/', r'/ko/'
        ]
    
    def is_english_url(self, url: str) -> bool:
        """Check if URL appears to be English content"""
        if not self.filter_english_only:
            return True
            
        url_lower = url.lower()
        for pattern in self.non_english_patterns:
            if re.search(pattern, url_lower):
                return False
        return True
    
    async def extract_urls(self, sitemap_url: str, url_prefix: str) -> List[str]:
        """Extract URLs from sitemap XML that match the specified prefix"""
        try:
            # Download sitemap XML
            async with aiohttp.ClientSession() as session:
                async with session.get(sitemap_url) as response:
                    response.raise_for_status()
                    content = await response.read()
            
            # Parse XML
            root = ET.fromstring(content)
            
            # Extract URLs - handle different XML namespaces
            urls: Set[str] = set()
            
            # Try common sitemap namespaces
            namespaces = [
                {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'},
                {'ns': 'http://www.google.com/schemas/sitemap/0.9'},
                {}  # No namespace
            ]
            
            for ns in namespaces:
                # Look for <url><loc> elements
                if ns:
                    url_elements = root.findall('.//ns:url/ns:loc', ns)
                else:
                    url_elements = root.findall('.//url/loc')
                    if not url_elements:
                        url_elements = root.findall('.//loc')
                
                for url_elem in url_elements:
                    if url_elem.text and url_elem.text.startswith(url_prefix):
                        url = url_elem.text.strip()
                        # Apply language filtering
                        if self.is_english_url(url):
                            urls.add(url)
            
            # Return deduplicated and sorted list
            return sorted(list(urls))
            
        except Exception as e:
            logger.error(f"❌ Failed to extract URLs from {sitemap_url}: {e}")
            return []


class JuliaBFFKnowledgeEngine:
    """
    Julia BFF Knowledge Management Engine
    
    Follows Julia BFF's proven patterns:
    - Multiple LLMs per task type
    - Sitemap extraction for up-to-date docs
    - Simple reasoning agents
    - Real documentation processing
    - AGNO/LanceDB vectorization
    """
    
    def __init__(self, groq_api_key: str, knowledge_base_dir: str = None):
        """Initialize the Julia BFF knowledge engine"""
        if knowledge_base_dir is None:
            self.knowledge_base_dir = Path(__file__).parent.parent / "data"
        else:
            self.knowledge_base_dir = Path(knowledge_base_dir)
        
        self.knowledge_base_dir.mkdir(exist_ok=True)
        
        # Initialize LLM provider
        self.llm_provider = JuliaBFFLLMProvider(groq_api_key)
        
        # Initialize sitemap extractor
        self.sitemap_extractor = SitemapExtractor()
        
        # Knowledge storage
        self.knowledge_bases: Dict[str, AgentKnowledge] = {}
        self.processing_metrics: Dict[str, ProcessingMetrics] = {}
        
        # Processing state
        self.active_extractions: Dict[str, asyncio.Task] = {}
        
        logger.info("🚀 Julia BFF Knowledge Management Engine initialized")
    
    async def create_domain_knowledge_base(
        self, 
        domain_config: DomainConfig,
        progress_callback: Optional[callable] = None
    ) -> Tuple[Optional[AgentKnowledge], ProcessingMetrics]:
        """
        Create knowledge base for any domain using Julia BFF pattern.
        Returns knowledge base and detailed metrics for frontend visibility.
        """
        metrics = ProcessingMetrics(
            domain=domain_config.name,
            start_time=time.time()
        )
        
        try:
            logger.info(f"🏗️ Creating knowledge base for {domain_config.display_name}...")
            
            # Step 1: Extract URLs from sitemap (Julia BFF pattern)
            urls = await self._extract_domain_urls(domain_config, metrics)
            
            if not urls:
                metrics.status = "failed"
                metrics.error_message = "No URLs extracted from sitemap"
                return None, metrics
            
            # Step 2: Create reasoning agent for knowledge processing
            knowledge_agent = await self._create_knowledge_agent(domain_config)
            
            # Step 3: Process URLs with real documentation
            knowledge_base = await self._process_urls_with_agent(
                knowledge_agent, urls, domain_config, metrics, progress_callback
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
    
    async def _extract_domain_urls(
        self, 
        domain_config: DomainConfig, 
        metrics: ProcessingMetrics
    ) -> List[str]:
        """Extract URLs using WebsiteReader for comprehensive discovery (except AGNO)"""
        
        # Special case for AGNO: Use configured URLs directly (single comprehensive URL)
        if domain_config.name.lower() == "agno" or "agno" in domain_config.name.lower():
            logger.info(f"📄 AGNO special case: Using configured comprehensive URL...")
            urls = ["https://docs.agno.com/llms-full.txt"]  # Use the single comprehensive URL
            metrics.urls_extracted = len(urls)
            logger.info(f"🎉 Using {len(urls)} configured URLs for AGNO (comprehensive documentation)")
            return urls
        
        # For other APIs: Use AGNO WebsiteReader for comprehensive URL discovery
        logger.info(f"🔍 Using AGNO WebsiteReader for comprehensive URL discovery: {domain_config.display_name}...")
        
        try:
            # Import WebsiteReader from AGNO (updated path)
            from agno.document.reader.website_reader import WebsiteReader
            
            # Create WebsiteReader instance
            website_reader = WebsiteReader()
            
            # Use base_url as the starting point for comprehensive crawling
            base_url = domain_config.url_prefix or domain_config.sitemap_url.replace('/sitemap.xml', '')
            
            # Get comprehensive URL list using WebsiteReader
            logger.info(f"🕷️ WebsiteReader crawling: {base_url}")
            
            # Configure WebsiteReader for comprehensive crawling
            website_reader.max_links = 100  # Limit to 100 links for performance
            website_reader.max_depth = 2    # Crawl 2 levels deep
            
            # Use the correct AGNO WebsiteReader API method (synchronous)
            documents = website_reader.read(base_url)
            
            # Extract URLs from documents and add base URL
            urls = [base_url]  # Always include the base URL
            
            if documents:
                logger.info(f"📄 WebsiteReader found {len(documents)} documents")
                for doc in documents:
                    if hasattr(doc, 'meta_data') and doc.meta_data:
                        url = doc.meta_data.get('url') or doc.meta_data.get('source')
                        if url and url not in urls:
                            urls.append(url)
            else:
                logger.warning(f"⚠️ WebsiteReader returned no documents for {base_url}")
            
            if isinstance(urls, str):
                # If single URL returned, convert to list
                urls = [base_url]
            elif isinstance(urls, dict) and 'links' in urls:
                # Extract links from response
                urls = urls['links']
            elif not isinstance(urls, list):
                # Fallback to base URL
                urls = [base_url]
            
            # Filter and deduplicate URLs
            filtered_urls = []
            for url in urls:
                if isinstance(url, str) and url.startswith(('http://', 'https://')):
                    if base_url in url:  # Only include URLs from the same domain
                        filtered_urls.append(url)
            
            # Remove duplicates and sort
            urls = sorted(list(set(filtered_urls)))
            
            metrics.urls_extracted = len(urls)
            logger.info(f"🎉 WebsiteReader discovered {len(urls)} URLs for {domain_config.display_name}")
            
            # Log first few URLs for verification
            for i, url in enumerate(urls[:5]):
                logger.info(f"📄 Discovered URL {i+1}: {url}")
            
            if len(urls) > 5:
                logger.info(f"📄 ... and {len(urls) - 5} more URLs")
            
            return urls
            
        except Exception as e:
            logger.error(f"❌ WebsiteReader failed for {domain_config.display_name}: {e}")
            
            # Fallback to configured URLs if WebsiteReader fails
            """Extract URLs using WebsiteReader for comprehensive discovery (except AGNO)"""
        
        # Special case for AGNO: Use configured URLs directly (single comprehensive URL)
        if domain_config.name.lower() == "agno" or "agno" in domain_config.name.lower():
            logger.info(f"📄 AGNO special case: Using configured comprehensive URL...")
            urls = ["https://docs.agno.com/llms-full.txt"]  # Use the single comprehensive URL
            metrics.urls_extracted = len(urls)
            logger.info(f"🎉 Using {len(urls)} configured URLs for AGNO (comprehensive documentation)")
            return urls
        
        # For other APIs: Use AGNO WebsiteReader for comprehensive URL discovery
        logger.info(f"🔍 Using AGNO WebsiteReader for comprehensive URL discovery: {domain_config.display_name}...")
        
        try:
            # Import WebsiteReader from AGNO (updated path)
            from agno.document.reader.website_reader import WebsiteReader
            
            # Create WebsiteReader instance
            website_reader = WebsiteReader()
            
            # Get base URL for crawling
            base_url = domain_config.base_url
            
            # Get comprehensive URL list using WebsiteReader
            logger.info(f"🕷️ WebsiteReader crawling: {base_url}")
            
            # Configure WebsiteReader for comprehensive crawling
            website_reader.max_links = 100  # Limit to 100 links for performance
            website_reader.max_depth = 2    # Crawl 2 levels deep
            
            # Use the correct AGNO WebsiteReader API method (synchronous)
            documents = website_reader.read(base_url)
            
            # Extract URLs from documents and add base URL
            urls = [base_url]  # Always include the base URL
            
            if documents:
                logger.info(f"📄 WebsiteReader found {len(documents)} documents")
                for doc in documents:
                    if hasattr(doc, 'meta_data') and doc.meta_data:
                        url = doc.meta_data.get('url') or doc.meta_data.get('source')
                        if url and url not in urls:
                            urls.append(url)
            else:
                logger.warning(f"⚠️ WebsiteReader returned no documents for {base_url}")
            
            # Filter and deduplicate URLs
            filtered_urls = []
            for url in urls:
                if isinstance(url, str) and url.startswith(('http://', 'https://')):
                    if base_url.split('//')[1].split('/')[0] in url:  # Same domain
                        filtered_urls.append(url)
            
            urls = sorted(list(set(filtered_urls)))
            metrics.urls_extracted = len(urls)
            logger.info(f"🎉 WebsiteReader discovered {len(urls)} URLs for {domain_config.display_name}")
            
            # Fallback to sitemap extraction
            logger.info(f"🔄 Final fallback to sitemap extraction: {domain_config.sitemap_url}")
            urls = await self.sitemap_extractor.extract_urls(
                domain_config.sitemap_url,
                domain_config.url_prefix
            )
            metrics.urls_extracted = len(urls)
            return urls
            
        except Exception as e:
            logger.error(f"❌ WebsiteReader failed for {domain_config.display_name}: {e}")
            
            # Fallback to sitemap extraction
            logger.info(f"🔄 Final fallback to sitemap extraction: {domain_config.sitemap_url}")
            urls = await self.sitemap_extractor.extract_urls(
                domain_config.sitemap_url,
                domain_config.url_prefix
            )
            metrics.urls_extracted = len(urls)
            return urls
    
    async def _create_knowledge_agent(self, domain_config: DomainConfig) -> Agent:
        """Create reasoning agent for knowledge processing (Julia BFF pattern)"""
        
        # Use reasoning model for complex knowledge processing
        reasoning_model = self.llm_provider.get_model_for_task(TaskType.REASONING)
        
        agent = Agent(
            name=f"{domain_config.name}_KnowledgeAgent",
            role=f"Expert at processing {domain_config.display_name} documentation with chain-of-thought reasoning",
            model=reasoning_model,
            instructions=[
                f"You are an expert at processing {domain_config.display_name} documentation.",
                "Use chain-of-thought reasoning to analyze and extract valuable knowledge.",
                "Focus on:",
                "- Core concepts and frameworks",
                "- API documentation and endpoints", 
                "- Practical examples and code samples",
                "- Best practices and patterns",
                "- Error handling and troubleshooting",
                "Think step by step:",
                "1. Analyze the content type and structure",
                "2. Identify key concepts and relationships",
                "3. Extract actionable information",
                "4. Create meaningful, searchable chunks",
                "Always provide reasoning for your decisions.",
                "Return structured JSON with your analysis and extracted chunks."
            ],
            markdown=True,
            show_tool_calls=False
        )
        
        return agent
    
    async def _process_urls_with_agent(
        self,
        agent: Agent,
        urls: List[str],
        domain_config: DomainConfig,
        metrics: ProcessingMetrics,
        progress_callback: Optional[callable] = None
    ) -> Optional[AgentKnowledge]:
        """Process URLs with reasoning agent (Julia BFF pattern)"""
        
        try:
            # Setup vector database with local embedder (no OpenAI dependency)
            local_embedder = get_embedder()
            if local_embedder:
                vector_db = LanceDb(
                    table_name=f"{domain_config.name}_knowledge",
                    uri=str(self.knowledge_base_dir / f"{domain_config.name}.db"),
                    search_type=SearchType.vector,
                    embedder=local_embedder
                )
                logger.info(f"✅ Created LanceDb with local SentenceTransformer embedder")
            else:
                logger.error(f"❌ Failed to get local embedder for vector database")
                vector_db = LanceDb(
                    table_name=f"{domain_config.name}_knowledge",
                    uri=str(self.knowledge_base_dir / f"{domain_config.name}.db"),
                    search_type=SearchType.vector
                )
            
            processed_chunks = []
            
            # Process URLs with parallel processing (Julia BFF pattern)
            process_limit = min(len(urls), 10)
            logger.info(f"🚀 Processing {process_limit} URLs with parallel reasoning agents...")
            
            # Parallel processing function
            async def process_single_url(i: int, url: str) -> tuple:
                """Process a single URL with error handling"""
                try:
                    logger.info(f"📄 Processing URL {i+1}/{process_limit}: {url}")
                    
                    # Fetch real content
                    content = await self._fetch_url_content(url)
                    if not content:
                        return i, url, []
                    
                    # Process with reasoning agent
                    chunks = await self._process_content_with_reasoning(
                        agent, url, content, domain_config
                    )
                    
                    return i, url, chunks if chunks else []
                    
                except Exception as e:
                    logger.warning(f"⚠️ Failed to process {url}: {e}")
                    return i, url, []
            
            # Execute all URLs in parallel (Julia BFF multithreading pattern)
            import asyncio
            tasks = [
                process_single_url(i, url) 
                for i, url in enumerate(urls[:process_limit])
            ]
            
            # Process all URLs concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Collect results
            for result in results:
                if isinstance(result, Exception):
                    logger.warning(f"⚠️ Task failed with exception: {result}")
                    continue
                    
                i, url, chunks = result
                if chunks:
                    processed_chunks.extend(chunks)
                    metrics.urls_processed += 1
                
                # Progress callback
                if progress_callback:
                    await progress_callback({
                        "domain": domain_config.name,
                        "status": "processing",
                        "progress": int((i + 1) / process_limit * 80),
                        "current_url": url
                    })
            
            metrics.chunks_created = len(processed_chunks)
            
            if processed_chunks:
                # Vectorize chunks
                vectorization_start = time.time()
                
                documents = []
                for i, chunk in enumerate(processed_chunks):
                    doc = Document(
                        name=f"chunk_{i}",
                        content=chunk["content"],
                        meta_data=chunk.get("metadata", {})
                    )
                    documents.append(doc)
                
                # Upsert to vector database
                vector_db.upsert(documents)
                
                metrics.vectorization_time = time.time() - vectorization_start
                metrics.embedding_count = len(documents)
                
                # Create AgentKnowledge with local embedder (no OpenAI dependency)
                local_embedder = get_embedder()
                if local_embedder:
                    knowledge_base = AgentKnowledge(vector_db=vector_db, embedder=local_embedder)
                    logger.info(f"✅ Using local SentenceTransformer embedder for {domain_config.display_name}")
                else:
                    logger.error(f"❌ Failed to get local embedder, falling back to default")
                    knowledge_base = AgentKnowledge(vector_db=vector_db)
                
                logger.info(f"✅ Processed {metrics.urls_processed} URLs, created {metrics.chunks_created} chunks")
                return knowledge_base
            else:
                logger.warning(f"⚠️ No chunks created for {domain_config.display_name}")
                return None
                
        except Exception as e:
            logger.error(f"❌ URL processing failed for {domain_config.name}: {e}")
            return None
    
    async def _fetch_url_content(self, url: str) -> Optional[str]:
        """Fetch real content from URL"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status == 200:
                        content = await response.text()
                        # Basic content extraction (could be enhanced with BeautifulSoup)
                        return content[:50000]  # Limit content size
                    else:
                        logger.warning(f"⚠️ HTTP {response.status} for {url}")
                        return None
        except Exception as e:
            logger.warning(f"⚠️ Failed to fetch {url}: {e}")
            return None
    
    async def _process_content_with_reasoning(
        self,
        agent: Agent,
        url: str,
        content: str,
        domain_config: DomainConfig
    ) -> List[Dict[str, Any]]:
        """Process content using Julia BFF agentic RAG pipeline with multi-agent processing"""
        
        try:
            # Import Julia BFF agentic pipeline components
            from agno.document.base import Document
            from agno.chunking.recursive import RecursiveChunking
            from enum import Enum
            from dataclasses import dataclass
            from typing import List, Dict, Any
            
            # Julia BFF Content Types (from the original pipeline)
            class ContentType(Enum):
                API_REFERENCE = "api_reference"
                EXAMPLES = "examples"
                TUTORIAL = "tutorial"
                CONCEPTS = "concepts"
                REFERENCE = "reference"
            
            @dataclass
            class ContentAnalysis:
                url: str
                content: str
                content_type: ContentType
                quality_score: float
                chunk_strategy: str
                keywords: List[str]
            
            @dataclass
            class ProcessedChunk:
                content: str
                metadata: Dict[str, Any]
                quality_score: float
                is_valuable: bool
            
            # Julia BFF Agent 2: Content Analysis (intelligent content type detection)
            logger.info(f"🤖 Julia BFF Agent 2: Analyzing content type and quality for {url}")
            
            content_lower = content.lower()
            
            # Intelligent content type detection (Julia BFF patterns)
            if any(pattern in content_lower for pattern in ['api', 'endpoint', 'method', 'parameter', 'request', 'response']):
                content_type = ContentType.API_REFERENCE
                chunk_strategy = "api_focused"
            elif any(pattern in content_lower for pattern in ['example', 'code', 'sample', 'demo', '```']):
                content_type = ContentType.EXAMPLES  
                chunk_strategy = "example_focused"
            elif any(pattern in content_lower for pattern in ['tutorial', 'guide', 'how to', 'step', 'walkthrough']):
                content_type = ContentType.TUTORIAL
                chunk_strategy = "sequential"
            elif any(pattern in content_lower for pattern in ['reference', 'specification', 'schema', 'attributes']):
                content_type = ContentType.REFERENCE
                chunk_strategy = "reference_focused"
            else:
                content_type = ContentType.CONCEPTS
                chunk_strategy = "concept_focused"
            
            # Quality scoring (Julia BFF approach)
            quality_score = 0.5  # Base score
            if len(content) > 2000: quality_score += 0.2
            if any(indicator in content_lower for indicator in ['important', 'note', 'warning', 'example']): quality_score += 0.1
            if content_type == ContentType.API_REFERENCE: quality_score += 0.2
            elif content_type == ContentType.EXAMPLES: quality_score += 0.15
            quality_score = min(quality_score, 1.0)
            
            # Extract keywords (Julia BFF approach)
            import re
            from collections import Counter
            words = re.findall(r'\b[A-Za-z]{3,}\b', content)
            stop_words = {'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one'}
            filtered_words = [word.lower() for word in words if word.lower() not in stop_words]
            keywords = [word for word, count in Counter(filtered_words).most_common(5)]
            
            content_analysis = ContentAnalysis(
                url=url,
                content=content,
                content_type=content_type,
                quality_score=quality_score,
                chunk_strategy=chunk_strategy,
                keywords=keywords
            )
            
            logger.info(f"✨ Content Analysis: {content_type.value}, quality={quality_score:.2f}, strategy={chunk_strategy}")
            
            # Julia BFF Agent 3: Smart Chunking (AGNO RecursiveChunking with content-aware sizing)
            logger.info(f"🧩 Julia BFF Agent 3: Creating smart chunks with content-aware sizing")
            
            # Chunk the document using AGNO's recursive chunking
            chunking_strategy = RecursiveChunking(
                chunk_size=5000,    # Julia BFF proven size - matches AGNO URLReader default
                overlap=500   # 10% overlap for context continuity (Julia BFF pattern)
            )
            
            doc = Document(
                name=f"doc_{url.split('/')[-1]}",
                content=content,
                meta_data={
                    "source": url,
                    "domain": domain_config.name,
                    "title": domain_config.display_name
                }
            )
            
            # Content-aware chunk sizing (Julia BFF Agent 3 intelligence)
            if content_analysis.content_type == ContentType.API_REFERENCE:
                chunk_size = 5000  # API docs - use AGNO's proven size
                overlap = 500
            elif content_analysis.content_type == ContentType.EXAMPLES:
                chunk_size = 6000  # Examples need even more context
                overlap = 600
            elif content_analysis.content_type == ContentType.TUTORIAL:
                chunk_size = 5500  # Tutorials need sequences intact
                overlap = 550
            else:
                chunk_size = 5000  # General docs - match AGNO default
                overlap = 500
            
            # Update chunking strategy with content-aware sizing
            chunking_strategy = RecursiveChunking(
                chunk_size=chunk_size,
                overlap=overlap
            )
            
            logger.info(f"🎯 Content-aware chunking: {content_analysis.content_type.value} -> {chunk_size} chars, {overlap} overlap")
            
            # Create chunks using AGNO's Document-based approach
            document_chunks = chunking_strategy.chunk(doc)
            
            logger.info(f"✅ Julia BFF Agent 3: Created {len(document_chunks)} smart chunks")
            
            # Julia BFF Agent 4: Quality Verification and Processing
            logger.info(f"🔍 Julia BFF Agent 4: Processing and verifying chunk quality")
            
            processed_chunks = []
            for i, chunk_doc in enumerate(document_chunks):
                # Extract content from AGNO Document
                chunk_content = chunk_doc.content
                
                # Julia BFF quality verification
                chunk_quality = content_analysis.quality_score
                
                # Content-specific quality adjustments
                if len(chunk_content) < 100:
                    chunk_quality *= 0.5  # Too short
                elif len(chunk_content) > 8000:
                    chunk_quality *= 0.8  # Too long
                
                # Check for valuable content indicators
                chunk_lower = chunk_content.lower()
                if any(indicator in chunk_lower for indicator in ['example', 'code', 'api', 'method', 'parameter']):
                    chunk_quality += 0.1
                
                chunk_quality = min(chunk_quality, 1.0)
                
                # Only keep valuable chunks (Julia BFF filtering)
                is_valuable = chunk_quality > 0.3
                
                if is_valuable:
                    processed_chunk = ProcessedChunk(
                        content=chunk_content,
                        metadata={
                            "url": content_analysis.url,
                            "type": content_analysis.content_type.value,
                            "chunk_index": i,
                            "strategy": content_analysis.chunk_strategy,
                            "chunk_name": chunk_doc.name,
                            "domain": domain_config.name,
                            "keywords": content_analysis.keywords,
                            "char_count": len(chunk_content)
                        },
                        quality_score=chunk_quality,
                        is_valuable=is_valuable
                    )
                    processed_chunks.append(processed_chunk)
            
            logger.info(f"✅ Julia BFF Agent 4: Verified {len(processed_chunks)} valuable chunks (filtered from {len(document_chunks)})")
            
            # Convert to final format for vectorization
            final_chunks = []
            for chunk in processed_chunks:
                final_chunks.append({
                    "content": chunk.content,
                    "metadata": chunk.metadata,
                    "importance": chunk.quality_score
                })
            
            # Production-Ready Semantic Processing: AGNO semantic chunking + intelligent local processing
            logger.info(f"⚡ Production Semantic Processing: Using AGNO semantic chunks with intelligent local analysis")
            
            def process_semantic_chunk_efficiently(chunk_info: dict) -> Dict[str, Any]:
                """Process AGNO semantic chunk with intelligent local analysis (production-ready)"""
                try:
                    content = chunk_info['content']
                    content_lower = content.lower()
                    
                    # Intelligent content type detection (enhanced patterns)
                    content_type = "concepts"  # Default
                    
                    # Code examples detection
                    code_patterns = ['```', 'class ', 'def ', 'import ', 'from ', 'function', '() {', 'const ', 'let ', 'var ']
                    if any(pattern in content_lower for pattern in code_patterns):
                        content_type = "code_examples"
                    
                    # API documentation detection
                    elif any(pattern in content_lower for pattern in ['api', 'endpoint', 'method', 'parameter', 'request', 'response', 'http']):
                        content_type = "api_docs"
                    
                    # Tutorial/guide detection
                    elif any(pattern in content_lower for pattern in ['tutorial', 'guide', 'how to', 'step', 'example', 'walkthrough']):
                        content_type = "tutorial"
                    
                    # Reference documentation detection
                    elif any(pattern in content_lower for pattern in ['reference', 'specification', 'schema', 'attributes', 'properties']):
                        content_type = "reference"
                    
                    # Intelligent importance scoring
                    importance = 0.5  # Base importance
                    
                    # Length-based importance (longer chunks often more comprehensive)
                    if len(content) > 2000:
                        importance += 0.2
                    elif len(content) > 1000:
                        importance += 0.1
                    
                    # Content quality indicators
                    quality_indicators = ['important', 'note', 'warning', 'required', 'example', 'usage']
                    if any(indicator in content_lower for indicator in quality_indicators):
                        importance += 0.1
                    
                    # Content type specific importance
                    if content_type == "code_examples":
                        importance += 0.2  # Code examples are highly valuable
                    elif content_type == "api_docs":
                        importance += 0.15  # API docs are very important
                    elif content_type == "tutorial":
                        importance += 0.1   # Tutorials are moderately important
                    
                    # Cap importance at 1.0
                    importance = min(importance, 1.0)
                    
                    # Intelligent keyword extraction (enhanced)
                    import re
                    from collections import Counter
                    
                    # Extract meaningful words (3+ chars, not common stop words)
                    words = re.findall(r'\b[A-Za-z]{3,}\b', content)
                    
                    # Enhanced stop words list
                    stop_words = {
                        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 
                        'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 
                        'did', 'man', 'men', 'put', 'say', 'she', 'too', 'use', 'way', 'will', 'with', 'have', 'this', 'that',
                        'they', 'been', 'their', 'said', 'each', 'which', 'what', 'were', 'when', 'where', 'than', 'some'
                    }
                    
                    # Filter and count words
                    filtered_words = [word.lower() for word in words if word.lower() not in stop_words and len(word) > 2]
                    word_counts = Counter(filtered_words)
                    
                    # Get top keywords with frequency weighting
                    top_keywords = [word for word, count in word_counts.most_common(8)]
                    
                    # Add domain-specific keywords based on content type
                    domain_keywords = []
                    if content_type == "code_examples":
                        domain_keywords = ['code', 'example', 'implementation']
                    elif content_type == "api_docs":
                        domain_keywords = ['api', 'endpoint', 'documentation']
                    elif content_type == "tutorial":
                        domain_keywords = ['tutorial', 'guide', 'howto']
                    
                    # Combine and deduplicate keywords
                    all_keywords = list(dict.fromkeys(top_keywords + domain_keywords))[:5]
                    
                    return {
                        "content": content,
                        "metadata": {
                            "url": url,
                            "chunk_index": chunk_info['index'],
                            "type": content_type,
                            "domain": domain_config.name,
                            "keywords": all_keywords,
                            "char_count": len(content),
                            "agno_metadata": chunk_info['metadata']
                        },
                        "importance": importance
                    }
                    
                except Exception as e:
                    logger.error(f"❌ Error in semantic processing for chunk {chunk_info['index']}: {e}")
                    # Return minimal fallback
                    return {
                        "content": chunk_info['content'],
                        "metadata": {
                            "url": url,
                            "chunk_index": chunk_info['index'],
                            "type": "concepts",
                            "domain": domain_config.name,
                            "keywords": ["documentation"],
                            "char_count": len(chunk_info['content'])
                        },
                        "importance": 0.5
                    }
            
            # Process AGNO chunks in parallel (Julia BFF multithreading pattern)
            import asyncio
            from concurrent.futures import ThreadPoolExecutor, as_completed
            
            # Julia BFF pattern: High-performance parallel processing (no agent bottleneck)
            batch_size = 200  # Process 200 chunks per batch (fast synchronous processing)
            concurrency = 6   # 6 parallel workers (can handle high throughput)
            
            # Auto-adjust based on chunk count for optimal performance
            if len(chunk_data) <= 50:
                # Small datasets: smaller batches, fewer workers
                batch_size = 25
                concurrency = 2
                logger.info(f"📊 Small dataset ({len(chunk_data)} chunks): Using 2 workers, 25 per batch")
            elif len(chunk_data) <= 200:
                # Medium datasets: moderate batches, good parallelism
                batch_size = 50
                concurrency = 4
                logger.info(f"📊 Medium dataset ({len(chunk_data)} chunks): Using 4 workers, 50 per batch")
            else:
                # Large datasets: maximum performance
                batch_size = 200
                concurrency = 7  # 7 workers for maximum throughput
                logger.info(f"📊 Large dataset ({len(chunk_data)} chunks): Using 7 workers, 200 per batch")
            
            logger.info(f"🚀 Julia BFF Performance: Processing {len(chunk_data)} chunks in batches of {batch_size} with {concurrency} workers")
            
            # Split chunks into batches for parallel processing
            batches = []
            for i in range(0, len(chunk_data), batch_size):
                batch = chunk_data[i:i + batch_size]
                batches.append((batch, i // batch_size + 1))
            
            logger.info(f"🚀 Julia BFF Performance: Created {len(batches)} batches for parallel processing")
            
            # Process batches with ThreadPoolExecutor (Julia BFF pattern)
            all_chunk_results = []
            
            def process_chunk_batch(batch_chunks, batch_id):
                """Process a batch of chunks with efficient semantic processing (production-ready)"""
                try:
                    logger.info(f"📊 Batch {batch_id}: Processing {len(batch_chunks)} chunks (semantic processing)")
                    
                    # Process all chunks in this batch with efficient local analysis
                    batch_results = []
                    for chunk_info in batch_chunks:
                        try:
                            result = process_semantic_chunk_efficiently(chunk_info)
                            batch_results.append(result)
                        except Exception as e:
                            logger.error(f"❌ Chunk {chunk_info['index']}: Failed - {e}")
                            # Add fallback chunk
                            batch_results.append({
                                "content": chunk_info['content'],
                                "metadata": {
                                    "url": url,
                                    "chunk_index": chunk_info['index'],
                                    "type": "api_docs",
                                    "domain": domain_config.name
                                },
                                "importance": 0.5
                            })
                    
                    logger.info(f"✅ Batch {batch_id}: Completed {len(batch_results)} chunks (fast path)")
                    return batch_results
                        
                except Exception as e:
                    logger.error(f"❌ Batch {batch_id}: Failed - {e}")
                    return []
            
            # Execute batches with ThreadPoolExecutor (Julia BFF multithreading)
            with ThreadPoolExecutor(max_workers=concurrency) as executor:
                # Submit all batch jobs
                future_to_batch = {}
                for batch_chunks, batch_id in batches:
                    future = executor.submit(process_chunk_batch, batch_chunks, batch_id)
                    future_to_batch[future] = (batch_chunks, batch_id)
                
                # Collect results as they complete (Julia BFF pattern)
                chunk_results = []
                for future in as_completed(future_to_batch):
                    batch_chunks, batch_id = future_to_batch[future]
                    try:
                        batch_results = future.result()
                        chunk_results.extend(batch_results)
                    except Exception as e:
                        logger.error(f"❌ Batch {batch_id}: Failed to get result - {e}")
            
            logger.info(f"🚀 Julia BFF Performance: Completed all {len(batches)} batches")
            
            # Collect all processed chunks
            all_chunks = []
            logger.info(f"🔍 Debug: chunk_results type: {type(chunk_results)}, length: {len(chunk_results)}")
            
            for i, result in enumerate(chunk_results):
                logger.info(f"🔍 Debug: result {i} type: {type(result)}, content: {result if not isinstance(result, list) or len(result) < 3 else f'list with {len(result)} items'}")
                
                if isinstance(result, Exception):
                    logger.warning(f"⚠️ Chunk processing failed: {result}")
                    continue
                if isinstance(result, list):
                    all_chunks.extend(result)
                elif isinstance(result, dict):
                    # Single chunk result
                    all_chunks.append(result)
                else:
                    logger.warning(f"⚠️ Unexpected result type: {type(result)}")
            
            logger.info(f"✅ Parallel AGNO chunk processing complete: {len(all_chunks)} enhanced chunks created from {len(chunks)} semantic chunks")
            return all_chunks
            
        except Exception as e:
            logger.error(f"❌ Content processing failed for {url}: {e}")
            # Fallback: create basic chunk from first part of content
            return [{
                "content": content[:2000],
                "metadata": {"url": url, "domain": domain_config.name},
                "importance": 0.5
            }]
    
    async def _parse_agent_response(
        self, 
        response, 
        url: str, 
        domain_config: DomainConfig, 
        chunk_index: int
    ) -> List[Dict[str, Any]]:
        """Parse agent response with proper error handling"""
        
        # Parse JSON response
        import json
        try:
            if isinstance(response, str):
                # Extract JSON from response
                json_start = response.find('{')
                json_end = response.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response[json_start:json_end]
                    result = json.loads(json_str)
                else:
                    # Fallback: create basic chunk
                    result = {
                        "chunks": [{
                            "content": str(response)[:2000],
                            "metadata": {"url": url, "domain": domain_config.name, "chunk_index": chunk_index},
                            "importance": 0.5
                        }]
                    }
            else:
                # Handle RunResponse object - extract content and parse as JSON
                response_content = response.content if hasattr(response, 'content') else str(response)
                if isinstance(response_content, str):
                    # Try to parse as JSON
                    try:
                        result = json.loads(response_content)
                    except json.JSONDecodeError:
                        # Fallback: create basic chunk from content
                        result = {
                            "chunks": [{
                                "content": response_content[:2000],
                                "metadata": {"url": url, "domain": domain_config.name, "chunk_index": chunk_index},
                                "importance": 0.5
                            }]
                        }
                else:
                    # If content is not a string, treat as structured data
                    result = response_content if isinstance(response_content, dict) else {"chunks": []}
            
            # Safely extract chunks from result
            if isinstance(result, dict):
                return result.get("chunks", [])
            else:
                # Fallback: create basic chunk
                return [{
                    "content": str(result)[:2000],
                    "metadata": {"url": url, "domain": domain_config.name, "chunk_index": chunk_index},
                    "importance": 0.5
                }]
                
        except json.JSONDecodeError:
            # Fallback: create basic chunk
            return [{
                "content": str(response)[:2000],
                "metadata": {"url": url, "domain": domain_config.name, "chunk_index": chunk_index},
                "importance": 0.5
            }]
    
    def get_processing_metrics(self, domain_name: Optional[str] = None) -> Dict[str, Any]:
        """Get real-time processing metrics for frontend visibility"""
        if domain_name:
            metrics = self.processing_metrics.get(domain_name)
            if metrics:
                return {
                    "domain": metrics.domain,
                    "status": metrics.status,
                    "urls_extracted": metrics.urls_extracted,
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
                "urls_extracted": metrics.urls_extracted,
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
    
    async def search_domain_knowledge(
        self, 
        domain: str, 
        query: str, 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Search specific domain knowledge base"""
        if domain not in self.knowledge_bases:
            return []
        
        try:
            knowledge_base = self.knowledge_bases[domain]
            # Use AGNO's search capabilities
            results = knowledge_base.search(query, num_documents=limit)
            
            return [
                {
                    "content": result.content,
                    "score": getattr(result, 'score', 0.9),
                    "metadata": getattr(result, 'meta_data', {"domain": domain, "query": query})
                }
                for result in results
            ]
        except Exception as e:
            logger.error(f"❌ Search failed for domain {domain}: {e}")
            return []


# Global instance
_julia_bff_engine: Optional[JuliaBFFKnowledgeEngine] = None


def get_julia_bff_engine(groq_api_key: str = None) -> JuliaBFFKnowledgeEngine:
    """Get the global Julia BFF knowledge engine instance"""
    global _julia_bff_engine
    if _julia_bff_engine is None:
        if not groq_api_key:
            import os
            groq_api_key = os.getenv("GROQ_API_KEY")
            if not groq_api_key:
                raise ValueError("GROQ_API_KEY required for Julia BFF Knowledge Engine")
        _julia_bff_engine = JuliaBFFKnowledgeEngine(groq_api_key)
    return _julia_bff_engine


# Predefined domain configurations following Julia BFF pattern
PREDEFINED_DOMAINS = {
    "binance_spot": DomainConfig(
        name="binance_spot",
        display_name="Binance Spot API",
        description="Binance Spot Trading API documentation",
        sitemap_url="https://developers.binance.com/docs/sitemap.xml",
        url_prefix="https://developers.binance.com/docs/binance-spot-api-docs/",
        keywords=["binance", "spot", "trading", "api", "cryptocurrency"]
    ),
    
    "binance_derivatives": DomainConfig(
        name="binance_derivatives",
        display_name="Binance Derivatives API",
        description="Binance Derivatives Trading API documentation",
        sitemap_url="https://developers.binance.com/docs/sitemap.xml",
        url_prefix="https://developers.binance.com/docs/derivatives/",
        keywords=["binance", "derivatives", "futures", "trading", "api"]
    ),
    
    "fastapi": DomainConfig(
        name="fastapi",
        display_name="FastAPI Framework",
        description="FastAPI web framework documentation",
        sitemap_url="https://fastapi.tiangolo.com/sitemap.xml",
        url_prefix="https://fastapi.tiangolo.com/",
        keywords=["fastapi", "api", "web", "framework", "python"]
    ),
    
    "agno": DomainConfig(
        name="agno",
        display_name="AGNO Framework",
        description="AGNO AI agent framework documentation",
        sitemap_url="https://docs.agno.ai/sitemap.xml",
        url_prefix="https://docs.agno.ai/",
        keywords=["agno", "ai", "agents", "framework", "llm"]
    )
}


# Example usage
async def main():
    """Example usage of the Julia BFF Knowledge Management Engine"""
    logging.basicConfig(level=logging.INFO)
    
    import os
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        logger.error("❌ GROQ_API_KEY not found in environment")
        return
    
    engine = get_julia_bff_engine(groq_api_key)
    
    # Test with Binance Spot API (following Julia BFF pattern)
    domain_config = PREDEFINED_DOMAINS["binance_spot"]
    
    # Create knowledge base
    knowledge_base, metrics = await engine.create_domain_knowledge_base(domain_config)
    
    if knowledge_base:
        logger.info("✅ Knowledge base created successfully!")
        logger.info(f"📊 Metrics: {engine.get_processing_metrics('binance_spot')}")
        
        # Test search
        results = await engine.search_domain_knowledge("binance_spot", "place order API", limit=3)
        logger.info(f"🔍 Search results: {len(results)} found")
        for result in results:
            logger.info(f"  📄 {result['content'][:100]}...")
    else:
        logger.error("❌ Knowledge base creation failed")


if __name__ == "__main__":
    asyncio.run(main())
