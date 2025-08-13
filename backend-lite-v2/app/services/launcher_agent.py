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
    from agno.storage.sqlite import SqliteStorage  # type: ignore
    from agno.tools import tool  # type: ignore
    _HAS_AGNO = True
except Exception:
    Agent = None  # type: ignore
    Groq = None  # type: ignore
    LanceDb = None  # type: ignore
    SqliteStorage = None  # type: ignore
    tool = None  # type: ignore


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
            # Use the preview store to get file content
            from ..util.preview_store import PreviewStore
            import os
            table = os.getenv("DYNAMO_TABLE_PREVIEW_SESSIONS") or "preview_sessions" 
            region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "eu-west-3"
            store = PreviewStore(table_name=table, region_name=region)
            
            # Get session data and find the file
            sess = store.get_session("default", session_id) or {}
            files = sess.get("files") or []
            
            for f in files:
                if isinstance(f, dict) and f.get("path") == file_path:
                    content = f.get("content", "")
                    return f"Content of {file_path}:\n\n{content}"
            
            return f"File {file_path} not found in project"
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
            # Use the E2B provider and update preview store
            from ..util.sandbox_e2b import E2BProvider, E2BUnavailable
            from ..util.preview_store import PreviewStore
            import os
            
            # Get the sandbox ID from session
            table = os.getenv("DYNAMO_TABLE_PREVIEW_SESSIONS") or "preview_sessions"
            region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "eu-west-3"
            store = PreviewStore(table_name=table, region_name=region)
            sess = store.get_session("default", session_id) or {}
            sandbox_id = sess.get("sandbox_id")
            
            if not sandbox_id:
                return f"Error: No sandbox found for session {session_id}"
            
            # Apply the file to E2B
            try:
                provider = E2BProvider()
                provider.apply_files(sandbox_id=sandbox_id, files=[{"path": file_path, "content": content}])
            except E2BUnavailable:
                # Mock mode - just update the store
                pass
            
            # Update the preview store
            files = sess.get("files") or []
            updated = False
            for i, f in enumerate(files):
                if isinstance(f, dict) and f.get("path") == file_path:
                    files[i] = {"path": file_path, "content": content, "language": f.get("language")}
                    updated = True
                    break
            
            if not updated:
                files.append({"path": file_path, "content": content})
            
            store.update_session_fields("default", session_id, {"files": files})
            return f"Successfully updated {file_path}"
        except Exception as e:
            return f"Error writing {file_path}: {str(e)}"

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
            
            sess = store.get_session("default", session_id) or {}
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
    def __init__(self, session_id: Optional[str] = None) -> None:
        self.model_id = os.getenv("LAUNCHER_MODEL_ID", "moonshotai/kimi-k2-instruct")
        self.lancedb_dir = os.getenv("LANCEDB_DIR", os.path.abspath(os.path.join(os.getcwd(), "../../local_lancedb")))
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
                            vector_db = LanceDb(
                                table_name=self.kb_table,
                                uri=self.lancedb_dir,
                                search_type="similarity",
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
                            """Search tenant- and pack-scoped knowledge in LanceDB.
                            Args:
                                query: Natural language query to search for.
                                k: Max documents to return (default 4).
                            Returns: A concise list of results with citations.
                            """
                            try:
                                vdb = getattr(self, "vector_db", None)
                                if vdb is None:
                                    return "Knowledge DB unavailable."

                                # Build filters from the latest run() context
                                t_id = getattr(self, "_current_tenant_id", None)
                                pack_ids = getattr(self, "_current_pack_ids", None)
                                filters = {}
                                if t_id:
                                    filters["tenant_id"] = t_id
                                if pack_ids:
                                    filters["pack_id"] = {"$in": pack_ids}

                                # Try common LanceDb API patterns safely
                                results = None
                                try:
                                    # Preferred API (if supported by agno LanceDb wrapper)
                                    results = vdb.search(query=query, filters=filters, limit=k)
                                except Exception:
                                    try:
                                        # Fallback signatures
                                        results = vdb.search(query, k)  # type: ignore
                                    except Exception:
                                        results = []

                                # Format output
                                out_lines = []
                                for r in (results or []):
                                    # Support dict or object-like returns
                                    if isinstance(r, dict):
                                        text = r.get("text") or r.get("content") or ""
                                        meta = r.get("metadata") or {}
                                    else:
                                        text = getattr(r, "text", "") or getattr(r, "content", "")
                                        meta = getattr(r, "metadata", {}) or {}
                                    pack = meta.get("pack_id")
                                    src = meta.get("source") or meta.get("doc") or meta.get("path")
                                    out_lines.append(f"- pack={pack} source={src}: {text[:300].replace('\n',' ')}")

                                return "No results." if not out_lines else "Results:\n" + "\n".join(out_lines)
                            except Exception as e:  # pragma: no cover
                                return f"Search error: {e}"

                        tools.append(search_pack_knowledge)
                        print(f"[LAUNCHER_AGENT] ✅ Added knowledge search tool")
                    except Exception as e:
                        print(f"[LAUNCHER_AGENT] ⚠️ Failed to add knowledge search tool: {e}")
                
                self.agent = Agent(
                    model=groq_model,
                    storage=storage,
                    tools=tools if tools else None,
                    # Attach knowledge when available for agentic RAG
                    **({"knowledge": getattr(self, "knowledge", None)} if hasattr(self, "knowledge") else {}),
                    search_knowledge=True,
                    instructions=[
                        "You are an AI agent specialized in understanding and modifying existing code projects through conversational interaction.",
                        "If the idea is complex: first use todo_plan to create a short step-by-step plan, then execute the steps. If the idea is simple: skip todo_plan and implement directly.",
                        "You have full access to read, understand, and modify files in the current project using the provided tools.",
                        "When users request changes, always start by using list_files to see the project structure, then read relevant files to understand the current state.",
                        "Use read_file to examine existing code before making changes.",
                        "Use write_file to apply modifications, always providing the complete updated file content.",
                        "Always explain what you're doing and why when modifying files.",
                        "Generate production-ready code that follows the existing project's patterns and conventions.",
                        "Ask clarifying questions when requirements are ambiguous.",
                        "Be helpful, concise, and technical when appropriate.",
                        "When modifying existing files, preserve existing functionality unless specifically asked to change it.",
                        # Pack-aware knowledge policy
                        "Knowledge usage policy:",
                        "- Only retrieve and cite knowledge matching the current tenant_id and the user's selected pack_id(s).",
                        "- Always filter by metadata: tenant_id=<CURRENT_TENANT>, pack_id in <SELECTED_PACKS>.",
                        "- Provide brief citations including pack_id and document title/section.",
                        "- If retrieval is insufficient, say so and ask whether to broaden packs.",
                        "When answering pack-related questions, start by calling search_pack_knowledge(query) to fetch scoped citations.",
                    ],
                    show_tool_calls=True,
                    markdown=True,
                    debug_mode=True,
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

            # Expose current scoping context for tools (e.g., search_pack_knowledge)
            try:
                setattr(self, "_current_tenant_id", tenant_id)
                setattr(self, "_current_pack_ids", selected_packs or [])
            except Exception:
                pass

            resp = await self.agent.arun(prompt, stream=False)  # type: ignore

            # Cleanup per-call context
            try:
                setattr(self, "_current_tenant_id", None)
                setattr(self, "_current_pack_ids", None)
            except Exception:
                pass
            text = getattr(resp, "content", "") or str(resp)
            tool_calls = getattr(resp, "tool_calls", None)
            return AgentRunResult(content=text, tool_calls=tool_calls)

        # Fallback minimal response (no AGNO)
        return AgentRunResult(
            content=f"[launcher] Received: {message}\n\nPlease install AGNO and configure Groq for full functionality.",
        )


def get_launcher_agent(session_id: Optional[str] = None) -> LauncherAgent:
    # Singleton-ish simple provider
    # In production we might keep it global; for now create per-request is fine
    return LauncherAgent(session_id=session_id)
