"""
AGNO Application Generator Service
==================================

Simple AGNO agent that generates complete applications.
Following AGNO docs pattern with proper knowledge base loading.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any

# AGNO imports
from agno.agent import Agent
from agno.tools.file import FileTools
from agno.tools.thinking import ThinkingTools
from agno.knowledge.url import UrlKnowledge
from agno.knowledge.combined import CombinedKnowledgeBase
from agno.vectordb.lancedb import LanceDb, SearchType

# Local imports
from app.config.llm_providers import llm_agentic
from app.knowledge.embedder_cache import get_embedder
from app.core.token_tracker import get_token_tracker, TokenTracker
from app.services.conversation_document_service import conversation_document_service
from app.knowledge.railway_config import railway_config

logger = logging.getLogger(__name__)

class AGNOApplicationGenerator:
    """Simple AGNO agent for generating applications"""
    
    def __init__(self):
        self.knowledge_base = None
        self.current_knowledge_sources = None  # Track current sources to detect changes
        self._warmup_done = False
        # Don't initialize knowledge base in __init__ - do it lazily when needed
    
    async def warmup_knowledge_base(self):
        """Simple warmup - just initialize the knowledge base once for better first-run UX"""
        if not self._warmup_done:
            try:
                logger.info("🚀 Warming up knowledge base for better UX...")
                await self._initialize_knowledge(None)  # Use default sources
                self._warmup_done = True
                logger.info("✅ Knowledge base warmup completed - first run will be fast!")
            except Exception as e:
                logger.warning(f"⚠️ Knowledge base warmup failed (not critical): {e}")
    
    async def _initialize_knowledge(self, knowledge_sources: list[str] = None, session_id: str = None, tenant_id: str = None, user_id: str = None):
        """Initialize AGNO Combined Knowledge Base with dynamic sources and optional session documents"""
        try:
            logger.info("🔍 Loading AGNO Combined Knowledge Base...")
            
            # Use provided knowledge sources or fallback to default AGNO URLs
            if knowledge_sources and len(knowledge_sources) > 0:
                agno_urls = knowledge_sources
                logger.info(f"📚 Using {len(agno_urls)} dynamic knowledge sources from frontend")
            else:
                # Fallback to default AGNO documentation
                agno_urls = [
                    "https://docs.agno.com/llms-full.txt",
                    "https://docs.agno.com/examples/agents/finance-agent",
                    "https://docs.agno.com/examples/agents/tweet-analysis-agent", 
                    "https://docs.agno.com/examples/agents/youtube-agent",
                    "https://docs.agno.com/examples/agents/research-agent",
                    "https://docs.agno.com/examples/agents/research-agent-exa",
                    "https://docs.agno.com/examples/agents/teaching-assistant",
                    "https://docs.agno.com/examples/agents/recipe-creator",
                    "https://docs.agno.com/examples/agents/movie-recommender",
                    "https://docs.agno.com/examples/agents/books-recommender",
                    "https://docs.agno.com/examples/agents/travel-planner", 
                    "https://docs.agno.com/examples/agents/startup-analyst-agent"
                ]
                logger.info(f"📚 Using {len(agno_urls)} default AGNO knowledge sources")
            
            # Create URL knowledge base with proper AGNO initialization
            logger.info(f"🔧 Creating UrlKnowledge with {len(agno_urls)} URLs...")
            
            # Create vector database with Railway-compatible path
            logger.info("🗄️ Initializing LanceDB vector database...")
            
            # Use Railway persistent storage if available
            if railway_config.is_railway_environment():
                lancedb_uri = railway_config.get_lancedb_path()
                table_path = f"{lancedb_uri}/agno_combined_knowledge"
                logger.info(f"🚂 Using Railway LanceDB path: {table_path}")
            else:
                table_path = "tmp/agno_combined_kb"
                logger.info(f"💻 Using local LanceDB path: {table_path}")
            
            vector_db = LanceDb(
                table_name="agno_combined_knowledge",
                uri=table_path,
                search_type=SearchType.hybrid,
                embedder=get_embedder()
            )
            logger.info(f"✅ LanceDB initialized: {vector_db}")
            
            # Create URL knowledge base with explicit parameter names and vector db
            logger.info("📚 Creating UrlKnowledge with vector database...")
            url_kb = UrlKnowledge(
                urls=agno_urls,
                vector_db=vector_db  # Explicitly pass vector database
            )
            logger.info(f"✅ UrlKnowledge created with vector_db: {url_kb.vector_db}")
            
            # Check for session documents and combine with URL sources
            knowledge_sources_list = [url_kb]
            
            if session_id and tenant_id and user_id:
                logger.info(f"🔍 Checking for session documents: {session_id}")
                session_kb = await conversation_document_service.get_session_knowledge_base(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    session_id=session_id
                )
                
                if session_kb:
                    knowledge_sources_list.append(session_kb)
                    logger.info(f"📄 Added session documents to knowledge base: {session_id}")
                else:
                    logger.info(f"📄 No session documents found for: {session_id}")
            
            logger.info("🔧 Creating CombinedKnowledgeBase...")
            # Create combined knowledge base with URL sources + session documents
            self.knowledge_base = CombinedKnowledgeBase(sources=knowledge_sources_list)
            logger.info(f"✅ CombinedKnowledgeBase created with {len(self.knowledge_base.sources)} sources")
            
            # Verify vector database is properly configured
            if hasattr(self.knowledge_base.sources[0], 'vector_db') and self.knowledge_base.sources[0].vector_db:
                logger.info(f"✅ Vector database confirmed in knowledge base: {self.knowledge_base.sources[0].vector_db}")
            else:
                logger.warning("⚠️ Vector database not found in knowledge base sources")
            
            # Load the knowledge base properly using AGNO pattern
            logger.info("🔄 Loading knowledge base with aload(recreate=False)...")
            await self.knowledge_base.aload(recreate=False)
            logger.info("✅ Knowledge base loaded successfully")
            
            # Store current sources for change detection
            self.current_knowledge_sources = agno_urls.copy() if agno_urls else None
            
            logger.info("✅ AGNO Combined Knowledge Base loaded successfully")
            
        except Exception as e:
            logger.error(f"❌ Knowledge base loading failed: {e}")
            self.knowledge_base = None
    
    async def generate_application(self, tenant_id: str, user_request: str, knowledge_sources: list[str] = None, session_id: str = None, user_id: str = "1", model: str = "kimi-k2") -> Dict[str, Any]:
        """Generate application using AGNO agent"""
        
        try:
            # Check if knowledge sources have changed and force reload if needed
            sources_changed = (
                self.current_knowledge_sources != knowledge_sources or
                (knowledge_sources is not None and self.current_knowledge_sources != knowledge_sources) or
                (knowledge_sources is None and self.current_knowledge_sources is not None)
            )
            
            # Initialize or reload knowledge base if needed
            if self.knowledge_base is None or sources_changed:
                if sources_changed or self.knowledge_base is None:
                    logger.info("🔄 Knowledge sources changed or not loaded - reloading knowledge base...")
                    await self._initialize_knowledge(knowledge_sources, session_id, tenant_id, user_id)  # Force reload
                else:
                    await self._initialize_knowledge(knowledge_sources)
            
            # Generate output directory (compatible with existing /applications system)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_dir = f"generated_apps/kiff_app_{timestamp}"
            
            # Ensure the output directory exists
            import os
            os.makedirs(output_dir, exist_ok=True)
            
            # Set up token tracking if session provided
            token_tracker = None
            if session_id:
                token_tracker = get_token_tracker(tenant_id, user_id, session_id)
                logger.info(f"🔢 Token tracking enabled for session {session_id}")
            
            # Get the selected model from the model parameter
            from app.config.llm_providers import get_tradeforge_models
            available_models = get_tradeforge_models()
            selected_llm = available_models.get(model, llm_agentic)  # Fallback to default if model not found
            
            logger.info(f"🤖 Using model: {model} for AGNO agent generation")
            
            # Create AGNO agent with streaming capabilities for better UX
            agent = Agent(
                model=selected_llm,
                knowledge=self.knowledge_base,
                search_knowledge=True,
                tools=[FileTools(), self._create_todo_tracker(), ThinkingTools(add_instructions=True)],
                show_tool_calls=True,
                stream_intermediate_steps=True,
                instructions=[
                    "You are a production-grade AI engineer specialized in the Agno framework.",
                    "Track your progress using the track_todo_progress tool.",
                    "Save all files to the specific directory provided in the prompt.",
                    "Use proper JSON formatting in all tool calls with quoted string values.",
                    "Think step by step and explain what you're doing for each file you create."
                ]
            )
            
            # Enhanced prompt with Docker requirement
            prompt = f"""Create a complete, deployable application for: {user_request}

