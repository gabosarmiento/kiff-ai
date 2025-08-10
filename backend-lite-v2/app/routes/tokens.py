from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..state.tokens import TOKENS, record_consumption
from ..util.session import get_session_from_request

router = APIRouter(prefix="/tokens", tags=["tokens"])


class ConsumeRequest(BaseModel):
    user_key: Optional[str] = None  # Defaults to session email if absent
    tokens: int
    model: Optional[str] = None
    action: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    meta: Optional[dict] = None


@router.post("/consume")
async def consume(req: ConsumeRequest, request: Request):
    tenant_id: str = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant not specified")

    sess = get_session_from_request(dict(request.headers), request.cookies)
    user_key = (req.user_key or (sess or {}).get("email") or "anonymous").lower()

    ev = record_consumption(
        tenant_id,
        user_key=user_key,
        tokens=req.tokens,
        model=req.model,
        action=req.action,
        input_tokens=req.input_tokens,
        output_tokens=req.output_tokens,
        meta=req.meta,
    )
    # Return updated balance as well
    balances = TOKENS.list_balances(tenant_id, user_key=user_key)
    balance = balances[0] if balances else None
    return {
        "event": ev.__dict__,
        "balance": balance.__dict__ if balance else None,
        "usd_per_1k": TOKENS.get_pricing(),
    }


@router.get("/balance")
async def balance(request: Request, user_key: Optional[str] = None):
    tenant_id: str = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant not specified")
    balances = TOKENS.list_balances(tenant_id, user_key=user_key)
    return {
        "balances": [b.__dict__ for b in balances],
        "usd_per_1k": TOKENS.get_pricing(),
    }


@router.get("/events")
async def events(request: Request, user_key: Optional[str] = None, limit: int = 100):
    tenant_id: str = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant not specified")
    evs = TOKENS.list_events(tenant_id, user_key=user_key, limit=limit)
    return {
        "events": [e.__dict__ for e in evs],
        "count": len(evs),
    }


class PricingUpdate(BaseModel):
    usd_per_1k: float


@router.get("/pricing")
async def get_pricing():
    return {"usd_per_1k": TOKENS.get_pricing()}


@router.post("/pricing")
async def set_pricing(p: PricingUpdate):
    # Note: Consider protecting this to admin only in the future
    if p.usd_per_1k <= 0:
        raise HTTPException(status_code=400, detail="usd_per_1k must be > 0")
    TOKENS.set_pricing(p.usd_per_1k)
    return {"usd_per_1k": TOKENS.get_pricing()}
