from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import os

router = APIRouter(prefix="/api/kiffs", tags=["kiffs"]) 

# Minimal in-memory store
_KIFFS: Dict[str, Dict[str, Any]] = {}


class CreateKiffRequest(BaseModel):
    name: str
    kb_id: str
    model: str = "mock"  # placeholder; later use real LLM via Agno
    top_k: int = 5


class Kiff(BaseModel):
    id: str
    name: str
    kb_id: str
    model: str
    top_k: int


class RunKiffRequest(BaseModel):
    prompt: str


@router.post("", response_model=Kiff)
async def create_kiff(req: CreateKiffRequest):
    import uuid
    kid = str(uuid.uuid4())
    k = {"id": kid, "name": req.name, "kb_id": req.kb_id, "model": req.model, "top_k": req.top_k}
    _KIFFS[kid] = k
    return Kiff(**k)


@router.post("/{kiff_id}/run")
async def run_kiff(kiff_id: str, req: RunKiffRequest):
    k = _KIFFS.get(kiff_id)
    if not k:
        raise HTTPException(status_code=404, detail="kiff not found")

    # MVP retrieval from LanceDB without embeddings: return first N rows for demo
    try:
        import lancedb  # type: ignore
    except Exception:
        return {
            "kiff_id": kiff_id,
            "model": k["model"],
            "prompt": req.prompt,
            "retrieved": [],
            "output": f"[mock-model] You said: '{req.prompt}'. (LanceDB not installed)",
        }

    LANCEDB_DIR = os.getenv("LANCEDB_DIR", os.path.abspath(os.path.join(os.getcwd(), "../../local_lancedb")))
    db = lancedb.connect(LANCEDB_DIR)

    # Table name stored in kb router meta registry via import
    from .kb import _KB_META  # type: ignore

    kb = _KB_META.get(k["kb_id"])  # type: ignore
    if not kb:
        raise HTTPException(status_code=400, detail="kb not found")

    tbl = db.open_table(kb["table"])  # type: ignore
    # Naive retrieval: first top_k rows
    rows = tbl.to_pandas().head(k["top_k"]).to_dict("records")

    # Mock generation output combining retrieved snippets
    context = "\n---\n".join(r.get("text", "")[:400] for r in rows)
    output = f"[mock-model] Prompt: {req.prompt}\n\nContext:\n{context}\n\nAnswer: (Replace with real LLM call)"

    return {"kiff_id": kiff_id, "model": k["model"], "retrieved": rows, "output": output}
