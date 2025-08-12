from __future__ import annotations
import os
import json
# ---- Models alias resolution ----
def _load_model_catalog():
    global MODEL_CATALOG
    if MODEL_CATALOG:
        return
    try:
        data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "models.json")
        with open(data_path, "r", encoding="utf-8") as f:
            MODEL_CATALOG = json.load(f)
    except Exception:
        MODEL_CATALOG = []


def _normalize(s: str) -> str:
    return s.strip().lower().replace(" ", "").replace("_", "-")


def _resolve_model_id(model_id: str) -> str:
    """Resolve a requested id to a provider-specific id using only the backend catalog.

    Strategy:
    - If it's already in the in-memory registry, return as-is.
    - Load `models.json` and try exact id and normalized name/id matches.
    - If still unresolved, and the id exists in catalog but isn't a provider id,
      try to find another entry with the same family that looks like a provider id (contains '/').
    - Otherwise, return the original id.
    """
    if not model_id:
        return model_id
    mid = model_id
    # 1) If already exists in registry, keep as-is
    if mid in GROQ_LLM_REGISTRY:
        return mid
    # 2) Catalog-driven resolution
    _load_model_catalog()
    if not MODEL_CATALOG:
        return mid
    norm_target = _normalize(mid)
    exact_entry = None
    # exact id match
    for m in MODEL_CATALOG:
        if m.get("id") == mid:
            exact_entry = m
            break
    if exact_entry is not None:
        # If it's already a provider-looking id (e.g., contains '/'), return it
        if "/" in exact_entry.get("id", ""):
            return exact_entry["id"]
        # Else, try to find a provider id within the same family
        fam = exact_entry.get("family")
        if fam:
            for m in MODEL_CATALOG:
                if m.get("family") == fam and "/" in m.get("id", ""):
                    return m["id"]
        return exact_entry["id"]
    # normalized id or name match
    for m in MODEL_CATALOG:
        cand_id = m.get("id", "")
        cand_name = m.get("name", "")
        if _normalize(cand_id) == norm_target or _normalize(cand_name) == norm_target:
            # Prefer provider-style ids if available for the same family
            fam = m.get("family")
            if fam:
                for mm in MODEL_CATALOG:
                    if mm.get("family") == fam and "/" in mm.get("id", ""):
                        return mm["id"]
            return cand_id
    return mid


from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
from fastapi import Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import time
import uuid
import asyncio

# Reuse the cached embedder builder from extract routes
try:
    from app.routes.extract import _build_embedder as _build_cached_embedder  # type: ignore
except Exception:
    _build_cached_embedder = None  # type: ignore

router = APIRouter(prefix="/api/compose", tags=["compose"]) 

# In-memory session store (swap with Redis later)
SESSIONS: Dict[str, Dict[str, Any]] = {}
CONTEXT_USED: Dict[str, List[Dict[str, Any]]] = {}
AGENTS: Dict[str, Any] = {}

# Optional AGNO imports (graceful fallback with version-agnostic paths)
AgnoAgent = None  # type: ignore
PDFKnowledgeBase = None  # type: ignore
LanceDb = None  # type: ignore
GroqLLM = None  # type: ignore
OpenAILLM = None  # type: ignore
AGNO_AVAILABLE = False
GROQ_LLM_REGISTRY: Dict[str, Any] = {}
MODEL_CATALOG: List[Dict[str, Any]] = []
MODEL_ALIASES: Dict[str, str] = {
    # Friendly name -> provider id
    "kimi-k2": "moonshotai/kimi-k2-instruct",
    # Common Groq Llama aliases
    "llama-3.1-8b": "llama-3.1-8b-instant",
    "llama-3.1 8b": "llama-3.1-8b-instant",
    "llama3.1-8b": "llama-3.1-8b-instant",
    "llama-3.3-70b": "llama-3.3-70b-versatile",
    "llama-3.3 70b": "llama-3.3-70b-versatile",
    "llama3.3-70b": "llama-3.3-70b-versatile",
    # GPT-OSS shortcuts
    "gpt-oss-120b": "openai/gpt-oss-120b",
    "gpt-oss-20b": "openai/gpt-oss-20b",
}

