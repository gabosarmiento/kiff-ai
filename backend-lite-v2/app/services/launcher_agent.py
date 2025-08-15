from __future__ import annotations
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

# Optional imports for LanceDB & AGNO
_HAS_LANCEDB = False
_HAS_AGNO = False

try:
    import lancedb  # type: ignore
    _HAS_LANCEDB = True
except Exception:
    lancedb = None  # type: ignore

try:
    from agno.agent import Agent  # type: ignore
    from agno.models.groq import Groq  # type: ignore
    from agno.vectordb.lancedb import LanceDb  # type: ignore
    from agno.vectordb.search import SearchType  # type: ignore
    from agno.storage.sqlite import SqliteStorage  # type: ignore
    from agno.tools import tool  # type: ignore
    from agno.tools.knowledge import KnowledgeTools  # type: ignore
    _HAS_AGNO = True
except Exception:
    Agent = None  # type: ignore
    Groq = None  # type: ignore
    LanceDb = None  # type: ignore
    SearchType = None  # type: ignore
    SqliteStorage = None  # type: ignore
    tool = None  # type: ignore
    KnowledgeTools = None  # type: ignore

# Module-level tenant context for tool functions
# These tools are created at __init__ time and don't receive tenant_id directly.
# We set this before each run() and reset after to ensure correct partitioning in PreviewStore.
_CURRENT_TENANT_ID: str = "default"
_REQUIRE_APPROVAL: bool = False

def _get_current_tenant_id() -> str:
    tid = _CURRENT_TENANT_ID or "default"
    return tid

def _detect_language_from_extension(file_path: str) -> str:
    """Detect programming language from file extension"""
    ext = file_path.lower().split('.')[-1] if '.' in file_path else ''
    lang_map = {
        'py': 'python',
        'js': 'javascript', 
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'md': 'markdown',
        'yml': 'yaml',
        'yaml': 'yaml',
        'txt': 'text',
        'sh': 'bash',
        'sql': 'sql',
        'go': 'go',
        'rs': 'rust',
        'java': 'java',
        'php': 'php',
        'rb': 'ruby'
    }
    return lang_map.get(ext, 'text')

# Observability & budgeting
try:
    from ..observability import SessionContext, call_llm_and_track
    from ..observability.pricing import get_latest_model_price, compute_cost_usd
    from ..services.budget_guard import evaluate_budget, send_budget_alert
    from ..db_core import SessionLocal
    _HAS_OBS = True
except Exception:
    _HAS_OBS = False

# Modular prompts and web search tool
try:
    from .launcher_prompts import get_launcher_instructions  # type: ignore
except Exception:
    def get_launcher_instructions(include_web: bool = True) -> List[str]:  # type: ignore
        # Fallback to a minimal default if prompts module is unavailable
        base = [
            "You are the Kiff Launcher agent. Be concise and action-oriented.",
            "Use the 'tool_name' to do X style. Prefer tools over prose.",
            "Use 'search_pack_knowledge' or 'search_pack_vectors' FIRST for API/framework questions. Cite sources as [pack/section or URL].",
            "For complex tasks: use 'todo_plan' then execute steps. For simple tasks: act directly.",
            "Start with 'list_files' to see structure, then 'read_file' before editing.",
            "When modifying code, MUST use 'write_file' and provide the COMPLETE updated file content (even for small edits).",
            "Briefly explain what and why for each change. Follow project conventions and keep diffs minimal.",
            "Ask 1–2 clarifying questions only if requirements are ambiguous. Otherwise proceed.",
            "Available tools (core): list_files, read_file, write_file, todo_plan, todo_* task tools, search_pack_knowledge, search_pack_vectors.",
            "Respect tenant and selected packs (scoped automatically). Do not leak unrelated knowledge.",
            "Keep responses short. End with a brief summary and next step(s).",
        ]
        if include_web:
            base.insert(3, "If knowledge is weak or missing, optionally use 'web_search' to augment.")
            base = [
                ("Available tools (core + web): list_files, read_file, write_file, todo_plan, "
                 "todo_* task tools, search_pack_knowledge, search_pack_vectors, web_search.")
                if s.startswith("Available tools (core):") else s for s in base
            ]
        return base

try:
    from .web_search import get_web_search_tool  # type: ignore
except Exception:
    def get_web_search_tool(_decorator):  # type: ignore
        return None


@dataclass
class AgentRunResult:
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    kiff_update: Optional[Dict[str, Any]] = None
    relevant_context: Optional[List[str]] = None
    action_json: Optional[str] = None


