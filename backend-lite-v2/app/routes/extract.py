from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Any, Dict, List, Optional, Literal
import re
import httpx
from bs4 import BeautifulSoup
import math
import os
import json
import xml.etree.ElementTree as ET
from time import monotonic

# --- Optional AGNO + Groq support ---
try:
    from agno.models.groq import Groq as GroqLLM  # type: ignore
except Exception:  # pragma: no cover - optional
    GroqLLM = None  # type: ignore

# Try importing various chunkers; each is optional and we fall back to fixed
try:
    from agno.document.chunking.recursive import RecursiveChunking  # type: ignore
except Exception:  # pragma: no cover
    RecursiveChunking = None  # type: ignore

try:
    from agno.document.chunking.semantic import SemanticChunking  # type: ignore
except Exception:  # pragma: no cover
    SemanticChunking = None  # type: ignore

try:
    from agno.document.chunking.agentic import AgenticChunking  # type: ignore
except Exception:  # pragma: no cover
    AgenticChunking = None  # type: ignore

try:
    from agno.document.chunking.document import DocumentChunking  # type: ignore
except Exception:  # pragma: no cover
    DocumentChunking = None  # type: ignore

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

    # Embedder selection for semantic/agentic strategies
    embedder: Optional[Literal[
        "sentence-transformers",
        "fastembed",
        "voyage",
        "openai",
        "cohere",
        "mistral",
    ]] = "sentence-transformers"

    # Chunking parameters (tokens approx)
    chunk_size: int = 5000
    chunk_overlap: int = 300

    # Options
    include_metadata: bool = True

    # Optional per-strategy custom params (ignored if strategy doesn't match)
    agentic_params: Optional[Dict[str, Any]] = None
    semantic_params: Optional[Dict[str, Any]] = None
    recursive_params: Optional[Dict[str, Any]] = None


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


# ---- Recommendation API models ----
class RecommendRequest(BaseModel):
    api_id: Optional[str] = None
    urls: Optional[List[str]] = None  # up to 10
    sample_size: int = 10
    optimize_for: Optional[Literal["quality", "speed"]] = None  # nudges mode/strategy


class RecommendConfig(BaseModel):
    mode: Literal["fast", "agentic"]
    strategy: Strategy
    embedder: Optional[str] = "sentence-transformers"
    chunk_size: int
    chunk_overlap: int
    semantic_params: Optional[Dict[str, Any]] = None
    reasons: List[str] = []
    confidence: float = 0.7
    label: Optional[str] = None


class RecommendResponse(BaseModel):
    suggested: RecommendConfig
    alternates: List[RecommendConfig]
    estimates: Dict[str, Any]
    diagnostics: Dict[str, Any]


async def fetch_text(url: str) -> str:
    async with httpx.AsyncClient(timeout=30, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }) as client:
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


# --- Groq / LLM helpers ---
def _build_groq(model_id: str):
    """Return a Groq LLM instance if available and API key present, else None."""
    if GroqLLM is None:
        return None
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        return GroqLLM(id=model_id, api_key=api_key)
    except Exception:
        return None


# --- Embedder builders (best-effort) ---
# Cache for heavy embedder instances
_EMBEDDER_CACHE: Dict[str, Any] = {}
# Cache for raw sentence-transformers models to avoid duplicate heavy loads
_RAW_ST_MODEL_CACHE: Dict[str, Any] = {}

