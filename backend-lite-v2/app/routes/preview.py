from fastapi import APIRouter, HTTPException
from ..state.memory import STORE

router = APIRouter()


@router.get("/preview/{job_id}")
async def preview(job_id: str):
    job = STORE.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "completed":
        return {"id": job_id, "status": job.status}
    return {
        "id": job_id,
        "status": job.status,
        "files": [f.__dict__ for f in job.files],
    }
