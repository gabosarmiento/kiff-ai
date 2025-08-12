#!/usr/bin/env python3
"""
Phase 2: Agentic Knowledge Processing Pipeline for 11 Successful APIs
Adapted from the proven julia_bff pipeline for comprehensive URL processing
"""

import asyncio
import logging
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

# Import dependencies with error handling
try:
    import aiohttp
except ImportError:
    aiohttp = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ContentType(Enum):
    API_REFERENCE = "api_reference"
    TUTORIAL = "tutorial" 
    EXAMPLES = "examples"
    GENERAL_DOC = "general_doc"
    LOW_VALUE = "low_value"

class Priority(Enum):
    CRITICAL = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4
    SKIP = 5

@dataclass
class URLAnalysis:
    url: str
    priority: Priority
    content_type: ContentType
    estimated_value: float
    reasoning: str

@dataclass
class ContentAnalysis:
    url: str
    content: str
    content_type: ContentType
    chunk_strategy: str
    should_process: bool
    quality_score: float

@dataclass
class ProcessedChunk:
    content: str
    metadata: Dict[str, Any]
    quality_score: float
    is_valuable: bool

class AgenticAPIProcessor:
    """Agentic processor for individual APIs using extracted URLs."""
    
    def __init__(self, api_name: str):
        self.api_name = api_name
        self.total_urls = 0
        self.processed_urls = 0
        self.valuable_chunks = 0
        self.skipped_urls = 0
        self.results = {
            "chunks": [],
            "stats": {},
            "timing": {}
        }
        
    def load_urls(self) -> List[str]:
        """Load URLs from the extraction JSON file."""
        try:
            urls_file = f"/Users/caroco/Gabo-Dev/kiff-dev/backend-lite-v2/api_urls_extraction/{self.api_name}_urls.json"
            
            with open(urls_file, 'r') as f:
                data = json.load(f)
                
            urls = data.get('urls', [])
            self.total_urls = len(urls)
            
            logger.info(f"📊 {self.api_name}: Loaded {len(urls)} URLs from extraction file")
            return urls
            
        except Exception as e:
            logger.error(f"❌ Error loading URLs for {self.api_name}: {e}")
            return []
    
    def prioritize_urls(self, urls: List[str]) -> List[URLAnalysis]:
        """Analyze and prioritize URLs using the proven strategy."""
        logger.info(f"🧭 {self.api_name}: Analyzing {len(urls)} URLs...")
        
        url_analyses = []
        
        for url in urls:
            try:
                url_lower = url.lower()
                
                # Critical priority patterns (essential API functionality)
                if any(pattern in url_lower for pattern in [
                    '/api', '/endpoints', '/websocket', '/stream',
                    '/authentication', '/auth', '/security',
                    '/rate-limit', '/limits', '/errors'
                ]):
                    priority = Priority.CRITICAL
                    content_type = ContentType.API_REFERENCE
                    value = 0.95
                    reasoning = "Critical API functionality"
                
                # High priority patterns (important developer resources)
                elif any(pattern in url_lower for pattern in [
                    '/examples', '/quickstart', '/getting-started',
                    '/tutorial', '/guide', '/how-to', '/cookbook',
                    '/reference', '/sdk', '/client'
                ]):
                    priority = Priority.HIGH
                    if any(pattern in url_lower for pattern in ['/examples', '/tutorial', '/guide']):
                        content_type = ContentType.EXAMPLES
                        value = 0.85
                        reasoning = "Important examples/tutorials"
                    else:
                        content_type = ContentType.API_REFERENCE
                        value = 0.8
                        reasoning = "Important API reference"
                
                # Medium priority patterns (useful reference material)
                elif any(pattern in url_lower for pattern in [
                    '/introduction', '/overview', '/concepts',
                    '/docs', '/documentation',
                    '/faq', '/troubleshooting', '/best-practices'
                ]):
                    priority = Priority.MEDIUM
                    if 'introduction' in url_lower or 'overview' in url_lower:
                        content_type = ContentType.TUTORIAL
                        value = 0.7
                        reasoning = "Foundational documentation"
                    else:
                        content_type = ContentType.GENERAL_DOC
                        value = 0.6
                        reasoning = "Reference documentation"
                
                # Low priority patterns (supplementary content)
                elif any(pattern in url_lower for pattern in [
                    '/changelog', '/release', '/history',
                    '/contact', '/support', '/help',
                    '/legal', '/terms', '/privacy'
                ]):
                    priority = Priority.LOW
                    content_type = ContentType.LOW_VALUE
                    value = 0.3
                    reasoning = "Supplementary content"
                
                # Skip patterns (navigation/marketing content)
                elif any(pattern in url_lower for pattern in [
                    '/home', '/index', '/landing',
                    '/about', '/company', '/team',
                    '/blog', '/news', '/press'
                ]):
                    priority = Priority.SKIP
                    content_type = ContentType.LOW_VALUE
                    value = 0.1
                    reasoning = "Navigation/marketing content"
                
                # Default analysis based on URL structure
                else:
                    path_segments = url.split('/')
                    if len(path_segments) > 5:  # Deep URLs often contain specific functionality
                        priority = Priority.HIGH
                        content_type = ContentType.API_REFERENCE
                        value = 0.75
                        reasoning = "Deep URL suggests specific functionality"
                    else:
                        priority = Priority.MEDIUM
                        content_type = ContentType.GENERAL_DOC
                        value = 0.5
                        reasoning = "General documentation"
                
                url_analyses.append(URLAnalysis(
                    url=url,
                    priority=priority,
                    content_type=content_type,
                    estimated_value=value,
                    reasoning=reasoning
                ))
                    
            except Exception as e:
                logger.warning(f"⚠️ URL analysis failed for {url}, using default: {e}")
                url_analyses.append(URLAnalysis(
                    url=url,
                    priority=Priority.MEDIUM,
                    content_type=ContentType.GENERAL_DOC,
                    estimated_value=0.5,
                    reasoning="Default - analysis failed"
                ))
        
        # Sort by priority and estimated value
        url_analyses.sort(key=lambda x: (x.priority.value, -x.estimated_value))
        
        # Count priorities for logging
        priority_counts = {}
        for analysis in url_analyses:
            priority_counts[analysis.priority.name] = priority_counts.get(analysis.priority.name, 0) + 1
        
        high_priority = len([u for u in url_analyses if u.priority in [Priority.CRITICAL, Priority.HIGH]])
        logger.info(f"✅ {self.api_name}: URL prioritization complete - {high_priority} high-priority URLs identified")
        logger.info(f"📊 Priority distribution: {priority_counts}")
        
        return url_analyses
    
    async def fetch_url_content(self, url: str) -> Optional[str]:
        """Fetch content from URL with proper error handling."""
        if not aiohttp:
            logger.warning("aiohttp not available, cannot fetch URLs")
            return None
            
        try:
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, headers={
                    'User-Agent': 'Mozilla/5.0 (compatible; AgenticBot/1.0)'
                }) as response:
                    if response.status == 200:
                        raw_html = await response.text()
                        clean_content = self.extract_main_content(raw_html, url)
                        
                        if clean_content and len(clean_content.strip()) > 100:
                            return clean_content
                        else:
                            logger.warning(f"⚠️ No substantial content extracted from {url}")
                            return None
                    else:
                        logger.warning(f"⚠️ HTTP {response.status} for {url}")
                        return None
        except Exception as e:
            logger.warning(f"⚠️ Failed to fetch {url}: {e}")
            return None
    
    def extract_main_content(self, html: str, url: str) -> str:
        """Extract main content from HTML, filtering out navigation and site chrome."""
        if not html:
            return ""
        
        try:
            if not BeautifulSoup:
                # Fallback without BeautifulSoup - basic HTML stripping
                import re
                text_content = re.sub(r'<[^>]+>', ' ', html)
                text_content = re.sub(r'\s+', ' ', text_content).strip()
                return text_content[:5000]
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove scripts, styles, and other non-content elements
            for element in soup.find_all(['script', 'style', 'noscript', 'meta', 'link']):
                element.decompose()
            
            # Try main content selectors
            content_element = None
            for selector in ['main', 'article', '.content', '.main-content', '.docs-content']:
                content_element = soup.select_one(selector)
                if content_element:
                    break
            
            # Fallback to body
            if not content_element:
                content_element = soup.find('body')
            
            if content_element:
                # Get text content
                text_content = content_element.get_text(separator=' ', strip=True)
                
                # Basic cleanup
                import re
                text_content = re.sub(r'window\.[^;]*;?', '', text_content)
                text_content = re.sub(r'function\([^)]*\)[^}]*}', '', text_content)
                text_content = re.sub(r'\s+', ' ', text_content).strip()
                
                return text_content
            
            # Last resort - return stripped HTML
            import re
            text_content = re.sub(r'<[^>]+>', ' ', html)
            text_content = re.sub(r'\s+', ' ', text_content).strip()
            return text_content[:5000]
            
        except Exception as e:
            logger.error(f"❌ Content extraction error for {url}: {e}")
            import re
            try:
                text_content = re.sub(r'<[^>]+>', ' ', html)
                text_content = re.sub(r'\s+', ' ', text_content).strip()
                return text_content[:5000]
            except:
                return ""
    
    async def analyze_content(self, url_analysis: URLAnalysis) -> Optional[ContentAnalysis]:
        """Analyze content and determine processing strategy."""
        try:
            content = await self.fetch_url_content(url_analysis.url)
            if not content or len(content) < 200:
                return None
            
            content_lower = content.lower()
            
            # Determine content type and strategy based on URL and content
            if any(term in content_lower for term in ['endpoint', 'api', 'parameter', 'response']):
                content_type = ContentType.API_REFERENCE
                chunk_strategy = "preserve_api_structure"
                quality_score = 0.9
            elif any(term in content_lower for term in ['example', 'sample', 'code', 'tutorial']):
                content_type = ContentType.EXAMPLES
                chunk_strategy = "preserve_code_blocks"
                quality_score = 0.8
            elif any(term in content_lower for term in ['guide', 'how to', 'step']):
                content_type = ContentType.TUTORIAL
                chunk_strategy = "preserve_sequences"
                quality_score = 0.7
            elif len(content) > 2000:
                content_type = ContentType.GENERAL_DOC
                chunk_strategy = "semantic_boundaries"
                quality_score = 0.6
            else:
                content_type = ContentType.LOW_VALUE
                chunk_strategy = "skip"
                quality_score = 0.2
            
            should_process = quality_score > 0.3
            
            return ContentAnalysis(
                url=url_analysis.url,
                content=content,
                content_type=content_type,
                chunk_strategy=chunk_strategy,
                should_process=should_process,
                quality_score=quality_score
            )
            
        except Exception as e:
            logger.warning(f"⚠️ Content analysis failed for {url_analysis.url}: {e}")
            return None
    
    def create_smart_chunks(self, content_analysis: ContentAnalysis) -> List[ProcessedChunk]:
        """Create semantically meaningful chunks using proven size strategy."""
        try:
            # Use large chunk sizes like the proven AGNO approach
            if content_analysis.content_type == ContentType.API_REFERENCE:
                chunk_size = 5000  # API docs - proven size
                overlap = 500
            elif content_analysis.content_type == ContentType.EXAMPLES:
                chunk_size = 6000  # Examples need more context
                overlap = 600
            elif content_analysis.content_type == ContentType.TUTORIAL:
                chunk_size = 5500  # Tutorials need sequences intact
                overlap = 550
            else:
                chunk_size = 5000  # General docs
                overlap = 500
            
            # Simple recursive chunking
            content = content_analysis.content
            chunks = []
            
            if len(content) <= chunk_size:
                chunks = [content]
            else:
                start = 0
                step = chunk_size - overlap
                
                while start < len(content):
                    end = min(len(content), start + chunk_size)
                    chunk_content = content[start:end]
                    chunks.append(chunk_content)
                    
                    if end >= len(content):
                        break
                    start += step
            
            processed_chunks = []
            for i, chunk_content in enumerate(chunks):
                processed_chunks.append(ProcessedChunk(
                    content=chunk_content,
                    metadata={
                        "url": content_analysis.url,
                        "type": content_analysis.content_type.value,
                        "chunk_index": i,
                        "strategy": content_analysis.chunk_strategy,
                        "api_name": self.api_name
                    },
                    quality_score=content_analysis.quality_score,
                    is_valuable=True  # Will be verified
                ))
            
            return processed_chunks
            
        except Exception as e:
            logger.warning(f"⚠️ Chunking failed for {content_analysis.url}: {e}")
            return []
    
    def verify_chunk_quality(self, chunks: List[ProcessedChunk]) -> List[ProcessedChunk]:
        """Verify chunk quality and filter valuable content."""
        verified_chunks = []
        
        for chunk in chunks:
            try:
                content = chunk.content.strip()
                
                # Skip very short chunks
                if len(content) < 100:
                    continue
                
                # Skip navigation/UI content
                content_lower = content.lower()
                if any(term in content_lower for term in [
                    'skip to main content', 'toggle navigation', 'menu toggle',
                    'search documentation', 'edit this page', 'back to top',
                    'cookie policy', 'privacy policy', 'terms of service', 
                    'all rights reserved', '© 2024', 'subscribe to newsletter'
                ]):
                    continue
                
                # Skip very generic content
                if len(content) < 200 and content.count(' ') < 10:
                    continue
                
                # Adjust quality score based on content characteristics
                quality_multiplier = 1.0
                
                # Boost for valuable technical content
                if any(term in content_lower for term in [
                    'function', 'method', 'parameter', 'return', 'example', 'code',
                    'endpoint', 'api', 'request', 'response', 'json', 'authentication',
                    'error code', 'rate limit', 'webhook', 'callback', 'sdk'
                ]):
                    quality_multiplier *= 1.3
                
                # Extra boost for API documentation patterns
                if any(pattern in content_lower for pattern in [
                    'get /', 'post /', 'put /', 'delete /',
                    'status code', 'http', 'curl', 'python', 'javascript'
                ]):
                    quality_multiplier *= 1.2
                
                final_quality = min(1.0, chunk.quality_score * quality_multiplier)
                
                # Inclusive quality threshold
                if final_quality > 0.2:
                    chunk.quality_score = final_quality
                    chunk.is_valuable = True
                    verified_chunks.append(chunk)
                
            except Exception as e:
                logger.warning(f"⚠️ Quality verification failed for chunk: {e}")
                continue
        
        return verified_chunks
    
    async def process_api(self) -> Dict[str, Any]:
        """Process a single API with the complete pipeline."""
        start_time = time.time()
        logger.info(f"🚀 {self.api_name}: Starting Agentic Processing Pipeline")
        
        try:
            # Load URLs
            urls = self.load_urls()
            if not urls:
                raise ValueError("No URLs to process")
            
            # Prioritize URLs
            url_analyses = self.prioritize_urls(urls)
            
            # Process all URLs with intelligent filtering
            url_analyses_sorted = sorted(url_analyses, key=lambda x: (x.priority.value, -x.estimated_value))
            
            logger.info(f"🧮 {self.api_name}: Processing ALL {len(url_analyses_sorted)} URLs with intelligent filtering")
            
            processed_chunks = []
            
            for i, url_analysis in enumerate(url_analyses_sorted):
                if i % 50 == 0:  # Progress every 50 URLs
                    logger.info(f"🔄 {self.api_name}: Processing URL {i+1}/{len(url_analyses_sorted)}")
                
                try:
                    # Content Analysis
                    content_analysis = await self.analyze_content(url_analysis)
                    if not content_analysis or not content_analysis.should_process:
                        self.skipped_urls += 1
                        continue
                    
                    # Smart Chunking
                    chunks = self.create_smart_chunks(content_analysis)
                    
                    # Quality Verification
                    verified_chunks = self.verify_chunk_quality(chunks)
                    
                    processed_chunks.extend(verified_chunks)
                    self.processed_urls += 1
                    
                    # Add small delay to be respectful
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.warning(f"⚠️ Failed to process {url_analysis.url}: {e}")
                    self.skipped_urls += 1
                    continue
            
            # Filter final chunks
            valuable_chunks = [c for c in processed_chunks if c.is_valuable and c.quality_score > 0.2]
            self.valuable_chunks = len(valuable_chunks)
            
            elapsed = time.time() - start_time
            
            # Prepare results
            result = {
                "api_name": self.api_name,
                "stats": {
                    "total_urls": self.total_urls,
                    "processed_urls": self.processed_urls,
                    "skipped_urls": self.skipped_urls,
                    "total_chunks": len(valuable_chunks),
                    "total_tokens": sum(len(c.content) // 4 for c in valuable_chunks),  # Rough token estimate
                    "avg_quality": sum(c.quality_score for c in valuable_chunks) / max(1, len(valuable_chunks))
                },
                "timing": {
                    "duration_seconds": elapsed,
                    "duration_minutes": elapsed / 60
                },
                "chunks": [
                    {
                        "content": c.content,
                        "metadata": c.metadata,
                        "quality_score": c.quality_score,
                        "token_estimate": len(c.content) // 4
                    } for c in valuable_chunks
                ]
            }
            
            logger.info(f"✅ {self.api_name}: Processing complete in {elapsed:.1f}s")
            logger.info(f"📊 {self.api_name}: Processed {self.processed_urls} URLs, created {self.valuable_chunks} valuable chunks")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ {self.api_name}: Processing failed: {e}")
            raise

# Main processing function
async def process_all_apis():
    """Process all 11 successful APIs with the agentic pipeline."""
    
    SUCCESSFUL_APIS = [
        {"name": "supabase", "priority": "high"},
        {"name": "openai", "priority": "high"}, 
        {"name": "rasa", "priority": "medium"},
        {"name": "deepgram", "priority": "medium"},
        {"name": "cohere", "priority": "medium"},
        {"name": "anthropic", "priority": "medium"},
        {"name": "synthesia", "priority": "medium"},
        {"name": "together", "priority": "low"},
        {"name": "murf", "priority": "low"},
        {"name": "clipdrop", "priority": "low"},
        {"name": "luma", "priority": "low"}
    ]
    
    print("🚀 Starting Phase 2: Agentic Knowledge Processing for 11 APIs")
    print("=" * 70)
    
    all_results = []
    start_time = time.time()
    
    for api_info in SUCCESSFUL_APIS:
        api_name = api_info["name"]
        priority = api_info["priority"]
        
        print(f"\n📚 Processing {api_name.upper()} ({priority} priority)")
        
        try:
            processor = AgenticAPIProcessor(api_name)
            result = await processor.process_api()
            all_results.append(result)
            
            stats = result["stats"]
            timing = result["timing"]
            
            print(f"✅ {api_name.upper()} completed in {timing['duration_minutes']:.1f} minutes")
            print(f"   📊 {stats['total_chunks']:,} chunks, {stats['total_tokens']:,} tokens")
            print(f"   📈 Quality: {stats['avg_quality']:.2f}, Success rate: {stats['processed_urls']}/{stats['total_urls']}")
            
        except Exception as e:
            print(f"❌ {api_name.upper()} failed: {e}")
            continue
    
    # Final summary
    total_duration = time.time() - start_time
    total_urls = sum(r['stats']['total_urls'] for r in all_results)
    total_processed = sum(r['stats']['processed_urls'] for r in all_results)
    total_chunks = sum(r['stats']['total_chunks'] for r in all_results)
    total_tokens = sum(r['stats']['total_tokens'] for r in all_results)
    
    print("\n" + "=" * 70)
    print("🎉 PHASE 2 AGENTIC PROCESSING COMPLETE!")
    print(f"⏱️  Total time: {total_duration / 60:.1f} minutes")
    print(f"🔗 URLs processed: {total_processed:,} / {total_urls:,}")
    print(f"📄 Total chunks created: {total_chunks:,}")
    print(f"🔤 Total tokens estimated: {total_tokens:,}")
    
    # Save comprehensive results
    results_summary = {
        "summary": {
            "total_apis": len(all_results),
            "total_urls": total_urls,
            "total_processed": total_processed,
            "total_chunks": total_chunks,
            "total_tokens": total_tokens,
            "duration_minutes": round(total_duration / 60, 2),
            "avg_quality": sum(r['stats']['avg_quality'] for r in all_results) / max(1, len(all_results))
        },
        "per_api_results": all_results,
        "completed_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    output_file = '/Users/caroco/Gabo-Dev/kiff-dev/backend-lite-v2/api_urls_extraction/phase2_agentic_results.json'
    with open(output_file, 'w') as f:
        json.dump(results_summary, f, indent=2)
    
    print(f"📁 Comprehensive results saved to phase2_agentic_results.json")

if __name__ == "__main__":
    asyncio.run(process_all_apis())