def _get_raw_sentence_transformer(model_id: str, logs: List[str]) -> Optional[Any]:
    """Return cached sentence-transformers model if available, else try to load one.
    Uses KIFF_ST_DEVICE and KIFF_ST_TRUST_REMOTE_CODE envs when present.
    """
    if model_id in _RAW_ST_MODEL_CACHE:
        return _RAW_ST_MODEL_CACHE[model_id]
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except Exception as e:
        logs.append(f"sentence-transformers not available: {e}")
        return None
    try:
        device = os.getenv("KIFF_ST_DEVICE")  # e.g. 'cpu' or 'cuda'
        trust = os.getenv("KIFF_ST_TRUST_REMOTE_CODE", "true").lower() in ("1", "true", "yes")
        kwargs: Dict[str, Any] = {"trust_remote_code": trust}
        if device:
            kwargs["device"] = device
        raw = SentenceTransformer(model_id, **kwargs)
        _RAW_ST_MODEL_CACHE[model_id] = raw
        return raw
    except Exception as e:
        logs.append(f"failed to init raw SentenceTransformer: {e}")
        return None

def _build_embedder(name: Optional[str], logs: List[str]):
    """Return an AGNO embedder instance matching 'name' or None if unavailable.
    We try multiple providers; if API keys are missing, we log and return None.
    """
    choice = (name or "sentence-transformers").lower()
    # Key includes resolved model when applicable to avoid mismatches
    if choice == "sentence-transformers":
        st_model = os.getenv("KIFF_ST_EMBEDDER_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
        cache_key = f"{choice}:{st_model}"
    else:
        cache_key = choice
    if cache_key in _EMBEDDER_CACHE:
        return _EMBEDDER_CACHE[cache_key]
    # SentenceTransformers (local default)
    if choice == "sentence-transformers":
        st_model = os.getenv("KIFF_ST_EMBEDDER_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
        # Try new canonical path first, with tolerant constructor signatures
        try:
            from agno.embedder.sentence_transformer import SentenceTransformerEmbedder  # type: ignore
            # Prefer passing a cached raw SentenceTransformer client to avoid duplication
            raw = _get_raw_sentence_transformer(st_model, logs)
            if raw is not None:
                # Try common kw combos seen in AGNO codebase evolution
                for id_kw in ("id", "model", "model_name", "model_id"):
                    for client_kw in ("sentence_transformer_client", "client", "model_client"):
                        try:
                            _EMBEDDER_CACHE[cache_key] = SentenceTransformerEmbedder(**{id_kw: st_model, client_kw: raw})  # type: ignore
                            return _EMBEDDER_CACHE[cache_key]
                        except TypeError:
                            continue
                # Fallback: try only client kw without id
                for client_kw in ("sentence_transformer_client", "client", "model_client"):
                    try:
                        _EMBEDDER_CACHE[cache_key] = SentenceTransformerEmbedder(**{client_kw: raw})  # type: ignore
                        return _EMBEDDER_CACHE[cache_key]
                    except TypeError:
                        continue
            # If raw not passed or not accepted, try empty and then model-name kws
            try:
                _EMBEDDER_CACHE[cache_key] = SentenceTransformerEmbedder()  # type: ignore
                return _EMBEDDER_CACHE[cache_key]
            except TypeError:
                pass
            for kw in ("model_name", "model_id", "name", "model", "id"):
                try:
                    _EMBEDDER_CACHE[cache_key] = SentenceTransformerEmbedder(**{kw: st_model})  # type: ignore
                    return _EMBEDDER_CACHE[cache_key]
                except TypeError:
                    continue
            # Last resort, attempt positional
            try:
                _EMBEDDER_CACHE[cache_key] = SentenceTransformerEmbedder(st_model)  # type: ignore
                return _EMBEDDER_CACHE[cache_key]
            except Exception as e_pos:
                raise e_pos
        except Exception as e1:  # pragma: no cover
            # Fallback to older naming
            try:
                from agno.embedder.sentencetransformers import SentenceTransformersEmbedder  # type: ignore
                try:
                    _EMBEDDER_CACHE[cache_key] = SentenceTransformersEmbedder(model=st_model)  # type: ignore
                    return _EMBEDDER_CACHE[cache_key]
                except TypeError:
                    _EMBEDDER_CACHE[cache_key] = SentenceTransformersEmbedder(st_model)  # type: ignore
                    return _EMBEDDER_CACHE[cache_key]
            except Exception as e2:  # pragma: no cover
                logs.append(f"embedder sentence-transformers unavailable: {e1 or e2}")
    # FastEmbed (qdrant fastembed)
    if choice == "fastembed":
        try:
            from agno.embedder.qdrant_fastembed import FastEmbedEmbedder as FastEmbed  # type: ignore
            return FastEmbed()  # type: ignore
        except Exception:
            try:
                from agno.embedder.qdrant_fastembed import FastEmbed as FastEmbed  # type: ignore
                return FastEmbed()  # type: ignore
            except Exception as e:  # pragma: no cover
                logs.append(f"embedder fastembed unavailable: {e}")
    # Voyage AI
    if choice == "voyage":
        try:
            from agno.embedder.voyageai import VoyageAIEmbedder  # type: ignore
            api_key = os.getenv("VOYAGE_API_KEY")
            if not api_key:
                raise RuntimeError("VOYAGE_API_KEY not set")
            model = os.getenv("KIFF_VOYAGE_MODEL", "voyage-large-2-instruct")
            return VoyageAIEmbedder(api_key=api_key, model=model)  # type: ignore
        except Exception as e:  # pragma: no cover
            logs.append(f"embedder voyage unavailable: {e}")
    # OpenAI
    if choice == "openai":
        try:
            from agno.embedder.openai import OpenAIEmbedder  # type: ignore
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise RuntimeError("OPENAI_API_KEY not set")
            model = os.getenv("KIFF_OPENAI_EMBED_MODEL", "text-embedding-3-large")
            return OpenAIEmbedder(api_key=api_key, model=model)  # type: ignore
        except Exception as e:  # pragma: no cover
            logs.append(f"embedder openai unavailable: {e}")
    # Cohere
    if choice == "cohere":
        try:
            from agno.embedder.cohere import CohereEmbedder  # type: ignore
            api_key = os.getenv("COHERE_API_KEY")
            if not api_key:
                raise RuntimeError("COHERE_API_KEY not set")
            model = os.getenv("KIFF_COHERE_MODEL", "embed-multilingual-v3.0")
            return CohereEmbedder(api_key=api_key, model=model)  # type: ignore
        except Exception as e:  # pragma: no cover
            logs.append(f"embedder cohere unavailable: {e}")
    # Mistral
    if choice == "mistral":
        try:
            from agno.embedder.mistral import MistralEmbedder  # type: ignore
            api_key = os.getenv("MISTRAL_API_KEY")
            if not api_key:
                raise RuntimeError("MISTRAL_API_KEY not set")
            model = os.getenv("KIFF_MISTRAL_EMBED_MODEL", "mistral-embed")
            return MistralEmbedder(api_key=api_key, model=model)  # type: ignore
        except Exception as e:  # pragma: no cover
            logs.append(f"embedder mistral unavailable: {e}")
    return None


def _apis_store_path() -> str:
    return os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "apis.json"))


