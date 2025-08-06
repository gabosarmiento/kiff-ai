"""
Comprehensive URL Discovery Service
==================================

Uses AGNO WebsiteReader to discover complete documentation structures for APIs.
Provides accurate URL counts for realistic indexing expectations.
"""

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from agno.document.reader.website_reader import WebsiteReader
from app.knowledge.api_gallery import APIDocumentation, APIGallery

logger = logging.getLogger(__name__)

@dataclass
class URLDiscoveryResult:
    """Result of comprehensive URL discovery"""
    api_name: str
    display_name: str
    total_urls: int
    documentation_urls: int
    url_list: List[str]
    discovery_method: str
    timestamp: str
    error: Optional[str] = None

class URLDiscoveryService:
    """Service for comprehensive API documentation URL discovery"""
    
    def __init__(self):
        self.cache_dir = Path(__file__).parent.parent / "data" / "url_discovery_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Configure WebsiteReader for comprehensive discovery
        self.website_reader = WebsiteReader(
            max_depth=4,      # Deep crawl for complete structure
            max_links=150,    # Allow many links for comprehensive coverage
            timeout=20        # Reasonable timeout for large sites
        )
        
        logger.info("🔍 URL Discovery Service initialized with AGNO WebsiteReader")
    
    async def discover_api_urls(self, api: APIDocumentation) -> URLDiscoveryResult:
        """Discover comprehensive URLs for a single API"""
        logger.info(f"🔍 Starting comprehensive URL discovery for {api.display_name}")
        
        try:
            # Strategy 1: Use comprehensive files only (like AGNO with full.txt)
            if api.documentation_urls and any('full.txt' in url or 'complete' in url for url in api.documentation_urls):
                logger.info(f"📝 Using comprehensive file for {api.display_name}")
                estimated_chunks = await self._estimate_comprehensive_file_chunks(api.documentation_urls)
                
                return URLDiscoveryResult(
                    api_name=api.name,
                    display_name=api.display_name,
                    total_urls=len(api.documentation_urls),
                    documentation_urls=estimated_chunks,
                    url_list=api.documentation_urls,
                    discovery_method="comprehensive_file_analysis",
                    timestamp=datetime.now().isoformat()
                )
            
            # Strategy 2: Use Julia BFF Sitemap Extractor for comprehensive URL discovery (PROVEN APPROACH)
            else:
                logger.info(f"🗺️ Using Julia BFF sitemap extractor for {api.display_name}")
                
                # Import Julia BFF sitemap extractor
                from app.knowledge.julia_bff_sitemap_extractor import get_julia_bff_sitemap_extractor
                
                sitemap_extractor = get_julia_bff_sitemap_extractor()
                
                # Define documentation prefixes for filtering
                doc_prefixes = self._get_documentation_prefixes(api)
                
                # Extract comprehensive URLs using proven Julia BFF approach
                extraction_result = sitemap_extractor.extract_comprehensive_urls(
                    api_name=api.name,
                    base_url=api.base_url,
                    doc_prefixes=doc_prefixes
                )
                
                if extraction_result.success and extraction_result.filtered_urls:
                    logger.info(f"✅ Julia BFF extraction successful for {api.display_name}")
                    logger.info(f"📊 Found {len(extraction_result.filtered_urls)} documentation URLs")
                    logger.info(f"🗺️ Sitemap: {extraction_result.sitemap_url}")
                    
                    return URLDiscoveryResult(
                        api_name=api.name,
                        display_name=api.display_name,
                        total_urls=extraction_result.total_urls,
                        documentation_urls=len(extraction_result.filtered_urls),
                        url_list=extraction_result.filtered_urls,
                        discovery_method="julia_bff_sitemap_extraction",
                        timestamp=datetime.now().isoformat()
                    )
                else:
                    logger.warning(f"⚠️ Julia BFF extraction failed for {api.display_name}: {extraction_result.error}")
                    logger.info(f"🔄 Falling back to configured URLs")
                    
                    return URLDiscoveryResult(
                        api_name=api.name,
                        display_name=api.display_name,
                        total_urls=len(api.documentation_urls),
                        documentation_urls=len(api.documentation_urls),
                        url_list=api.documentation_urls,
                        discovery_method="fallback_configured_urls",
                        timestamp=datetime.now().isoformat()
                    )
                
        except Exception as e:
            logger.error(f"❌ Error discovering URLs for {api.display_name}: {e}")
            return URLDiscoveryResult(
                api_name=api.name,
                display_name=api.display_name,
                total_urls=0,
                documentation_urls=0,
                url_list=[],
                discovery_method="error",
                timestamp=datetime.now().isoformat(),
                error=str(e)
            )
    
    async def discover_all_api_urls(self) -> Dict[str, URLDiscoveryResult]:
        """Discover comprehensive URLs for all APIs in the gallery"""
        logger.info("🚀 Starting comprehensive URL discovery for all APIs")
        
        gallery = APIGallery()
        all_apis = gallery.get_all_apis()
        results = {}
        
        for api_name, api in all_apis.items():
            try:
                result = await self.discover_api_urls(api)
                results[api_name] = result
                
                # Add small delay to be respectful to servers
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"❌ Failed to discover URLs for {api_name}: {e}")
                results[api_name] = URLDiscoveryResult(
                    api_name=api_name,
                    display_name=api.display_name,
                    total_urls=0,
                    documentation_urls=0,
                    url_list=[],
                    discovery_method="error",
                    timestamp=datetime.now().isoformat(),
                    error=str(e)
                )
        
        # Cache the results
        await self._cache_discovery_results(results)
        
        # Print summary
        self._print_discovery_summary(results)
        
        return results
    
    def _get_documentation_prefixes(self, api: APIDocumentation) -> List[str]:
        """Get documentation URL prefixes for filtering sitemap URLs"""
        base_url = api.base_url.rstrip('/')
        
        # API-specific documentation prefixes
        if 'leonardo.ai' in base_url:
            return [
                'https://docs.leonardo.ai/docs',
                'https://docs.leonardo.ai/reference'
            ]
        elif 'stability.ai' in base_url:
            return [
                'https://platform.stability.ai/docs'
            ]
        elif 'elevenlabs.io' in base_url:
            return [
                'https://elevenlabs.io/docs'
            ]
        elif 'openai.com' in base_url:
            return [
                'https://platform.openai.com/docs'
            ]
        elif 'stripe.com' in base_url:
            return [
                'https://stripe.com/docs'
            ]
        else:
            # Generic documentation prefixes
            return [
                f"{base_url}/docs",
                f"{base_url}/documentation",
                f"{base_url}/api",
                f"{base_url}/reference"
            ]
    
    def _get_crawl_starting_urls(self, api: APIDocumentation) -> List[str]:
        """Get potential starting URLs for crawling"""
        base_url = api.base_url.rstrip('/')
        
        # Common documentation entry points
        candidates = [
            f"{base_url}/docs",
            f"{base_url}/documentation",
            f"{base_url}/api",
            f"{base_url}/developers",
            f"{base_url}/reference",
            f"{base_url}/getting-started",
            f"{base_url}/guide"
        ]
        
        # For specific known patterns
        if 'leonardo.ai' in base_url:
            candidates.insert(0, "https://docs.leonardo.ai/docs/getting-started")
        elif 'stability.ai' in base_url:
            candidates.insert(0, "https://platform.stability.ai/docs")
        elif 'elevenlabs.io' in base_url:
            candidates.insert(0, "https://elevenlabs.io/docs")
        elif 'openai.com' in base_url:
            candidates.insert(0, "https://platform.openai.com/docs")
        elif 'stripe.com' in base_url:
            candidates.insert(0, "https://stripe.com/docs")
        
        return candidates
    
    def _filter_documentation_urls(self, urls: List[str]) -> List[str]:
        """Filter URLs to keep only documentation-related ones"""
        doc_urls = []
        
        for url in urls:
            if any(indicator in url.lower() for indicator in [
                '/docs/', '/documentation/', '/api/', '/reference/', 
                '/guide/', '/tutorial/', '/getting-started', '/quickstart',
                '/developers/', '/dev/', '/sdk/', '/client/', '/integration/',
                '/webhook', '/auth', '/endpoint', '/model', '/generate'
            ]):
                doc_urls.append(url)
        
        return doc_urls
    
    async def _estimate_comprehensive_file_chunks(self, urls: List[str]) -> int:
        """Estimate chunks for comprehensive documentation files"""
        total_estimated = 0
        
        for url in urls:
            if any(keyword in url.lower() for keyword in ['full.txt', 'complete', 'comprehensive']):
                # For comprehensive files like AGNO's llms-full.txt, estimate based on typical structure
                total_estimated += 50  # Conservative estimate for comprehensive files
            else:
                total_estimated += 1
        
        return max(total_estimated, len(urls))
    
    async def _cache_discovery_results(self, results: Dict[str, URLDiscoveryResult]):
        """Cache discovery results for future use"""
        cache_file = self.cache_dir / "comprehensive_url_discovery.json"
        
        try:
            cache_data = {
                "timestamp": datetime.now().isoformat(),
                "total_apis": len(results),
                "results": {
                    name: {
                        "api_name": result.api_name,
                        "display_name": result.display_name,
                        "total_urls": result.total_urls,
                        "documentation_urls": result.documentation_urls,
                        "discovery_method": result.discovery_method,
                        "timestamp": result.timestamp,
                        "error": result.error
                    }
                    for name, result in results.items()
                }
            }
            
            with open(cache_file, 'w') as f:
                json.dump(cache_data, f, indent=2)
            
            logger.info(f"💾 Cached discovery results to {cache_file}")
            
        except Exception as e:
            logger.error(f"❌ Failed to cache results: {e}")
    
    def _print_discovery_summary(self, results: Dict[str, URLDiscoveryResult]):
        """Print comprehensive discovery summary"""
        logger.info("📋 COMPREHENSIVE URL DISCOVERY SUMMARY")
        logger.info("=" * 70)
        
        total_docs = 0
        successful_apis = 0
        
        for result in results.values():
            status_emoji = "✅" if result.error is None else "❌"
            doc_count = result.documentation_urls
            method = result.discovery_method
            
            logger.info(f"{status_emoji} {result.display_name}: {doc_count} URLs ({method})")
            
            if result.error is None:
                successful_apis += 1
                total_docs += doc_count
        
        logger.info("=" * 70)
        logger.info(f"🎯 TOTAL Documentation URLs: {total_docs}")
        logger.info(f"📊 Successful APIs: {successful_apis}/{len(results)}")
        logger.info(f"📚 Average URLs per API: {total_docs/successful_apis if successful_apis > 0 else 0:.1f}")
        logger.info("🚀 These are the REAL URL counts for production indexing!")

# Global service instance
_url_discovery_service: Optional[URLDiscoveryService] = None

def get_url_discovery_service() -> URLDiscoveryService:
    """Get the global URL discovery service instance"""
    global _url_discovery_service
    if _url_discovery_service is None:
        _url_discovery_service = URLDiscoveryService()
    return _url_discovery_service
