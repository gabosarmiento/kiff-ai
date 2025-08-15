from __future__ import annotations
import os
import uuid
import datetime as dt
import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db_core import SessionLocal
from ..models_kiffs import Kiff, KiffChatSession, ConversationMessage

# Optional imports for AGNO
try:
    from agno.agent import Agent
    from agno.models.groq import Groq
    _HAS_AGNO = True
except Exception:
    Agent = None
    Groq = None
    _HAS_AGNO = False

router = APIRouter(prefix="/api/launcher", tags=["launcher_project"]) 

DEFAULT_TENANT_FALLBACK = os.getenv("DEFAULT_TENANT_ID", "4485db48-71b7-47b0-8128-c6dca5be352d")


class GenerateRequest(BaseModel):
    session_id: Optional[str] = None
    idea: str
    selected_packs: Optional[List[str]] = None
    user_id: Optional[str] = None
    kiff_id: Optional[str] = None


class FileSpec(BaseModel):
    path: str
    content: str
    language: Optional[str] = None


class GenerateResponse(BaseModel):
    session_id: str
    files: List[FileSpec]
    kiff_id: str


class UpdateSessionPacksRequest(BaseModel):
    selected_packs: List[str]


# --- Dependencies ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _tenant_id_from_request(request: Request) -> str:
    tenant_id = request.headers.get("X-Tenant-ID")
    if not tenant_id:
        tenant_id = DEFAULT_TENANT_FALLBACK
    return tenant_id


# --- Helpers ---

async def _generate_project_files(idea: str, packs: List[str], tenant_id: str) -> tuple[List[Dict[str, str]], str]:
    """Generate project files using AGNO agent based on user's idea and selected packs."""
    if not _HAS_AGNO:
        raise HTTPException(status_code=503, detail="Project generation requires AGNO framework")
    
    # Create agent for project generation
    model = Groq(id="llama-3.3-70b-versatile")
    agent = Agent(
        model=model,
        instructions=[
            "You are an expert project generator that creates complete, production-ready projects.",
            "Analyze the user's idea and generate appropriate files based on the technology they request.",
            "Generate complete, working code with proper error handling and best practices.",
            "Always include a README.md explaining how to run the project.",
            "Format your response as a JSON object with 'files' array containing objects with 'path', 'content', and 'language' fields."
        ],
        show_tool_calls=True,
        markdown=True,
        debug_mode=True
    )
    
    # Prepare context about selected packs
    pack_context = ""
    if packs:
        pack_context = f"\n\nSelected Kiff Packs: {', '.join(packs)}\nIntegrate these APIs/services if relevant to the project."
    
    prompt = f"""Create a complete project for this idea: "{idea}"{pack_context}

Generate all necessary files with complete, working code. Respond with a JSON object in this exact format:

{{
  "files": [
    {{"path": "filename.ext", "content": "file content here", "language": "python|javascript|html|css|json|markdown|typescript"}},
    ...
  ]
}}

Make sure the project is complete and runnable. Include proper dependencies, configuration files, and documentation."""

    response = await agent.arun(prompt)
    response_text = response.content if hasattr(response, 'content') else str(response)
    
    # Parse JSON response
    try:
        # Extract JSON from the response
        start_idx = response_text.find('{')
        end_idx = response_text.rfind('}') + 1
        if start_idx != -1 and end_idx > start_idx:
            json_str = response_text[start_idx:end_idx]
            parsed = json.loads(json_str)
            if 'files' in parsed and isinstance(parsed['files'], list):
                # Create a user-friendly response showing what was generated
                files = parsed['files']
                file_list = [f"- {f['path']}" for f in files[:10]]  # Show first 10 files
                agent_response = f"""I've generated a complete project for your idea: "{idea}"

Created {len(files)} files:
{chr(10).join(file_list)}
{f'... and {len(files) - 10} more files' if len(files) > 10 else ''}

The project is ready to run! You can see the files in the Files panel and the live preview on the right. Feel free to ask me to modify anything or add new features."""
                
                return files, agent_response
    except (json.JSONDecodeError, ValueError) as e:
        print(f"Failed to parse agent response as JSON: {e}")
        print(f"Response was: {response_text[:500]}...")
        raise HTTPException(status_code=500, detail="Failed to parse agent response")
    
    raise HTTPException(status_code=500, detail="Agent failed to generate valid project files")


