from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import List
from sqlalchemy.orm import Session

from ..db_core import SessionLocal
from ..models_kiffs import User as UserModel

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
    db: Session = SessionLocal()
    try:
        users = db.query(UserModel).all()
        return [UserOut(email=u.email, role=u.role) for u in users]
    finally:
        db.close()


@router.post("/", response_model=UserOut)
async def create_user_route(body: CreateUserBody):
    db: Session = SessionLocal()
    try:
        existing = db.query(UserModel).filter(UserModel.email == body.email.lower()).first()
        if existing:
            return UserOut(email=existing.email, role=existing.role)
        
        user = UserModel(
            email=body.email.lower(),
            password=body.password,
            role=body.role
        )
        db.add(user)
        db.commit()
        return UserOut(email=user.email, role=user.role)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create user: {e}")
    finally:
        db.close()


@router.put("/{email}/role", response_model=UserOut)
async def update_user_role(email: str, body: UpdateRoleBody):
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Invalid role")
    
    db: Session = SessionLocal()
    try:
        user = db.query(UserModel).filter(UserModel.email == email.lower()).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user.role = body.role
        db.commit()
        return UserOut(email=user.email, role=user.role)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update user: {e}")
    finally:
        db.close()