Save all files to directory: {output_dir}/

CRITICAL REQUIREMENTS:
1. Include all necessary files to make it runnable
2. MUST include either Dockerfile OR docker-compose.yml for cloud deployment
3. Include proper README.md with setup instructions
4. Make it production-ready for cloud hosting

Generate a complete application with Docker configuration for easy deployment."""
            
            # Let AGNO do everything
            response = agent.run(prompt)
            
            # Track token usage from AGNO's native metrics
            if token_tracker:
                token_tracker.track_agno_run(agent)
                usage = token_tracker.get_current_usage()
                logger.info(f"🔢 Tokens consumed: {usage.format_display()} (Input: {usage.input_tokens}, Output: {usage.output_tokens})")
                
                # Persist to database for billing tracking with actual model used
                actual_model_id = getattr(llm_agentic, 'id', 'unknown')
                await token_tracker.persist_to_database(
                    operation_type='generation',
                    operation_id=f"kiff_app_{timestamp}",
                    model_name=actual_model_id,
                    provider='groq',
                    extra_data={
                        'user_request': user_request[:500],  # Truncate long requests
                        'knowledge_sources_count': len(knowledge_sources) if knowledge_sources else 0,
                        'output_dir': output_dir,
                        'version': 'v0.0',
                        'model_used': actual_model_id,
                        'agent_type': 'agno_application_generator'
                    }
                )
                
                # Also add to billing cycle consumption
                from app.services.billing_token_service import BillingTokenService
                from app.core.database import AsyncSessionLocal
                try:
                    async with AsyncSessionLocal() as db:
                        await BillingTokenService.record_token_consumption(
                            db=db,
                            tenant_id=tenant_id,
                            user_id=user_id,
                            session_id=session_id,
                            token_usage=usage,
                            operation_type='generation',
                            operation_id=f"kiff_app_{timestamp}",
                            model_name=actual_model_id,
                            provider='groq'
                        )
                        logger.info(f"💰 Added tokens to billing cycle: {usage.format_display()}")
                except Exception as e:
                    logger.error(f"❌ Failed to add tokens to billing cycle: {e}")
            
            return {
                "id": f"kiff_app_{timestamp}",
                "tenant_id": tenant_id,
                "output_dir": output_dir,
                "status": "completed",
                "response": str(response)  # Convert to string to avoid JSON serialization issues
            }
            
        except Exception as e:
            logger.error(f"❌ Generation failed: {e}")
            return {"status": "error", "error": str(e)}
    
    async def generate_application_streaming(self, tenant_id: str, user_request: str, knowledge_sources: list[str] = None, session_id: str = None, user_id: str = "1", model: str = "kimi-k2"):
        """Generate application using AGNO agent with streaming progress updates"""
        
        try:
            # Check if knowledge sources have changed and force reload if needed
            sources_changed = (
                self.current_knowledge_sources != knowledge_sources or
                (knowledge_sources is not None and self.current_knowledge_sources != knowledge_sources) or
                (knowledge_sources is None and self.current_knowledge_sources is not None)
            )
            
            # Initialize or reload knowledge base if needed
            if self.knowledge_base is None or sources_changed:
                if sources_changed:
                    yield {"type": "status", "content": {"message": "🔄 Knowledge sources changed, reloading knowledge base..."}}
                    logger.info("🔄 Knowledge sources changed, reloading knowledge base...")
                    self.knowledge_base = None  # Force reload
                
                # Check for session documents
                if session_id:
                    yield {"type": "status", "content": {"message": f"📄 Checking for session documents: {session_id}"}}
                
                await self._initialize_knowledge(knowledge_sources, session_id, tenant_id, user_id)
                yield {"type": "status", "content": {"message": "✅ Knowledge base loaded successfully"}}
            
            # Generate output directory
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_dir = f"generated_apps/kiff_app_{timestamp}"
            
            # Ensure the output directory exists
            import os
            os.makedirs(output_dir, exist_ok=True)
            
            yield {"type": "status", "content": {"message": f"📁 Created output directory: {output_dir}"}}
            
            # Set up token tracking
            token_tracker = None
            if session_id:
                token_tracker = get_token_tracker(tenant_id, user_id, session_id)
                logger.info(f"🔢 Token tracking enabled for session {session_id}")
                yield {"type": "status", "content": {"message": "🔢 Token tracking enabled"}}
            
            # Get the selected model from the model parameter
            from app.config.llm_providers import get_tradeforge_models
            available_models = get_tradeforge_models()
            selected_llm = available_models.get(model, llm_agentic)  # Fallback to default if model not found
            
            logger.info(f"🤖 Using model: {model} for AGNO agent streaming generation")
            yield {"type": "status", "content": {"message": f"🤖 Using {model} model for generation"}}
            
            # Create AGNO agent with streaming capabilities
            agent = Agent(
                model=selected_llm,
                knowledge=self.knowledge_base,
                search_knowledge=True,
                tools=[FileTools(), self._create_todo_tracker(), ThinkingTools(add_instructions=True)],
                show_tool_calls=True,
                stream_intermediate_steps=True,
                instructions=[
                    "You are a production-grade AI engineer specialized in the Agno framework.",
                    "Track your progress using the track_todo_progress tool.",
                    "Save all files to the specific directory provided in the prompt.",
                    "Use proper JSON formatting in all tool calls with quoted string values.",
                    "Think step by step and explain what you're doing for each file you create."
                ]
            )
            
            yield {"type": "status", "content": {"message": "🤖 AGNO agent created, starting generation..."}}
            
            # Enhanced prompt
            prompt = f"""Create a complete, deployable application for: {user_request}

