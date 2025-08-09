from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Literal, Optional, Dict, Any
import httpx
from bs4 import BeautifulSoup
import math
import os
import json
import xml.etree.ElementTree as ET
from time import monotonic

router = APIRouter(prefix="/api/extract", tags=["extract"]) 


Strategy = Literal[
    "fixed",
    "semantic",
    "agentic",
    "recursive",
    "document",
]


class ExtractPreviewRequest(BaseModel):
    # Primary selectors
    api_id: Optional[str] = None
    urls: Optional[List[str]] = None

    # Execution mode and strategy
    mode: Literal["fast", "agentic"] = "fast"
    strategy: Strategy = "fixed"

    # Chunking parameters (tokens approx)
    chunk_size: int = 5000
    chunk_overlap: int = 300

    # Options
    include_metadata: bool = True


class Chunk(BaseModel):
    text: str
    url: str
    index: int
    tokens_est: int
    metadata: Dict[str, Any] | None = None


class ExtractPreviewResponse(BaseModel):
    chunks: List[Chunk]
    totals: Dict[str, Any]
    per_url: Dict[str, Any]
    config: Dict[str, Any]
    logs: List[str]
    costs: Dict[str, Any]


async def fetch_text(url: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url)
        r.raise_for_status()
        html = r.text
    soup = BeautifulSoup(html, "html.parser")
    # Remove scripts/styles
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    return text


def simple_token_estimate(s: str) -> int:
    # quick heuristic: ~4 chars per token
    return max(1, math.ceil(len(s) / 4))


def fixed_chunk(text: str, size: int, overlap: int) -> List[str]:
    # operate on characters as an approximation to tokens
    if size <= 0:
        return [text]
    res = []
    start = 0
    step = max(1, size - max(0, overlap))
    while start < len(text):
        end = min(len(text), start + size)
        res.append(text[start:end])
        start += step
    return res


def _apis_store_path() -> str:
    return os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "apis.json"))


def _load_api(api_id: str) -> Optional[Dict[str, Any]]:
    path = _apis_store_path()
    if not os.path.exists(path):
        return None


# --- Models store helpers ---
def _models_store_path() -> str:
    return os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "models.json"))


def _read_models() -> List[Dict[str, Any]]:
    path = _models_store_path()
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        try:
            items = json.load(f)
        except json.JSONDecodeError:
            return []
    return items or []


def _get_model(model_id: str) -> Optional[Dict[str, Any]]:
    for m in _read_models():
        if m.get("id") == model_id:
            return m
    return None


def _model_for_mode(mode: str) -> str:
    # Map UI mode to model id via environment configuration with sane defaults
    fast_default = "llama-3.1-8b-instant"
    agentic_default = "kimi-k2-1t-128k"
    if mode == "fast":
        return os.getenv("KIFF_MODEL_FAST", fast_default)
    return os.getenv("KIFF_MODEL_AGENTIC", agentic_default)


def _estimate_cost(tokens: int, embed_tokens: int, model_id: str) -> Dict[str, Any]:
    m = _get_model(model_id)
    # Fallback pricing if model not found in store
    price_in = 0.3
    price_out = 0.6
    if m:
        price_in = float(m.get("price_per_1k_input", price_in))
        price_out = float(m.get("price_per_1k_output", price_out))
    avg_per_1k = (price_in + price_out) / 2.0
    usd = round(((tokens or 0) / 1000.0) * avg_per_1k, 6)
    if embed_tokens:
        usd += round((embed_tokens / 1000.0) * 0.02, 6)
    return {
        "model": model_id,
        "price_per_1k_input": price_in,
        "price_per_1k_output": price_out,
        "tokens_est": tokens,
        "embed_tokens_est": embed_tokens,
        "est_usd": usd,
    }
    with open(path, "r", encoding="utf-8") as f:
        try:
            items = json.load(f)
        except json.JSONDecodeError:
            return None
    for it in items:
        if it.get("id") == api_id:
            return it
    return None