def _load_api(api_id: str) -> Optional[Dict[str, Any]]:
    path = _apis_store_path()
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        try:
            items = json.load(f)
        except json.JSONDecodeError:
            return None
    for it in items or []:
        if it.get("id") == api_id:
            return it
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


# --- AGNO chunking wrappers (best-effort) ---

def _normalize_chunks(parts: Any) -> List[str]:
    """Normalize various chunker outputs into a List[str].
    Accepts: str, object with .content, dicts with 'content', lists of the above.
    """
    try:
        if parts is None:
            return []
        # list-like
        if isinstance(parts, list):
            if not parts:
                return []
            if isinstance(parts[0], str):
                return parts  # type: ignore
            out: List[str] = []
            for p in parts:
                if isinstance(p, str):
                    out.append(p)
                elif isinstance(p, dict):
                    out.append(str(p.get("content", "")))
                else:
                    out.append(str(getattr(p, "content", p)))
            return out
        # single item
        if isinstance(parts, str):
            return [parts]
        if isinstance(parts, dict):
            return [str(parts.get("content", ""))]
        return [str(getattr(parts, "content", parts))]
    except Exception:
        return [str(parts)]
def _chunk_semantic(text: str, size: int, overlap: int, model_id: str, logs: List[str], embedder_name: Optional[str] = None, params: Optional[Dict[str, Any]] = None) -> List[str]:
    # Try dynamic import if not available at module import time
    local_SemanticChunking = SemanticChunking
    if local_SemanticChunking is None:
        try:
            from agno.document.chunking.semantic import SemanticChunking as _SC  # type: ignore
            local_SemanticChunking = _SC  # type: ignore
        except Exception:
            logs.append("semantic chunking unavailable; falling back to fixed")
            return fixed_chunk(text, size, overlap)
    emb = _build_embedder(embedder_name, logs)
    try:
        # Version-tolerant params: AGNO variants may expect 'threshold' or 'similarity_threshold'.
        # Older versions do NOT accept 'chunk_overlap' or 'model' in the constructor.
        given = dict(params or {})
        thr_val = given.get("threshold")
        if thr_val is None and "similarity_threshold" in given:
            thr_val = given.get("similarity_threshold")
            logs.append("semantic chunking: mapped similarity_threshold -> threshold (attempt)")

        # Build candidate kwargs in decreasing strictness. We never pass 'model' here.
        candidates = []
        # Prefer modern 'threshold'
        if thr_val is not None:
            candidates.append({"embedder": emb, "chunk_size": size, "threshold": thr_val})
        # Older 'similarity_threshold'
        if thr_val is not None:
            candidates.append({"embedder": emb, "chunk_size": size, "similarity_threshold": thr_val})
        # Only chunk_size + embedder
        candidates.append({"embedder": emb, "chunk_size": size})
        # Minimal
        candidates.append({"embedder": emb})

        last_err: Exception | None = None
        chunker = None
        for kw in candidates:
            try:
                chunker = local_SemanticChunking(**kw)  # type: ignore
                logs.append(f"semantic chunking: initialized with kwargs {list(kw.keys())}")
                break
            except TypeError as e:
                last_err = e
                continue
        if chunker is None:
            raise TypeError(str(last_err) if last_err else "failed to init SemanticChunking")
        # Method tolerance: split() or chunk()
        method = getattr(chunker, "split", None) or getattr(chunker, "chunk", None)
        if not callable(method):
            raise AttributeError("SemanticChunking has no split/chunk method")
        # Try multiple input shapes: str, Document, [Document], dict, [dict]
        try:
            parts = method(text)
        except Exception:
            try:
                from agno.document import Document  # type: ignore
                try:
                    parts = method(Document(content=text))
                except Exception:
                    parts = method([Document(content=text)])
            except Exception:
                try:
                    parts = method({"content": text})
                except Exception:
                    parts = method([{"content": text}])  # minimal fallback shape
        return _normalize_chunks(parts)
    except Exception as e:
        logs.append(f"semantic chunking error: {e}; falling back to fixed")
        return fixed_chunk(text, size, overlap)


