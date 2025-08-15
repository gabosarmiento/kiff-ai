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
                "content": content,  # Include complete content for localStorage
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
                    instructions=[
                        # Launcher workflow: plan, read, modify files using provided tools
                        "You are an AI agent specialized in understanding and modifying existing code projects through conversational interaction.",
                        "If the idea is complex: first use todo_plan to create a short step-by-step plan, then execute the steps. If the idea is simple: skip todo_plan and implement directly.",
                        "You have full access to read, understand, and modify files in the current project using the provided tools.",
                        "When users request changes, always start by using list_files to see the project structure, then read relevant files to understand the current state.",
                        "Use read_file to examine existing code before making changes.",
                        "CRITICAL: When users ask you to modify files or make changes, you MUST use the write_file tool to create file proposals.",
                        "The write_file tool creates proposals that the frontend can apply instantly - always use it instead of just describing changes.",
                        "Always provide the complete updated file content when using write_file, not just partial changes.",
                        "When making small changes like changing a single word, still use write_file with the complete file content.",
                        "Always explain what you're doing and why when modifying files.",
                        "Generate production-ready code that follows the existing project's patterns and conventions.",
                        "Ask clarifying questions when requirements are ambiguous.",
                        # Pack-aware knowledge policy unique to Kiff
                        "Knowledge usage policy:",
                        "- ALWAYS use search_pack_knowledge(query) when users ask questions that could be answered from API documentation or pack content.",
                        "- The search will automatically filter by the current tenant and user's selected pack(s).",
                        "- Provide citations from the knowledge search results in your answers.",
                        "- If no relevant knowledge is found, explain this and work with general programming knowledge.",
                        "- For API-related questions, code examples, integration patterns, always search knowledge first.",
                    ],
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

    async def run(self, message: str, chat_history: List[Dict[str, Any]], tenant_id: str, kiff_id: str, selected_packs: Optional[List[str]] = None) -> AgentRunResult:
        # If AGNO available, use it; otherwise return a simple stub
        if self.agent is not None:
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
                "You are assisting the user to define and iteratively build a 'kiff' (project).\n"
                "Ask clarifying questions when needed and propose concrete file additions or changes.\n"
                "When knowledge is present, cite patterns; otherwise proceed with best practices.\n\n"
                f"Chat so far:\n{context_text}\n\nUser: {message}"
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
                    user_id=None,
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
            return AgentRunResult(content=text, tool_calls=tool_calls)

        # Fallback minimal response (no AGNO)
        return AgentRunResult(
            content=f"[launcher] Received: {message}\n\nPlease install AGNO and configure Groq for full functionality.",
        )


def get_launcher_agent(session_id: Optional[str] = None, model_id: Optional[str] = None) -> LauncherAgent:
    # Singleton-ish simple provider
    # In production we might keep it global; for now create per-request is fine
    return LauncherAgent(session_id=session_id, model_id=model_id)