async def _resolve_urls_from_api(api: Dict[str, Any], limit: int = 20) -> List[str]:
    sitemap_url = api.get("sitemap_url")
    if not sitemap_url:
        return []
    filters = api.get("url_filters") or []
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(sitemap_url)
        r.raise_for_status()
        text = r.text
    root = ET.fromstring(text)
    ns = ""
    if root.tag.startswith("{"):
        ns_uri = root.tag.split("}")[0][1:]
        ns = f"{{{ns_uri}}}"
    urls = [loc.text.strip() for loc in root.findall(f".{ns}url/{ns}loc") if getattr(loc, "text", None)]
    if filters:
        urls = [u for u in urls if any(u.startswith(f) for f in filters)]
    return urls[: min(limit, len(urls))]


@router.post("/preview", response_model=ExtractPreviewResponse)
async def preview(req: ExtractPreviewRequest):
    t0 = monotonic()

    # Enforce defaults and bounds
    size = max(1, min(req.chunk_size or 5000, 12000))
    overlap = max(0, min(req.chunk_overlap or 300, 500))

    logs: List[str] = []
    logs.append(f"mode={req.mode} strategy={req.strategy} size={size} overlap={overlap}")

    # Determine URLs
    urls: List[str] = []
    if req.urls and len(req.urls) > 0:
        urls = req.urls
        logs.append(f"using {len(urls)} provided urls")
    elif req.api_id:
        api = _load_api(req.api_id)
        if not api:
            raise HTTPException(status_code=404, detail="api_id not found")
        urls = await _resolve_urls_from_api(api, limit=20)
        logs.append(f"resolved {len(urls)} urls from sitemap of {req.api_id}")
    else:
        raise HTTPException(status_code=400, detail="must provide urls or api_id")

    # For MVP: non-fixed/document strategies fall back to fixed, but we record it.
    effective_strategy = req.strategy
    if req.strategy not in {"fixed", "document"}:
        logs.append(f"strategy {req.strategy} not yet implemented; falling back to fixed")
        effective_strategy = "fixed"

    all_chunks: List[Chunk] = []
    per_url: Dict[str, Any] = {}

    for url in urls:
        try:
            text = await fetch_text(url)
            logs.append(f"fetched {len(text)} chars from {url}")
        except Exception as e:
            per_url[url] = {"error": str(e)}
            logs.append(f"error fetching {url}: {e}")
            continue

        pieces: List[str]
        if effective_strategy == "document":
            pieces = [text]
        else:
            pieces = fixed_chunk(text, size, overlap)

        url_chunks: List[Chunk] = []
        for i, piece in enumerate(pieces):
            ch = Chunk(
                text=piece,
                url=url,
                index=i,
                tokens_est=simple_token_estimate(piece),
                metadata={
                    "strategy": effective_strategy,
                    "approx": True,
                } if req.include_metadata else None,
            )
            url_chunks.append(ch)
            all_chunks.append(ch)

        per_url[url] = {
            "chunks": len(url_chunks),
            "tokens_est": sum(c.tokens_est for c in url_chunks),
        }

    totals_tokens = sum(c.tokens_est for c in all_chunks)
    totals = {
        "chunks": len(all_chunks),
        "tokens_est": totals_tokens,
        "duration_ms": int((monotonic() - t0) * 1000),
    }

    # Cost estimate via model pricing
    model_id = _model_for_mode(req.mode)
    costs = _estimate_cost(tokens=totals_tokens, embed_tokens=0, model_id=model_id)

    config = {
        "mode": req.mode,
        "model": model_id,
        "strategy": req.strategy,
        "effective_strategy": effective_strategy,
        "chunk_size": size,
        "chunk_overlap": overlap,
        "include_metadata": req.include_metadata,
        "source": "urls" if req.urls else f"api:{req.api_id}",
    }

    return ExtractPreviewResponse(
        chunks=all_chunks,
        totals=totals,
        per_url=per_url,
        config=config,
        logs=logs,
        costs=costs,
    )