def _chunk_agentic(text: str, size: int, overlap: int, model_id: str, logs: List[str], embedder_name: Optional[str] = None, params: Optional[Dict[str, Any]] = None) -> List[str]:
    if AgenticChunking is None:
        logs.append("agentic chunking unavailable; falling back to fixed")
        return fixed_chunk(text, size, overlap)
    llm = _build_groq(model_id)
    if llm is None:
        logs.append("agentic chunking: no LLM available; falling back to fixed")
        return fixed_chunk(text, size, overlap)
    emb = _build_embedder(embedder_name, logs)
    try:
        # Allowlist of supported kwargs (version tolerant)
        allowed = {"max_chunk_size", "boundary_sensitivity", "allow_titles"}
        extra = {k: v for k, v in (params or {}).items() if k in allowed and v is not None}
        # Map our generic size to max_chunk_size if not provided
        extra.setdefault("max_chunk_size", size)
        # Try most permissive signature first (with embedder if available)
        try:
            if emb is not None:
                chunker = AgenticChunking(model=llm, embedder=emb, **extra)  # type: ignore
            else:
                chunker = AgenticChunking(model=llm, **extra)  # type: ignore
        except TypeError:
            # Fallback: only required args
            chunker = AgenticChunking(model=llm)  # type: ignore
        method = getattr(chunker, "split", None) or getattr(chunker, "chunk", None)
        if not callable(method):
            raise AttributeError("AgenticChunking has no split/chunk method")
        # Try multiple input shapes: str, Document, [Document], dict, [dict]
        try:
            parts = method(text)
        except Exception:
            try:
                from agno.document import Document  # type: ignore
                try:
                    parts = method(Document(content=text))
                except Exception:
                    parts = method([Document(content=text)])
            except Exception:
                try:
                    parts = method({"content": text})
                except Exception as e:
                    try:
                        parts = method([{"content": text}])
                    except Exception:
                        logs.append(f"agentic chunking error: {e}; falling back to fixed")
                        return fixed_chunk(text, size, overlap)
        return _normalize_chunks(parts)
    except Exception as e:
        logs.append(f"agentic chunking error: {e}; falling back to fixed")
        return fixed_chunk(text, size, overlap)


