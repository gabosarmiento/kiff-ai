from fastapi import APIRouter, Request
from ..state.memory import STORE

router = APIRouter()


@router.delete("/account")
async def delete_account(request: Request):
    tenant_id: str = getattr(request.state, "tenant_id")
    removed = STORE.clear_tenant(tenant_id)
    return {"ok": True, "removed_jobs": removed}
