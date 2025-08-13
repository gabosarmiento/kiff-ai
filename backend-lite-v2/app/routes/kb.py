import os
import uuid
import hashlib
import time
from typing import Any, Dict, List, Optional, Literal
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db_core import SessionLocal
from ..models_kiffs import KnowledgePack as KnowledgePackModel

router = APIRouter(prefix="/api/kb", tags=["kb"]) 

LANCEDB_DIR = os.getenv("LANCEDB_DIR", os.path.abspath(os.path.join(os.getcwd(), "../../local_lancedb")))

try:
    import lancedb  # type: ignore
    from lancedb import DB
    _HAS_LANCEDB = True
except Exception:  # pragma: no cover
    lancedb = None
    DB = Any
    _HAS_LANCEDB = False


# Legacy in-memory registry (will be phased out)
_KB_META: Dict[str, Dict[str, Any]] = {}


def _require_tenant(x_tenant_id: Optional[str]) -> str:
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="Tenant not specified")
    return x_tenant_id


class CreateKBRequest(BaseModel):
    name: str
    vector_store: str = "lancedb"  # reserved for future providers
    retrieval_mode: Optional[Literal["agentic-search", "agentic-rag"]] = "agentic-search"
    embedder: Optional[str] = "sentence-transformers"


class KBMeta(BaseModel):
    id: str
    name: str
    vector_store: str
    table: Optional[str] = None
    tenant_id: Optional[str] = None
    retrieval_mode: Optional[str] = None
    embedder: Optional[str] = None
    created_at: Optional[int] = None


class IngestItem(BaseModel):
    text: str
    url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class IngestRequest(BaseModel):
    items: List[IngestItem]