# Create project file tools for the agent
def create_project_tools(session_id: str):
    """Create file management tools for the given session_id"""
    
    @tool
    def read_file(file_path: str) -> str:
        """Read the contents of a file from the current project.
        
        Args:
            file_path: The path to the file to read (e.g., 'src/App.tsx')
        
        Returns:
            The content of the file or an error message
        """
        try:
            # Note: This tool now relies on the project_files context passed to the agent
            # The actual file content should be available in the conversation context
            # For now, we'll indicate that the agent should refer to the files in context
            return f"To read {file_path}, please refer to the current project files provided in the conversation context. The file content should be visible above in the 'Current Project Files' section."
        except Exception as e:
            return f"Error reading {file_path}: {str(e)}"

    @tool
    def write_file(file_path: str, content: str) -> str:
        """Write or update a file in the current project.
        
        Args:
            file_path: The path to the file to write (e.g., 'src/App.tsx')
            content: The complete content to write to the file
        
        Returns:
            Success message or error message
        """
        try:
            import json
            import uuid as _uuid
            import difflib
            
            # Always create proposals for frontend approval since we're using localStorage
            # The frontend will apply the changes to localStorage when approved
            
            # Try to get current file content from the context or assume empty for new files
            # This is a simple implementation - in a more sophisticated version,
            # we could parse the project_files from the conversation context
            old_content = ""
            
            # Build proposal with diff and complete content
            diff_lines = list(
                difflib.unified_diff(
                    old_content.splitlines(keepends=True),
                    content.splitlines(keepends=True),
                    fromfile=file_path,
                    tofile=file_path,
                )
            )
            
            proposal_id = str(_uuid.uuid4())
            change = {
                "path": file_path,
                # IMPORTANT: The approve endpoint expects 'new_content'. See
                # app/routes/launcher_chat.py -> approve_proposal where it reads
                # c.get("new_content", "") when applying to the sandbox and store.
                # Using 'new_content' ensures the applied file contains the intended content.
                "new_content": content,
                "diff": "".join(diff_lines),
                "language": _detect_language_from_extension(file_path)
            }
            
            # Return proposal in JSON format that the frontend expects
            proposal = {
                "type": "ProposedFileChanges",
                "proposal_id": proposal_id,
                "title": f"Update {file_path}",
                "changes": [change],
                "status": "pending"
            }
            
            # Return as special PROPOSAL format that the chat handler recognizes
            return "PROPOSAL:" + json.dumps(proposal)
            
        except Exception as e:
            return f"Error preparing file changes for {file_path}: {str(e)}"

    @tool  
    def list_files() -> str:
        """List all files in the current project.
        
        Returns:
            A list of all file paths in the project
        """
        try:
            # Use the preview store to get file list
            from ..util.preview_store import PreviewStore
            import os
            table = os.getenv("DYNAMO_TABLE_PREVIEW_SESSIONS") or "preview_sessions"
            region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "eu-west-3"
            store = PreviewStore(table_name=table, region_name=region)
            
            tenant_id = _get_current_tenant_id()
            sess = store.get_session(tenant_id, session_id) or {}
            files = sess.get("files") or []
            paths = [f.get("path") for f in files if isinstance(f, dict) and f.get("path")]
            
            if paths:
                return f"Files in project:\n" + "\n".join(f"- {path}" for path in sorted(paths))
            else:
                return "No files found in project"
        except Exception as e:
            return f"Error listing files: {str(e)}"

    return [read_file, write_file, list_files]


