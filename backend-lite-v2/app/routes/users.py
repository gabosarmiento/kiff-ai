from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import List

from ..state.users import get_user, create_user
from ..state import users as users_state

router = APIRouter(prefix="/api/users", tags=["users"]) 


class UserOut(BaseModel):
    email: EmailStr
    role: str


class CreateUserBody(BaseModel):
    email: EmailStr
    password: str
    role: str = "user"


class UpdateRoleBody(BaseModel):
    role: str


@router.get("/", response_model=List[UserOut])
async def list_users():
    # Expose users from in-memory store (mock)
    items: list[UserOut] = []
    for u in users_state._USERS.values():  # type: ignore[attr-defined]
        items.append(UserOut(email=u.email, role=u.role))
    return items


@router.post("/", response_model=UserOut)
async def create_user_route(body: CreateUserBody):
    u = get_user(body.email)
    if not u:
        u = create_user(body.email, body.password, body.role)
    return UserOut(email=u.email, role=u.role)


@router.put("/{email}/role", response_model=UserOut)
async def update_user_role(email: str, body: UpdateRoleBody):
    u = get_user(email)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Invalid role")
    u.role = body.role
    return UserOut(email=u.email, role=u.role)