def _chunk_recursive(text: str, size: int, overlap: int, logs: List[str], params: Optional[Dict[str, Any]] = None) -> List[str]:
    if RecursiveChunking is None:
        logs.append("recursive chunking unavailable; falling back to fixed")
        return fixed_chunk(text, size, overlap)
    try:
        # Allowlist extra params
        allowed = {"base_strategy", "levels", "min_chunk_size"}
        extra = {k: v for k, v in (params or {}).items() if k in allowed and v is not None}
        try:
            chunker = RecursiveChunking(chunk_size=size, chunk_overlap=overlap, **extra)  # type: ignore
        except TypeError:
            # Some versions may not accept chunk_overlap or extras
            try:
                chunker = RecursiveChunking(chunk_size=size, **extra)  # type: ignore
            except TypeError:
                chunker = RecursiveChunking(chunk_size=size)  # type: ignore
        method = getattr(chunker, "split", None) or getattr(chunker, "chunk", None)
        if not callable(method):
            raise AttributeError("RecursiveChunking has no split/chunk method")
        parts = method(text)
        if parts and isinstance(parts[0], str):
            return parts
        return [getattr(p, "content", str(p)) for p in parts]
    except Exception as e:
        logs.append(f"recursive chunking error: {e}; falling back to fixed")
        return fixed_chunk(text, size, overlap)