def create_todo_tools(session_id: str):
    """Create lightweight, session-scoped todo planning tools.

    State is stored in the PreviewStore session document under key 'todo_state'.
    Structure:
        {
            "current_plan": ["step 1", "step 2", ...],
            "completed_tasks": ["..."],
            "current_task": "..." | None,
            "progress_log": ["..."],
        }
    """

    if not _HAS_AGNO:
        return []

    from ..util.preview_store import PreviewStore
    import os

    def _get_store():
        table = os.getenv("DYNAMO_TABLE_PREVIEW_SESSIONS") or "preview_sessions"
        region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "eu-west-3"
        return PreviewStore(table_name=table, region_name=region)

    def _get_state(store):
        sess = store.get_session("default", session_id) or {}
        state = sess.get("todo_state")
        if not isinstance(state, dict):
            state = {
                "current_plan": [],
                "completed_tasks": [],
                "current_task": None,
                "progress_log": [],
            }
        return sess, state

    def _save_state(store, sess, state):
        sess["todo_state"] = state
        store.update_session_fields("default", session_id, {"todo_state": state})

    @tool
    def todo_plan(idea: str) -> str:
        """Create a short, step-by-step plan for a complex idea. Keep steps concise."""
        try:
            store = _get_store()
            sess, state = _get_state(store)

            # Simple heuristic to split into steps if user provided list-like input.
            # Otherwise, create a minimal 3-5 step plan template.
            lines = [s.strip(" -\t") for s in idea.split("\n") if s.strip()]
            if len(lines) >= 2:
                plan = lines
            else:
                plan = [
                    "Understand current project context and constraints",
                    "Identify files to add or modify",
                    "Implement the minimal working solution",
                    "Test the change and adjust",
                    "Summarize and deliver",
                ]

            state["current_plan"] = plan
            state["current_task"] = plan[0] if plan else None
            _save_state(store, sess, state)
            bullets = "\n".join(f"- {s}" for s in plan)
            return f"Plan created:\n{bullets}"
        except Exception as e:
            return f"Error creating plan: {e}"

    @tool
    def todo_start_task(task: str) -> str:
        """Start working on a specific task from the plan."""
        try:
            store = _get_store()
            sess, state = _get_state(store)
            state["current_task"] = task
            state["progress_log"].append(f"Start: {task}")
            _save_state(store, sess, state)
            return f"Started: {task}"
        except Exception as e:
            return f"Error starting task: {e}"

    @tool
    def todo_complete_task() -> str:
        """Mark the current task as completed and move to the next."""
        try:
            store = _get_store()
            sess, state = _get_state(store)
            cur = state.get("current_task")
            if cur:
                state["completed_tasks"].append(cur)
                state["progress_log"].append(f"Done: {cur}")
                # Advance to next pending item
                remaining = [s for s in state.get("current_plan", []) if s not in state["completed_tasks"]]
                state["current_task"] = remaining[0] if remaining else None
                _save_state(store, sess, state)
                next_task = state["current_task"] or "All tasks completed"
                return f"Completed: {cur}. Next: {next_task}"
            return "No current task to complete"
        except Exception as e:
            return f"Error completing task: {e}"

    @tool
    def todo_status() -> str:
        """Show plan, current task, completed tasks, and recent logs."""
        try:
            store = _get_store()
            sess, state = _get_state(store)
            plan = state.get("current_plan", [])
            cur = state.get("current_task")
            done = state.get("completed_tasks", [])
            log = state.get("progress_log", [])[-10:]
            plan_s = "\n".join(f"- {s}" for s in plan) if plan else "(none)"
            done_s = "\n".join(f"- {s}" for s in done) if done else "(none)"
            log_s = "\n".join(f"- {s}" for s in log) if log else "(none)"
            return (
                f"Plan:\n{plan_s}\n\n"
                f"Current: {cur or '(none)'}\n\n"
                f"Completed:\n{done_s}\n\n"
                f"Recent:\n{log_s}"
            )
        except Exception as e:
            return f"Error getting status: {e}"

    @tool
    def todo_log(message: str) -> str:
        """Append a short progress note."""
        try:
            store = _get_store()
            sess, state = _get_state(store)
            state["progress_log"].append(message)
            _save_state(store, sess, state)
            return "Logged"
        except Exception as e:
            return f"Error logging progress: {e}"

    return [todo_plan, todo_start_task, todo_complete_task, todo_status, todo_log]

