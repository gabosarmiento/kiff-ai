#!/usr/bin/env python3
"""
Julia BFF Sitemap XML URL Extractor (Integrated into Kiff AI)

Proven sitemap extraction system from Julia BFF that successfully extracted
98+ URLs for Leonardo AI and other APIs. This replaces the failing WebsiteReader approach.
"""

import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Set, Dict, Optional
import requests
from urllib.parse import urlparse
import re
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class SitemapExtractionResult:
    """Result of sitemap extraction"""
    api_name: str
    total_urls: int
    filtered_urls: List[str]
    sitemap_url: str
    success: bool
    error: Optional[str] = None

class JuliaBFFSitemapExtractor:
    """Extract and filter URLs from sitemap XML files - Julia BFF proven approach."""
    
    def __init__(self, filter_english_only: bool = True):
        """Initialize extractor with language filtering."""
        self.filter_english_only = filter_english_only
        
        # Patterns to identify non-English URLs
        self.non_english_patterns = [
            r'/cn/',           # Chinese language path
            r'/zh/',           # Chinese language code
            r'/zh-cn/',        # Simplified Chinese
            r'/zh-tw/',        # Traditional Chinese
            r'[\u4e00-\u9fff]', # Chinese characters in URL
            r'/chinese/',      # Explicit Chinese path
        ]
        
        # Known sitemap patterns for different APIs
        self.sitemap_patterns = {
            'leonardo_ai': [
                'https://docs.leonardo.ai/sitemap.xml',
                'https://docs.leonardo.ai/sitemap-0.xml',
                'https://docs.leonardo.ai/sitemap_index.xml'
            ],
            'stability_ai': [
                'https://platform.stability.ai/sitemap.xml',
                'https://platform.stability.ai/docs/sitemap.xml'
            ],
            'elevenlabs': [
                'https://elevenlabs.io/sitemap.xml',
                'https://elevenlabs.io/docs/sitemap.xml'
            ],
            'openai': [
                'https://platform.openai.com/sitemap.xml',
                'https://platform.openai.com/docs/sitemap.xml'
            ],
            'stripe': [
                'https://stripe.com/sitemap.xml',
                'https://stripe.com/docs/sitemap.xml'
            ]
        }
    
    def is_english_url(self, url: str) -> bool:
        """Check if URL appears to be English content."""
        if not self.filter_english_only:
            return True
            
        url_lower = url.lower()
        
        # Check for non-English patterns
        for pattern in self.non_english_patterns:
            if re.search(pattern, url_lower):
                return False
                
        return True
    
    def filter_urls_by_prefixes(self, urls: List[str], prefixes: List[str]) -> List[str]:
        """Filter URLs that start with any of the given prefixes."""
        if not prefixes:
            return urls
            
        filtered = []
        for url in urls:
            if any(url.startswith(prefix) for prefix in prefixes):
                if self.is_english_url(url):
                    filtered.append(url)
                    
        return filtered
    
    def extract_urls_from_sitemap(self, sitemap_url: str) -> List[str]:
        """Extract all URLs from a sitemap XML file."""
        try:
            logger.info(f"🗺️ Fetching sitemap: {sitemap_url}")
            response = requests.get(sitemap_url, timeout=30)
            response.raise_for_status()
            
            # Parse XML
            root = ET.fromstring(response.content)
            
            # Handle different sitemap formats
            urls = []
            
            # Standard sitemap namespace
            namespaces = {
                'sitemap': 'http://www.sitemaps.org/schemas/sitemap/0.9'
            }
            
            # Try with namespace first
            url_elements = root.findall('.//sitemap:url/sitemap:loc', namespaces)
            if not url_elements:
                # Try without namespace (some sitemaps don't use it)
                url_elements = root.findall('.//url/loc')
            
            # Extract URLs
            for element in url_elements:
                if element.text:
                    urls.append(element.text.strip())
            
            # Also check for sitemap index files
            sitemap_elements = root.findall('.//sitemap:sitemap/sitemap:loc', namespaces)
            if not sitemap_elements:
                sitemap_elements = root.findall('.//sitemap/loc')
            
            # If this is a sitemap index, recursively fetch child sitemaps
            for element in sitemap_elements:
                if element.text:
                    child_sitemap_url = element.text.strip()
                    logger.info(f"📄 Found child sitemap: {child_sitemap_url}")
                    try:
                        child_urls = self.extract_urls_from_sitemap(child_sitemap_url)
                        urls.extend(child_urls)
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to fetch child sitemap {child_sitemap_url}: {e}")
            
            logger.info(f"✅ Extracted {len(urls)} URLs from {sitemap_url}")
            return urls
            
        except Exception as e:
            logger.error(f"❌ Failed to extract URLs from {sitemap_url}: {e}")
            return []
    
    def discover_sitemap_url(self, base_url: str) -> Optional[str]:
        """Discover sitemap URL for a given base domain."""
        base_url = base_url.rstrip('/')
        
        # Common sitemap locations
        common_paths = [
            '/sitemap.xml',
            '/sitemap_index.xml',
            '/docs/sitemap.xml',
            '/sitemap-0.xml'
        ]
        
        for path in common_paths:
            sitemap_url = base_url + path
            try:
                response = requests.head(sitemap_url, timeout=10)
                if response.status_code == 200:
                    logger.info(f"🎯 Found sitemap: {sitemap_url}")
                    return sitemap_url
            except:
                continue
                
        return None
    
    def extract_comprehensive_urls(
        self, 
        api_name: str, 
        base_url: str, 
        doc_prefixes: Optional[List[str]] = None
    ) -> SitemapExtractionResult:
        """
        Extract comprehensive URLs for an API using sitemap discovery.
        
        Args:
            api_name: Name of the API (e.g., 'leonardo_ai')
            base_url: Base URL of the API documentation
            doc_prefixes: URL prefixes to filter for documentation
            
        Returns:
            SitemapExtractionResult with extracted URLs
        """
        logger.info(f"🚀 Starting comprehensive URL extraction for {api_name}")
        
        try:
            # Try known sitemap patterns first
            sitemap_url = None
            if api_name in self.sitemap_patterns:
                for pattern_url in self.sitemap_patterns[api_name]:
                    try:
                        response = requests.head(pattern_url, timeout=10)
                        if response.status_code == 200:
                            sitemap_url = pattern_url
                            break
                    except:
                        continue
            
            # If no known pattern worked, discover sitemap
            if not sitemap_url:
                sitemap_url = self.discover_sitemap_url(base_url)
            
            if not sitemap_url:
                return SitemapExtractionResult(
                    api_name=api_name,
                    total_urls=0,
                    filtered_urls=[],
                    sitemap_url="",
                    success=False,
                    error="No sitemap found"
                )
            
            # Extract all URLs from sitemap
            all_urls = self.extract_urls_from_sitemap(sitemap_url)
            
            if not all_urls:
                return SitemapExtractionResult(
                    api_name=api_name,
                    total_urls=0,
                    filtered_urls=[],
                    sitemap_url=sitemap_url,
                    success=False,
                    error="No URLs extracted from sitemap"
                )
            
            # Filter URLs by documentation prefixes
            if doc_prefixes:
                filtered_urls = self.filter_urls_by_prefixes(all_urls, doc_prefixes)
            else:
                # Use smart filtering for documentation URLs
                doc_keywords = ['docs', 'api', 'reference', 'guide', 'tutorial', 'getting-started']
                filtered_urls = []
                for url in all_urls:
                    if any(keyword in url.lower() for keyword in doc_keywords):
                        if self.is_english_url(url):
                            filtered_urls.append(url)
            
            # Remove duplicates and sort
            filtered_urls = sorted(list(set(filtered_urls)))
            
            logger.info(f"✅ Extracted {len(filtered_urls)} documentation URLs for {api_name}")
            logger.info(f"📊 Total sitemap URLs: {len(all_urls)}, Filtered: {len(filtered_urls)}")
            
            return SitemapExtractionResult(
                api_name=api_name,
                total_urls=len(all_urls),
                filtered_urls=filtered_urls,
                sitemap_url=sitemap_url,
                success=True
            )
            
        except Exception as e:
            logger.error(f"❌ Comprehensive URL extraction failed for {api_name}: {e}")
            return SitemapExtractionResult(
                api_name=api_name,
                total_urls=0,
                filtered_urls=[],
                sitemap_url="",
                success=False,
                error=str(e)
            )

# Factory function for easy integration
def get_julia_bff_sitemap_extractor() -> JuliaBFFSitemapExtractor:
    """Get a configured Julia BFF sitemap extractor instance."""
    return JuliaBFFSitemapExtractor(filter_english_only=True)