def _chunk_document(text: str, logs: List[str]) -> List[str]:
    # For preview, a single whole-document chunk; optionally use DocumentChunking if present
    if DocumentChunking is None:
        return [text]
    try:
        parts = DocumentChunking().split(text)  # type: ignore
        if not parts:
            return [text]
        if isinstance(parts[0], str):
            return parts
        return [getattr(p, "content", str(p)) for p in parts]
    except Exception:
        return [text]


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
async def preview(req: ExtractPreviewRequest, x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")):
    t0 = monotonic()

    # Enforce defaults and bounds
    size = max(1, min(req.chunk_size or 5000, 12000))
    overlap = max(0, min(req.chunk_overlap or 300, 500))

    logs: List[str] = []
    # Tenant handling (recurring issue): use provided header or safe fallback
    tenant_id = (x_tenant_id or "").strip()
    if not tenant_id:
        tenant_id = "4485db48-71b7-47b0-8128-c6dca5be352d"
        logs.append("warning: missing X-Tenant-ID; using fallback tenant")
    logs.append(f"tenant={tenant_id} mode={req.mode} strategy={req.strategy} size={size} overlap={overlap}")

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
        if effective_strategy == "fixed":
            pieces = fixed_chunk(text, size, overlap)
        elif effective_strategy == "document":
            pieces = _chunk_document(text, logs)
        elif effective_strategy == "semantic":
            pieces = _chunk_semantic(text, size, overlap, _model_for_mode(req.mode), logs, req.embedder, params=req.semantic_params)
        elif effective_strategy == "agentic":
            pieces = _chunk_agentic(text, size, overlap, _model_for_mode(req.mode), logs, req.embedder, params=req.agentic_params)
        elif effective_strategy == "recursive":
            pieces = _chunk_recursive(text, size, overlap, logs, params=req.recursive_params)
        else:
            logs.append(f"unknown strategy {effective_strategy}; using fixed")
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
    logs.append(f"model={model_id} embedder={req.embedder}")
    costs = _estimate_cost(tokens=totals_tokens, embed_tokens=0, model_id=model_id)

    # Echo chosen strategy params for UI reproducibility
    strategy_params = None
    if req.strategy == "agentic":
        strategy_params = req.agentic_params or {}
    elif req.strategy == "semantic":
        strategy_params = req.semantic_params or {}
    elif req.strategy == "recursive":
        strategy_params = req.recursive_params or {}

    config = {
        "mode": req.mode,
        "model": model_id,
        "strategy": req.strategy,
        "effective_strategy": effective_strategy,
        "chunk_size": size,
        "chunk_overlap": overlap,
        "include_metadata": req.include_metadata,
        "embedder": req.embedder,
        "source": "urls" if req.urls else f"api:{req.api_id}",
        "strategy_params": strategy_params,
        "tenant_id": tenant_id,
    }

    return ExtractPreviewResponse(
        chunks=all_chunks,
        totals=totals,
        per_url=per_url,
        config=config,
        logs=logs,
        costs=costs,
    )


# ---- Recommendation endpoint ----
def _analyze_text_features(text: str) -> Dict[str, Any]:
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    paragraphs = lines
    avg_len = (sum(len(p) for p in paragraphs) / max(1, len(paragraphs))) if paragraphs else 0
    var_len = (sum((len(p) - avg_len) ** 2 for p in paragraphs) / max(1, len(paragraphs))) if paragraphs else 0
    headings = [ln for ln in lines if ln.startswith("#") or (len(ln) < 90 and re.match(r"^[A-Z][A-Za-z0-9 \-/_:()]+$", ln))]
    heading_density = (len(headings) / max(1, len(lines))) if lines else 0
    code_present = ("```" in text) or bool(re.search(r"`[^`]+`", text)) or bool(re.search(r"\b(GET|POST|PUT|DELETE)\s+/", text))
    tokens = simple_token_estimate(text)
    return {
        "avg_len": avg_len,
        "var_len": var_len,
        "heading_density": heading_density,
        "code_present": code_present,
        "tokens": tokens,
    }


def _recommend_from_features(features: List[Dict[str, Any]], optimize_for: Optional[str]) -> Dict[str, Any]:
    # Aggregate
    if not features:
        # Safe defaults
        base = {
            "mode": "agentic",
            "strategy": "semantic",
            "embedder": "sentence-transformers",
            "chunk_size": 1200,
            "chunk_overlap": 150,
            "semantic_params": {"threshold": 0.55},
            "reasons": ["No sample available; using robust defaults"],
            "confidence": 0.6,
        }
        return base
    avg_len = sum(f["avg_len"] for f in features) / len(features)
    avg_heading = sum(f["heading_density"] for f in features) / len(features)
    any_code = any(f["code_present"] for f in features)

    reasons: List[str] = []
    mode: Literal["fast", "agentic"] = "agentic" if (optimize_for == "quality") else "fast"
    # Heuristics
    if any_code or avg_heading > 0.08:
        # Favor semantic boundaries; switch to agentic mode for higher quality if asked
        strategy: Strategy = "semantic"
        if optimize_for == "quality":
            mode = "agentic"
        reasons.append("Detected code/requests or frequent headings; semantic preserves coherence")
        chunk_size = 1200
        overlap = 150
        semantic_params = {"threshold": 0.55}
        confidence = 0.8
    elif avg_len < 220:
        strategy = "fixed"
        mode = "fast" if optimize_for != "quality" else "agentic"
        reasons.append("Short uniform paragraphs; fixed size is predictable and cheap")
        chunk_size = 1000
        overlap = 120
        semantic_params = None
        confidence = 0.7
    else:
        strategy = "semantic"
        mode = "agentic" if optimize_for == "quality" else "fast"
        reasons.append("Mixed paragraph lengths; semantic boundaries reduce fragmentation")
        chunk_size = 1200
        overlap = 150
        semantic_params = {"threshold": 0.55}
        confidence = 0.75

    return {
        "mode": mode,
        "strategy": strategy,
        "embedder": "sentence-transformers",
        "chunk_size": chunk_size,
        "chunk_overlap": overlap,
        "semantic_params": semantic_params,
        "reasons": reasons,
        "confidence": confidence,
    }


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(req: RecommendRequest, x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")):
    # Tenant handling
    tenant_id = (x_tenant_id or "").strip() or "4485db48-71b7-47b0-8128-c6dca5be352d"

    # Determine URLs
    urls: List[str] = []
    if req.urls:
        urls = req.urls[:10]
    elif req.api_id:
        api = _load_api(req.api_id)
        if not api:
            raise HTTPException(status_code=404, detail="api_id not found")
        urls = await _resolve_urls_from_api(api, limit=20)
    if not urls:
        raise HTTPException(status_code=400, detail="must provide urls or api_id")

    sample_n = max(1, min(req.sample_size or 10, 10, len(urls)))
    sample_urls = urls[:sample_n]

    # Fetch and analyze
    features: List[Dict[str, Any]] = []
    tokens_total = 0
    for u in sample_urls:
        try:
            text = await fetch_text(u)
        except Exception:
            text = ""
        f = _analyze_text_features(text)
        features.append(f)
        tokens_total += f["tokens"]

    suggested = _recommend_from_features(features, req.optimize_for)

    # Alternates
    alternates: List[RecommendConfig] = []
    alternates.append(RecommendConfig(
        label="Faster",
        mode="fast",
        strategy="fixed",
        embedder="sentence-transformers",
        chunk_size=1000,
        chunk_overlap=120,
        semantic_params=None,
        reasons=["Predictable cost, no LLM chunking"],
        confidence=0.65,
    ))
    alternates.append(RecommendConfig(
        label="Complex docs (agentic)",
        mode="agentic",
        strategy="agentic",
        embedder="sentence-transformers",
        chunk_size=1200,
        chunk_overlap=150,
        semantic_params=None,
        reasons=["Code/tables/mixed content benefit from agentic boundaries"],
        confidence=0.72,
    ))

    # Estimates based on suggested mode/model
    model_id = _model_for_mode(suggested["mode"]) if isinstance(suggested, dict) else _model_for_mode("fast")
    costs = _estimate_cost(tokens=tokens_total, embed_tokens=0, model_id=model_id)
    estimates = {
        "urls": sample_n,
        "tokens_est": tokens_total,
        "est_usd": costs.get("est_usd", 0.0),
    }

    diagnostics = {
        "tenant_id": tenant_id,
        "sample_urls": sample_urls,
        "feature_summary": {
            "avg_len": sum(f["avg_len"] for f in features) / max(1, len(features)),
            "heading_density": sum(f["heading_density"] for f in features) / max(1, len(features)),
            "any_code": any(f["code_present"] for f in features),
        },
    }

    # Coerce suggested into RecommendConfig for response_model
    suggested_cfg = RecommendConfig(**suggested)
    return RecommendResponse(
        suggested=suggested_cfg,
        alternates=alternates,
        estimates=estimates,
        diagnostics=diagnostics,
    )
