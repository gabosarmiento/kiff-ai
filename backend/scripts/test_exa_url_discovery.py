#!/usr/bin/env python3
"""
Test Exa URL Discovery for Leonardo AI

Uses only Exa search to discover Leonardo AI documentation URLs.
No crawling needed - just URL discovery.
"""

import asyncio
import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from agno.agent import Agent
from app.config.llm_providers import get_model_for_task

# Import Exa tools only
try:
    from agno.tools.exa import ExaTools
    EXA_AVAILABLE = True
except ImportError:
    ExaTools = None
    EXA_AVAILABLE = False

async def test_exa_url_discovery():
    """Test Exa-only URL discovery for Leonardo AI"""
    print("🚀 Testing Exa URL Discovery for Leonardo AI")
    print("=" * 60)
    
    # Check Exa availability
    exa_api_key = os.getenv("EXA_API_KEY")
    print(f"🔧 Exa Search: {'✅ Available' if EXA_AVAILABLE else '❌ Not available'}")
    print(f"🔑 EXA_API_KEY: {'✅ Found' if exa_api_key else '❌ Missing'}")
    print()
    
    if not EXA_AVAILABLE or not exa_api_key:
        print("❌ Exa not available - cannot perform URL discovery")
        return
    
    # Configure Exa tool for URL discovery
    try:
        exa_tool = ExaTools(
            api_key=exa_api_key,
            num_results=10,  # Get more results for comprehensive discovery
            text_length_limit=1000,  # We only need URLs, not full content
            category="company",
            type="neural"
        )
        print("✅ Exa tool configured for URL discovery")
    except Exception as e:
        print(f"❌ Failed to configure Exa tool: {e}")
        return
    
    # Create URL discovery agent
    discovery_agent = Agent(
        name="URLDiscoveryAgent",
        role="Expert at discovering API documentation URLs using search",
        model=get_model_for_task("discovery"),
        tools=[exa_tool],  # Only Exa for URL discovery
        instructions=[
            "You are an expert at finding comprehensive API documentation URLs using search.",
            "Your task is to discover ALL documentation URLs for Leonardo AI's API.",
            "",
            "SEARCH STRATEGY:",
            "1. Search for 'Leonardo AI API documentation site:docs.leonardo.ai'",
            "2. Search for 'Leonardo AI developer portal API reference'",
            "3. Search for 'Leonardo AI REST API endpoints documentation'",
            "4. Search for 'Leonardo AI getting started guide API'",
            "5. Search for 'Leonardo AI authentication API docs'",
            "",
            "Look for URLs that contain:",
            "- docs.leonardo.ai (their documentation site)",
            "- /api/, /reference/, /docs/, /guide/",
            "- Authentication, getting-started, endpoints",
            "- Image generation, models, SDK documentation",
            "",
            "IMPORTANT: Perform multiple searches with different terms to find ALL documentation pages.",
            "Don't just return the homepage - find the actual API documentation URLs.",
            "",
            "Return comprehensive JSON with all URLs found:",
            "{\"urls\": [\"url1\", \"url2\", ...], \"search_terms_used\": [\"term1\", \"term2\"], \"total_found\": number}"
        ],
        markdown=True,
        show_tool_calls=True
    )
    
    print("🔍 Starting URL discovery for Leonardo AI...")
    print("-" * 40)
    
    try:
        # Run URL discovery
        response = await discovery_agent.arun(
            "Find all Leonardo AI API documentation URLs. "
            "Search for their documentation site and return all relevant URLs."
        )
        
        print("🤖 Agent Response:")
        print(response.content)
        
        # Extract URLs from response
        import json
        try:
            content = response.content
            if "```json" in content:
                json_start = content.find("```json") + 7
                json_end = content.find("```", json_start)
                json_content = content[json_start:json_end].strip()
            else:
                json_content = content
            
            result = json.loads(json_content)
            urls = result.get("urls", [])
            total_found = result.get("total_found", len(urls))
            
            print("\n" + "=" * 60)
            print("📋 LEONARDO AI URL DISCOVERY RESULTS")
            print("=" * 60)
            print(f"📚 URLs discovered: {len(urls)}")
            
            if urls:
                print("\n📄 Documentation URLs:")
                for i, url in enumerate(urls, 1):
                    print(f"   {i:2d}. {url}")
            
            print("=" * 60)
            print(f"🎯 RESULT: {len(urls)} URLs found for Leonardo AI indexing")
            print("These URLs will be indexed (content crawled) during the indexing phase! 🚀")
            
            return {
                "urls_found": len(urls),
                "url_list": urls,
                "method": "exa_url_discovery"
            }
            
        except json.JSONDecodeError as e:
            print(f"⚠️ Could not parse JSON: {e}")
            print("Raw response available above")
            return {"urls_found": 0, "method": "parse_error"}
        
    except Exception as e:
        print(f"❌ Error during URL discovery: {e}")
        return {"urls_found": 0, "method": "error", "error": str(e)}

if __name__ == "__main__":
    result = asyncio.run(test_exa_url_discovery())
    print(f"\n✅ URL discovery test complete: {result.get('urls_found', 0)} URLs found")
