import os
from typing import Callable, Optional

# This module returns a unified web search tool for the LauncherAgent.
# Priority: Tavily (if TAVILY_API_KEY set) -> fallback Serper (if SERPER_API_KEY set)
# Exposes: get_web_search_tool(tool_decorator) -> Optional[Callable]


def _make_tavily_tool(tool):
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return None

    @tool
    def web_search(query: str, num_results: int = 5) -> str:  # type: ignore
        """Search the web with Tavily and return concise citations.
        Args:
            query: The search query
            num_results: How many results to return (default 5, max 10)
        Returns: Bulleted list of Title – URL – snippet
        """
        import httpx as _httpx
        try:
            n = max(1, min(int(num_results or 5), 10))
        except Exception:
            n = 5
        try:
            resp = _httpx.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": query,
                    "max_results": n,
                    "include_answer": False,
                    "include_images": False,
                    "include_raw_content": False,
                },
                timeout=20.0,
            )
            if resp.status_code != 200:
                return f"Tavily error: HTTP {resp.status_code} - {resp.text[:200]}"
            data = resp.json()
        except Exception as e:
            return f"Tavily request failed: {e}"

        items = []
        for r in (data.get("results") or [])[:n]:
            title = r.get("title") or "(no title)"
            link = r.get("url") or r.get("link") or ""
            snippet = (r.get("content") or r.get("snippet") or r.get("description") or "").strip()
            snippet = (snippet[:220] + "...") if len(snippet) > 220 else snippet
            items.append(f"• {title} — {link}\n  {snippet}")
        if not items:
            return f"No results for: {query}"
        return "Web results (Tavily):\n" + "\n".join(items)

    return web_search


def _make_serper_tool(tool):
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return None

    @tool
    def web_search(query: str, num_results: int = 5) -> str:  # type: ignore
        """Search the web with Serper (Google) and return concise citations.
        Args:
            query: The search query
            num_results: How many results to return (default 5, max 10)
        Returns: Bulleted list of Title – URL – snippet
        """
        import httpx as _httpx
        try:
            n = max(1, min(int(num_results or 5), 10))
        except Exception:
            n = 5
        headers = {
            "X-API-KEY": api_key,
            "Content-Type": "application/json",
        }
        payload = {"q": query, "num": n}
        try:
            resp = _httpx.post(
                "https://google.serper.dev/search",
                headers=headers,
                json=payload,
                timeout=20.0,
            )
            if resp.status_code != 200:
                return f"Serper error: HTTP {resp.status_code} - {resp.text[:200]}"
            data = resp.json()
        except Exception as e:
            return f"Serper request failed: {e}"

        items = []
        for r in (data.get("organic") or [])[:n]:
            title = r.get("title") or "(no title)"
            link = r.get("link") or r.get("url") or ""
            snippet = (r.get("snippet") or r.get("description") or "").strip()
            snippet = (snippet[:220] + "...") if len(snippet) > 220 else snippet
            items.append(f"• {title} — {link}\n  {snippet}")
        if not items:
            return f"No results for: {query}"
        return "Web results (Serper):\n" + "\n".join(items)

    return web_search


def get_web_search_tool(tool_decorator) -> Optional[Callable]:
    """Return a unified web_search tool using Tavily if available, else Serper.
    If neither API key is configured, returns None.
    """
    # Prefer Tavily
    t = _make_tavily_tool(tool_decorator)
    if t is not None:
        return t
    # Fallback Serper
    s = _make_serper_tool(tool_decorator)
    return s
