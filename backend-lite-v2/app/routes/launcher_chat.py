from __future__ import annotations
import os
import uuid
import datetime as dt
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db_core import SessionLocal
from ..models_kiffs import Kiff, ConversationMessage, KiffChatSession
from ..services.launcher_agent import get_launcher_agent, AgentRunResult

router = APIRouter(prefix="/api/chat", tags=["launcher_chat"]) 

DEFAULT_TENANT_FALLBACK = os.getenv("DEFAULT_TENANT_ID", "4485db48-71b7-47b0-8128-c6dca5be352d")


class ToolCall(BaseModel):
    function: Dict[str, Any]


class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None
    metadata: Optional[Dict[str, Any]] = None


class SendMessageRequest(BaseModel):
    message: str
    chat_history: List[ChatMessage] = []
    user_id: Optional[str] = None
    kiff_id: Optional[str] = None
    session_id: Optional[str] = None


class SendMessageResponse(BaseModel):
    content: str
    tool_calls: Optional[List[ToolCall]] = None
    kiff_update: Optional[Dict[str, Any]] = None
    relevant_context: Optional[List[str]] = None
    session_id: str


class LoadSessionRequest(BaseModel):
    kiff_id: str


class LoadSessionResponse(BaseModel):
    session_id: str
    messages: List[ChatMessage]


class SaveSessionRequest(BaseModel):
    session_id: str
    agent_state: Dict[str, Any]


# --- Dependencies ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _tenant_id_from_request(request: Request) -> str:
    # Enforce exact header name per recurring issue
    tenant_id = request.headers.get("X-Tenant-ID")
    if not tenant_id:
        # Fallback to default to avoid UX breakage unless strictness required
        tenant_id = DEFAULT_TENANT_FALLBACK
    return tenant_id


# --- Routes ---

@router.post("/send-message", response_model=SendMessageResponse)
async def send_message(req: SendMessageRequest, request: Request, db: Session = Depends(get_db)):
    tenant_id = _tenant_id_from_request(request)

    # Ensure kiff exists or create a temp placeholder if none
    kiff_id: Optional[str] = None
    if req.kiff_id:
        k = db.query(Kiff).filter(Kiff.id == req.kiff_id, Kiff.tenant_id == tenant_id).first()
        if not k:
            raise HTTPException(status_code=404, detail="Kiff not found")
        kiff_id = k.id
    else:
        # Create a lightweight placeholder kiff to bind the session
        placeholder_kiff = Kiff(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            user_id=req.user_id,
            name="Untitled Kiff",
            slug=f"kiff-{uuid.uuid4().hex[:8]}",
            model_id=None,
            created_at=dt.datetime.utcnow(),
        )
        db.add(placeholder_kiff)
        db.flush()
        kiff_id = placeholder_kiff.id

    # Ensure session
    session: Optional[KiffChatSession] = None
    if req.session_id:
        session = db.query(KiffChatSession).filter(
            KiffChatSession.id == req.session_id,
            KiffChatSession.tenant_id == tenant_id
        ).first()
    if not session:
        # Create new session bound to the resolved kiff_id
        session = KiffChatSession(
            id=str(uuid.uuid4()),
            kiff_id=kiff_id,
            tenant_id=tenant_id,
            user_id=req.user_id,
            agent_state=None,
            created_at=dt.datetime.utcnow(),
            updated_at=dt.datetime.utcnow(),
        )
        db.add(session)
        db.flush()

    # Prepare enhanced message and run agent with session context
    agent = get_launcher_agent(session_id=session.id)
    # Extract selected packs from session agent_state when present
    selected_packs: List[str] = []
    try:
        state = session.agent_state or {}
        if isinstance(state, str):
            import json as _json
            state = _json.loads(state)
        maybe_packs = (state or {}).get("selected_packs")
        if isinstance(maybe_packs, list):
            selected_packs = [str(p) for p in maybe_packs][:5]
    except Exception:
        selected_packs = []

    run: AgentRunResult = await agent.run(
        message=req.message,
        chat_history=[m.dict() for m in req.chat_history],
        tenant_id=tenant_id,
        kiff_id=session.kiff_id,
        selected_packs=selected_packs,
    )

    # Persist conversation messages
    now = dt.datetime.utcnow()
    user_msg = ConversationMessage(
        id=str(uuid.uuid4()),
        kiff_id=session.kiff_id,
        tenant_id=tenant_id,
        user_id=req.user_id,
        session_id=session.id,
        role="user",
        content=req.message,
        created_at=now,
    )
    asst_msg = ConversationMessage(
        id=str(uuid.uuid4()),
        kiff_id=session.kiff_id,
        tenant_id=tenant_id,
        user_id=req.user_id,
        session_id=session.id,
        role="assistant",
        content=run.content,
        action_json=(run.action_json or None),
        created_at=now,
    )
    db.add_all([user_msg, asst_msg])
    db.commit()

    return SendMessageResponse(
        content=run.content,
        tool_calls=run.tool_calls,
        kiff_update=run.kiff_update,
        relevant_context=run.relevant_context,
        session_id=session.id,
    )


@router.post("/load-session", response_model=LoadSessionResponse)
async def load_session(req: LoadSessionRequest, request: Request, db: Session = Depends(get_db)):
    tenant_id = _tenant_id_from_request(request)
    session = (
        db.query(KiffChatSession)
        .filter(KiffChatSession.kiff_id == req.kiff_id, KiffChatSession.tenant_id == tenant_id)
        .order_by(KiffChatSession.created_at.desc())
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="No session found for kiff")

    msgs = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.session_id == session.id, ConversationMessage.tenant_id == tenant_id)
        .order_by(ConversationMessage.created_at.asc())
        .all()
    )
    out: List[ChatMessage] = []
    for m in msgs:
        out.append(ChatMessage(role=m.role, content=m.content, timestamp=m.created_at.isoformat()))
    return LoadSessionResponse(session_id=session.id, messages=out)


@router.post("/save-session")
async def save_session(req: SaveSessionRequest, request: Request, db: Session = Depends(get_db)):
    tenant_id = _tenant_id_from_request(request)
    session = db.query(KiffChatSession).filter(
        KiffChatSession.id == req.session_id,
        KiffChatSession.tenant_id == tenant_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.agent_state = req.agent_state
    session.updated_at = dt.datetime.utcnow()
    db.add(session)
    db.commit()
    return {"status": "ok"}
