"""
Agentic Sitemap Extractor
=========================

Smart, agent-driven sitemap extraction that can:
1. Intelligently discover API documentation sitemaps
2. Extract relevant URLs using reasoning agents
3. Fall back to human-in-the-loop when needed
4. Keep the simplicity of Julia BFF's sitemap_extractor.py

Based on Julia BFF's proven pattern but made agentic and adaptive.
"""

import asyncio
import aiohttp
import logging
import os
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urljoin, urlparse
import re
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from pathlib import Path
from dataclasses import dataclass
import json
import requests
import aiohttp
from urllib.parse import urljoin, urlparse
import re

from agno.agent import Agent

# Import centralized LLM provider (Julia BFF pattern)
from app.config.llm_providers import get_model_for_task

# Optional Exa search tools (if available)
try:
    from agno.tools.toolkits.search.exa import ExaTools
    EXA_AVAILABLE = True
except ImportError:
    ExaTools = None
    EXA_AVAILABLE = False

# Optional Crawl4AI tools (if available) - AGNO pattern
try:
    from agno.tools.crawl4ai import Crawl4aiTools
    CRAWL4AI_AVAILABLE = True
except ImportError:
    Crawl4aiTools = None
    CRAWL4AI_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class SitemapDiscovery:
    """Result of intelligent sitemap discovery"""
    base_url: str
    sitemap_url: Optional[str] = None
    documentation_urls: List[str] = None
    api_sections: List[str] = None
    confidence_score: float = 0.0
    reasoning: str = ""
    needs_human_input: bool = False


