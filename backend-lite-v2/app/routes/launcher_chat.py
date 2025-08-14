from __future__ import annotations
import os
import uuid
import datetime as dt
import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db_core import SessionLocal
from ..models_kiffs import Kiff, ConversationMessage, KiffChatSession
from ..services.launcher_agent import get_launcher_agent, AgentRunResult
from ..util.preview_store import PreviewStore
from ..util.sandbox_e2b import E2BProvider, E2BUnavailable

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
    model_id: Optional[str] = None
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


class ProposalActionRequest(BaseModel):
    session_id: str
    proposal_id: str


class HitlToggleRequest(BaseModel):
    session_id: str
    require_approval: bool


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
        # default HITL on
        try:
            session.agent_state = {"require_approval": True}
            db.add(session)
            db.flush()
        except Exception:
            pass

    # Determine model for this run (request override -> session state -> default)
    effective_model_id: Optional[str] = None
    if req.model_id:
        effective_model_id = req.model_id
    else:
        try:
            state0 = session.agent_state or {}
            if isinstance(state0, str):
                import json as _json
                state0 = _json.loads(state0)
            effective_model_id = (state0 or {}).get("model_id")
        except Exception:
            effective_model_id = None

    # Persist model override into session state if provided
    try:
        if req.model_id:
            state = session.agent_state or {}
            if isinstance(state, str):
                import json as _json
                state = _json.loads(state)
            if not isinstance(state, dict):
                state = {}
            state["model_id"] = req.model_id
            session.agent_state = state
            db.add(session)
            db.flush()
    except Exception:
        pass

    # Prepare enhanced message and run agent with session context
    agent = get_launcher_agent(session_id=session.id, model_id=effective_model_id)
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

    # Ensure HITL approval flag set on launcher_agent module for this run
    try:
        import app.services.launcher_agent as _launcher_agent_mod  # type: ignore
        _state = session.agent_state or {}
        if isinstance(_state, str):
            import json as _json
            _state = _json.loads(_state)
        require_approval = bool((_state or {}).get("require_approval", True))
        _launcher_agent_mod._REQUIRE_APPROVAL = require_approval  # type: ignore[attr-defined]
        _launcher_agent_mod._CURRENT_TENANT_ID = tenant_id  # ensure tenant context as well
    except Exception:
        pass

    run: AgentRunResult = await agent.run(
        message=req.message,
        chat_history=[m.dict() for m in req.chat_history],
        tenant_id=tenant_id,
        kiff_id=session.kiff_id,
        selected_packs=selected_packs,
    )

    # Persist conversation messages
    now = dt.datetime.utcnow()
    # Count existing messages BEFORE inserting new ones to detect first turn
    existing_count = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.session_id == session.id, ConversationMessage.tenant_id == tenant_id)
        .count()
    )
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
    # If this is the first message in this session, mark chat_active in agent_state
    if existing_count == 0:
        # Parse and update agent_state.chat_active
        import json as _json
        state = {}
        try:
            raw = session.agent_state or {}
            if isinstance(raw, str):
                state = _json.loads(raw) if raw else {}
            elif isinstance(raw, dict):
                state = raw
        except Exception:
            state = {}
        state["chat_active"] = True
        session.agent_state = state
        session.updated_at = now
        db.add(session)

    db.commit()

    return SendMessageResponse(
        content=run.content,
        tool_calls=run.tool_calls,
        kiff_update=run.kiff_update,
        relevant_context=run.relevant_context,
        session_id=session.id,
    )


