#!/usr/bin/env python3
"""
API URL Analysis Script

Pre-analyzes API documentation URLs to provide realistic counts for the API Gallery.
In production, this would run as a background job to keep URL counts up-to-date.
"""

import asyncio
import aiohttp
import xml.etree.ElementTree as ET
from pathlib import Path
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime
import sys
import os

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.knowledge.api_gallery import APIGallery, APIDocumentation
from app.knowledge.engine.julia_bff_knowledge_engine import SitemapExtractor

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class APIURLAnalyzer:
    """Analyzes API documentation URLs to provide realistic counts"""
    
    def __init__(self):
        self.sitemap_extractor = SitemapExtractor()
        self.results_cache_file = backend_dir / "data" / "api_url_analysis.json"
        self.results_cache_file.parent.mkdir(exist_ok=True)
        
    async def analyze_api_urls(self, api: APIDocumentation) -> Dict:
        """Analyze URLs for a specific API"""
        logger.info(f"🔍 Analyzing URLs for {api.display_name}...")
        
        result = {
            "name": api.name,
            "display_name": api.display_name,
            "base_url": api.base_url,
            "analysis_timestamp": datetime.now().isoformat(),
            "configured_urls": len(api.documentation_urls) if api.documentation_urls else 0,
            "configured_url_list": api.documentation_urls or [],
            "sitemap_urls": 0,
            "sitemap_url_list": [],
            "total_discoverable_urls": 0,
            "analysis_method": "unknown",
            "status": "pending"
        }
        
        try:
            # Method 1: Use configured documentation URLs if available
            if api.documentation_urls:
                logger.info(f"📝 Using {len(api.documentation_urls)} configured URLs for {api.display_name}")
                result["total_discoverable_urls"] = len(api.documentation_urls)
                result["analysis_method"] = "configured_urls"
                result["status"] = "success"
                
                # For comprehensive files like llms-full.txt, estimate content sections
                if any("full.txt" in url or "complete" in url for url in api.documentation_urls):
                    try:
                        # Try to fetch and analyze the comprehensive file
                        async with aiohttp.ClientSession() as session:
                            async with session.get(api.documentation_urls[0]) as response:
                                if response.status == 200:
                                    content = await response.text()
                                    # Estimate sections by counting major headings
                                    sections = content.count('\n# ') + content.count('\n## ')
                                    if sections > 10:  # If it's a comprehensive file
                                        result["estimated_sections"] = sections
                                        result["total_discoverable_urls"] = sections
                                        result["analysis_method"] = "comprehensive_file_sections"
                                        logger.info(f"📚 Estimated {sections} sections in comprehensive documentation")
                    except Exception as e:
                        logger.warning(f"⚠️ Could not analyze comprehensive file: {e}")
            
            # Method 2: Try sitemap extraction as fallback
            else:
                sitemap_url = f"{api.base_url}/sitemap.xml"
                logger.info(f"🗺️ Checking sitemap: {sitemap_url}")
                
                urls = await self.sitemap_extractor.extract_urls(sitemap_url, api.base_url)
                
                if urls:
                    # Filter for documentation-related URLs
                    doc_urls = [url for url in urls if self._is_documentation_url(url)]
                    
                    result["sitemap_urls"] = len(urls)
                    result["sitemap_url_list"] = urls[:10]  # Store first 10 for reference
                    result["total_discoverable_urls"] = len(doc_urls)
                    result["analysis_method"] = "sitemap_extraction"
                    result["status"] = "success"
                    
                    logger.info(f"🗺️ Found {len(urls)} total URLs, {len(doc_urls)} documentation URLs")
                else:
                    logger.warning(f"⚠️ No URLs found in sitemap for {api.display_name}")
                    result["status"] = "no_urls_found"
                    
        except Exception as e:
            logger.error(f"❌ Error analyzing {api.display_name}: {e}")
            result["status"] = "error"
            result["error"] = str(e)
        
        return result
    
    def _is_documentation_url(self, url: str) -> bool:
        """Check if URL is likely documentation"""
        doc_indicators = [
            '/docs/', '/documentation/', '/api/', '/reference/', 
            '/guide/', '/tutorial/', '/help/', '/manual/',
            '/getting-started', '/quickstart', '/examples'
        ]
        return any(indicator in url.lower() for indicator in doc_indicators)
    
    async def analyze_all_apis(self) -> Dict:
        """Analyze all APIs in the gallery"""
        logger.info("🚀 Starting comprehensive API URL analysis...")
        
        gallery = APIGallery()
        all_apis = gallery.get_all_apis()
        
        results = {
            "analysis_timestamp": datetime.now().isoformat(),
            "total_apis_analyzed": len(all_apis),
            "apis": {}
        }
        
        # Analyze each API
        for api_name, api in all_apis.items():
            logger.info(f"📊 Analyzing {api.display_name} ({api_name})...")
            api_result = await self.analyze_api_urls(api)
            results["apis"][api_name] = api_result
            
            # Add small delay to be respectful to servers
            await asyncio.sleep(0.5)
        
        # Save results to cache
        await self._save_results_cache(results)
        
        # Print summary
        self._print_analysis_summary(results)
        
        return results
    
    async def _save_results_cache(self, results: Dict):
        """Save analysis results to cache file"""
        try:
            with open(self.results_cache_file, 'w') as f:
                json.dump(results, f, indent=2)
            logger.info(f"💾 Saved analysis results to {self.results_cache_file}")
        except Exception as e:
            logger.error(f"❌ Failed to save cache: {e}")
    
    def _print_analysis_summary(self, results: Dict):
        """Print a nice summary of the analysis"""
        logger.info("📋 API URL Analysis Summary:")
        logger.info("=" * 60)
        
        for api_name, api_result in results["apis"].items():
            status_emoji = "✅" if api_result["status"] == "success" else "❌"
            method = api_result.get("analysis_method", "unknown")
            url_count = api_result.get("total_discoverable_urls", 0)
            
            logger.info(f"{status_emoji} {api_result['display_name']}: {url_count} URLs ({method})")
            
            if api_result.get("estimated_sections"):
                logger.info(f"    📚 Estimated {api_result['estimated_sections']} documentation sections")
        
        logger.info("=" * 60)
        logger.info(f"🎯 Analysis complete! Results cached for API Gallery display.")

async def main():
    """Main analysis function"""
    analyzer = APIURLAnalyzer()
    results = await analyzer.analyze_all_apis()
    
    print("\n🎉 API URL Analysis Complete!")
    print(f"📊 Analyzed {results['total_apis_analyzed']} APIs")
    print(f"💾 Results cached in: {analyzer.results_cache_file}")
    print("\nThe API Gallery will now show realistic URL counts! 🚀")

if __name__ == "__main__":
    asyncio.run(main())
