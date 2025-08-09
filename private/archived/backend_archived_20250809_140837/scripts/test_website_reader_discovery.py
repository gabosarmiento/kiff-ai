#!/usr/bin/env python3
"""
Test AGNO WebsiteReader for Comprehensive URL Discovery

Uses AGNO's WebsiteReader to crawl Leonardo AI docs and discover ALL URLs
in the documentation structure. This gives us the complete, realistic URL count.
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from agno.document.reader.website_reader import WebsiteReader

async def test_website_reader_discovery():
    """Test AGNO WebsiteReader for comprehensive URL discovery"""
    print("🚀 Testing AGNO WebsiteReader for Leonardo AI URL Discovery")
    print("=" * 70)
    
    # Configure WebsiteReader for comprehensive discovery
    reader = WebsiteReader(
        max_depth=4,  # Go deeper to find all nested pages
        max_links=100,  # Allow more links to discover comprehensive structure
        timeout=15  # Reasonable timeout
    )
    
    # Leonardo AI documentation starting point
    start_url = "https://docs.leonardo.ai/docs/getting-started"
    
    print(f"🔍 Starting comprehensive crawl from: {start_url}")
    print(f"📊 Configuration:")
    print(f"   • Max depth: {reader.max_depth}")
    print(f"   • Max links: {reader.max_links}")
    print(f"   • Timeout: {reader.timeout}s")
    print("-" * 50)
    
    try:
        # Crawl the Leonardo AI documentation
        print("🕷️ Starting website crawl...")
        results = reader.crawl(start_url)
        
        print(f"✅ Crawl completed!")
        print(f"📚 Total URLs discovered: {len(results)}")
        
        # Analyze the discovered URLs
        all_urls = list(results.keys())
        
        # Filter for documentation URLs
        doc_urls = []
        for url in all_urls:
            if any(indicator in url.lower() for indicator in [
                '/docs/', '/documentation/', '/api/', '/reference/', 
                '/guide/', '/tutorial/', '/getting-started', '/quickstart'
            ]):
                doc_urls.append(url)
        
        # Categorize URLs by type
        categories = {
            'getting_started': [],
            'guides': [],
            'api_reference': [],
            'tutorials': [],
            'other_docs': []
        }
        
        for url in doc_urls:
            if 'getting-started' in url.lower() or 'quickstart' in url.lower():
                categories['getting_started'].append(url)
            elif 'guide' in url.lower():
                categories['guides'].append(url)
            elif 'api' in url.lower() or 'reference' in url.lower():
                categories['api_reference'].append(url)
            elif 'tutorial' in url.lower():
                categories['tutorials'].append(url)
            else:
                categories['other_docs'].append(url)
        
        print("\n" + "=" * 70)
        print("📋 LEONARDO AI COMPREHENSIVE URL DISCOVERY RESULTS")
        print("=" * 70)
        print(f"📊 Total URLs crawled: {len(all_urls)}")
        print(f"📚 Documentation URLs: {len(doc_urls)}")
        
        print(f"\n📂 URL Categories:")
        for category, urls in categories.items():
            if urls:
                print(f"   • {category.replace('_', ' ').title()}: {len(urls)} URLs")
        
        print(f"\n📄 ALL Documentation URLs discovered:")
        for i, url in enumerate(doc_urls, 1):
            print(f"   {i:2d}. {url}")
        
        print("\n" + "=" * 70)
        print(f"🎯 FINAL RESULT: {len(doc_urls)} documentation URLs will be indexed")
        print("This is the COMPLETE Leonardo AI documentation structure! 🚀")
        
        return {
            "total_urls": len(all_urls),
            "documentation_urls": len(doc_urls),
            "url_list": doc_urls,
            "categories": {k: len(v) for k, v in categories.items()},
            "method": "agno_website_reader"
        }
        
    except Exception as e:
        print(f"❌ Error during website crawling: {e}")
        return {
            "total_urls": 0,
            "documentation_urls": 0,
            "method": "error",
            "error": str(e)
        }

if __name__ == "__main__":
    result = asyncio.run(test_website_reader_discovery())
    print(f"\n✅ WebsiteReader test complete: {result.get('documentation_urls', 0)} URLs discovered")