@router.post("/stream-message")
async def stream_message(req: SendMessageRequest, request: Request, db: Session = Depends(get_db)):
    """Stream agent response as SSE tokens using AGNO streaming.
    Preserves tenant scoping and persists the conversation after completion.
    """
    tenant_id = _tenant_id_from_request(request)

    # Ensure kiff exists or create placeholder
    kiff_id: Optional[str] = None
    if req.kiff_id:
        k = db.query(Kiff).filter(Kiff.id == req.kiff_id, Kiff.tenant_id == tenant_id).first()
        if not k:
            raise HTTPException(status_code=404, detail="Kiff not found")
        kiff_id = k.id
    else:
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
            KiffChatSession.tenant_id == tenant_id,
        ).first()
    if not session:
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

    # Resolve model
    effective_model_id: Optional[str] = None
    if req.model_id:
        effective_model_id = req.model_id
    else:
        try:
            state0 = session.agent_state or {}
            if isinstance(state0, str):
                import json as _json
                state0 = _json.loads(state0)
            effective_model_id = (state0 or {}).get("model_id")
        except Exception:
            effective_model_id = None
    agent = get_launcher_agent(session_id=session.id, model_id=effective_model_id)

    # Extract selected packs from session agent_state
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

    # Build prompt similarly to LauncherAgent.run
    context_lines = []
    for m in req.chat_history[-10:]:
        role = getattr(m, "role", None) or (isinstance(m, dict) and m.get("role")) or "user"
        content = getattr(m, "content", None) or (isinstance(m, dict) and m.get("content")) or ""
        context_lines.append(f"{role.upper()}: {content}")
    context_text = "\n".join(context_lines)
    prompt = (
        f"Tenant: {tenant_id}\nKiff: {session.kiff_id}\n"
        f"Selected Packs: {', '.join(selected_packs or [])}\n"
        "You are assisting the user to define and iteratively build a 'kiff' (project).\n"
        "Ask clarifying questions when needed and propose concrete file additions or changes.\n"
        "When knowledge is present, cite patterns; otherwise proceed with best practices.\n\n"
        f"Chat so far:\n{context_text}\n\nUser: {req.message}"
    )

    # Set tenant/pack context for tools and knowledge
    try:
        # Attributes on the LauncherAgent instance (used by knowledge tool)
        setattr(agent, "_current_tenant_id", tenant_id)
        setattr(agent, "_current_pack_ids", selected_packs or [])
        # Module-level tenant used by file tools inside launcher_agent
        try:
            import app.services.launcher_agent as _launcher_agent_mod  # type: ignore
            _launcher_agent_mod._CURRENT_TENANT_ID = tenant_id  # type: ignore[attr-defined]
            # Set HITL require-approval flag from session state (default True)
            try:
                _state = session.agent_state or {}
                if isinstance(_state, str):
                    import json as _json
                    _state = _json.loads(_state)
                _launcher_agent_mod._REQUIRE_APPROVAL = bool((_state or {}).get("require_approval", True))  # type: ignore[attr-defined]
            except Exception:
                pass
        except Exception:
            pass
    except Exception:
        pass

    async def event_generator():
        """Yield SSE data lines while accumulating final content to persist."""
        final_content_parts: List[str] = []
        final_tool_calls: List[Dict[str, Any]] = []
        ended = False
        try:
            if getattr(agent, "agent", None) is None:
                # AGNO unavailable, send minimal fallback
                msg = "[launcher] Streaming not available: AGNO not initialized"
                yield f"data: {{\"token\": {msg!r} }}\n\n"
                return

            agen = agent.agent  # underlying AGNO agent
            # Prefer async streaming; fallback to sync iterator if needed
            stream = None
            try:
                stream = await agen.arun(prompt, stream=True)  # type: ignore
                is_async = True
            except TypeError:
                # arun may return non-awaitable iterator for some versions
                stream = agen.run(prompt, stream=True)  # type: ignore
                is_async = False

            async def handle_event(ev: Any):
                etype = getattr(ev, "event", None) or (isinstance(ev, dict) and ev.get("event"))
                if etype == "RunResponseContent":
                    chunk = getattr(ev, "content", None) or (isinstance(ev, dict) and ev.get("content")) or ""
                    if chunk:
                        final_content_parts.append(str(chunk))
                        yield f"data: {{\"token\": {str(chunk)!r} }}\n\n"
                elif etype == "ToolCallCompleted":
                    # Collect minimal tool call info for final summary
                    tool = getattr(ev, "tool", None) or (isinstance(ev, dict) and ev.get("tool"))
                    result = getattr(ev, "result", None) or (isinstance(ev, dict) and ev.get("result"))
                    args = getattr(ev, "args", None) or (isinstance(ev, dict) and ev.get("args"))
                    final_tool_calls.append({"tool": tool, "result": result, "args": args})
                    # Forward proposal events when tool returns PROPOSAL payload
                    try:
                        if isinstance(result, str) and result.startswith("PROPOSAL:"):
                            payload = result[len("PROPOSAL:"):]
                            data = json.loads(payload)
                            evt = {"type": "ProposedFileChanges", "proposal_id": data.get("proposal_id"), "changes": data.get("changes", [])}
                            yield f"data: {json.dumps(evt)}\n\n"
                    except Exception:
                        pass
                elif etype == "RunCompleted":
                    # Emit final structured summary before DONE to satisfy frontend onDone()
                    try:
                        summary = {"session_id": session.id, "tool_calls": final_tool_calls}
                        yield f"data: {json.dumps(summary)}\n\n"
                    except Exception:
                        pass
                    yield "data: [DONE]\n\n"
                elif etype == "RunError":
                    err = getattr(ev, "content", None) or (isinstance(ev, dict) and ev.get("content")) or "error"
                    yield f"data: {{\"error\": {str(err)!r} }}\n\n"
                # Optionally expose tool events in the future

            if is_async:
                async for ev in stream:  # type: ignore
                    async for line in handle_event(ev):
                        yield line
            else:
                for ev in stream:  # type: ignore
                    # Use a small async wrapper to reuse handle_event
                    async for line in handle_event(ev):
                        yield line
            # If the provider didn't send an explicit RunCompleted, still emit a summary+DONE
            try:
                summary = {"session_id": session.id, "tool_calls": final_tool_calls}
                yield f"data: {json.dumps(summary)}\n\n"
            except Exception:
                pass
            yield "data: [DONE]\n\n"
            ended = True
        except Exception as e:
            yield f"data: {{\"error\": {str(e)!r} }}\n\n"
        finally:
            # Reset tenant context after the run
            try:
                setattr(agent, "_current_tenant_id", None)
                setattr(agent, "_current_pack_ids", None)
                try:
                    import app.services.launcher_agent as _launcher_agent_mod  # type: ignore
                    _launcher_agent_mod._CURRENT_TENANT_ID = "default"  # type: ignore[attr-defined]
                except Exception:
                    pass
            except Exception:
                pass

            # Persist messages if we produced any output
            try:
                final_text = "".join(final_content_parts).strip()
                if final_text:
                    now = dt.datetime.utcnow()
                    existing_count = (
                        db.query(ConversationMessage)
                        .filter(ConversationMessage.session_id == session.id, ConversationMessage.tenant_id == tenant_id)
                        .count()
                    )
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
                        content=final_text,
                        created_at=now,
                    )
                    db.add_all([user_msg, asst_msg])
                    if existing_count == 0:
                        import json as _json
                        state = {}
                        try:
                            raw = session.agent_state or {}
                            if isinstance(raw, str):
                                state = _json.loads(raw) if raw else {}
                            elif isinstance(raw, dict):
                                state = raw
                        except Exception:
                            state = {}
                        state["chat_active"] = True
                        session.agent_state = state
                        session.updated_at = now
                        db.add(session)
                    db.commit()
            except Exception:
                # Do not break the stream termination on persistence errors
                pass

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  # for nginx
    }
    return StreamingResponse(event_generator(), headers=headers, media_type="text/event-stream")


