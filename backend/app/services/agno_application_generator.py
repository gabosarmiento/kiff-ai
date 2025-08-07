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
from app.services.conversation_document_service import ConversationDocumentService
from app.models.conversation_models import Conversation, ConversationMessage, MessageRole, ConversationStatus
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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
    
    async def _generate_conversation_title(self, user_request: str) -> str:
        """Generate a meaningful conversation title based on user request"""
        try:
            # Extract key words and create a concise title
            words = user_request.lower().split()
            
            # Look for app-related keywords
            app_keywords = ['app', 'application', 'website', 'tool', 'dashboard', 'api', 'service']
            tech_keywords = ['react', 'next', 'vue', 'python', 'node', 'flask', 'django', 'fastapi']
            
            found_keywords = []
            for word in words[:10]:  # Check first 10 words
                clean_word = word.strip('.,!?"').lower()
                if clean_word in app_keywords or clean_word in tech_keywords:
                    found_keywords.append(clean_word.title())
            
            if found_keywords:
                title = f"{' '.join(found_keywords[:2])} Kiff"
            else:
                # Fallback: use first few words
                title_words = user_request.split()[:4]
                title = ' '.join(title_words).title()
                if not title.lower().endswith('kiff'):
                    title += " Kiff"
            
            # Ensure title is not too long
            return title[:50] if len(title) > 50 else title
            
        except Exception as e:
            logger.warning(f"Failed to generate conversation title: {e}")
            return "New Kiff"
    
    async def _create_conversation(self, tenant_id: str, user_id: str, session_id: str, 
                                 user_request: str, knowledge_sources: list[str] = None) -> int:
        """Create a new conversation for the kiff generation"""
        try:
            # Generate a meaningful title
            title = await self._generate_conversation_title(user_request)
            
            # Get database session
            async for db in get_db():
                # Create new conversation
                conversation = Conversation(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    title=title,
                    description=f"Kiff generation: {user_request[:100]}...",
                    session_id=session_id,
                    status=ConversationStatus.ACTIVE,
                    generator_type="v0",
                    knowledge_sources=knowledge_sources or [],
                    is_pinned=False
                )
                
                db.add(conversation)
                await db.commit()
                await db.refresh(conversation)
                
                logger.info(f"✅ Created conversation {conversation.id}: '{title}' for session {session_id}")
                return conversation.id
                
        except Exception as e:
            logger.error(f"Failed to create conversation: {e}")
            return None
    
    async def _add_conversation_message(self, conversation_id: int, role: MessageRole, 
                                      content: str, model_used: str = None, 
                                      token_count: int = None, app_info: dict = None):
        """Add a message to the conversation"""
        try:
            if not conversation_id:
                return
                
            async for db in get_db():
                # Get message count for ordering
                result = await db.execute(
                    select(ConversationMessage).where(
                        ConversationMessage.conversation_id == conversation_id
                    )
                )
                message_count = len(result.scalars().all())
                
                # Create new message
                message = ConversationMessage(
                    conversation_id=conversation_id,
                    role=role,
                    content=content,
                    message_order=message_count + 1,
                    model_used=model_used,
                    token_count=token_count,
                    app_info=app_info
                )
                
                db.add(message)
                await db.commit()
                
                logger.info(f"✅ Added {role.value} message to conversation {conversation_id}")
                
        except Exception as e:
            logger.error(f"Failed to add conversation message: {e}")
    
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
                    "Use explicit step-by-step reasoning and explain your thought clearly."
                    "Be conversational and explain each step as you work through the project.",
                    "IMPORTANT: When using save_file, reinforce format: save_file(file_name='path/file.ext', contents='your content'). Do not use 'filename' parameter."
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
        """Generate application using AGNO agent with conversational streaming progress updates"""
        
        # Conversation state tracking
        conversation_state = {
            "current_phase": "initialization",
            "files_created": [],
            "tools_used": [],
            "reasoning_steps": 0,
            "start_time": datetime.now()
        }
        
        try:
            # Initial greeting
            yield {"type": "conversation", "content": {"message": f"👋 Hi! I'm starting to work on your request: **{user_request}**"}}
            yield {"type": "conversation", "content": {"message": "Let me set everything up first and then I'll walk you through each step as I build your application."}}
            
            # Check if knowledge sources have changed and force reload if needed
            sources_changed = (
                self.current_knowledge_sources != knowledge_sources or
                (knowledge_sources is not None and self.current_knowledge_sources != knowledge_sources) or
                (knowledge_sources is None and self.current_knowledge_sources is not None)
            )
            
            # Initialize or reload knowledge base if needed
            if self.knowledge_base is None or sources_changed:
                conversation_state["current_phase"] = "loading_knowledge"
                
                if sources_changed:
                    yield {"type": "conversation", "content": {"message": "🔄 I notice you've changed the knowledge sources, so I need to reload my knowledge base with the new information."}}
                    logger.info("🔄 Knowledge sources changed, reloading knowledge base...")
                    self.knowledge_base = None  # Force reload
                else:
                    yield {"type": "conversation", "content": {"message": "📚 Let me load up my knowledge base with all the documentation and examples I'll need."}}
                
                # Check for session documents
                if session_id:
                    yield {"type": "conversation", "content": {"message": f"📄 I'm also checking if you've uploaded any documents for this session that I should reference..."}}
                
                await self._initialize_knowledge(knowledge_sources, session_id, tenant_id, user_id)
                
                knowledge_count = len(knowledge_sources) if knowledge_sources else "default"
                yield {"type": "conversation", "content": {"message": f"✅ Perfect! My knowledge base is loaded with {knowledge_count} sources. I'm ready to start building."}}
            
            # Generate output directory
            conversation_state["current_phase"] = "setup"
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_dir = f"generated_apps/kiff_app_{timestamp}"
            
            # Ensure the output directory exists
            import os
            os.makedirs(output_dir, exist_ok=True)
            
            yield {"type": "conversation", "content": {"message": f"📁 I've created a workspace directory for your project: `{output_dir.split('/')[-1]}`"}}
            
            # Set up token tracking
            token_tracker = None
            if session_id:
                token_tracker = get_token_tracker(tenant_id, user_id, session_id)
                logger.info(f"🔢 Token tracking enabled for session {session_id}")
                yield {"type": "conversation", "content": {"message": "🔢 Token tracking is enabled, so I'll keep track of usage for you."}}
            
            # Get the selected model
            from app.config.llm_providers import get_tradeforge_models
            available_models = get_tradeforge_models()
            selected_llm = available_models.get(model, llm_agentic)
            
            logger.info(f"🤖 Using model: {model} for AGNO agent streaming generation")
            yield {"type": "conversation", "content": {"message": f"🤖 I'll be using the **{model}** model for this generation. Let me initialize my AI agent..."}}
            
            # Create AGNO agent with streaming capabilities
            agent = Agent(
                model=selected_llm,
                knowledge=self.knowledge_base,
                search_knowledge=True,
                tools=[FileTools(), self._create_todo_tracker(), ThinkingTools(add_instructions=True)],
                show_tool_calls=True,
                show_full_reasoning=True,
                stream_intermediate_steps=True,
                instructions=[
                    "You are a production-grade AI engineer that uses knowledge and tools to build the requested prompt.",
                    "You have access to multiple knowledge documents—use **all** of them.",
                    "Ground every step in the provided knowledge sources.",
                    "Explain your thinking and what you're doing as you work.",
                    "Track your progress using the track_todo_progress tool and narrate your actions.",
                    "Save all files to the specific directory provided in the prompt.",
                    "Use proper JSON formatting in all tool calls with quoted string values.",
                    "Only use information found in your knowledge. Do NOT hallucinate or introduce your own knowledge.",
                    "Be conversational and explain each step as you work through the project.",
                    "IMPORTANT: When using save_file, reinforce format: save_file(file_name='path/file.ext', contents='your content'). Do not use 'filename' parameter."
                ]
            )
            
            conversation_state["current_phase"] = "planning"
            yield {"type": "conversation", "content": {"message": "🤖 My AI agent is ready! Now I'm going to start analyzing your request and planning the application architecture."}}
            
            # Create conversation for this kiff generation
            conversation_id = await self._create_conversation(
                tenant_id=tenant_id,
                user_id=user_id,
                session_id=session_id,
                user_request=user_request,
                knowledge_sources=knowledge_sources
            )
            
            # Add user's initial message to conversation
            if conversation_id:
                await self._add_conversation_message(
                    conversation_id=conversation_id,
                    role=MessageRole.USER,
                    content=user_request
                )
                yield {"type": "conversation", "content": {"message": "💬 Created conversation history for this kiff generation."}}
            
            # Enhanced prompt
            prompt = f"""Create a complete, deployable application for: {user_request}

Save all files to directory: {output_dir}/

CRITICAL REQUIREMENTS:
1. Include all necessary files to make it runnable
2. MUST include either Dockerfile OR docker-compose.yml for cloud deployment
3. Include proper README.md with setup instructions
4. Make it production-ready for cloud hosting

IMPORTANT: As you work, explain what you're doing and why. Think of this as a conversation where you're walking the user through your development process.

Generate a complete application with Docker configuration for easy deployment."""
            
            # Stream the AGNO agent execution with conversational updates
            response_content = ""
            current_tool = None
            reasoning_count = 0
            
            for event in agent.run(prompt, stream=True, stream_intermediate_steps=True):
                if hasattr(event, 'event'):
                    event_type = event.event
                    
                    if event_type == "ToolCallStarted":
                        tool_name = getattr(event.tool, 'tool_name', 'Unknown Tool')
                        current_tool = tool_name
                        conversation_state["tools_used"].append(tool_name)
                        
                        # Conversational tool messages
                        if tool_name == "search_knowledge":
                            yield {"type": "conversation", "content": {"message": "🔍 I'm searching through my knowledge base for relevant examples and patterns..."}}
                        elif tool_name == "write_file":
                            yield {"type": "conversation", "content": {"message": "✍️ I'm writing a new file for the project..."}}
                        elif tool_name == "read_file":
                            yield {"type": "conversation", "content": {"message": "👀 Let me read an existing file to understand the current structure..."}}
                        elif "todo" in tool_name.lower():
                            yield {"type": "conversation", "content": {"message": "📋 Updating my project plan and progress tracking..."}}
                        else:
                            yield {"type": "conversation", "content": {"message": f"🔧 Using {tool_name} to help with the development..."}}
                        
                    elif event_type == "ToolCallCompleted":
                        tool_name = getattr(event.tool, 'tool_name', 'Unknown Tool')
                        if hasattr(event, 'result') and event.result:
                            result_str = str(event.result)
                            
                            # File creation feedback
                            if "Saved:" in result_str or tool_name == "write_file":
                                file_path = result_str.split("Saved:")[-1].strip() if "Saved:" in result_str else "new file"
                                file_name = file_path.split('/')[-1] if '/' in file_path else file_path
                                conversation_state["files_created"].append(file_name)
                                
                                # Send conversational message
                                yield {"type": "conversation", "content": {"message": f"💾 Created **{file_name}** - this handles {self._explain_file_purpose(file_name)}"}}
                                
                                # Send file_created event with file data for frontend
                                try:
                                    # Try to read the file content to send to frontend
                                    import os
                                    if os.path.exists(file_path):
                                        with open(file_path, 'r', encoding='utf-8') as f:
                                            file_content = f.read()
                                        
                                        yield {
                                            "type": "file_created", 
                                            "content": {
                                                "message": f"File created: {file_name}",
                                                "file_path": file_path,
                                                "file_content": file_content
                                            }
                                        }
                                except Exception as e:
                                    logger.warning(f"Could not read file content for {file_path}: {e}")
                            
                            # Knowledge search feedback  
                            elif tool_name == "search_knowledge":
                                yield {"type": "conversation", "content": {"message": "✅ Found some great examples and documentation that will help guide the implementation."}}
                            
                            # Todo tracking feedback
                            elif "todo" in tool_name.lower():
                                if "started" in result_str.lower():
                                    yield {"type": "conversation", "content": {"message": "📋 I've outlined my plan and I'm tracking progress as I go."}}
                                elif "completed" in result_str.lower():
                                    yield {"type": "conversation", "content": {"message": "✅ Marked another task as complete in my progress tracker."}}
                            else:
                                yield {"type": "conversation", "content": {"message": f"✅ Finished using {tool_name} successfully."}}
                        
                    elif event_type == "ReasoningStarted":
                        conversation_state["current_phase"] = "thinking"
                        reasoning_count += 1
                        conversation_state["reasoning_steps"] = reasoning_count
                        
                        if reasoning_count == 1:
                            yield {"type": "conversation", "content": {"message": "🤔 Let me think through the architecture and approach for this application..."}}
                        elif reasoning_count <= 3:
                            yield {"type": "conversation", "content": {"message": "💭 Analyzing the requirements and planning the next steps..."}}
                        
                    elif event_type == "ReasoningStep":
                        if hasattr(event, 'content') and event.content:
                            reasoning_text = str(event.content)
                            # Only show particularly interesting reasoning steps to avoid spam
                            if any(keyword in reasoning_text.lower() for keyword in ['create', 'implement', 'structure', 'design', 'approach']):
                                shortened = reasoning_text[:150] + "..." if len(reasoning_text) > 150 else reasoning_text
                                yield {"type": "conversation", "content": {"message": f"💡 {shortened}"}}
                        
                    elif event_type == "ReasoningCompleted":
                        yield {"type": "conversation", "content": {"message": "✨ I've got a clear plan now. Let me start implementing..."}}
                        conversation_state["current_phase"] = "implementation"
                        
                    elif event_type == "RunResponseContent":
                        if hasattr(event, 'content') and event.content:
                            content_chunk = str(event.content)
                            response_content += content_chunk
                            
                            # Only show substantial content chunks to avoid noise
                            if len(content_chunk) > 50:
                                preview = content_chunk[:100] + "..." if len(content_chunk) > 100 else content_chunk
                                yield {"type": "conversation", "content": {"message": f"📝 {preview}"}}
                            
                    elif event_type == "MemoryUpdateStarted":
                        yield {"type": "conversation", "content": {"message": "💾 Saving my progress to memory so I can reference it later..."}}
                        
                    elif event_type == "MemoryUpdateCompleted":
                        yield {"type": "conversation", "content": {"message": "✅ Progress saved! I can now build on what I've learned."}}
                
                # Fallback for other event types
                elif hasattr(event, 'content'):
                    content = str(event.content)
                    response_content += content
                    if len(content) > 30:  # Only show meaningful content
                        yield {"type": "conversation", "content": {"message": content}}
            
            # Completion summary
            conversation_state["current_phase"] = "completed"
            elapsed_time = datetime.now() - conversation_state["start_time"]
            
            yield {"type": "conversation", "content": {"message": f"🎉 **Application completed!** I've created {len(conversation_state['files_created'])} files in {elapsed_time.seconds} seconds."}}
            
            if conversation_state["files_created"]:
                files_list = ", ".join(conversation_state['files_created'][:5])  # Show first 5 files
                more_count = len(conversation_state['files_created']) - 5
                if more_count > 0:
                    files_list += f" and {more_count} more"
                yield {"type": "conversation", "content": {"message": f"📦 **Files created**: {files_list}"}}
            
            yield {"type": "conversation", "content": {"message": "🚀 Your application is ready to deploy! Check the README for setup instructions."}}
            
            # Save assistant's final response to conversation
            if conversation_id:
                # Create a summary of the generation for the conversation
                app_summary = f"Successfully generated a complete kiff application based on your request: '{user_request}'. "
                app_summary += f"Created {len(conversation_state['files_created'])} files including all necessary components for deployment. "
                app_summary += f"The application is ready to run and includes Docker configuration for cloud hosting."
                
                # Add app generation info
                app_info = {
                    "files_created": conversation_state["files_created"],
                    "tools_used": conversation_state["tools_used"],
                    "reasoning_steps": conversation_state["reasoning_steps"],
                    "generation_time_seconds": elapsed_time.seconds,
                    "output_directory": output_dir,
                    "status": "completed"
                }
                
                await self._add_conversation_message(
                    conversation_id=conversation_id,
                    role=MessageRole.ASSISTANT,
                    content=app_summary,
                    model_used=model,
                    app_info=app_info
                )
                
                yield {"type": "conversation", "content": {"message": "💬 Saved this kiff generation to your conversation history."}}
            
            # Track token usage
            if token_tracker:
                token_tracker.track_agno_run(agent)
                usage = token_tracker.get_current_usage()
                yield {"type": "conversation", "content": {"message": f"📊 **Resource usage**: {usage.format_display()} tokens consumed for this generation."}}
                
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
                        'agent_type': 'agno_application_generator_streaming',
                        'files_created': len(conversation_state["files_created"]),
                        'tools_used': len(conversation_state["tools_used"]),
                        'reasoning_steps': conversation_state["reasoning_steps"]
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
                        yield {"type": "conversation", "content": {"message": "💰 Usage has been recorded to your billing account."}}
                except Exception as e:
                    logger.error(f"❌ Failed to add tokens to billing cycle: {e}")
                    yield {"type": "conversation", "content": {"message": "⚠️ Note: There was an issue recording billing information, but your application was created successfully."}}
            
            # Final completion message with all details
            yield {"type": "completed", "content": {
                "id": f"kiff_app_{timestamp}",
                "tenant_id": tenant_id,
                "output_dir": output_dir,
                "status": "completed",
                "message": "✅ Your application has been generated successfully and is ready to use!",
                "response": response_content,
                "stats": {
                    "files_created": len(conversation_state["files_created"]),
                    "tools_used": len(conversation_state["tools_used"]),
                    "reasoning_steps": conversation_state["reasoning_steps"],
                    "duration_seconds": elapsed_time.seconds
                }
            }}
            
        except Exception as e:
            logger.error(f"❌ Streaming generation failed: {e}")
            yield {"type": "conversation", "content": {"message": f"😔 I'm sorry, but I encountered an error while working on your application: {str(e)}"}}
            yield {"type": "conversation", "content": {"message": "🔄 You might want to try again, or if this keeps happening, please let the team know about this issue."}}
            yield {"type": "error", "content": {"message": f"❌ Generation failed: {str(e)}", "error": str(e)}}
    
    def _explain_file_purpose(self, filename: str) -> str:
        """Provide a human-readable explanation of what a file does based on its name/extension"""
        filename_lower = filename.lower()
        
        # Common patterns
        if filename_lower.endswith('.py'):
            if 'main' in filename_lower or 'app' in filename_lower:
                return "the main application entry point"
            elif 'model' in filename_lower:
                return "data models and database schemas"
            elif 'view' in filename_lower or 'route' in filename_lower:
                return "API routes and request handling"
            elif 'service' in filename_lower:
                return "business logic and services"
            elif 'config' in filename_lower:
                return "application configuration"
            elif 'test' in filename_lower:
                return "automated tests"
            else:
                return "Python application logic"
                
        elif filename_lower.endswith(('.js', '.jsx')):
            if 'app' in filename_lower or 'index' in filename_lower:
                return "the main React application"
            elif 'component' in filename_lower:
                return "reusable UI components"
            else:
                return "JavaScript functionality"
                
        elif filename_lower.endswith(('.ts', '.tsx')):
            return "TypeScript application logic"
            
        elif filename_lower.endswith('.html'):
            return "the web page structure"
            
        elif filename_lower.endswith('.css'):
            return "styling and visual design"
            
        elif filename_lower == 'dockerfile':
            return "containerization for deployment"
            
        elif filename_lower == 'docker-compose.yml':
            return "multi-container deployment setup"
            
        elif filename_lower == 'requirements.txt':
            return "Python package dependencies"
            
        elif filename_lower == 'package.json':
            return "Node.js project configuration and dependencies"
            
        elif filename_lower == 'readme.md':
            return "documentation and setup instructions"
            
        elif filename_lower.endswith('.env'):
            return "environment variables and secrets"
            
        elif filename_lower.endswith('.yml') or filename_lower.endswith('.yaml'):
            return "configuration in YAML format"
            
        elif filename_lower.endswith('.json'):
            return "structured data configuration"
            
        elif filename_lower.endswith('.sql'):
            return "database schema and queries"
            
        else:
            return "application configuration and setup"
    
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