def _basic_vite_app_files(app_name: str, idea: str, packs: List[str]) -> List[Dict[str, str]]:
    """Minimal Vite + React + TS app configured for port 5173."""
    files: List[Dict[str, str]] = []

    package_json = {
        "name": app_name,
        "private": True,
        "version": "0.1.0",
        "type": "module",
        "scripts": {
            "dev": "vite --host 0.0.0.0 --port 5173",
            "build": "tsc -b && vite build",
            "preview": "vite preview --host 0.0.0.0 --port 5173"
        },
        "dependencies": {
            "react": "18.3.1",
            "react-dom": "18.3.1"
        },
        "devDependencies": {
            "vite": "5.2.0",
            "@vitejs/plugin-react": "4.2.1",
            "typescript": "5.5.2",
            "@types/react": "18.3.3",
            "@types/react-dom": "18.3.0"
        }
    }

    files.append({
        "path": "package.json",
        "content": __import__("json").dumps(package_json, indent=2),
        "language": "json"
    })

    vite_config = """
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 }
})
"""
    files.append({
        "path": "vite.config.ts",
        "content": vite_config.strip() + "\n",
        "language": "typescript"
    })

    tsconfig = {
        "compilerOptions": {
            "target": "ES2020",
            "useDefineForClassFields": True,
            "lib": ["ES2020", "DOM", "DOM.Iterable"],
            "module": "ESNext",
            "skipLibCheck": True,
            "jsx": "react-jsx",
            "moduleResolution": "bundler",
            "resolveJsonModule": True,
            "isolatedModules": True,
            "noEmit": True,
            "esModuleInterop": True,
            "forceConsistentCasingInFileNames": True,
            "strict": True
        },
        "include": ["src"]
    }
    files.append({
        "path": "tsconfig.json",
        "content": __import__("json").dumps(tsconfig, indent=2),
        "language": "json"
    })

    index_html = f"""
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{app_name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"""
    files.append({
        "path": "index.html",
        "content": index_html,
        "language": "html"
    })

    app_tsx = f"""
import React from 'react'

export default function App() {{
  return (
    <main style={{ padding: 24, fontFamily: 'Inter, system-ui, -apple-system' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>Kiff Launcher App</h1>
      <p style={{ marginBottom: 16 }}>Idea: {idea}</p>
      {f"<p style={{ marginBottom: 16 }}>Selected Packs: {', '.join(packs)}</p>" if packs else ""}
      <p>Start building! Edit this page at <code>src/App.tsx</code>.</p>
      <p><a href=\"https://kiff.ai\" target=\"_blank\" rel=\"noreferrer\">Kiff AI</a></p>
    </main>
  )
}}
"""
    files.append({
        "path": "src/App.tsx",
        "content": app_tsx,
        "language": "typescript"
    })

    main_tsx = """
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
"""
    files.append({
        "path": "src/main.tsx",
        "content": main_tsx.strip() + "\n",
        "language": "typescript"
    })

    files.append({
        "path": "README.md",
        "content": f"# {app_name}\n\nGenerated from idea: `{idea}` using Kiff Launcher (Vite).\n\n## Develop\n\n```bash\nnpm install\nnpm run dev\n```\n\nThen open the preview URL.\n",
        "language": "markdown"
    })

    if packs:
        files.append({
            "path": "kiff.config.json",
            "content": __import__("json").dumps({"packs": packs}, indent=2),
            "language": "json"
        })
        files.append({
            "path": "src/packs.ts",
            "content": "export const packs = " + __import__("json").dumps(packs) + ";\n",
            "language": "typescript"
        })

    return files


# --- Routes ---

