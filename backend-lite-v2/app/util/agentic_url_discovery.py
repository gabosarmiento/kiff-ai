"""
Agentic URL Discovery System
Uses AGNO agents to discover documentation URLs when sitemaps are insufficient or missing.
"""

import asyncio
import httpx
from typing import List, Dict, Any, Optional, Set
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin, urlparse
import json

# Optional AGNO import
try:
    from agno.models.groq import Groq as GroqLLM  # type: ignore
    AGNO_AVAILABLE = True
except Exception:
    AGNO_AVAILABLE = False
    GroqLLM = None

class AgenticURLDiscoverer:
    """
    Discovers API documentation URLs using heuristics and AI-powered analysis.
    
    Strategy:
    1. Start with base URL
    2. Try common documentation paths
    3. Crawl navigation menus and footer links
    4. Use AI to identify documentation-relevant links
    5. Follow breadcrumbs and pagination
    """
    
    def __init__(self, base_url: str, max_depth: int = 3, max_urls: int = 200):
        self.base_url = base_url.rstrip('/')
        self.domain = urlparse(base_url).netloc
        self.max_depth = max_depth
        self.max_urls = max_urls
        
        # Common documentation URL patterns
        self.doc_patterns = [
            r'/docs?/',
            r'/documentation/',
            r'/api/',
            r'/reference/',
            r'/guide/',
            r'/guides/',
            r'/tutorial/',
            r'/tutorials/',
            r'/help/',
            r'/support/',
            r'/developer/',
            r'/dev/',
            r'/sdk/',
            r'/manual/',
            r'/spec/',
            r'/specification/',
        ]
        
        # Keywords that indicate documentation links
        self.doc_keywords = [
            'documentation', 'docs', 'api', 'reference', 'guide', 'guides',
            'tutorial', 'tutorials', 'help', 'support', 'developer', 'dev',
            'sdk', 'manual', 'spec', 'specification', 'quickstart', 'getting started',
            'examples', 'playground', 'console', 'dashboard'
        ]
        
        # Initialize LLM if available
        self.llm = None
        if AGNO_AVAILABLE and GroqLLM:
            try:
                self.llm = GroqLLM(model="llama3-8b-8192")
            except Exception as e:
                print(f"Warning: Could not initialize Groq LLM: {e}")

    async def discover_urls(self) -> Dict[str, Any]:
        """
        Main discovery method that combines multiple strategies.
        
        Returns:
            Dict containing discovered URLs, metadata, and analysis
        """
        discovered_urls: Set[str] = set()
        visited_urls: Set[str] = set()
        analysis_log = []
        
        # Phase 1: Try common documentation paths
        common_paths = await self._try_common_paths()
        discovered_urls.update(common_paths['found_urls'])
        analysis_log.append({
            "phase": "common_paths",
            "found": len(common_paths['found_urls']),
            "tried": common_paths['tried_paths']
        })
        
        # Phase 2: Crawl homepage and main sections
        if len(discovered_urls) < 50:  # Only if we need more URLs
            crawl_results = await self._crawl_with_heuristics(
                start_url=self.base_url,
                max_depth=2,
                discovered_urls=discovered_urls,
                visited_urls=visited_urls
            )
            analysis_log.append({
                "phase": "heuristic_crawl",
                "found": len(crawl_results['new_urls']),
                "crawled_pages": len(crawl_results['visited'])
            })
            discovered_urls.update(crawl_results['new_urls'])
        
        # Phase 3: AI-powered analysis (if available and needed)
        if self.llm and len(discovered_urls) < 30:
            ai_results = await self._ai_guided_discovery(list(discovered_urls)[:5])
            if ai_results['suggested_urls']:
                verified_urls = await self._verify_urls(ai_results['suggested_urls'])
                discovered_urls.update(verified_urls)
                analysis_log.append({
                    "phase": "ai_guided",
                    "suggested": len(ai_results['suggested_urls']),
                    "verified": len(verified_urls),
                    "reasoning": ai_results.get('reasoning', '')
                })
        
        # Convert to sorted list
        final_urls = sorted(list(discovered_urls))[:self.max_urls]
        
        return {
            "urls": final_urls,
            "total_found": len(final_urls),
            "analysis_log": analysis_log,
            "base_url": self.base_url,
            "strategies_used": [log["phase"] for log in analysis_log],
            "agno_available": AGNO_AVAILABLE,
            "llm_used": self.llm is not None
        }

    async def _try_common_paths(self) -> Dict[str, Any]:
        """Try common documentation URL patterns."""
        common_urls = [
            f"{self.base_url}/docs",
            f"{self.base_url}/docs/",
            f"{self.base_url}/documentation",
            f"{self.base_url}/api",
            f"{self.base_url}/api/",
            f"{self.base_url}/reference",
            f"{self.base_url}/guide",
            f"{self.base_url}/guides",
            f"{self.base_url}/developer",
            f"{self.base_url}/help",
            f"{self.base_url}/support",
            f"{self.base_url}/v1/docs",
            f"{self.base_url}/latest/docs",
        ]
        
        found_urls = []
        tried_paths = []
        
        async with httpx.AsyncClient(timeout=10) as client:
            for url in common_urls:
                try:
                    tried_paths.append(url)
                    response = await client.get(url)
                    if response.status_code == 200:
                        # Extract more URLs from this documentation page
                        soup = BeautifulSoup(response.text, 'html.parser')
                        page_urls = self._extract_doc_urls_from_page(soup, url)
                        found_urls.extend(page_urls)
                        
                except Exception:
                    continue
        
        return {
            "found_urls": list(set(found_urls)),
            "tried_paths": tried_paths
        }

    async def _crawl_with_heuristics(self, start_url: str, max_depth: int, 
                                   discovered_urls: Set[str], visited_urls: Set[str]) -> Dict[str, Any]:
        """Crawl pages using heuristics to identify documentation links."""
        if max_depth <= 0 or len(discovered_urls) > self.max_urls:
            return {"new_urls": [], "visited": []}
        
        if start_url in visited_urls:
            return {"new_urls": [], "visited": []}
        
        visited_urls.add(start_url)
        new_urls = []
        
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(start_url)
                if response.status_code != 200:
                    return {"new_urls": [], "visited": [start_url]}
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Extract documentation URLs from this page
                page_doc_urls = self._extract_doc_urls_from_page(soup, start_url)
                new_urls.extend(page_doc_urls)
                
                # Find navigation and high-value links to crawl further
                nav_links = self._find_navigation_links(soup, start_url)
                
                # Recursively crawl promising navigation links
                for nav_url in nav_links[:3]:  # Limit to avoid explosion
                    if nav_url not in visited_urls and len(discovered_urls) + len(new_urls) < self.max_urls:
                        sub_results = await self._crawl_with_heuristics(
                            nav_url, max_depth - 1, discovered_urls, visited_urls
                        )
                        new_urls.extend(sub_results['new_urls'])
                        
        except Exception as e:
            print(f"Error crawling {start_url}: {e}")
        
        return {"new_urls": list(set(new_urls)), "visited": list(visited_urls)}

    def _extract_doc_urls_from_page(self, soup: BeautifulSoup, page_url: str) -> List[str]:
        """Extract documentation-related URLs from a page."""
        doc_urls = []
        base_domain = urlparse(page_url).netloc
        
        # Find all links
        for link in soup.find_all('a', href=True):
            href = link.get('href')
            if not href:
                continue
                
            # Convert to absolute URL
            full_url = urljoin(page_url, href)
            parsed = urlparse(full_url)
            
            # Only keep links from same domain
            if parsed.netloc != base_domain:
                continue
            
            # Check if URL matches documentation patterns
            path = parsed.path.lower()
            link_text = link.get_text(strip=True).lower()
            
            is_doc_url = (
                any(re.search(pattern, path) for pattern in self.doc_patterns) or
                any(keyword in link_text for keyword in self.doc_keywords) or
                any(keyword in path for keyword in self.doc_keywords)
            )
            
            if is_doc_url:
                doc_urls.append(full_url)
        
        return list(set(doc_urls))

    def _find_navigation_links(self, soup: BeautifulSoup, page_url: str) -> List[str]:
        """Find high-value navigation links to crawl."""
        nav_urls = []
        base_domain = urlparse(page_url).netloc
        
        # Look for navigation elements
        nav_selectors = [
            'nav a', 'header a', 'footer a',
            '.navbar a', '.navigation a', '.nav a',
            '.menu a', '.sidebar a', '.toc a'
        ]
        
        for selector in nav_selectors:
            for link in soup.select(selector):
                href = link.get('href')
                if href:
                    full_url = urljoin(page_url, href)
                    parsed = urlparse(full_url)
                    
                    if parsed.netloc == base_domain:
                        link_text = link.get_text(strip=True).lower()
                        if any(keyword in link_text for keyword in self.doc_keywords[:10]):  # Top keywords
                            nav_urls.append(full_url)
        
        return list(set(nav_urls))

    async def _ai_guided_discovery(self, sample_urls: List[str]) -> Dict[str, Any]:
        """Use AI to suggest additional documentation URLs based on discovered patterns."""
        if not self.llm or not sample_urls:
            return {"suggested_urls": [], "reasoning": ""}
        
        try:
            prompt = f"""
Given these documentation URLs from {self.base_url}:
{chr(10).join(sample_urls[:5])}

Based on common API documentation patterns, suggest 5-10 additional URLs that might contain valuable API documentation for this service. Consider:
- Common REST API patterns (/api/v1/, /api/reference/)
- SDK documentation paths
- Tutorial and guide sections
- Developer resources
- Authentication docs

Return only a JSON array of URLs, no additional text.
"""
            
            response = await self.llm.agenerate(prompt)
            if response and response.content:
                try:
                    suggested_urls = json.loads(response.content.strip())
                    if isinstance(suggested_urls, list):
                        # Filter to same domain
                        valid_urls = []
                        for url in suggested_urls:
                            if isinstance(url, str) and urlparse(url).netloc == self.domain:
                                valid_urls.append(url)
                        
                        return {
                            "suggested_urls": valid_urls,
                            "reasoning": "AI analysis based on URL patterns"
                        }
                except json.JSONDecodeError:
                    pass
            
        except Exception as e:
            print(f"AI discovery error: {e}")
        
        return {"suggested_urls": [], "reasoning": ""}

    async def _verify_urls(self, urls: List[str]) -> List[str]:
        """Verify that suggested URLs actually exist and contain content."""
        verified = []
        
        async with httpx.AsyncClient(timeout=5) as client:
            for url in urls:
                try:
                    response = await client.head(url)  # Use HEAD for efficiency
                    if response.status_code == 200:
                        verified.append(url)
                except Exception:
                    # Try GET as fallback
                    try:
                        response = await client.get(url, timeout=3)
                        if response.status_code == 200 and len(response.text) > 100:
                            verified.append(url)
                    except Exception:
                        continue
        
        return verified


async def discover_api_urls(base_url: str, max_depth: int = 3, max_urls: int = 200) -> Dict[str, Any]:
    """
    Convenience function to discover API documentation URLs.
    
    Args:
        base_url: Base URL to start discovery from
        max_depth: Maximum crawling depth
        max_urls: Maximum URLs to return
    
    Returns:
        Dict with discovered URLs and analysis metadata
    """
    discoverer = AgenticURLDiscoverer(base_url, max_depth, max_urls)
    return await discoverer.discover_urls()