class AgenticSitemapExtractor:
    """
    Agentic version of Julia BFF's sitemap extractor.
    Uses reasoning agents to intelligently discover and extract API documentation.
    """
    
    def __init__(self, exa_api_key: Optional[str] = None):
        """
        Initialize the Agentic Sitemap Extractor.
        
        Args:
            exa_api_key: Optional Exa API key for enhanced search capabilities
        """
        # Load from environment variables with proper fallback
        self.exa_api_key = exa_api_key or os.getenv("EXA_API_KEY")
        
        if self.exa_api_key:
            logger.info("✅ EXA_API_KEY found - enhanced search capabilities enabled")
        else:
            logger.info("ℹ️ EXA_API_KEY not found - using basic discovery only")
        
        # Use centralized LLM provider (Julia BFF pattern)
        self.reasoning_model = get_model_for_task("reasoning")
        self.discovery_model = get_model_for_task("discovery")
        self.extraction_model = get_model_for_task("extraction")
        self.filtering_model = get_model_for_task("filtering")
        
        # Initialize agents
        self.sitemap_discovery_agent = None
        self.url_extraction_agent = None
        
        # Storage
        self.output_dir = Path(__file__).parent.parent / "data" / "extracted_urls"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Language filtering (from Julia BFF pattern)
        self.non_english_patterns = [
            r'/cn/', r'/zh/', r'/zh-cn/', r'/zh-tw/',
            r'[\u4e00-\u9fff]', r'/chinese/', r'/ja/', r'/ko/'
        ]
        
        logger.info("🚀 Agentic Sitemap Extractor initialized")
    
    async def initialize_agents(self):
        """Initialize reasoning agents for sitemap discovery and extraction"""
        
        # Agent 1: Sitemap Discovery Agent with proper AGNO tools
        agent_tools = []
        
        # Add Exa search toolkit if available
        if self.exa_api_key and EXA_AVAILABLE:
            try:
                from agno.tools.exa import ExaTools
                exa_toolkit = ExaTools(
                    api_key=self.exa_api_key,
                    num_results=5,  # Testing guardrail
                    text_length_limit=2000,  # Testing guardrail
                    category="company",  # Focus on company/API docs
                    type="neural",
                    livecrawl="always"
                )
                agent_tools.append(exa_toolkit)
                logger.info("✅ Exa toolkit configured for discovery agent")
            except Exception as e:
                logger.warning(f"⚠️ Failed to configure Exa toolkit: {e}")
        
        # Add Crawl4AI toolkit if available
        if CRAWL4AI_AVAILABLE:
            try:
                from agno.tools.crawl4ai import Crawl4aiTools
                crawl4ai_toolkit = Crawl4aiTools(
                    max_length=2000  # Testing guardrail
                )
                agent_tools.append(crawl4ai_toolkit)
                logger.info("✅ Crawl4AI toolkit configured for discovery agent")
            except Exception as e:
                logger.warning(f"⚠️ Failed to configure Crawl4AI toolkit: {e}")
        
        # Now create the discovery agent with the configured tools
        self.sitemap_discovery_agent = Agent(
            name="SitemapDiscoveryAgent",
            role="Expert at discovering API documentation sitemaps and documentation structures",
            model=self.discovery_model,
            tools=agent_tools,  # Use the configured AGNO toolkits
            instructions=[
                "You are an expert at finding API documentation and sitemaps for any technology or service.",
                "When given a technology name or service, you need to:",
                "1. Use the search_exa tool to find the official documentation website",
                "2. Use the web_crawler tool to verify documentation structure",
                "3. Identify the main documentation base URL",
                "4. Look for sitemap locations (/sitemap.xml, /docs/sitemap.xml, etc.)",
                "5. Assess confidence in your findings",
                "",
                "TESTING GUARDRAILS:",
                "- Limit search to 3-5 results maximum",
                "- Only crawl 2-3 pages to verify structure",
                "- Focus on finding main documentation entry points",
                "",
                "Common patterns for API documentation:",
                "- /docs/, /documentation/, /api/, /developers/",
                "- /sitemap.xml, /docs/sitemap.xml, /api/sitemap.xml",
                "- Developer portals and API reference sites",
                "",
                "Return JSON with:",
                "- base_url: Main documentation site URL",
                "- sitemap_url: Most likely sitemap location", 
                "- api_sections: List of API documentation sections found",
                "- confidence_score: 0.0-1.0 confidence based on search results",
                "- reasoning: Step-by-step explanation of your search and findings",
                "- needs_human_input: true if search tools couldn't find clear documentation"
            ],
            markdown=True,
            show_tool_calls=True
        )
        
        # Agent 2: URL Extraction Agent  
        self.url_extraction_agent = Agent(
            name="URLExtractionAgent",
            role="Expert at extracting and filtering relevant URLs from sitemaps",
            model=self.extraction_model,
            instructions=[
                "You extract and filter URLs from sitemap XML content.",
                "Focus on URLs that contain:",
                "- API documentation and endpoints",
                "- Developer guides and tutorials", 
                "- Code examples and samples",
                "- Authentication and getting started guides",
                "",
                "Filter out:",
                "- Marketing pages and blog posts",
                "- Navigation and footer links",
                "- Non-English content",
                "- Duplicate or redundant pages",
                "",
                "Return JSON with:",
                "- relevant_urls: List of filtered, relevant URLs",
                "- url_categories: Categorization of URL types",
                "- total_extracted: Total number of URLs found",
                "- reasoning: Why these URLs were selected"
            ],
            markdown=True,
            show_tool_calls=False
        )
        
        logger.info("✅ Agentic sitemap agents initialized")
    
    async def discover_api_documentation(self, technology_or_service: str) -> SitemapDiscovery:
        """
        Intelligently discover API documentation using Exa search and Crawl4AI.
        Uses actual tools to find real documentation URLs, not just reasoning.
        """
        if not self.sitemap_discovery_agent:
            await self.initialize_agents()
        
        logger.info(f"🔍 Discovering API documentation for: {technology_or_service}")
        
        try:
            # Use agent with Exa search tool to find real documentation
            discovery_prompt = f"""
            Find API documentation for: {technology_or_service}
            
            Use the Exa search tool to find the official documentation website.
            Search for terms like:
            - "{technology_or_service} API documentation"
            - "{technology_or_service} developer docs"
            - "{technology_or_service} API reference"
            
            Once you find the main documentation site:
            1. Extract the base URL (e.g., https://docs.example.com)
            2. Look for common sitemap locations (sitemap.xml, docs/sitemap.xml)
            3. Use the crawler tool to verify the documentation structure
            
            Return your findings as JSON with:
            - base_url: The main documentation site URL
            - sitemap_url: Location of sitemap.xml if found
            - confidence_score: How confident you are (0.0-1.0)
            - reasoning: Your step-by-step analysis
            
            TESTING GUARDRAILS:
            - Limit search to 3-5 results maximum
            - Only crawl 2-3 pages to verify structure
            - Focus on finding the main documentation entry points
            """
            
            response = await self.sitemap_discovery_agent.arun(discovery_prompt)
            
            # Parse response
            discovery = self._parse_discovery_response(response, technology_or_service)
            
            # Additional validation with testing limits
            if discovery.sitemap_url:
                logger.info(f"🔍 Validating sitemap: {discovery.sitemap_url}")
                is_valid = await self._validate_sitemap_with_limits(discovery.sitemap_url)
                if not is_valid:
                    discovery.needs_human_input = True
                    discovery.reasoning += " | Sitemap validation failed"
            
            logger.info(f"✅ Discovery complete for {technology_or_service}")
            logger.info(f"  Base URL: {discovery.base_url}")
            logger.info(f"  Sitemap: {discovery.sitemap_url}")
            logger.info(f"  Confidence: {discovery.confidence_score:.2f}")
            logger.info(f"  Needs human input: {discovery.needs_human_input}")
            
            return discovery
            
        except Exception as e:
            logger.error(f"❌ Discovery failed for {technology_or_service}: {e}")
            return SitemapDiscovery(
                base_url="",
                needs_human_input=True,
                reasoning=f"Discovery failed: {str(e)}"
            )
    
    async def extract_urls_from_sitemap(
        self, 
        sitemap_url: str, 
        url_prefix: Optional[str] = None,
        technology_context: str = ""
    ) -> List[str]:
        """
        Extract relevant URLs from sitemap using intelligent filtering.
        Similar to Julia BFF's extract_urls but with agent-based filtering.
        """
        if not self.url_extraction_agent:
            await self.initialize_agents()
        
        logger.info(f"📚 Extracting URLs from sitemap: {sitemap_url}")
        
        try:
            # Download sitemap XML (same as Julia BFF)
            async with aiohttp.ClientSession() as session:
                async with session.get(sitemap_url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status != 200:
                        logger.error(f"❌ HTTP {response.status} for sitemap: {sitemap_url}")
                        return []
                    
                    content = await response.read()
            
            # Parse XML (same as Julia BFF)
            root = ET.fromstring(content)
            
            # Extract all URLs from sitemap
            raw_urls = self._extract_raw_urls_from_xml(root, url_prefix)
            
            # Apply language filtering (Julia BFF pattern)
            english_urls = [url for url in raw_urls if self._is_english_url(url)]
            
            logger.info(f"📄 Found {len(raw_urls)} total URLs, {len(english_urls)} English URLs")
            
            # Use agent to intelligently filter URLs
            filtered_urls = await self._filter_urls_with_agent(
                english_urls, technology_context, sitemap_url
            )
            
            logger.info(f"✅ Extracted {len(filtered_urls)} relevant URLs")
            return filtered_urls
            
        except Exception as e:
            logger.error(f"❌ URL extraction failed for {sitemap_url}: {e}")
            return []
    
    def _extract_raw_urls_from_xml(self, root: ET.Element, url_prefix: Optional[str] = None) -> List[str]:
        """Extract raw URLs from XML (Julia BFF pattern)"""
        urls: Set[str] = set()
        
        # Try common sitemap namespaces (Julia BFF pattern)
        namespaces = [
            {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'},
            {'ns': 'http://www.google.com/schemas/sitemap/0.9'},
            {}  # No namespace
        ]
        
        for ns in namespaces:
            # Look for <url><loc> elements
            if ns:
                url_elements = root.findall('.//ns:url/ns:loc', ns)
            else:
                url_elements = root.findall('.//url/loc')
                if not url_elements:
                    url_elements = root.findall('.//loc')
            
            for url_elem in url_elements:
                if url_elem.text:
                    url = url_elem.text.strip()
                    if not url_prefix or url.startswith(url_prefix):
                        urls.add(url)
        
        return sorted(list(urls))
    
    def _is_english_url(self, url: str) -> bool:
        """Check if URL is English content (Julia BFF pattern)"""
        url_lower = url.lower()
        for pattern in self.non_english_patterns:
            if re.search(pattern, url_lower):
                return False
        return True
    
    async def _filter_urls_with_agent(
        self, 
        urls: List[str], 
        technology_context: str,
        sitemap_url: str
    ) -> List[str]:
        """Use agent to intelligently filter URLs for relevance"""
        
        if len(urls) == 0:
            return []
        
        # Limit URLs for agent processing (avoid token limits)
        sample_urls = urls[:50] if len(urls) > 50 else urls
        
        try:
            filter_prompt = f"""
            Filter these URLs from {sitemap_url} for {technology_context} API documentation.
            
            URLs to filter ({len(sample_urls)} of {len(urls)} total):
            {json.dumps(sample_urls[:20], indent=2)}
            
            Select the most relevant URLs for API documentation, focusing on:
            - API reference and endpoints
            - Developer guides and tutorials
            - Authentication and getting started
            - Code examples and samples
            - SDKs and libraries
            
            Return JSON with the filtered list of relevant URLs.
            """
            
            response = await self.url_extraction_agent.arun(filter_prompt)
            
            # Parse response
            try:
                if isinstance(response, str):
                    # Extract JSON from response
                    json_start = response.find('{')
                    json_end = response.rfind('}') + 1
                    if json_start >= 0 and json_end > json_start:
                        json_str = response[json_start:json_end]
                        result = json.loads(json_str)
                    else:
                        result = {"relevant_urls": sample_urls[:10]}  # Fallback
                else:
                    result = response
                
                filtered_urls = result.get("relevant_urls", [])
                
                # Validate URLs are from original list
                valid_filtered = [url for url in filtered_urls if url in urls]
                
                return valid_filtered
                
            except json.JSONDecodeError:
                logger.warning("⚠️ Agent response parsing failed, using heuristic filtering")
                return self._heuristic_url_filtering(sample_urls)
                
        except Exception as e:
            logger.warning(f"⚠️ Agent filtering failed: {e}, using heuristic filtering")
            return self._heuristic_url_filtering(sample_urls)
    
    def _heuristic_url_filtering(self, urls: List[str]) -> List[str]:
        """Fallback heuristic filtering if agent fails"""
        relevant_patterns = [
            r'/api/', r'/docs/', r'/documentation/', r'/developers/',
            r'/reference/', r'/guide/', r'/tutorial/', r'/examples/',
            r'/getting-started/', r'/quickstart/', r'/auth/'
        ]
        
        filtered = []
        for url in urls:
            url_lower = url.lower()
            if any(re.search(pattern, url_lower) for pattern in relevant_patterns):
                filtered.append(url)
        
        return filtered[:20]  # Limit results
    
    async def _validate_sitemap(self, sitemap_url: str) -> bool:
        """
        Validate if a sitemap URL is accessible and contains valid XML
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(sitemap_url, timeout=10) as response:
                    if response.status == 200:
                        content = await response.text()
                        # Basic XML validation
                        try:
                            ET.fromstring(content)
                            return True
                        except ET.ParseError:
                            return False
                    return False
        except Exception as e:
            logger.warning(f"⚠️ Sitemap validation failed for {sitemap_url}: {e}")
            return False
    
    async def _validate_sitemap_with_limits(self, sitemap_url: str) -> bool:
        """
        Validate sitemap with testing guardrails - limited checking
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(sitemap_url, timeout=5) as response:
                    if response.status == 200:
                        # Read only first 10KB for testing
                        content = await response.text()
                        if len(content) > 10000:
                            content = content[:10000]
                        
                        # Basic XML validation
                        try:
                            ET.fromstring(content + "</urlset>" if not content.endswith(">") else content)
                            logger.info(f"✅ Sitemap validation passed (limited check)")
                            return True
                        except ET.ParseError as e:
                            logger.warning(f"⚠️ XML parsing failed: {e}")
                            return False
                    else:
                        logger.warning(f"⚠️ Sitemap returned status {response.status}")
                        return False
        except Exception as e:
            logger.warning(f"⚠️ Sitemap validation failed for {sitemap_url}: {e}")
            return False
    
    def _parse_discovery_response(self, response: Any, technology: str) -> SitemapDiscovery:
        """Parse agent discovery response into SitemapDiscovery object"""
        try:
            if isinstance(response, str):
                # Extract JSON from response
                json_start = response.find('{')
                json_end = response.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response[json_start:json_end]
                    result = json.loads(json_str)
                else:
                    result = {}
            else:
                result = response if isinstance(response, dict) else {}
            
            return SitemapDiscovery(
                base_url=result.get("base_url", ""),
                sitemap_url=result.get("sitemap_url"),
                documentation_urls=result.get("documentation_urls", []),
                api_sections=result.get("api_sections", []),
                confidence_score=result.get("confidence_score", 0.0),
                reasoning=result.get("reasoning", ""),
                needs_human_input=result.get("needs_human_input", False)
            )
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to parse discovery response: {e}")
            return SitemapDiscovery(
                base_url="",
                needs_human_input=True,
                reasoning=f"Response parsing failed: {str(e)}"
            )
    
    async def save_urls_to_file(self, urls: List[str], filename: str) -> Path:
        """Save URLs as bullet list to text file (Julia BFF pattern)"""
        output_file = self.output_dir / f"{filename}.txt"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            for url in urls:
                f.write(f"• {url}\n")
        
        logger.info(f"💾 Saved {len(urls)} URLs to: {output_file}")
        return output_file
    
    async def process_technology_documentation(
        self, 
        technology_or_service: str,
        user_provided_urls: Optional[List[str]] = None
    ) -> Tuple[List[str], Path]:
        """
        Complete workflow: discover documentation and extract URLs.
        Supports human-in-the-loop fallback with user-provided URLs.
        """
        logger.info(f"🚀 Processing documentation for: {technology_or_service}")
        
        # Step 1: Try intelligent discovery
        if not user_provided_urls:
            discovery = await self.discover_api_documentation(technology_or_service)
            
            if discovery.needs_human_input or not discovery.sitemap_url:
                logger.info("🤝 Human input needed - automatic discovery insufficient")
                return [], Path()  # Signal that human input is needed
            
            # Step 2: Extract URLs from discovered sitemap
            urls = await self.extract_urls_from_sitemap(
                discovery.sitemap_url,
                technology_context=technology_or_service
            )
        else:
            # Use user-provided URLs directly
            logger.info(f"📝 Using {len(user_provided_urls)} user-provided URLs")
            urls = user_provided_urls
        
        # Step 3: Save URLs to file (Julia BFF pattern)
        if urls:
            safe_filename = re.sub(r'[^\w\-_]', '_', technology_or_service.lower())
            output_file = await self.save_urls_to_file(urls, f"{safe_filename}_urls")
            
            logger.info(f"✅ Processed {technology_or_service}: {len(urls)} URLs extracted")
            return urls, output_file
        else:
            logger.warning(f"⚠️ No URLs extracted for {technology_or_service}")
            return [], Path()


# Human-in-the-loop helper functions
async def request_human_input_for_documentation(technology: str, discovery: SitemapDiscovery) -> Dict[str, Any]:
    """
    Request human input when automatic discovery fails.
    Returns structured request for human assistance.
    """
    return {
        "type": "human_input_required",
        "technology": technology,
        "message": f"Could not automatically find API documentation for {technology}",
        "discovery_attempt": {
            "base_url": discovery.base_url,
            "sitemap_url": discovery.sitemap_url,
            "confidence": discovery.confidence_score,
            "reasoning": discovery.reasoning
        },
        "requested_input": {
            "documentation_url": "Please provide the main documentation URL",
            "sitemap_url": "Please provide sitemap.xml URL if available", 
            "api_urls": "Or provide specific API documentation URLs as a list"
        },
        "examples": [
            "https://docs.example.com/",
            "https://developers.example.com/docs/sitemap.xml",
            "https://api.example.com/docs/"
        ]
    }


# Global instance
_agentic_extractor: Optional[AgenticSitemapExtractor] = None


def get_agentic_extractor(exa_api_key: Optional[str] = None) -> AgenticSitemapExtractor:
    """Get global agentic sitemap extractor instance"""
    global _agentic_extractor
    if _agentic_extractor is None:
        _agentic_extractor = AgenticSitemapExtractor(exa_api_key)
    return _agentic_extractor


# Example usage
async def main():
    """Example usage of the Agentic Sitemap Extractor"""
    logging.basicConfig(level=logging.INFO)
    
    import os
    exa_api_key = os.getenv("EXA_API_KEY")  # Optional
    
    # GROQ_API_KEY is handled by centralized LLM provider
    extractor = get_agentic_extractor(exa_api_key)
    
    # Test with different technologies
    technologies = ["FastAPI", "Stripe API", "OpenAI API"]
    
    for tech in technologies:
        logger.info(f"\n{'='*50}")
        logger.info(f"Testing: {tech}")
        logger.info(f"{'='*50}")
        
        urls, output_file = await extractor.process_technology_documentation(tech)
        
        if urls:
            logger.info(f"✅ Success: {len(urls)} URLs extracted")
            logger.info(f"📁 Saved to: {output_file}")
        else:
            logger.info("🤝 Human input required")


if __name__ == "__main__":
    asyncio.run(main())