@router.post("/generate", response_model=GenerateResponse)
async def generate_project(req: GenerateRequest, request: Request, db: Session = Depends(get_db)):
    tenant_id = _tenant_id_from_request(request)

    # Resolve or create Kiff on first generate
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
            name=(req.idea[:40] + "...") if len(req.idea) > 40 else req.idea or "Untitled Kiff",
            slug=f"kiff-{uuid.uuid4().hex[:8]}",
            model_id=None,
            created_at=dt.datetime.utcnow(),
        )
        db.add(placeholder_kiff)
        db.flush()
        kiff_id = placeholder_kiff.id
        db.commit()

    session_id = req.session_id or str(uuid.uuid4())
    packs = (req.selected_packs or [])[:5]

    # Generate project files using the agent instead of hardcoded scaffolding  
    files, agent_response = await _generate_project_files(idea=req.idea, packs=packs, tenant_id=tenant_id)

    # Store the initial conversation in the database
    from ..models_kiffs import ConversationMessage, KiffChatSession
    
    # Create chat session
    chat_session = KiffChatSession(
        id=session_id,
        kiff_id=kiff_id,
        tenant_id=tenant_id,
        user_id=req.user_id,
        created_at=dt.datetime.utcnow(),
    )
    # Persist selected packs in the chat session state for agentic RAG scoping
    try:
        chat_session.agent_state = {"selected_packs": packs}
    except Exception:
        # If model lacks agent_state, ignore silently (backward compatibility)
        pass
    db.add(chat_session)
    db.flush()

    # Add initial user message
    user_message = ConversationMessage(
        id=str(uuid.uuid4()),
        kiff_id=kiff_id,
        tenant_id=tenant_id,
        user_id=req.user_id,
        session_id=session_id,
        role="user",
        content=req.idea,
        created_at=dt.datetime.utcnow(),
    )
    db.add(user_message)

    # Add agent response showing what was generated
    assistant_message = ConversationMessage(
        id=str(uuid.uuid4()),
        kiff_id=kiff_id,
        tenant_id=tenant_id,
        user_id=req.user_id,
        session_id=session_id,
        role="assistant", 
        content=agent_response,
        created_at=dt.datetime.utcnow(),
    )
    db.add(assistant_message)
    db.commit()

    # Return files for the frontend to apply via /api/preview/files SSE
    out_files = [FileSpec(**f) for f in files]
    return GenerateResponse(session_id=session_id, files=out_files, kiff_id=kiff_id)


@router.post("/session/{session_id}/packs")
async def update_session_packs(session_id: str, req: UpdateSessionPacksRequest, request: Request, db: Session = Depends(get_db)):
    """Update the session's selected_packs before chat starts.

    Rules:
    - Allowed only if the session is not active (no chat started yet).
    - Determined by `agent_state.chat_active` flag; if true -> 409.
    - Enforces tenant ownership via X-Tenant-ID.
    """
    tenant_id = _tenant_id_from_request(request)

    sess = db.query(KiffChatSession).filter(
        KiffChatSession.id == session_id,
        KiffChatSession.tenant_id == tenant_id,
    ).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    # Parse/normalize agent_state
    import json as _json
    state: Dict[str, Any]
    try:
        raw = sess.agent_state or {}
        if isinstance(raw, str):
            state = _json.loads(raw) if raw else {}
        elif isinstance(raw, dict):
            state = raw
        else:
            state = {}
    except Exception:
        state = {}

    # If chat_active flag is set, block mutation (chat actually started)
    if bool(state.get("chat_active")):
        raise HTTPException(status_code=409, detail="Cannot modify packs after chat has started.")

    # Update selected_packs (cap at 5 to keep prompt size small)
    packs = [str(p) for p in (req.selected_packs or [])][:5]
    state["selected_packs"] = packs
    sess.agent_state = state
    sess.updated_at = dt.datetime.utcnow()
    db.add(sess)
    db.commit()

    return {"session_id": sess.id, "selected_packs": packs}
