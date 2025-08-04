#!/usr/bin/env python3
"""
Test AGNO Agentic Discovery for Leonardo AI

Uses AGNO agents with proper tools (ExaTools, Crawl4aiTools) to discover
Leonardo AI documentation when sitemaps are not available.
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

# Import AGNO tools
try:
    from agno.tools.exa import ExaTools
    EXA_AVAILABLE = True
except ImportError:
    ExaTools = None
    EXA_AVAILABLE = False

try:
    from agno.tools.crawl4ai import Crawl4aiTools
    CRAWL4AI_AVAILABLE = True
except ImportError:
    Crawl4aiTools = None
    CRAWL4AI_AVAILABLE = False

async def test_agno_leonardo_discovery():
    """Test AGNO agentic discovery for Leonardo AI documentation"""
    print("🚀 Testing AGNO Agentic Discovery for Leonardo AI")
    print("=" * 60)
    
    # Check tool availability
    print("🔧 Tool Availability:")
    print(f"   • Exa Search: {'✅ Available' if EXA_AVAILABLE else '❌ Not available'}")
    print(f"   • Crawl4AI: {'✅ Available' if CRAWL4AI_AVAILABLE else '❌ Not available'}")
    
    exa_api_key = os.getenv("EXA_API_KEY")
    print(f"   • EXA_API_KEY: {'✅ Found' if exa_api_key else '❌ Missing'}")
    print()
    
    if not EXA_AVAILABLE and not CRAWL4AI_AVAILABLE:
        print("❌ No AGNO tools available - cannot perform agentic discovery")
        return
    
    # Configure agent tools
    agent_tools = []
    
    if EXA_AVAILABLE and exa_api_key:
        try:
            exa_tool = ExaTools(
                api_key=exa_api_key,
                num_results=5,
                text_length_limit=2000,
                category="company",
                type="neural",
                livecrawl="always"
            )
            agent_tools.append(exa_tool)
            print("✅ Exa search tool configured")
        except Exception as e:
            print(f"❌ Failed to configure Exa tool: {e}")
    
    if CRAWL4AI_AVAILABLE:
        try:
            crawl_tool = Crawl4aiTools(max_length=2000)
            agent_tools.append(crawl_tool)
            print("✅ Crawl4AI tool configured")
        except Exception as e:
            print(f"❌ Failed to configure Crawl4AI tool: {e}")
    
    if not agent_tools:
        print("❌ No tools configured - cannot create discovery agent")
        return
    
    print(f"🤖 Creating agent with {len(agent_tools)} tools...")
    
    # Create discovery agent with proper AGNO tools
    discovery_agent = Agent(
        name="LeonardoDiscoveryAgent",
        role="Expert at discovering Leonardo AI documentation URLs",
        model=get_model_for_task("discovery"),
        tools=agent_tools,  # Pass the AGNO tools here
        instructions=[
            "You are an expert at finding API documentation for Leonardo AI.",
            "Your task is to discover ALL documentation URLs for Leonardo AI's API.",
            "",
            "Steps to follow:",
            "1. Use search_exa to find Leonardo AI's official documentation site",
            "2. Use web_crawler to explore the documentation structure", 
            "3. Find all API reference pages, guides, tutorials, and examples",
            "4. Look for endpoints like /docs/api-reference, /docs/getting-started, etc.",
            "",
            "Focus on finding:",
            "- API reference documentation",
            "- Getting started guides", 
            "- Authentication documentation",
            "- Image generation endpoints",
            "- Model documentation",
            "- SDK and integration guides",
            "",
            "Return a JSON list of ALL documentation URLs you discover.",
            "Format: {\"documentation_urls\": [\"url1\", \"url2\", ...], \"reasoning\": \"explanation\"}"
        ],
        markdown=True,
        show_tool_calls=True
    )
    
    print("🔍 Starting agentic discovery for Leonardo AI...")
    print("-" * 40)
    
    try:
        # Run the agent to discover Leonardo AI documentation
        response = await discovery_agent.arun(
            "Discover all documentation URLs for Leonardo AI's API. "
            "Find their complete API reference, guides, and developer documentation."
        )
        
        print("🤖 Agent Response:")
        print(response.content)
        
        # Try to extract URLs from the response
        import json
        try:
            # Look for JSON in the response
            content = response.content
            if "```json" in content:
                json_start = content.find("```json") + 7
                json_end = content.find("```", json_start)
                json_content = content[json_start:json_end].strip()
            else:
                json_content = content
            
            result = json.loads(json_content)
            urls = result.get("documentation_urls", [])
            reasoning = result.get("reasoning", "No reasoning provided")
            
            print("\n" + "=" * 60)
            print("📋 LEONARDO AI AGENTIC DISCOVERY RESULTS")
            print("=" * 60)
            print(f"📚 Documentation URLs found: {len(urls)}")
            
            if urls:
                print("\n📄 Discovered URLs:")
                for i, url in enumerate(urls, 1):
                    print(f"   {i:2d}. {url}")
                
                print(f"\n🧠 Agent Reasoning:")
                print(f"   {reasoning}")
            
            print("=" * 60)
            print(f"🎯 RESULT: {len(urls)} URLs discovered using AGNO agentic tools")
            print("This shows the power of agentic discovery when sitemaps aren't available! 🚀")
            
            return {
                "documentation_urls": len(urls),
                "url_list": urls,
                "method": "agno_agentic_discovery",
                "reasoning": reasoning
            }
            
        except json.JSONDecodeError as e:
            print(f"⚠️ Could not parse JSON from agent response: {e}")
            print("Raw response content available above")
            return {"documentation_urls": 0, "method": "parse_error"}
        
    except Exception as e:
        print(f"❌ Error during agentic discovery: {e}")
        return {"documentation_urls": 0, "method": "error", "error": str(e)}

if __name__ == "__main__":
    result = asyncio.run(test_agno_leonardo_discovery())
    print(f"\n✅ AGNO test complete: {result.get('documentation_urls', 0)} URLs discovered")
