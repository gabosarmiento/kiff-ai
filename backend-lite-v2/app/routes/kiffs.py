from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional
import uuid
import random
import string
import datetime as dt
from sqlalchemy.orm import Session
from app.db_core import SessionLocal
from app.models_kiffs import Kiff as KiffModel, ConversationMessage as MessageModel

router = APIRouter(prefix="/api/kiffs", tags=["kiffs"]) 


def _require_tenant(x_tenant_id: Optional[str]):
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="Tenant not specified")
    return x_tenant_id


def _slugify(name: str) -> str:
    base = "".join(ch.lower() if ch.isalnum() else "-" for ch in name).strip("-")
    suffix = "".join(random.choices(string.ascii_letters + string.digits, k=11))
    return f"kiffs/{base}+{suffix}"


class CreateKiffRequest(BaseModel):
    name: str
    model_id: Optional[str] = None
    user_id: Optional[str] = None


class Kiff(BaseModel):
    id: str
    name: str
    slug: str
    model_id: Optional[str] = None
    created_at: dt.datetime


class ConversationMessage(BaseModel):
    id: str
    role: str
    content: str
    step: Optional[int] = None
    thought: Optional[str] = None
    action_json: Optional[str] = None
    validator: Optional[str] = None
    created_at: str


@router.get("", response_model=List[Kiff])
async def list_kiffs(x_tenant_id: str = Header(None)):
    _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        rows = (
            db.query(KiffModel)
            .filter(KiffModel.tenant_id == x_tenant_id)
            .order_by(KiffModel.created_at.desc())
            .all()
        )
        return [Kiff(id=r.id, name=r.name, slug=r.slug, model_id=r.model_id, created_at=r.created_at) for r in rows]
    finally:
        db.close()


@router.post("", response_model=Kiff)
async def create_kiff(req: CreateKiffRequest, x_tenant_id: str = Header(None)):
    _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        kid = str(uuid.uuid4())
        slug = _slugify(req.name)
        row = KiffModel(
            id=kid,
            tenant_id=x_tenant_id,
            user_id=req.user_id,
            name=req.name,
            slug=slug,
            model_id=req.model_id,
        )
        db.add(row)
        db.commit()
        return Kiff(id=row.id, name=row.name, slug=row.slug, model_id=row.model_id, created_at=row.created_at)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create kiff: {e}")
    finally:
        db.close()


@router.get("/{kiff_id}", response_model=Kiff)
async def get_kiff(kiff_id: str, x_tenant_id: str = Header(None)):
    _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        row = db.query(KiffModel).filter(KiffModel.id == kiff_id, KiffModel.tenant_id == x_tenant_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="kiff not found")
        return Kiff(id=row.id, name=row.name, slug=row.slug, model_id=row.model_id, created_at=row.created_at)
    finally:
        db.close()


@router.get("/{kiff_id}/messages", response_model=List[ConversationMessage])
async def list_kiff_messages(kiff_id: str, x_tenant_id: str = Header(None)):
    _require_tenant(x_tenant_id)
    db: Session = SessionLocal()
    try:
        k = db.query(KiffModel).filter(KiffModel.id == kiff_id, KiffModel.tenant_id == x_tenant_id).first()
        if not k:
            raise HTTPException(status_code=404, detail="kiff not found")
        msgs = (
            db.query(MessageModel)
            .filter(MessageModel.kiff_id == kiff_id, MessageModel.tenant_id == x_tenant_id)
            .order_by(MessageModel.created_at.asc())
            .all()
        )
        out: List[ConversationMessage] = []
        for m in msgs:
            out.append(
                ConversationMessage(
                    id=m.id,
                    role=m.role,
                    content=m.content,
                    step=m.step,
                    thought=m.thought,
                    action_json=m.action_json,
                    validator=m.validator,
                    created_at=m.created_at.isoformat(),
                )
            )
        return out
    finally:
        db.close()