# Try multiple import paths to support different agno versions
try:
    # Agent import variants
    try:
        from agno import Agent as AgnoAgent  # type: ignore
    except Exception:
        from agno.agent import Agent as AgnoAgent  # type: ignore

    # Knowledge base (PDF) variants
    try:
        from agno.knowledge.pdf import PDFKnowledgeBase  # type: ignore
    except Exception:
        try:
            from agno.knowledge import PDFKnowledgeBase  # type: ignore
        except Exception:
            PDFKnowledgeBase = None  # type: ignore

    # LanceDB store variants
    try:
        from agno.store.lancedb import LanceDb  # type: ignore
    except Exception:
        try:
            from agno.vectordb.lancedb import LanceDb  # type: ignore
        except Exception:
            LanceDb = None  # type: ignore

    # Groq LLM variants (prefer official docs path)
    try:
        from agno.models.groq import Groq as GroqLLM  # type: ignore
    except Exception:
        try:
            from agno.llms.groq import Groq as GroqLLM  # type: ignore
        except Exception:
            try:
                from agno.providers.groq import Groq as GroqLLM  # type: ignore
            except Exception:
                GroqLLM = None  # type: ignore

    # OpenAI provider variants (to route through Groq's OpenAI-compatible API)
    try:
        from agno.models.openai import OpenAI as OpenAILLM  # type: ignore
    except Exception:
        try:
            from agno.llms.openai import OpenAI as OpenAILLM  # type: ignore
        except Exception:
            try:
                from agno.providers.openai import OpenAI as OpenAILLM  # type: ignore
            except Exception:
                OpenAILLM = None  # type: ignore

    AGNO_AVAILABLE = AgnoAgent is not None
except Exception:
    AGNO_AVAILABLE = False


# Initialize a minimal set of Groq LLM providers (names -> instances)
def _initialize_groq_models():
    global GROQ_LLM_REGISTRY
    if GroqLLM is None:
        return
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return
    try:
        presets = {
            "llama-3.3-70b-versatile": {"temperature": 0.3},
            "llama-3.1-8b-instant": {"temperature": 0.2},
            "deepseek-r1-distill-llama-70b": {"temperature": 0.6, "top_p": 0.9, "max_tokens": 20480},
            "gemma2-9b-it": {"temperature": 0.2},
            "qwen/qwen3-32b": {"temperature": 0.25, "top_p": 0.9, "max_tokens": 20480},
            "moonshotai/kimi-k2-instruct": {"temperature": 0.3},
            "openai/gpt-oss-120b": {"temperature": 0.6},
            "openai/gpt-oss-20b": {"temperature": 0.6},
        }
        reg: Dict[str, Any] = {}
        for mid, opts in presets.items():
            try:
                reg[mid] = GroqLLM(id=mid, api_key=api_key, **opts)  # type: ignore
            except Exception:
                continue
        GROQ_LLM_REGISTRY = reg
    except Exception:
        # Silently ignore; we'll build on-demand later
        pass


_initialize_groq_models()


# ---- Schemas ----
class ComposeSessionRequest(BaseModel):
    model_id: Optional[str] = None
    knowledge_space_ids: List[str] = []
    tool_ids: List[str] = []
    mcp_ids: List[str] = []
    system_preamble: Optional[str] = None
    session_id: Optional[str] = None


class ComposeSessionResponse(BaseModel):
    session_id: str
    agent_status: str
    resolved_model_id: Optional[str] = None
    # Optional debug fields
    agno_available: Optional[bool] = None
    groq_class: Optional[str] = None
    have_groq_api_key: Optional[bool] = None
    registry_count: Optional[int] = None


class ComposeMessageRequest(BaseModel):
    session_id: str
    prompt: str
    model_id: Optional[str] = None
    tool_ids: List[str] = []
    mcp_ids: List[str] = []
    knowledge_space_ids: List[str] = []
    options: Dict[str, Any] = {}


class ComposeMessageResponse(BaseModel):
    message_id: str
    content: str


class ToolsResponse(BaseModel):
    tools: List[Dict[str, Any]]
    mcps: List[Dict[str, Any]]


# ---- Helpers ----

def _require_tenant(x_tenant_id: Optional[str]):
    # tenant middleware runs earlier, but we double-check for safety
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="Tenant not specified")
    return x_tenant_id


def _now_ms() -> int:
    return int(time.time() * 1000)


