#!/usr/bin/env python3
"""
Full Documentation Discovery

Uses our AgenticSitemapExtractor to discover ALL documentation pages for each API.
This gives us the complete, realistic URL counts that will be indexed in production.
"""

import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.knowledge.api_gallery import APIGallery
from app.knowledge.engine.agentic_sitemap_extractor import AgenticSitemapExtractor

async def discover_full_documentation():
    """Discover complete documentation for all APIs using our agentic tools"""
    print("🚀 Full Documentation Discovery Using Agentic Tools")
    print("=" * 70)
    
    gallery = APIGallery()
    extractor = AgenticSitemapExtractor()
    await extractor.initialize_agents()
    
    all_apis = gallery.get_all_apis()
    results = {}
    
    for api_name, api in all_apis.items():
        print(f"\n🔍 DISCOVERING: {api.display_name}")
        print(f"📍 Base URL: {api.base_url}")
        print("-" * 50)
        
        try:
            # Use our AgenticSitemapExtractor for full discovery
            discovery_result = await extractor.process_technology_documentation(
                technology_or_service=api.display_name,
                user_provided_urls=None  # Let it discover everything
            )
            
            if discovery_result and discovery_result.get('urls'):
                urls = discovery_result['urls']
                
                # Filter for documentation URLs
                doc_urls = []
                for url in urls:
                    if any(indicator in url.lower() for indicator in [
                        '/docs/', '/documentation/', '/api/', '/reference/', 
                        '/guide/', '/tutorial/', '/help/', '/manual/',
                        '/getting-started', '/quickstart', '/examples',
                        '/sdk/', '/client/', '/integration/', '/webhook'
                    ]):
                        doc_urls.append(url)
                
                print(f"📊 TOTAL URLs discovered: {len(urls)}")
                print(f"📚 DOCUMENTATION URLs: {len(doc_urls)}")
                
                if len(doc_urls) > 0:
                    print(f"📄 Sample documentation URLs:")
                    for i, url in enumerate(doc_urls[:10], 1):  # Show first 10
                        print(f"   {i:2d}. {url}")
                    if len(doc_urls) > 10:
                        print(f"   ... and {len(doc_urls) - 10} more documentation URLs")
                
                results[api_name] = {
                    "display_name": api.display_name,
                    "base_url": api.base_url,
                    "total_urls": len(urls),
                    "documentation_urls": len(doc_urls),
                    "sample_urls": doc_urls[:10],
                    "all_urls": urls,
                    "method": "agentic_discovery",
                    "status": "success"
                }
                
                print(f"✅ SUCCESS: {len(doc_urls)} documentation URLs will be indexed")
                
            else:
                print(f"⚠️ No URLs discovered through agentic extraction")
                
                # Fallback: Try direct sitemap extraction
                print(f"🔄 Trying fallback sitemap extraction...")
                sitemap_url = f"{api.base_url}/sitemap.xml"
                
                fallback_urls = await extractor.extract_urls_from_sitemap(
                    sitemap_url=sitemap_url,
                    url_prefix=api.base_url,
                    technology_context=api.display_name
                )
                
                if fallback_urls:
                    doc_urls = [url for url in fallback_urls if any(indicator in url.lower() for indicator in [
                        '/docs/', '/documentation/', '/api/', '/reference/', 
                        '/guide/', '/tutorial/', '/help/', '/manual/'
                    ])]
                    
                    print(f"📊 Fallback found: {len(fallback_urls)} total, {len(doc_urls)} documentation URLs")
                    
                    results[api_name] = {
                        "display_name": api.display_name,
                        "base_url": api.base_url,
                        "total_urls": len(fallback_urls),
                        "documentation_urls": len(doc_urls),
                        "sample_urls": doc_urls[:10],
                        "all_urls": fallback_urls,
                        "method": "sitemap_fallback",
                        "status": "success"
                    }
                    
                    print(f"✅ FALLBACK SUCCESS: {len(doc_urls)} documentation URLs")
                else:
                    print(f"❌ No URLs found through any method")
                    results[api_name] = {
                        "display_name": api.display_name,
                        "base_url": api.base_url,
                        "total_urls": 0,
                        "documentation_urls": 0,
                        "method": "failed",
                        "status": "failed"
                    }
                
        except Exception as e:
            print(f"❌ ERROR discovering {api.display_name}: {e}")
            results[api_name] = {
                "display_name": api.display_name,
                "base_url": api.base_url,
                "error": str(e),
                "method": "error",
                "status": "error"
            }
    
    # Print comprehensive summary
    print("\n" + "=" * 70)
    print("📋 COMPREHENSIVE DOCUMENTATION DISCOVERY RESULTS")
    print("=" * 70)
    
    total_docs = 0
    successful_apis = 0
    
    for api_name, result in results.items():
        status_emoji = "✅" if result["status"] == "success" else "❌"
        doc_count = result.get("documentation_urls", 0)
        method = result.get("method", "unknown")
        
        print(f"{status_emoji} {result['display_name']}: {doc_count} documentation URLs ({method})")
        
        if result["status"] == "success":
            successful_apis += 1
            total_docs += doc_count
    
    print("=" * 70)
    print(f"🎯 TOTAL Documentation URLs: {total_docs}")
    print(f"📊 Successful APIs: {successful_apis}/{len(results)}")
    print(f"📚 Average URLs per API: {total_docs/successful_apis if successful_apis > 0 else 0:.1f}")
    
    # Save results
    results_file = backend_dir / "data" / "full_documentation_discovery.json"
    results_file.parent.mkdir(exist_ok=True)
    
    with open(results_file, 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total_documentation_urls": total_docs,
            "successful_apis": successful_apis,
            "results": results
        }, f, indent=2)
    
    print(f"💾 Results saved to: {results_file}")
    print("\n🎉 Full documentation discovery complete!")
    print("These are the REAL URL counts that will be indexed in production! 🚀")
    
    return results

if __name__ == "__main__":
    asyncio.run(discover_full_documentation())
