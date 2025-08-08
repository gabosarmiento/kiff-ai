from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel, EmailStr
import os

from ..state.users import get_user, create_user
from ..util.session import encode_session, make_cookie, clear_cookie

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECURE_COOKIES = os.getenv("SECURE_COOKIES", "false").lower() == "true"


class LoginBody(BaseModel):
    email: EmailStr
    password: str
    tenant_id: Optional[str] = None  # optional hint from UI


class SignupBody(BaseModel):
    email: EmailStr
    password: str
    role: Optional[str] = None  # default user
    tenant_id: Optional[str] = None


class Profile(BaseModel):
    email: EmailStr
    role: str
    tenant_id: str


@router.post("/login", response_model=Profile)
async def login(req: Request, res: Response, body: LoginBody):
    user = get_user(body.email)
    if not user or user.password != body.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Resolve tenant: body.tenant_id > header/session (set by middleware) > default in middleware
    tenant_id = body.tenant_id or getattr(req.state, "tenant_id", None)
    if not tenant_id:
        # fallback defensive: allow login even if tenant missing
        tenant_id = os.getenv("DEFAULT_TENANT_ID", "4485db48-71b7-47b0-8128-c6dca5be352d")

    token = encode_session({
        "sub": user.email,
        "role": user.role,
        "tenant_id": tenant_id,
    })
    cookie = make_cookie(token, secure=SECURE_COOKIES)
    res.set_cookie(**cookie)
    return Profile(email=user.email, role=user.role, tenant_id=tenant_id)


@router.post("/signup", response_model=Profile)
async def signup(req: Request, res: Response, body: SignupBody):
    role = body.role or "user"
    user = get_user(body.email)
    if not user:
        user = create_user(body.email, body.password, role)

    tenant_id = body.tenant_id or getattr(req.state, "tenant_id", None)
    if not tenant_id:
        tenant_id = os.getenv("DEFAULT_TENANT_ID", "4485db48-71b7-47b0-8128-c6dca5be352d")

    token = encode_session({
        "sub": user.email,
        "role": user.role,
        "tenant_id": tenant_id,
    })
    cookie = make_cookie(token, secure=SECURE_COOKIES)
    res.set_cookie(**cookie)
    return Profile(email=user.email, role=user.role, tenant_id=tenant_id)


@router.post("/logout")
async def logout(res: Response):
    res.set_cookie(**clear_cookie())
    return {"ok": True}


@router.get("/me", response_model=Profile)
async def me(req: Request):
    # Expect middleware to attach tenant even if header missing
    tenant_id = getattr(req.state, "tenant_id", None) or os.getenv("DEFAULT_TENANT_ID", "4485db48-71b7-47b0-8128-c6dca5be352d")
    # We don't decode cookie here; the middleware doesn't decode the user. In a real app, verify session.
    # For mock, we simply reflect a profile if a cookie exists; otherwise 401
    session_cookie = req.cookies.get(os.getenv("SESSION_COOKIE_NAME", "session"))
    if not session_cookie:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # Lightweight decode to extract email/role
    from ..util.session import decode_session
    data = decode_session(session_cookie)
    if not data:
        raise HTTPException(status_code=401, detail="Invalid session")
    return Profile(email=data.get("sub"), role=data.get("role", "user"), tenant_id=str(data.get("tenant_id") or tenant_id))