def _get_or_build_agent(session_id: str, sess: Dict[str, Any]) -> Any:
    if AGNO_AVAILABLE is False:
        return None
    if session_id in AGENTS:
        return AGENTS[session_id]
    # Build minimal AGNO Agent
    requested_model = sess.get("model_id") or "kimi-k2"
    model = _resolve_model_id(requested_model)
    # Build Groq LLM object exactly per AGNO best practice
    if GroqLLM is None:
        sess["agent_init_error"] = "GroqLLM class unavailable"
        return None
    api_key = os.getenv("GROQ_API_KEY")
    try:
        llm_obj = GroqLLM(id=model, api_key=api_key, temperature=0.3)  # type: ignore
    except Exception as e:
        sess["agent_init_error"] = f"GroqLLM init failed: {e}"
        return None
    kb = None
    # Only build knowledge base if caller provided knowledge_space_ids
    if sess.get("knowledge_space_ids"):
        # Build or reuse a local sentence-transformers embedder to avoid defaulting to OpenAI
        embedder = None
        if _build_cached_embedder is not None:
            try:
                logs: List[str] = []
                embedder = _build_cached_embedder("sentence-transformers", logs)
            except Exception:
                embedder = None
        # Initialize Knowledge Base only if vector DB and embedder are available
        if PDFKnowledgeBase and LanceDb and embedder is not None:
            # Create a session-scoped table
            table_name = f"kb_{sess['tenant_id']}_{session_id}".replace("-", "_")
            uri = os.getenv("LANCEDB_URI", "tmp/lancedb")
            kb = PDFKnowledgeBase(
                path=[],  # paths will be attached via /attach later
                vector_db=LanceDb(table_name=table_name, uri=uri, embedder=embedder),  # type: ignore
            )
    # Construct Agent per docs: pass a Model/LLM object using 'model'
    agent_kwargs: Dict[str, Any] = {"markdown": True}
    if llm_obj is None:
        return None
    agent_kwargs["model"] = llm_obj
    if kb is not None:
        agent_kwargs["knowledge"] = kb
        agent_kwargs["enable_agentic_knowledge_filters"] = True
    try:
        agent = AgnoAgent(**agent_kwargs)  # type: ignore
    except Exception as e:
        sess["agent_init_error"] = f"Agent init failed: {e}"
        return None
    AGENTS[session_id] = agent
    return agent


# ---- Endpoints ----

@router.post("/session", response_model=ComposeSessionResponse)
async def create_compose_session(payload: ComposeSessionRequest, x_tenant_id: str = Header(None)):
    _require_tenant(x_tenant_id)

    session_id = payload.session_id or f"sess_{uuid.uuid4().hex[:12]}"

    # Resolve model id (fallback, then alias -> provider id)
    requested_model = payload.model_id or "kimi-k2"
    resolved_model = _resolve_model_id(requested_model)

    SESSIONS[session_id] = {
        "tenant_id": x_tenant_id,
        "model_id": resolved_model,
        "knowledge_space_ids": payload.knowledge_space_ids or [],
        "tool_ids": payload.tool_ids or [],
        "mcp_ids": payload.mcp_ids or [],
        "system_preamble": payload.system_preamble,
        "created_at": _now_ms(),
    }
    CONTEXT_USED[session_id] = []

    # Diagnostics for troubleshooting initialization (non-sensitive)
    groq_class = None
    if GroqLLM is not None:
        try:
            groq_class = f"{GroqLLM.__module__}.{GroqLLM.__name__}"  # type: ignore
        except Exception:
            groq_class = "unknown"
    have_groq_api_key = bool(os.getenv("GROQ_API_KEY"))
    # attach transient debug fields (FastAPI will ignore extras unless model includes them, so send as dict)
    return {
        "session_id": session_id,
        "agent_status": "ready",
        "resolved_model_id": resolved_model,
        "agno_available": bool(AGNO_AVAILABLE),
        "groq_class": groq_class,
        "have_groq_api_key": have_groq_api_key,
        "registry_count": len(GROQ_LLM_REGISTRY or {}),
    }


