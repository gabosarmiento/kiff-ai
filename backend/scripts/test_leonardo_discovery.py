#!/usr/bin/env python3
"""
Test Leonardo AI Documentation Discovery

Test comprehensive URL discovery for just Leonardo AI to validate our approach.
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.knowledge.engine.julia_bff_knowledge_engine import SitemapExtractor

async def test_leonardo_discovery():
    """Test comprehensive URL discovery for Leonardo AI"""
    print("🚀 Testing Leonardo AI Documentation Discovery")
    print("=" * 60)
    
    extractor = SitemapExtractor()
    
    # Leonardo AI details
    base_url = "https://docs.leonardo.ai"
    api_name = "Leonardo AI"
    
    print(f"🔍 Testing: {api_name}")
    print(f"📍 Base URL: {base_url}")
    print("-" * 40)
    
    # Try multiple sitemap locations for Leonardo AI
    sitemap_candidates = [
        f"{base_url}/sitemap.xml",
        f"{base_url}/docs/sitemap.xml", 
        f"{base_url}/api/sitemap.xml",
        "https://leonardo.ai/sitemap.xml",  # Main site
        "https://leonardo.ai/docs/sitemap.xml"
    ]
    
    all_urls = []
    successful_sitemaps = []
    
    for sitemap_url in sitemap_candidates:
        try:
            print(f"🔍 Checking sitemap: {sitemap_url}")
            urls = await extractor.extract_urls(sitemap_url, base_url)
            
            if urls:
                print(f"✅ Found {len(urls)} URLs")
                all_urls.extend(urls)
                successful_sitemaps.append(sitemap_url)
                
                # Show first few URLs as sample
                print(f"📄 Sample URLs:")
                for i, url in enumerate(urls[:5], 1):
                    print(f"   {i}. {url}")
                if len(urls) > 5:
                    print(f"   ... and {len(urls) - 5} more")
                print()
            else:
                print(f"❌ No URLs found")
                
        except Exception as e:
            print(f"❌ Error: {e}")
    
    # Remove duplicates
    unique_urls = list(set(all_urls))
    
    # Filter for documentation URLs
    doc_urls = []
    for url in unique_urls:
        if any(indicator in url.lower() for indicator in [
            '/docs/', '/documentation/', '/api/', '/reference/', 
            '/guide/', '/tutorial/', '/help/', '/manual/',
            '/getting-started', '/quickstart', '/examples',
            '/sdk/', '/client/', '/integration/', '/webhook'
        ]):
            doc_urls.append(url)
    
    print("=" * 60)
    print("📋 LEONARDO AI DISCOVERY RESULTS")
    print("=" * 60)
    print(f"✅ Successful sitemaps: {len(successful_sitemaps)}")
    for sitemap in successful_sitemaps:
        print(f"   • {sitemap}")
    print(f"📊 Total unique URLs: {len(unique_urls)}")
    print(f"📚 Documentation URLs: {len(doc_urls)}")
    
    if len(doc_urls) > 0:
        print(f"\n📄 ALL Documentation URLs found:")
        for i, url in enumerate(doc_urls, 1):
            print(f"   {i:2d}. {url}")
    
    print("=" * 60)
    print(f"🎯 RESULT: {len(doc_urls)} URLs will be indexed for Leonardo AI")
    print("This is the REAL number that production indexing will process! 🚀")
    
    return {
        "total_urls": len(unique_urls),
        "documentation_urls": len(doc_urls),
        "doc_url_list": doc_urls,
        "successful_sitemaps": successful_sitemaps
    }

if __name__ == "__main__":
    result = asyncio.run(test_leonardo_discovery())
    print(f"\n✅ Test complete: {result['documentation_urls']} documentation URLs discovered")
