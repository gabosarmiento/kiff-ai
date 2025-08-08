from fastapi import APIRouter

router = APIRouter()


@router.get("/status")
async def status():
    return {"status": "ready", "service": "backend-lite-v2"}