@router.post("/message", response_model=ComposeMessageResponse)
async def compose_message(payload: ComposeMessageRequest, x_tenant_id: str = Header(None)):
    _require_tenant(x_tenant_id)
    sess = SESSIONS.get(payload.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess["tenant_id"] != x_tenant_id:
        raise HTTPException(status_code=403, detail="Session belongs to another tenant")

    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is empty")

    # Try AGNO
    content: str
    if AGNO_AVAILABLE:
        agent = _get_or_build_agent(payload.session_id, sess)
        if agent is None:
            content = f"[AGNO error: could not initialize agent for model '{sess['model_id']}'] echo: {prompt}"
        else:
            try:
                # AGNO doc pattern: pass prompt as positional argument
                result = agent.run(prompt)  # type: ignore
                # Prefer plain content if available
                content_val = getattr(result, "content", None)
                content = content_val if isinstance(content_val, str) else str(result)
            except Exception as e:
                # Fall back to echo if AGNO call fails
                content = f"[AGNO error: {e}] Model={payload.model_id or sess['model_id']} echo: {prompt}"
    else:
        content = f"[AGNO not installed] Model={payload.model_id or sess['model_id']} echo: {prompt}"

    # Mock context; real impl would read from agent.knowledge.retriever traces
    CONTEXT_USED[payload.session_id] = [
        {"space_id": sid, "chunk_id": f"mock_{i}", "summary": "Sample context"}
        for i, sid in enumerate(payload.knowledge_space_ids or sess.get("knowledge_space_ids") or [])
    ]

    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    return ComposeMessageResponse(message_id=message_id, content=content)


@router.get("/context")
async def get_compose_context(session_id: str, x_tenant_id: str = Header(None)):
    _require_tenant(x_tenant_id)
    sess = SESSIONS.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess["tenant_id"] != x_tenant_id:
        raise HTTPException(status_code=403, detail="Session belongs to another tenant")
    return {"session_id": session_id, "used": CONTEXT_USED.get(session_id, [])}


@router.get("/tools", response_model=ToolsResponse)
async def list_tools(x_tenant_id: str = Header(None)):
    _require_tenant(x_tenant_id)
    tools = [
        {"id": "github", "name": "GitHub", "description": "Read/Write repos"},
        {"id": "browser", "name": "Browser", "description": "Navigate websites"},
        {"id": "scraper", "name": "Scraper", "description": "Extract structured data"},
        {"id": "db", "name": "DB", "description": "Query your database"},
    ]
    mcps = [
        {"id": "filesystem", "name": "Filesystem MCP"},
        {"id": "fetch", "name": "Fetch MCP"},
        {"id": "secrets", "name": "Secrets MCP"},
    ]
    return ToolsResponse(tools=tools, mcps=mcps)


@router.post("/attach")
async def attach_knowledge(
    session_id: str = Form(...),
    space_id: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    x_tenant_id: str = Header(None)
):
    _require_tenant(x_tenant_id)
    sess = SESSIONS.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess["tenant_id"] != x_tenant_id:
        raise HTTPException(status_code=403, detail="Session belongs to another tenant")

    # If AGNO + LanceDB are available, save PDFs and register with knowledge base
    effective_space = space_id or f"kb_temp_{session_id}"
    saved_paths: List[str] = []
    if AGNO_AVAILABLE and PDFKnowledgeBase and LanceDb:
        base_dir = os.path.join("tmp", "uploads", sess["tenant_id"], session_id)
        os.makedirs(base_dir, exist_ok=True)
        for uf in files:
            dst = os.path.join(base_dir, uf.filename)
            with open(dst, "wb") as out:
                out.write(await uf.read())
            saved_paths.append(dst)
        # Build knowledge base for these files
        table_name = f"kb_{sess['tenant_id']}_{session_id}".replace("-", "_")
        uri = os.getenv("LANCEDB_URI", "tmp/lancedb")
        kb = PDFKnowledgeBase(
            path=[{"path": p, "metadata": {"tenant_id": sess["tenant_id"], "session_id": session_id, "space_id": effective_space}} for p in saved_paths],  # type: ignore
            vector_db=LanceDb(table_name=table_name, uri=uri),  # type: ignore
        )
        # Some AGNO versions require explicit processing call
        try:
            kb.process()  # type: ignore
        except Exception:
            pass
        # Attach to agent if present
        agent = _get_or_build_agent(session_id, sess)
        if agent is not None:
            try:
                agent.knowledge = kb  # type: ignore
            except Exception:
                pass
        chunks_indexed = len(saved_paths)  # approximation; real value comes from kb stats
        return {"space_id": effective_space, "chunks_indexed": chunks_indexed}
    else:
        # Fallback: no real indexing
        count = len(files)
        return {"space_id": effective_space, "chunks_indexed": count, "note": "AGNO/LanceDB not available - mocked"}


@router.get("/stream")
async def compose_stream(session_id: str, prompt: str, x_tenant_id: str = Header(None)):
    _require_tenant(x_tenant_id)
    sess = SESSIONS.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess["tenant_id"] != x_tenant_id:
        raise HTTPException(status_code=403, detail="Session belongs to another tenant")

    async def event_gen():
        # Real streaming using AGNO RunResponseEvent when available; else fallback
        if AGNO_AVAILABLE:
            agent = _get_or_build_agent(session_id, sess)
            if agent is None:
                yield f"data: [AGNO error: could not initialize agent for model '{sess['model_id']}']\n\n"
                yield "data: [DONE]\n\n"
                return
            try:
                response_stream = agent.run(prompt, stream=True)  # type: ignore
                for ev in response_stream:
                    # Extract only human-readable text. Skip event reprs.
                    text = None
                    # Most token events expose `.delta`
                    d = getattr(ev, "delta", None)
                    if isinstance(d, str) and d:
                        text = d
                    # Some events carry `.text` or `.content`
                    if text is None:
                        t = getattr(ev, "text", None)
                        if isinstance(t, str) and t:
                            text = t
                    if text is None:
                        c = getattr(ev, "content", None)
                        if isinstance(c, str) and c:
                            text = c
                    # Only emit if we found text; otherwise, ignore control/meta events
                    if text:
                        yield f"data: {text}\n\n"
                    await asyncio.sleep(0)
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                # Fallback to non-streaming text echo on errors
                text = f"[AGNO error: {e}] {prompt}"
        else:
            text = f"[AGNO not installed] {prompt}"

        for ch in text:
            yield f"data: {ch}\n\n"
            await asyncio.sleep(0.005)
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")
