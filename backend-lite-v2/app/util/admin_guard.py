from __future__ import annotations
from typing import Optional
from fastapi import Request, HTTPException
from .session import decode_session, SESSION_COOKIE_NAME

ADMIN_ROLE = "admin"


def require_admin(req: Request):
    token = req.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    data = decode_session(token)
    if not data:
        raise HTTPException(status_code=401, detail="Invalid session")
    role = str(data.get("role") or "user").lower()
    if role != ADMIN_ROLE:
        raise HTTPException(status_code=403, detail="Admin only")
    return data  # includes email and tenant_id