Save all files to directory: {output_dir}/

CRITICAL REQUIREMENTS:
1. Include all necessary files to make it runnable
2. MUST include either Dockerfile OR docker-compose.yml for cloud deployment
3. Include proper README.md with setup instructions
4. Make it production-ready for cloud hosting

Generate a complete application with Docker configuration for easy deployment."""
            
            # Stream the AGNO agent execution with intermediate steps
            response_content = ""
            for event in agent.run(prompt, stream=True, stream_intermediate_steps=True):
                if hasattr(event, 'event'):
                    event_type = event.event
                    
                    if event_type == "ToolCallStarted":
                        tool_name = getattr(event.tool, 'tool_name', 'Unknown Tool')
                        yield {"type": "tool_started", "content": {"tool": tool_name, "message": f"🔧 Using tool: {tool_name}"}}
                        
                    elif event_type == "ToolCallCompleted":
                        tool_name = getattr(event.tool, 'tool_name', 'Unknown Tool')
                        if hasattr(event, 'result') and event.result:
                            # Check if it's a file creation
                            result_str = str(event.result)
                            if "Saved:" in result_str:
                                file_path = result_str.split("Saved:")[-1].strip()
                                yield {"type": "file_created", "content": {"file": file_path, "message": f"💾 Created: {file_path.split('/')[-1]}"}}
                            else:
                                yield {"type": "tool_completed", "content": {"tool": tool_name, "message": f"✅ Tool completed: {tool_name}"}}
                        else:
                            yield {"type": "tool_completed", "content": {"tool": tool_name, "message": f"✅ Tool completed: {tool_name}"}}
                        
                    elif event_type == "ReasoningStarted":
                        yield {"type": "thinking", "content": {"message": "🤔 Agent is thinking..."}}
                        
                    elif event_type == "ReasoningStep":
                        if hasattr(event, 'content') and event.content:
                            yield {"type": "reasoning", "content": {"message": f"💭 {str(event.content)[:200]}..."}}
                        
                    elif event_type == "ReasoningCompleted":
                        yield {"type": "thinking_done", "content": {"message": "✅ Reasoning completed"}}
                        
                    elif event_type == "RunResponseContent":
                        if hasattr(event, 'content') and event.content:
                            content_chunk = str(event.content)
                            response_content += content_chunk
                            yield {"type": "content", "content": {"chunk": content_chunk, "message": content_chunk}}
                            
                    elif event_type == "MemoryUpdateStarted":
                        yield {"type": "memory", "content": {"message": "💾 Updating memory..."}}
                        
                    elif event_type == "MemoryUpdateCompleted":
                        yield {"type": "memory", "content": {"message": "✅ Memory updated"}}
                
                # Fallback for other event types
                elif hasattr(event, 'content'):
                    response_content += str(event.content)
                    yield {"type": "content", "content": {"chunk": str(event.content), "message": str(event.content)}}
            
            # Track token usage
            if token_tracker:
                token_tracker.track_agno_run(agent)
                usage = token_tracker.get_current_usage()
                yield {"type": "tokens", "content": {"message": f"🔢 Tokens consumed: {usage.format_display()}", "usage": usage.format_display()}}
                
                # Persist to database
                actual_model_id = getattr(llm_agentic, 'id', 'unknown')
                await token_tracker.persist_to_database(
                    operation_type='generation',
                    operation_id=f"kiff_app_{timestamp}",
                    model_name=actual_model_id,
                    provider='groq',
                    extra_data={
                        'user_request': user_request[:500],
                        'knowledge_sources_count': len(knowledge_sources) if knowledge_sources else 0,
                        'output_dir': output_dir,
                        'version': 'v0.0',
                        'model_used': actual_model_id,
                        'agent_type': 'agno_application_generator_streaming'
                    }
                )
                
                # Also record in billing cycle
                from app.services.billing_token_service import BillingTokenService
                from app.core.database import AsyncSessionLocal
                try:
                    async with AsyncSessionLocal() as db:
                        await BillingTokenService.record_token_consumption(
                            db=db,
                            tenant_id=tenant_id,
                            user_id=user_id,
                            session_id=session_id,
                            token_usage=usage,
                            operation_type='generation',
                            operation_id=f"kiff_app_{timestamp}",
                            model_name=actual_model_id,
                            provider='groq'
                        )
                        yield {"type": "billing", "content": {"message": f"💰 Billing recorded: {usage.format_display()}"}}
                except Exception as e:
                    logger.error(f"❌ Failed to add tokens to billing cycle: {e}")
                    yield {"type": "error", "content": {"message": f"⚠️ Billing error: {str(e)}"}}
            
            # Final completion message
            yield {"type": "completed", "content": {
                "id": f"kiff_app_{timestamp}",
                "tenant_id": tenant_id,
                "output_dir": output_dir,
                "status": "completed",
                "message": "✅ Application generation completed successfully!",
                "response": response_content
            }}
            
        except Exception as e:
            logger.error(f"❌ Streaming generation failed: {e}")
            yield {"type": "error", "content": {"message": f"❌ Generation failed: {str(e)}", "error": str(e)}}
    
    def _create_todo_tracker(self):
        """Create a todo tracker tool following Julia BFF pattern"""
        
        # Initialize todo tracking state
        todo_state = {
            "current_plan": [],
            "completed_tasks": [],
            "current_task": None,
            "progress_log": []
        }
        
        def track_todo_progress(action: str, task_info: str = "") -> str:
            """
            Track and manage todo progress during file generation.
            
            Args:
                action (str): Action type - 'start_plan', 'start_task', 'complete_task', 'log_progress', 'get_status'
                task_info (str): Task information or progress details
                
            Returns:
                str: Status update or current progress information
            """
            nonlocal todo_state
            
            if action == "start_plan":
                if task_info:
                    plan_lines = [line.strip() for line in task_info.split("\n") if line.strip()]
                    todo_state["current_plan"] = plan_lines
                else:
                    todo_state["current_plan"] = []
                todo_state["completed_tasks"] = []
                todo_state["current_task"] = None
                todo_state["progress_log"].append(f"📋 Plan started with {len(todo_state['current_plan'])} tasks")
                return f"Plan tracking started: {len(todo_state['current_plan'])} tasks registered"
                
            elif action == "start_task":
                todo_state["current_task"] = task_info
                todo_state["progress_log"].append(f"🚀 Started: {task_info}")
                return f"Task started: {task_info}"
                
            elif action == "complete_task":
                if todo_state["current_task"]:
                    todo_state["completed_tasks"].append(todo_state["current_task"])
                    todo_state["progress_log"].append(f"✅ Completed: {todo_state['current_task']}")
                    completed_task = todo_state["current_task"]
                    todo_state["current_task"] = None
                    return f"Task completed: {completed_task}"
                return "No current task to complete"
                
            elif action == "log_progress":
                todo_state["progress_log"].append(f"📝 {task_info}")
                return f"Progress logged: {task_info}"
                
            elif action == "get_status":
                total_tasks = len(todo_state["current_plan"])
                completed_count = len(todo_state["completed_tasks"])
                current = todo_state["current_task"] or "None"
                
                status = f"""📊 TODO TRACKER STATUS:
                Total Tasks: {total_tasks}
                Completed: {completed_count}
                Current Task: {current}
                Progress: {completed_count}/{total_tasks} ({(completed_count/total_tasks*100) if total_tasks > 0 else 0:.1f}%)
                
                Recent Progress Log:
                """ + "\n                ".join(todo_state["progress_log"][-5:])
                
                return status
                
            else:
                return f"Unknown action: {action}. Use: start_plan, start_task, complete_task, log_progress, get_status"
        
        return track_todo_progress

# Global instance
agno_app_generator = AGNOApplicationGenerator()