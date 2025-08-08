from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from ..state.memory import STORE, JobResult, FileInfo, now_ts
import uuid

router = APIRouter()


class GenerateRequest(BaseModel):
    user_request: str
    model: str | None = "kimi-k2"
    knowledge_sources: list[str] | None = None
    stream: bool = False  # non-stream baseline; SSE could be added later


@router.post("/generate")
async def generate(req: GenerateRequest, request: Request):
    tenant_id: str = getattr(request.state, "tenant_id")

    # Minimal fake generation: create a tiny project with 3 files based on request
    job_id = str(uuid.uuid4())

    files = [
        FileInfo(path="README.md", content=f"# App generated\n\nRequest: {req.user_request}\nModel: {req.model}", language="markdown"),
        FileInfo(path="app/main.py", content=(
            "from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get('/')\n"
            "async def root():\n    return {'hello': 'world'}\n"
        ), language="python"),
        FileInfo(path=".gitignore", content="__pycache__/\n.env\n", language="text"),
    ]

    result = JobResult(
        id=job_id,
        tenant_id=tenant_id,
        status="completed",
        created_at=now_ts(),
        files=files,
    )
    STORE.save_job(result)

    return {
        "id": job_id,
        "status": result.status,
        "files": [f.__dict__ for f in files],
    }