class LauncherAgent:
    def __init__(self, session_id: Optional[str] = None, model_id: Optional[str] = None) -> None:
        self.model_id = model_id or os.getenv("LAUNCHER_MODEL_ID", "moonshotai/kimi-k2-instruct")
        self.lancedb_dir = os.getenv("LANCEDB_DIR", os.path.abspath(os.path.join(os.getcwd(), "./kiff_vectors")))
        self.kb_table = os.getenv("LAUNCHER_KB_TABLE", "kiff_packs")
        self.agent_sessions_table = os.getenv("LAUNCHER_AGENT_SESSIONS_TABLE", "agent_sessions")
        self.search_knowledge = True
        self.session_id = session_id
        # Diagnostics and retrieval behavior flags
        self.diag_enabled = (os.getenv("LAUNCHER_RAG_DIAGNOSTICS", "true").lower() in ("1", "true", "yes"))
        try:
            self.lowconf_threshold = float(os.getenv("LAUNCHER_LOWCONF_THRESHOLD", "0.25"))
        except Exception:
            self.lowconf_threshold = 0.25
        self.web_on_lowconf = (os.getenv("LAUNCHER_WEBSEARCH_ON_LOWCONF", "true").lower() in ("1", "true", "yes"))

        self.agent = None
        if _HAS_AGNO:
            try:
                print(f"[LAUNCHER_AGENT] Initializing AGNO agent with model: {self.model_id}")
                
                knowledge = None
                storage = None
                
                # Set up storage using SQLite (simpler than LanceDB for sessions)
                try:
                    print(f"[LAUNCHER_AGENT] Setting up SQLite storage...")
                    storage = SqliteStorage(
                        table_name=self.agent_sessions_table,
                        db_file=os.path.join(self.lancedb_dir, "agent_sessions.db")
                    )
                    print(f"[LAUNCHER_AGENT] ✅ SQLite storage configured")
                except Exception as e:
                    print(f"[LAUNCHER_AGENT] ⚠️ SQLite storage setup failed: {e}")
                    storage = None
                
                # Set up LanceDB vector knowledge if available
                if _HAS_LANCEDB:
                    try:
                        print(f"[LAUNCHER_AGENT] Setting up LanceDB vector knowledge at: {self.lancedb_dir}")
                        os.makedirs(self.lancedb_dir, exist_ok=True)
                        
                        # Import our cached embedder
                        from app.services.embedder_cache import get_embedder
                        embedder = get_embedder()
                        
                        if embedder:
                            print(f"[LAUNCHER_AGENT] Using cached sentence-transformers embedder")
                            # Create LanceDB vector database with our embedder
                            # Prefer AGNO's SearchType.hybrid if available; otherwise omit search_type
                            if 'SearchType' in globals() and SearchType is not None:
                                # Use vector-only search to avoid FTS index requirements
                                vector_db = LanceDb(
                                    table_name=self.kb_table,
                                    uri=self.lancedb_dir,
                                    search_type=SearchType.vector,
                                    embedder=embedder  # Use our cached embedder instead of OpenAI
                                )
                            else:
                                vector_db = LanceDb(
                                    table_name=self.kb_table,
                                    uri=self.lancedb_dir,
                                    embedder=embedder  # Use our cached embedder instead of OpenAI
                                )
                            # Persist reference for later use
                            try:
                                self.vector_db = vector_db  # type: ignore[attr-defined]
                                # If AGNO is available, set up AgentKnowledge wrapper
                                if _HAS_AGNO:
                                    from agno.knowledge import AgentKnowledge  # type: ignore
                                    self.knowledge = AgentKnowledge(  # type: ignore[attr-defined]
                                        vector_db=vector_db,
                                        num_documents=4,
                                    )
                                else:
                                    self.knowledge = None  # type: ignore[attr-defined]
                            except Exception:
                                # Non-fatal if attributes cannot be set
                                pass
                            print(f"[LAUNCHER_AGENT] ✅ LanceDB vector database configured with cached embedder")
                            # Ensure indexed / non-empty check for visibility
                            try:
                                import lancedb as _ldb  # type: ignore
                                _db = _ldb.connect(self.lancedb_dir)
                                _tbl = _db.open_table(self.kb_table)
                                try:
                                    _n = _tbl.count_rows()
                                except Exception:
                                    try:
                                        _n = len(list(_tbl.head(1))) * 0  # force iterable
                                        _n = 0
                                    except Exception:
                                        _n = -1
                                if _n == 0:
                                    print(f"[LAUNCHER_AGENT] ⚠️ LanceDB table '{self.kb_table}' is empty. Packs may not be indexed yet.")
                                elif _n > 0:
                                    print(f"[LAUNCHER_AGENT] ℹ️ LanceDB table '{self.kb_table}' has ~{_n} rows (reported).")
                                else:
                                    print(f"[LAUNCHER_AGENT] ℹ️ Unable to determine row count for '{self.kb_table}'.")
                            except Exception as _e_idx:
                                print(f"[LAUNCHER_AGENT] ⚠️ Ensure-indexed check failed: {_e_idx}")
                        else:
                            print(f"[LAUNCHER_AGENT] ⚠️ Cached embedder not available, skipping vector setup")
                        
                    except Exception as e:
                        print(f"[LAUNCHER_AGENT] ⚠️ LanceDB vector setup failed: {e}")
                        # Proceed without vector knowledge

                print(f"[LAUNCHER_AGENT] Creating Groq model...")
                groq_model = Groq(id=self.model_id)
                print(f"[LAUNCHER_AGENT] ✅ Groq model created")
                
                print(f"[LAUNCHER_AGENT] Creating AGNO agent...")
                
                # Add project tools and todo tools if session_id is available
                tools = []
                if self.session_id:
                    try:
                        tools = create_project_tools(self.session_id)
                        print(f"[LAUNCHER_AGENT] ✅ Added {len(tools)} project file tools for session {self.session_id}")
                    except Exception as e:
                        print(f"[LAUNCHER_AGENT] ⚠️ Failed to add project tools: {e}")

                    # Add lightweight todo planning tools (session-scoped via PreviewStore)
                    try:
                        todo_tools = create_todo_tools(self.session_id)
                        tools.extend(todo_tools)
                        print(f"[LAUNCHER_AGENT] ✅ Added {len(todo_tools)} todo tools for session {self.session_id}")
                    except Exception as e:
                        print(f"[LAUNCHER_AGENT] ⚠️ Failed to add todo tools: {e}")

                # Add a knowledge search tool that honors tenant and selected packs
                if _HAS_AGNO and tool is not None:
                    try:
                        self._current_tenant_id = None  # type: ignore[attr-defined]
                        self._current_pack_ids = None  # type: ignore[attr-defined]

                        @tool
                        def search_pack_knowledge(query: str, k: int = 4) -> str:  # type: ignore
                            """Search tenant- and pack-scoped knowledge using ML service.
                            Args:
                                query: Natural language query to search for.
                                k: Max documents to return (default 4).
                            Returns: A concise list of results with citations.
                            """
                            try:
                                # Use the ML API client instead of local processing
                                from app.services.ml_api_client import ml_client
                                import asyncio
                                
                                t_id = getattr(self, "_current_tenant_id", None)
                                pack_ids = getattr(self, "_current_pack_ids", None)
                                
                                if not t_id:
                                    return "No tenant context available."
                                
                                if not pack_ids:
                                    return "No packs selected for knowledge search."
                                
                                # Call ML service for vector search
                                try:
                                    # Run async call in current event loop or create new one
                                    try:
                                        loop = asyncio.get_event_loop()
                                        if loop.is_running():
                                            # We're in an async context, create a task
                                            import concurrent.futures
                                            with concurrent.futures.ThreadPoolExecutor() as executor:
                                                future = executor.submit(
                                                    asyncio.run,
                                                    ml_client.search_vectors(query, t_id, pack_ids, k)
                                                )
                                                results = future.result(timeout=30)
                                        else:
                                            results = asyncio.run(ml_client.search_vectors(query, t_id, pack_ids, k))
                                    except RuntimeError:
                                        # No event loop, safe to create one
                                        results = asyncio.run(ml_client.search_vectors(query, t_id, pack_ids, k))
                                    
                                    # Format output
                                    out_lines = []
                                    for r in results:
                                        content = r.get("content", "")
                                        pack_name = r.get("pack_name", "")
                                        doc_type = r.get("document_type", "")
                                        # Truncate content for readability
                                        content_snippet = content[:250].replace('\n', ' ').strip()
                                        out_lines.append(f"• [{pack_name}] {doc_type}: {content_snippet}...")

                                    # Diagnostics
                                    try:
                                        print(f"[LAUNCHER_AGENT][ML-RAG] tenant={t_id} packs={pack_ids} query='{query}' hits={len(results)}")
                                    except Exception:
                                        pass

                                    if not out_lines:
                                        return f"No knowledge found in selected packs ({', '.join(pack_ids)}) for query: {query}"

                                    return f"Knowledge from selected packs:\n" + "\n".join(out_lines)
                                    
                                except Exception as ml_error:
                                    return f"ML service error: {ml_error}"
                                    
                            except Exception as e:  # pragma: no cover
                                return f"Search error: {e}"

                        tools.append(search_pack_knowledge)
                        print(f"[LAUNCHER_AGENT] ✅ Added knowledge search tool")
                    except Exception as e:
                        print(f"[LAUNCHER_AGENT] ⚠️ Failed to add knowledge search tool: {e}")

                # Add direct LanceDB vector search over Packs (tenant + pack scoped)
                if _HAS_AGNO and tool is not None and _HAS_LANCEDB:
                    try:
                        @tool
                        def search_pack_vectors(query: str, k: int = 4) -> str:  # type: ignore
                            """Direct vector search in LanceDB over selected Packs.
                            Applies tenant and pack filters. Returns concise citations.
                            """
                            import json as _json
                            import re as _re
                            import os as _os
                            import httpx as _httpx
                            try:
                                t_id = getattr(self, "_current_tenant_id", None)
                                pack_ids = getattr(self, "_current_pack_ids", None)
                                if not t_id:
                                    return "No tenant context available."
                                if not pack_ids:
                                    return "No packs selected for knowledge search."

                                # Open LanceDB table and perform filtered search
                                import lancedb as _ldb  # type: ignore
                                db = _ldb.connect(self.lancedb_dir)
                                tbl = db.open_table(self.kb_table)
                                # Build filter expression: tenant AND pack_id IN (...)
                                # Note: simple SQL-like 'IN' filter is supported by LanceDB
                                ids = ",".join([f"'{p}'" for p in pack_ids])
                                where = f"tenant_id == '{t_id}' and pack_id in [{ids}]"
                                # Vector query; if the table supports hybrid search, this will do ANN
                                res = tbl.search(query).where(where).limit(int(k or 4)).to_list()

                                if not res:
                                    try:
                                        print(f"[LAUNCHER_AGENT][RAG] tenant={t_id} packs={pack_ids} query='{query}' hits=0")
                                    except Exception:
                                        pass
                                    return f"No knowledge found in selected packs ({', '.join(pack_ids)}) for query: {query}"

                                # Lightweight reranker: combine LanceDB score with token overlap
                                def _tokenize(s: str) -> set:
                                    return set(t for t in _re.findall(r"[A-Za-z0-9_]+", (s or "").lower()) if len(t) > 2)

                                q_tokens = _tokenize(query)
                                scored = []
                                for r in res:
                                    content = (r.get("content", "") or "").strip()
                                    tokens = _tokenize(content[:1000])
                                    overlap = len(q_tokens & tokens)
                                    base = r.get("score", 0.0) or 0.0
                                    # small metadata boosts
                                    boost = 0.0
                                    section = (r.get("section") or "").lower()
                                    title = (r.get("title") or r.get("heading") or "").lower()
                                    url = (r.get("url") or "").lower()
                                    if section and any(t in section for t in q_tokens):
                                        boost += 0.02
                                    if title and any(t in title for t in q_tokens):
                                        boost += 0.03
                                    if any(s in url for s in ("/api/", "reference", "docs")):
                                        boost += 0.01
                                    final = float(base) + 0.01 * float(overlap) + boost
                                    r["_rerank_score"] = final
                                    scored.append(r)

                                scored.sort(key=lambda x: x.get("_rerank_score", 0.0), reverse=True)

                                # Diagnostics
                                try:
                                    if getattr(self, "diag_enabled", True):
                                        dbg = [
                                            {
                                                "pack": rr.get("pack_id") or rr.get("pack_name"),
                                                "score": rr.get("score"),
                                                "rerank": rr.get("_rerank_score"),
                                                "section": rr.get("section"),
                                                "url": rr.get("url"),
                                            }
                                            for rr in scored[: min(len(scored), int(k or 4))]
                                        ]
                                        print(f"[LAUNCHER_AGENT][RAG] tenant={t_id} packs={pack_ids} query='{query}' hits={len(scored)} top={dbg}")
                                except Exception:
                                    pass

                                # Confidence gating: if low confidence and enabled, augment with Serper web results
                                try:
                                    top_score = float(scored[0].get("_rerank_score", 0.0)) if scored else 0.0
                                except Exception:
                                    top_score = 0.0
                                lowconf = top_score < getattr(self, "lowconf_threshold", 0.25)

                                lines = []
                                for r in scored[: int(k or 4)]:
                                    content = r.get("content", "").strip()
                                    pack_name = r.get("pack_name", r.get("pack_id", ""))
                                    section = r.get("section", "")
                                    url = r.get("url", "")
                                    snippet = (content[:250] + "...") if len(content) > 250 else content
                                    cite = f" • [{pack_name}] {section} — {url}\n   {snippet}"
                                    lines.append(cite)

                                if lowconf and getattr(self, "web_on_lowconf", True):
                                    try:
                                        serper_key = _os.getenv("SERPER_API_KEY")
                                        if serper_key:
                                            headers = {"X-API-KEY": serper_key, "Content-Type": "application/json"}
                                            payload = {"q": query, "num": 5}
                                            resp = _httpx.post("https://google.serper.dev/search", headers=headers, json=payload, timeout=15.0)
                                            if resp.status_code == 200:
                                                data = resp.json()
                                                web_items = []
                                                for r in (data.get("organic") or [])[:5]:
                                                    title = r.get("title") or "(no title)"
                                                    link = r.get("link") or r.get("url") or ""
                                                    snippet = (r.get("snippet") or r.get("description") or "").strip()
                                                    snippet = (snippet[:200] + "...") if len(snippet) > 200 else snippet
                                                    web_items.append(f"   - {title} — {link}\n     {snippet}")
                                                if web_items:
                                                    lines.append("\nLow confidence on Packs; augmenting with web (Serper):")
                                                    lines.extend(web_items)
                                                if getattr(self, "diag_enabled", True):
                                                    print(f"[LAUNCHER_AGENT][RAG] lowconf={top_score:.3f} < {self.lowconf_threshold:.3f}; appended Serper results")
                                            else:
                                                if getattr(self, "diag_enabled", True):
                                                    print(f"[LAUNCHER_AGENT][RAG] Serper HTTP {resp.status_code}: {resp.text[:120]}")
                                        else:
                                            if getattr(self, "diag_enabled", True):
                                                print("[LAUNCHER_AGENT][RAG] SERPER_API_KEY not set; skipping web augmentation")
                                    except Exception as _e_web:
                                        if getattr(self, "diag_enabled", True):
                                            print(f"[LAUNCHER_AGENT][RAG] Serper augmentation failed: {_e_web}")
                                return "Knowledge from selected packs (LanceDB):\n" + "\n".join(lines)
                            except Exception as e:
                                return f"Vector search error: {e}"

                        tools.append(search_pack_vectors)
                        print(f"[LAUNCHER_AGENT] ✅ Added LanceDB pack vector search tool")
                    except Exception as e:
                        print(f"[LAUNCHER_AGENT] ⚠️ Failed to add LanceDB vector search tool: {e}")

                # Add unified web search tool (Tavily -> Serper fallback) if enabled
                web_tool_added = False
                try:
                    enable_web = (os.getenv("LAUNCHER_ENABLE_WEB_SEARCH", "true").lower() in ("1", "true", "yes"))
                except Exception:
                    enable_web = True
                if _HAS_AGNO and tool is not None and enable_web:
                    try:
                        web_tool = get_web_search_tool(tool)
                        if web_tool is not None:
                            tools.append(web_tool)
                            web_tool_added = True
                            print("[LAUNCHER_AGENT] ✅ Added unified web search tool")
                        else:
                            print("[LAUNCHER_AGENT] ℹ️ No web search provider configured; skipping")
                    except Exception as e:
                        print(f"[LAUNCHER_AGENT] ⚠️ Failed to add web search tool: {e}")
                else:
                    if not enable_web:
                        print("[LAUNCHER_AGENT] ℹ️ Web search disabled via LAUNCHER_ENABLE_WEB_SEARCH")

                # Add AGNO KnowledgeTools to enable Think -> Search -> Analyze over our knowledge base
                try:
                    kt_knowledge = getattr(self, "knowledge", None)
                    if _HAS_AGNO and KnowledgeTools is not None and kt_knowledge is not None:
                        kt = KnowledgeTools(
                            knowledge=kt_knowledge,
                            think=True,
                            search=True,
                            analyze=True,
                            add_few_shot=True,
                            add_instructions=True,
                        )
                        tools.append(kt)  # type: ignore[arg-type]
                        print(f"[LAUNCHER_AGENT] ✅ Added KnowledgeTools (think+search+analyze)")
                    else:
                        if kt_knowledge is None:
                            print(f"[LAUNCHER_AGENT] ⚠️ KnowledgeTools skipped: no knowledge configured")
                except Exception as e:
                    print(f"[LAUNCHER_AGENT] ⚠️ Failed to add KnowledgeTools: {e}")

                self.agent = Agent(
                    model=groq_model,
                    storage=storage,
                    tools=tools if tools else None,
                    # Attach knowledge for KnowledgeTools context (search handled by KnowledgeTools)
                    **({"knowledge": getattr(self, "knowledge", None)} if hasattr(self, "knowledge") else {}),
                    search_knowledge=False,
                    instructions=get_launcher_instructions(include_web=locals().get("web_tool_added", False)),
                    show_tool_calls=True,
                    markdown=True,
                    add_datetime_to_instructions=True,
                    debug_mode=False
                )
                print(f"[LAUNCHER_AGENT] ✅ AGNO agent initialized successfully")
                
            except Exception as e:
                print(f"[LAUNCHER_AGENT] ❌ AGNO agent initialization failed: {e}")
                import traceback
                traceback.print_exc()
                self.agent = None
        else:
            print(f"[LAUNCHER_AGENT] ❌ AGNO not available")

    async def run(self, message: str, chat_history: List[Dict[str, Any]], tenant_id: str, kiff_id: str, selected_packs: Optional[List[str]] = None, user_id: Optional[str] = None) -> AgentRunResult:
        # If AGNO available, use it; otherwise return a simple stub
        if self.agent is not None:
            import time
            _t0 = time.perf_counter()
            # Format a minimal prompt that embeds prior chat context
            context_lines = []
            for m in chat_history[-10:]:  # last 10
                role = m.get("role", "user")
                content = m.get("content", "")
                context_lines.append(f"{role.upper()}: {content}")
            context_text = "\n".join(context_lines)

            prompt = (
                f"Tenant: {tenant_id}\nKiff: {kiff_id}\n"
                f"Selected Packs: {', '.join(selected_packs or [])}\n"
                "Goal: Help the user iteratively build or modify their Kiff using tools.\n"
                "Policy: Search packs first; cite sources. Use minimal tool commands. Write full files for changes.\n\n"
                f"Chat so far:\n{context_text}\n\nUser: {message}\n\n"
                "Next actions (concise):\n"
                "- If API/docs context needed: use 'search_pack_knowledge' (or 'search_pack_vectors').\n"
                "- If complex task: use 'todo_plan'. Otherwise: 'list_files' -> 'read_file' -> 'write_file'.\n"
            )

            # Expose current scoping context for tools (e.g., search_pack_knowledge and file tools)
            try:
                setattr(self, "_current_tenant_id", tenant_id)
                setattr(self, "_current_pack_ids", selected_packs or [])
                # Also set module-level tenant for file tools defined in this module
                global _CURRENT_TENANT_ID
                _CURRENT_TENANT_ID = tenant_id
            except Exception:
                pass

            # Observability + budget guard
            if _HAS_OBS:
                # Budget pre-check (estimate: chars/4 + 500)
                try:
                    _provider = (self.model_id.split("/", 1)[0] if "/" in self.model_id else "groq").lower()
                    with SessionLocal() as _db:
                        price = get_latest_model_price(_db, provider=_provider, model=self.model_id)
                        est_in = max(1, len(prompt) // 4)
                        est_out = 500
                        projected = compute_cost_usd(price, est_in, est_out) if price else None
                        decision = evaluate_budget(_db, tenant_id, projected or 0)  # type: ignore[arg-type]
                        if decision.notify:
                            send_budget_alert(tenant_id, decision)
                        if decision.should_block:
                            return AgentRunResult(content=f"[budget] {decision.message}")
                except Exception:
                    pass

                # Build session context
                import uuid as _uuid
                run_id = f"run_{_uuid.uuid4().hex[:12]}"
                step_id = f"step_{_uuid.uuid4().hex[:12]}"
                session_ctx = SessionContext(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    workspace_id=None,
                    session_id=self.session_id or f"sess_{_uuid.uuid4().hex[:10]}",
                    run_id=run_id,
                    step_id=step_id,
                    parent_step_id=None,
                    agent_name="Kiff Launcher",
                    tool_name=None,
                )

                messages = [{"role": "user", "content": prompt}]

                async def _delegate(*, messages, stream=False):  # type: ignore
                    """Call arun in a version-tolerant way.
                    Prefer streaming + intermediate steps when supported; otherwise fallback.
                    """
                    try:
                        out = await self.agent.arun(prompt, stream=stream, stream_intermediate_steps=True)  # type: ignore
                    except TypeError:
                        # Older AGNO may not support stream_intermediate_steps
                        try:
                            out = await self.agent.arun(prompt, stream=stream)  # type: ignore
                        except TypeError:
                            # Fallback to non-streaming
                            out = await self.agent.arun(prompt)  # type: ignore
                    text = getattr(out, "content", "") or str(out)
                    return {"content": text}

                try:
                    wrapped = await call_llm_and_track(
                        provider=_provider,
                        model=self.model_id,
                        model_version=None,
                        messages=messages,
                        session_ctx=session_ctx,
                        tool_name=None,
                        stream=False,
                        attempt_n=1,
                        cache_hit=False,
                        llm_callable=_delegate,
                    )
                    text = wrapped.get("content") if isinstance(wrapped, dict) else str(wrapped)
                except Exception as _e:
                    text = f"[launcher] error: {_e}"
                resp = type("_R", (), {"content": text, "tool_calls": None})()
            else:
                resp = await self.agent.arun(prompt, stream=False)  # type: ignore

            # Cleanup per-call context
            try:
                setattr(self, "_current_tenant_id", None)
                setattr(self, "_current_pack_ids", None)
                # Reset module tenant to default after run
                _CURRENT_TENANT_ID = "default"
            except Exception:
                pass
            text = getattr(resp, "content", "") or str(resp)
            tool_calls = getattr(resp, "tool_calls", None)
            try:
                _dur = (time.perf_counter() - _t0)
                print(f"[LAUNCHER_AGENT] run completed model={self.model_id} user={user_id} tenant={tenant_id} duration_sec={_dur:.2f} tool_calls={len(tool_calls) if tool_calls else 0}")
            except Exception:
                pass
            return AgentRunResult(content=text, tool_calls=tool_calls)

        # Fallback minimal response (no AGNO)
        return AgentRunResult(
            content=f"[launcher] Received: {message}\n\nPlease install AGNO and configure Groq for full functionality.",
        )


def get_launcher_agent(session_id: Optional[str] = None, model_id: Optional[str] = None) -> LauncherAgent:
    # Singleton-ish simple provider
    # In production we might keep it global; for now create per-request is fine
    return LauncherAgent(session_id=session_id, model_id=model_id)
