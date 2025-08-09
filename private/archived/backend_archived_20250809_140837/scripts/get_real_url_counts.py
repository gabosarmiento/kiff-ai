#!/usr/bin/env python3
"""
Real URL Count Analysis - Uses Our Production Tools

Uses the exact same Julia BFF SitemapExtractor and tools that will be used in production
to get accurate URL counts for each API. This shows exactly how many pages will be chunked.
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.knowledge.api_gallery import APIGallery
from app.knowledge.engine.julia_bff_knowledge_engine import SitemapExtractor

async def get_real_url_counts():
    """Get real URL counts using our production tools"""
    print("🚀 Getting Real URL Counts Using Production Tools")
    print("=" * 60)
    
    gallery = APIGallery()
    extractor = SitemapExtractor()
    all_apis = gallery.get_all_apis()
    
    results = {}
    
    for api_name, api in all_apis.items():
        print(f"\n🔍 Analyzing: {api.display_name}")
        print(f"📍 Base URL: {api.base_url}")
        
        try:
            # Method 1: If API has configured documentation URLs (like AGNO)
            if api.documentation_urls:
                print(f"📝 Using configured documentation URLs:")
                for i, url in enumerate(api.documentation_urls, 1):
                    print(f"   {i}. {url}")
                
                url_count = len(api.documentation_urls)
                method = "configured_urls"
                
                # For comprehensive files like llms-full.txt, estimate sections
                if any("full.txt" in url or "complete" in url for url in api.documentation_urls):
                    print(f"📚 Detected comprehensive documentation file")
                    method = "comprehensive_file"
                    # In production, this would be chunked into many sections
                    url_count = f"{len(api.documentation_urls)} file(s) (will be chunked)"
            
            # Method 2: Use our SitemapExtractor (same as production)
            else:
                sitemap_url = f"{api.base_url}/sitemap.xml"
                print(f"🗺️ Extracting from sitemap: {sitemap_url}")
                
                urls = await extractor.extract_urls(sitemap_url, api.base_url)
                
                if urls:
                    # Filter for documentation URLs (same logic as production)
                    doc_urls = []
                    for url in urls:
                        if any(indicator in url.lower() for indicator in [
                            '/docs/', '/documentation/', '/api/', '/reference/', 
                            '/guide/', '/tutorial/', '/help/', '/manual/',
                            '/getting-started', '/quickstart', '/examples'
                        ]):
                            doc_urls.append(url)
                    
                    print(f"📊 Total URLs found: {len(urls)}")
                    print(f"📚 Documentation URLs: {len(doc_urls)}")
                    
                    if len(doc_urls) > 0:
                        print(f"📄 Sample documentation URLs:")
                        for url in doc_urls[:5]:  # Show first 5
                            print(f"   • {url}")
                        if len(doc_urls) > 5:
                            print(f"   ... and {len(doc_urls) - 5} more")
                    
                    url_count = len(doc_urls)
                    method = "sitemap_extraction"
                else:
                    print(f"⚠️ No URLs found in sitemap")
                    url_count = 0
                    method = "no_sitemap"
            
            results[api_name] = {
                "display_name": api.display_name,
                "url_count": url_count,
                "method": method,
                "status": "success"
            }
            
            print(f"✅ Result: {url_count} URLs will be processed")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            results[api_name] = {
                "display_name": api.display_name,
                "url_count": 0,
                "method": "error",
                "status": "failed",
                "error": str(e)
            }
    
    # Print summary
    print("\n" + "=" * 60)
    print("📋 FINAL SUMMARY - URLs That Will Be Chunked:")
    print("=" * 60)
    
    total_urls = 0
    for api_name, result in results.items():
        status_emoji = "✅" if result["status"] == "success" else "❌"
        url_count = result["url_count"]
        method = result["method"]
        
        print(f"{status_emoji} {result['display_name']}: {url_count} URLs ({method})")
        
        if isinstance(url_count, int):
            total_urls += url_count
    
    print("=" * 60)
    print(f"🎯 TOTAL URLs to be chunked: {total_urls}")
    print(f"📊 APIs analyzed: {len(results)}")
    print("\n💡 These are the exact numbers that will be processed when indexing starts!")
    
    return results

if __name__ == "__main__":
    asyncio.run(get_real_url_counts())