@router.post("/create", response_model=KBMeta)
async def create_kb(req: CreateKBRequest, x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")):
    tenant_id = _require_tenant(x_tenant_id)
    if req.vector_store != "lancedb":
        raise HTTPException(status_code=400, detail="Only lancedb supported in MVP")

    kb_id = str(uuid.uuid4())
    table_name = f"kb_{kb_id.replace('-', '_')}"

    if _HAS_LANCEDB:
        os.makedirs(LANCEDB_DIR, exist_ok=True)
        db: DB = lancedb.connect(LANCEDB_DIR)
        if table_name not in [t.name for t in db.table_names()]:
            db.create_table(table_name, data=[{"text": "__init__", "url": None, "metadata": {"init": True}}])
            # remove seed row right away
            tbl = db.open_table(table_name)
            tbl.delete("text == '__init__'")

    # Save to database instead of in-memory
    db_session: Session = SessionLocal()
    try:
        kb = KnowledgePackModel(
            id=kb_id,
            name=req.name,
            vector_store=req.vector_store,
            table_name=table_name,
            tenant_id=tenant_id,
            retrieval_mode=req.retrieval_mode,
            embedder=req.embedder
        )
        db_session.add(kb)
        db_session.commit()
        
        return KBMeta(
            id=kb.id,
            name=kb.name,
            vector_store=kb.vector_store,
            table=kb.table_name,
            tenant_id=kb.tenant_id,
            retrieval_mode=kb.retrieval_mode,
            embedder=kb.embedder,
            created_at=int(kb.created_at.timestamp() * 1000)
        )
    except Exception as e:
        db_session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create knowledge pack: {e}")
    finally:
        db_session.close()


@router.get("/{kb_id}", response_model=KBMeta)
async def get_kb(kb_id: str, x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")):
    tenant_id = _require_tenant(x_tenant_id)
    
    db_session: Session = SessionLocal()
    try:
        kb = db_session.query(KnowledgePackModel).filter(
            KnowledgePackModel.id == kb_id,
            KnowledgePackModel.tenant_id == tenant_id
        ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="kb not found")
        
        return KBMeta(
            id=kb.id,
            name=kb.name,
            vector_store=kb.vector_store,
            table=kb.table_name,
            tenant_id=kb.tenant_id,
            retrieval_mode=kb.retrieval_mode,
            embedder=kb.embedder,
            created_at=int(kb.created_at.timestamp() * 1000)
        )
    finally:
        db_session.close()


@router.get("", response_model=List[KBMeta])
async def list_kbs(x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")):
    tenant_id = _require_tenant(x_tenant_id)
    
    db_session: Session = SessionLocal()
    try:
        kbs = db_session.query(KnowledgePackModel).filter(
            KnowledgePackModel.tenant_id == tenant_id
        ).all()
        
        return [
            KBMeta(
                id=kb.id,
                name=kb.name,
                vector_store=kb.vector_store,
                table=kb.table_name,
                tenant_id=kb.tenant_id,
                retrieval_mode=kb.retrieval_mode,
                embedder=kb.embedder,
                created_at=int(kb.created_at.timestamp() * 1000)
            ) for kb in kbs
        ]
    finally:
        db_session.close()


@router.post("/{kb_id}/ingest")
async def ingest(kb_id: str, req: IngestRequest, x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")):
    tenant_id = _require_tenant(x_tenant_id)
    
    # Get KB metadata from database
    db_session: Session = SessionLocal()
    try:
        kb = db_session.query(KnowledgePackModel).filter(
            KnowledgePackModel.id == kb_id,
            KnowledgePackModel.tenant_id == tenant_id
        ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="kb not found")
    finally:
        db_session.close()
    
    if not _HAS_LANCEDB:
        raise HTTPException(status_code=400, detail="lancedb not installed on server")

    db: DB = lancedb.connect(LANCEDB_DIR)
    tbl = db.open_table(kb.table_name)  # type: ignore

    rows = []
    for it in req.items:
        cid = hashlib.sha1((it.url or "") .encode("utf-8") + b"|" + it.text.encode("utf-8")).hexdigest()
        rows.append({
            "id": cid,
            "text": it.text,
            "url": it.url,
            "metadata": it.metadata or {},
        })
    if rows:
        # delete duplicates by id then add
        for r in rows:
            try:
                tbl.delete(f"id == '{r['id']}'")
            except Exception:
                pass
        tbl.add(rows)

    return {"ok": True, "ingested": len(rows)}


# ----- Index via extraction pipeline -----
# We reuse the chunkers and helpers from extract.py
try:
    from .extract import (
        fetch_text,
        fixed_chunk,
        _chunk_semantic,
        _chunk_agentic,
        _chunk_recursive,
        _chunk_document,
        _model_for_mode,
        _estimate_cost,
        simple_token_estimate,
        _resolve_urls_from_api,
        _load_api,
    )
except Exception:
    fetch_text = None  # type: ignore
    _resolve_urls_from_api = None  # type: ignore
    _load_api = None  # type: ignore

# Prefer URLs discovered and persisted by the admin gallery flow
try:
    from ..util.gallery_store import list_doc_urls  # type: ignore
except Exception:
    list_doc_urls = None  # type: ignore


class IndexRequest(BaseModel):
    kb_id: str
    api_id: Optional[str] = None
    urls: Optional[List[str]] = None
    mode: Literal["fast", "agentic"] = "fast"
    strategy: Literal["fixed", "semantic", "agentic", "recursive", "document"] = "fixed"
    embedder: Optional[str] = "sentence-transformers"
    chunk_size: int = 1000
    chunk_overlap: int = 120
    semantic_params: Optional[Dict[str, Any]] = None
    budget_cap_usd: float = 5.0


@router.post("/index")
async def index_into_kb(req: IndexRequest, x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")):
    tenant_id = _require_tenant(x_tenant_id)
    if fetch_text is None:
        raise HTTPException(status_code=500, detail="extract pipeline unavailable")

    # Get KB metadata from database
    db_session: Session = SessionLocal()
    try:
        kb = db_session.query(KnowledgePackModel).filter(
            KnowledgePackModel.id == req.kb_id,
            KnowledgePackModel.tenant_id == tenant_id
        ).first()
        
        if not kb:
            raise HTTPException(status_code=404, detail="kb not found")
    finally:
        db_session.close()

    # Resolve URLs
    urls: List[str] = []
    if req.urls:
        urls = req.urls[:50]
    elif req.api_id:
        # 1) Try admin gallery persisted URLs (UUID-based api_service_id)
        if list_doc_urls is not None:
            try:
                persisted = [d.get("url") for d in list_doc_urls() if d.get("api_service_id") == req.api_id and d.get("url")]
                if persisted:
                    urls = persisted[:50]
            except Exception:
                pass
        # 2) Fallback to legacy crawler based on apis.json slugs
        if not urls and _load_api is not None and _resolve_urls_from_api is not None:
            api = _load_api(req.api_id)
            if not api:
                raise HTTPException(status_code=404, detail="api_id not found")
            urls = await _resolve_urls_from_api(api, limit=50)
    if not urls:
        raise HTTPException(status_code=400, detail="must provide urls or api_id")

    # Open table
    if not _HAS_LANCEDB:
        raise HTTPException(status_code=400, detail="lancedb not installed on server")
    db: DB = lancedb.connect(LANCEDB_DIR)
    tbl = db.open_table(kb.table_name)  # type: ignore

    # Chunk + ingest
    logs: List[str] = []
    total_chunks = 0
    total_tokens = 0
    model_id = _model_for_mode(req.mode)

    for url in urls:
        try:
            text = await fetch_text(url)  # type: ignore
        except Exception as e:
            logs.append(f"error: fetch failed {url}: {e}")
            continue
        pieces: List[str]
        if req.strategy == "fixed":
            pieces = fixed_chunk(text, req.chunk_size, req.chunk_overlap)  # type: ignore
        elif req.strategy == "semantic":
            pieces = _chunk_semantic(text, req.chunk_size, req.chunk_overlap, model_id, logs, req.embedder, params=req.semantic_params)  # type: ignore
        elif req.strategy == "agentic":
            pieces = _chunk_agentic(text, req.chunk_size, req.chunk_overlap, model_id, logs, req.embedder)  # type: ignore
        elif req.strategy == "recursive":
            pieces = _chunk_recursive(text, req.chunk_size, req.chunk_overlap, model_id, logs, req.embedder)  # type: ignore
        else:
            pieces = _chunk_document(text, req.chunk_size, req.chunk_overlap, model_id, logs, req.embedder)  # type: ignore

        rows = []
        for i, p in enumerate(pieces):
            cid = hashlib.sha1((url + "|" + str(i) + "|" + str(len(p))).encode("utf-8") + p.encode("utf-8")).hexdigest()
            rows.append({
                "id": cid,
                "text": p,
                "url": url,
                "metadata": {
                    "strategy": req.strategy,
                    "mode": req.mode,
                    "idx": i,
                },
            })
            total_tokens += simple_token_estimate(p)  # type: ignore
        total_chunks += len(rows)
        # upsert
        for r in rows:
            try:
                tbl.delete(f"id == '{r['id']}'")
            except Exception:
                pass
        if rows:
            tbl.add(rows)

    costs = _estimate_cost(tokens=total_tokens, embed_tokens=0, model_id=model_id)
    if costs.get("est_usd", 0.0) > req.budget_cap_usd:
        logs.append(f"warning: estimated cost {costs['est_usd']:.4f} exceeded cap {req.budget_cap_usd:.4f}")

    return {
        "kb_id": req.kb_id,
        "indexed": {"urls": len(urls), "chunks": total_chunks, "tokens_est": total_tokens},
        "costs": costs,
        "logs": logs,
    }
