import os
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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


# In-memory registry for KB metadata (MVP)
_KB_META: Dict[str, Dict[str, Any]] = {}


class CreateKBRequest(BaseModel):
    name: str
    vector_store: str = "lancedb"  # reserved for future providers


class KBMeta(BaseModel):
    id: str
    name: str
    vector_store: str
    table: Optional[str] = None


class IngestItem(BaseModel):
    text: str
    url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class IngestRequest(BaseModel):
    items: List[IngestItem]


@router.post("", response_model=KBMeta)
async def create_kb(req: CreateKBRequest):
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

    meta = {"id": kb_id, "name": req.name, "vector_store": req.vector_store, "table": table_name}
    _KB_META[kb_id] = meta
    return KBMeta(**meta)


@router.get("/{kb_id}", response_model=KBMeta)
async def get_kb(kb_id: str):
    meta = _KB_META.get(kb_id)
    if not meta:
        raise HTTPException(status_code=404, detail="kb not found")
    return KBMeta(**meta)


@router.post("/{kb_id}/ingest")
async def ingest(kb_id: str, req: IngestRequest):
    meta = _KB_META.get(kb_id)
    if not meta:
        raise HTTPException(status_code=404, detail="kb not found")
    if not _HAS_LANCEDB:
        raise HTTPException(status_code=400, detail="lancedb not installed on server")

    db: DB = lancedb.connect(LANCEDB_DIR)
    tbl = db.open_table(meta["table"])  # type: ignore

    rows = [{"text": it.text, "url": it.url, "metadata": it.metadata or {}} for it in req.items]
    if rows:
        tbl.add(rows)

    return {"ok": True, "ingested": len(rows)}