@router.post("/proposals/approve")
async def approve_proposal(req: ProposalActionRequest, request: Request):
    tenant_id = _tenant_id_from_request(request)
    # Load session from PreviewStore (proposal storage lives there)
    table = os.getenv("DYNAMO_TABLE_PREVIEW_SESSIONS") or "preview_sessions"
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "eu-west-3"
    store = PreviewStore(table_name=table, region_name=region)
    sess = store.get_session(tenant_id, req.session_id) or {}
    proposals = list(sess.get("pending_proposals") or [])
    proposal = next((p for p in proposals if p.get("id") == req.proposal_id), None)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    changes = proposal.get("changes") or []

    # Apply to E2B and update files in PreviewStore
    sandbox_id = (sess or {}).get("sandbox_id")
    if not sandbox_id:
        raise HTTPException(status_code=400, detail="No sandbox for session")
    try:
        provider = E2BProvider()
        files_payload = [{"path": c.get("path"), "content": c.get("new_content", "")} for c in changes]
        provider.apply_files(sandbox_id=sandbox_id, files=files_payload)
    except E2BUnavailable:
        # ignore in mock mode
        pass

    files = list(sess.get("files") or [])
    for change in changes:
        path = change.get("path")
        new_content = change.get("new_content", "")
        found = False
        for i, f in enumerate(files):
            if isinstance(f, dict) and f.get("path") == path:
                files[i] = {"path": path, "content": new_content, "language": f.get("language")}
                found = True
                break
        if not found:
            files.append({"path": path, "content": new_content})
    # remove proposal
    proposals = [p for p in proposals if p.get("id") != req.proposal_id]
    sess["files"] = files
    sess["pending_proposals"] = proposals
    store.update_session_fields(tenant_id, req.session_id, {"files": files, "pending_proposals": proposals})
    return {"status": "ok", "applied": len(changes), "files_count": len(files)}


@router.post("/proposals/reject")
async def reject_proposal(req: ProposalActionRequest, request: Request):
    tenant_id = _tenant_id_from_request(request)
    table = os.getenv("DYNAMO_TABLE_PREVIEW_SESSIONS") or "preview_sessions"
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "eu-west-3"
    store = PreviewStore(table_name=table, region_name=region)
    sess = store.get_session(tenant_id, req.session_id) or {}
    proposals = list(sess.get("pending_proposals") or [])
    exists = any(p for p in proposals if p.get("id") == req.proposal_id)
    if not exists:
        raise HTTPException(status_code=404, detail="Proposal not found")
    proposals = [p for p in proposals if p.get("id") != req.proposal_id]
    sess["pending_proposals"] = proposals
    store.update_session_fields(tenant_id, req.session_id, {"pending_proposals": proposals})
    return {"status": "ok"}


@router.post("/hitl/toggle")
async def toggle_hitl(req: HitlToggleRequest, request: Request, db: Session = Depends(get_db)):
    tenant_id = _tenant_id_from_request(request)
    session = db.query(KiffChatSession).filter(
        KiffChatSession.id == req.session_id,
        KiffChatSession.tenant_id == tenant_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    # update session.agent_state.require_approval
    try:
        state = session.agent_state or {}
        if isinstance(state, str):
            import json as _json
            state = _json.loads(state)
        if not isinstance(state, dict):
            state = {}
        state["require_approval"] = bool(req.require_approval)
        session.agent_state = state
        session.updated_at = dt.datetime.utcnow()
        db.add(session)
        db.commit()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update HITL toggle")
    return {"status": "ok", "require_approval": bool(req.require_approval)}


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
