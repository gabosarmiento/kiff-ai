"""
Advanced AGNO Application Generator V0.1
========================================

Enhanced AGNO agent generator that processes the full AGNO documentation
to create sophisticated agents capable of executing complex tasks.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List

# AGNO imports
from agno.agent import Agent
from agno.tools.file import FileTools
from agno.knowledge.url import UrlKnowledge
from agno.vectordb.lancedb import LanceDb, SearchType

# Local imports
from app.config.llm_providers import llm_agentic
from app.knowledge.embedder_cache import get_embedder
from app.core.token_tracker import get_token_tracker, TokenTracker

# Modular RAG integration
from app.services.modular_rag_service import get_rag_service, search_rag
from app.knowledge.interfaces.agentic_rag_interface import DomainConfig

logger = logging.getLogger(__name__)

class AdvancedAGNOGenerator:
    """Advanced AGNO agent generator with comprehensive documentation knowledge"""
    
    def __init__(self):
        self.knowledge_base = None
        self.rag_service = None
        self._warmup_done = False
        self._rag_initialized = False
        
    async def warmup_comprehensive_knowledge(self):
        """Initialize comprehensive AGNO knowledge base with modular RAG"""
        if not self._warmup_done:
            try:
                logger.info("🚀 Warming up v0.1 enhanced knowledge system...")
                
                # Initialize modular RAG service
                await self._initialize_modular_rag()
                
                # Also initialize traditional knowledge base for compatibility
                await self._initialize_comprehensive_knowledge()
                
                self._warmup_done = True
                logger.info("✅ v0.1 Enhanced knowledge system ready!")
            except Exception as e:
                logger.warning(f"⚠️ Knowledge base warmup failed (not critical): {e}")
    
    async def _initialize_modular_rag(self):
        """Initialize modular RAG system with comprehensive AGNO knowledge"""
        try:
            logger.info("🧱 Initializing modular RAG system for v0.1...")
            
            # Get RAG service instance
            self.rag_service = await get_rag_service()
            
            # Create comprehensive AGNO domain configuration
            agno_domain_config = DomainConfig(
                name="agno_comprehensive",
                display_name="AGNO Framework - Comprehensive Documentation",
                description="Complete AGNO framework documentation with examples, patterns, and best practices",
                sources=[
                    # Core documentation
                    "https://docs.agno.com/llms-full.txt",
                    "https://docs.agno.com/introduction",
                    "https://docs.agno.com/agents",
                    "https://docs.agno.com/tools",
                    "https://docs.agno.com/knowledge",
                    "https://docs.agno.com/vectordb",
                    "https://docs.agno.com/storage",
                    "https://docs.agno.com/workflows",
                    
                    # Advanced examples
                    "https://docs.agno.com/examples/agents/finance-agent",
                    "https://docs.agno.com/examples/agents/research-agent",
                    "https://docs.agno.com/examples/agents/youtube-agent",
                    "https://docs.agno.com/examples/agents/teaching-assistant",
                    
                    # Tools and patterns
                    "https://docs.agno.com/tools/builtin",
                    "https://docs.agno.com/tools/custom",
                    "https://docs.agno.com/patterns/async",
                    "https://docs.agno.com/patterns/streaming"
                ],
                priority=1,
                extraction_strategy="agentic_pipeline",
                keywords=["agno", "agents", "tools", "knowledge", "vectordb", "workflows", "patterns"]
            )
            
            # Process AGNO domain through RAG system (background processing)
            logger.info("📚 Processing comprehensive AGNO knowledge through RAG system...")
            async for metrics in self.rag_service.process_domain(agno_domain_config):
                logger.info(f"RAG Processing: {metrics.stage.value} - {metrics.status} ({metrics.urls_processed} URLs, {metrics.chunks_created} chunks)")
                if metrics.status == "completed":
                    break
            
            self._rag_initialized = True
            logger.info("✅ Modular RAG system initialized with comprehensive AGNO knowledge")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize modular RAG system: {e}")
            # Continue without RAG - fallback to traditional approach
            self._rag_initialized = False
    
    async def _initialize_comprehensive_knowledge(self):
        """Initialize comprehensive AGNO knowledge base from full documentation"""
        try:
            logger.info("📚 Loading comprehensive AGNO documentation...")
            
            # Full AGNO documentation sources
            agno_comprehensive_sources = [
                # Core documentation
                "https://docs.agno.com/llms-full.txt",  # Complete LLM documentation
                
                # Framework fundamentals
                "https://docs.agno.com/introduction",
                "https://docs.agno.com/agents",
                "https://docs.agno.com/tools",
                "https://docs.agno.com/knowledge",
                "https://docs.agno.com/vectordb", 
                "https://docs.agno.com/storage",
                "https://docs.agno.com/workflows",
                
                # Advanced patterns
                "https://docs.agno.com/examples/agents/finance-agent",
                "https://docs.agno.com/examples/agents/research-agent",
                "https://docs.agno.com/examples/agents/research-agent-exa",
                "https://docs.agno.com/examples/agents/youtube-agent",
                "https://docs.agno.com/examples/agents/tweet-analysis-agent",
                "https://docs.agno.com/examples/agents/teaching-assistant",
                "https://docs.agno.com/examples/agents/recipe-creator",
                "https://docs.agno.com/examples/agents/movie-recommender",
                "https://docs.agno.com/examples/agents/books-recommender",
                "https://docs.agno.com/examples/agents/travel-planner",
                "https://docs.agno.com/examples/agents/startup-analyst-agent",
                
                # Tools and integrations
                "https://docs.agno.com/tools/builtin",
                "https://docs.agno.com/tools/custom",
                "https://docs.agno.com/tools/file-tools",
                "https://docs.agno.com/tools/web-tools",
                "https://docs.agno.com/tools/database-tools",
                
                # Knowledge and retrieval
                "https://docs.agno.com/knowledge/pdf",
                "https://docs.agno.com/knowledge/website",
                "https://docs.agno.com/knowledge/combined",
                
                # Vector databases
                "https://docs.agno.com/vectordb/lancedb",
                "https://docs.agno.com/vectordb/pgvector",
                "https://docs.agno.com/vectordb/chroma",
                
                # Workflows and orchestration
                "https://docs.agno.com/workflows/introduction",
                "https://docs.agno.com/workflows/examples",
                
                # Best practices and patterns
                "https://docs.agno.com/patterns/async",
                "https://docs.agno.com/patterns/streaming",
                "https://docs.agno.com/patterns/error-handling",
                "https://docs.agno.com/patterns/memory",
                "https://docs.agno.com/patterns/monitoring"
            ]
            
            logger.info(f"📖 Processing {len(agno_comprehensive_sources)} comprehensive AGNO documentation sources")
            
            # Create advanced vector database
            logger.info("🗄️ Initializing advanced LanceDB vector database...")
            vector_db = LanceDb(
                table_name="agno_comprehensive_knowledge_v01",
                uri="tmp/agno_comprehensive_kb_v01",
                search_type=SearchType.hybrid,  # Use hybrid search for better retrieval
                embedder=get_embedder()
            )
            logger.info(f"✅ Advanced LanceDB initialized with hybrid search")
            
            # Create comprehensive URL knowledge base
            logger.info("📚 Creating comprehensive URL knowledge base...")
            url_kb = UrlKnowledge(
                urls=agno_comprehensive_sources,
                vector_db=vector_db
            )
            logger.info(f"✅ Comprehensive URL knowledge created")
            
            # Load all knowledge sources
            logger.info("🔄 Loading comprehensive knowledge base (this may take a while)...")
            await url_kb.aload(recreate=False)
            
            self.knowledge_base = url_kb
            logger.info("✅ Comprehensive AGNO knowledge base loaded successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize comprehensive knowledge base: {e}")
            self.knowledge_base = None
    
    async def generate_advanced_application(
        self, 
        tenant_id: str, 
        user_request: str,
        session_id: str = None, 
        user_id: str = "1"
    ) -> Dict[str, Any]:
        """Generate advanced application with comprehensive AGNO knowledge and modular RAG"""
        
        try:
            # Initialize comprehensive knowledge if needed
            if self.knowledge_base is None:
                await self._initialize_comprehensive_knowledge()
            
            # Initialize modular RAG if needed
            if not self._rag_initialized:
                await self._initialize_modular_rag()
            
            # Generate output directory
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_dir = f"generated_apps/kiff_v01_app_{timestamp}"
            
            # Ensure output directory exists
            import os
            os.makedirs(output_dir, exist_ok=True)
            
            # Set up token tracking
            token_tracker = None
            if session_id:
                token_tracker = get_token_tracker(tenant_id, user_id, session_id)
                logger.info(f"🔢 Advanced token tracking enabled for session {session_id}")
            
            # Use modular RAG to enhance user request with relevant knowledge
            enhanced_context = ""
            if self.rag_service and self.rag_service.is_healthy():
                try:
                    # Search for relevant knowledge using modular RAG
                    rag_results = await self.rag_service.search_knowledge(
                        query=user_request,
                        max_results=10,
                        min_relevance=0.7
                    )
                    
                    if rag_results:
                        logger.info(f"🔍 Found {len(rag_results)} relevant knowledge chunks via modular RAG")
                        
                        # Build enhanced context from RAG results
                        context_chunks = []
                        for result in rag_results[:5]:  # Use top 5 most relevant
                            context_chunks.append(f"**{result.source}**: {result.content}")
                        
                        enhanced_context = "\n\n**RELEVANT KNOWLEDGE FROM RAG:**\n" + "\n\n".join(context_chunks) + "\n\n"
                        logger.info(f"📚 Enhanced request with {len(context_chunks)} knowledge chunks")
                    else:
                        logger.info("🔍 No relevant knowledge found via modular RAG")
                        
                except Exception as e:
                    logger.warning(f"⚠️ Modular RAG search failed, continuing with base knowledge: {e}")
            
            # Create advanced AGNO agent with comprehensive knowledge
            agent = Agent(
                model=llm_agentic,
                knowledge=self.knowledge_base,
                search_knowledge=True,
                tools=[FileTools(), self._create_advanced_task_tracker()],
                instructions=[
                    "You are an expert AI engineer specialized in the AGNO framework with comprehensive knowledge.",
                    "You have access to the complete AGNO documentation and all advanced patterns.",
                    "Create production-grade, sophisticated applications that leverage AGNO's full capabilities.",
                    "Use advanced AGNO patterns including workflows, custom tools, knowledge bases, and vector databases.",
                    "Include proper error handling, async patterns, streaming capabilities, and monitoring.",
                    "Track your progress using the advanced_task_tracker tool for complex multi-step operations.",
                    "Generate applications that demonstrate AGNO best practices and advanced features.",
                    "Always include comprehensive documentation and deployment instructions.",
                    "Use proper typing, error handling, and follow AGNO architectural patterns.",
                    "Leverage the provided relevant knowledge context to create more accurate and contextual solutions."
                ]
            )
            
            # Enhanced prompt for advanced applications with RAG context
            enhanced_prompt = f"""Create a sophisticated, production-ready application for: {user_request}

{enhanced_context}Save all files to directory: {output_dir}/

ADVANCED REQUIREMENTS:
1. **AGNO Integration**: Use advanced AGNO patterns from the comprehensive documentation
2. **Agent Architecture**: Implement proper agent-based architecture with tools and knowledge bases
3. **Vector Database**: Include vector database setup (LanceDB preferred) for knowledge retrieval
4. **Async Patterns**: Use async/await patterns throughout for optimal performance  
5. **Custom Tools**: Create custom tools specific to the application domain
6. **Knowledge Integration**: Set up knowledge bases relevant to the application
7. **Workflow Orchestration**: Use AGNO workflows for complex multi-step processes
8. **Error Handling**: Implement comprehensive error handling and logging
9. **Monitoring**: Include monitoring and observability features
10. **Streaming**: Support streaming responses where applicable
11. **Docker Deployment**: Include production-ready Docker configuration
12. **Documentation**: Comprehensive README with AGNO setup instructions
13. **Testing**: Include test files and testing strategies
14. **Best Practices**: Follow all AGNO architectural best practices
15. **Context-Driven**: Use the provided relevant knowledge context to create accurate, well-informed solutions

Create a sophisticated application that showcases AGNO's advanced capabilities and serves as a reference implementation.

IMPORTANT: If relevant knowledge context is provided above, prioritize and integrate those specific patterns, APIs, and best practices into your implementation."""
            
            # Generate with comprehensive AGNO knowledge
            logger.info(f"🤖 Generating advanced AGNO application with comprehensive knowledge...")
            response = agent.run(enhanced_prompt)
            
            # Track token usage with advanced metrics
            if token_tracker:
                token_tracker.track_agno_run(agent)
                usage = token_tracker.get_current_usage()
                logger.info(f"🔢 Advanced generation tokens: {usage.format_display()}")
                
                # Persist to billing database with actual model used
                actual_model_id = getattr(llm_agentic, 'id', 'unknown')
                await token_tracker.persist_to_database(
                    operation_type='advanced_generation',
                    operation_id=f"kiff_v01_{timestamp}",
                    model_name=actual_model_id,
                    provider='groq',
                    extra_data={
                        'user_request': user_request[:500],
                        'comprehensive_knowledge': True,
                        'advanced_features': True,
                        'output_dir': output_dir,
                        'version': 'v0.1',
                        'model_used': actual_model_id,
                        'agent_type': 'advanced_agno_generator'
                    }
                )
                logger.info(f"💰 Advanced tokens tracked in billing cycle")
            
            return {
                "id": f"kiff_v01_app_{timestamp}",
                "tenant_id": tenant_id,
                "output_dir": output_dir,
                "status": "completed",
                "version": "v0.1",
                "features": {
                    "comprehensive_agno_knowledge": True,
                    "advanced_patterns": True,
                    "vector_database_integration": True,
                    "workflow_orchestration": True,
                    "custom_tools": True,
                    "async_streaming": True,
                    "production_ready": True
                },
                "response": str(response)
            }
            
        except Exception as e:
            logger.error(f"❌ Advanced generation failed: {e}")
            return {
                "status": "error", 
                "error": str(e),
                "version": "v0.1"
            }
    
    def _create_advanced_task_tracker(self):
        """Create advanced task tracker for complex operations"""
        
        # Advanced task tracking state
        task_state = {
            "project_plan": [],
            "current_phase": None,
            "completed_phases": [],
            "current_tasks": [],
            "completed_tasks": [],
            "progress_log": [],
            "architecture_decisions": [],
            "technology_stack": [],
            "error_log": []
        }
        
        def advanced_task_tracker(
            action: str, 
            phase: str = "",
            task_info: str = "", 
            details: str = ""
        ) -> str:
            """
            Advanced task tracking for sophisticated AGNO application development.
            
            Args:
                action (str): Action type - 'init_project', 'start_phase', 'complete_phase', 
                             'add_task', 'complete_task', 'log_architecture', 'log_tech_stack', 
                             'log_progress', 'log_error', 'get_status'
                phase (str): Current development phase
                task_info (str): Task description
                details (str): Additional details or context
                
            Returns:
                str: Status update or progress information
            """
            nonlocal task_state
            
            if action == "init_project":
                task_state["project_plan"] = task_info.split("\n") if task_info else []
                task_state["current_phase"] = None
                task_state["completed_phases"] = []
                task_state["progress_log"].append(f"🚀 Project initialized: {phase}")
                return f"Advanced project tracking initialized with {len(task_state['project_plan'])} phases"
                
            elif action == "start_phase":
                task_state["current_phase"] = phase
                task_state["current_tasks"] = []
                task_state["progress_log"].append(f"📋 Phase started: {phase}")
                return f"Started phase: {phase}"
                
            elif action == "complete_phase":
                if task_state["current_phase"]:
                    task_state["completed_phases"].append(task_state["current_phase"])
                    task_state["progress_log"].append(f"✅ Phase completed: {task_state['current_phase']}")
                    task_state["current_phase"] = None
                return f"Phase completed: {phase}"
                
            elif action == "add_task":
                task_state["current_tasks"].append({
                    "task": task_info,
                    "phase": phase,
                    "details": details,
                    "started_at": datetime.now().isoformat()
                })
                task_state["progress_log"].append(f"📝 Task added: {task_info}")
                return f"Task added to {phase}: {task_info}"
                
            elif action == "complete_task":
                completed_task = {
                    "task": task_info,
                    "phase": phase,
                    "details": details,
                    "completed_at": datetime.now().isoformat()
                }
                task_state["completed_tasks"].append(completed_task)
                # Remove from current tasks
                task_state["current_tasks"] = [
                    t for t in task_state["current_tasks"] 
                    if t["task"] != task_info
                ]
                task_state["progress_log"].append(f"✅ Task completed: {task_info}")
                return f"Task completed: {task_info}"
                
            elif action == "log_architecture":
                decision = {
                    "component": phase,
                    "decision": task_info,
                    "rationale": details,
                    "timestamp": datetime.now().isoformat()
                }
                task_state["architecture_decisions"].append(decision)
                task_state["progress_log"].append(f"🏗️ Architecture decision: {task_info}")
                return f"Architecture decision logged for {phase}"
                
            elif action == "log_tech_stack":
                tech = {
                    "category": phase,
                    "technology": task_info,
                    "purpose": details,
                    "timestamp": datetime.now().isoformat()
                }
                task_state["technology_stack"].append(tech)
                task_state["progress_log"].append(f"🔧 Tech stack: {task_info}")
                return f"Technology added to stack: {task_info}"
                
            elif action == "log_progress":
                task_state["progress_log"].append(f"📈 {task_info}")
                return f"Progress logged: {task_info}"
                
            elif action == "log_error":
                error = {
                    "phase": phase,
                    "error": task_info,
                    "context": details,
                    "timestamp": datetime.now().isoformat()
                }
                task_state["error_log"].append(error)
                task_state["progress_log"].append(f"❌ Error: {task_info}")
                return f"Error logged: {task_info}"
                
            elif action == "get_status":
                total_phases = len(task_state["project_plan"])
                completed_phases = len(task_state["completed_phases"])
                current_tasks_count = len(task_state["current_tasks"])
                completed_tasks_count = len(task_state["completed_tasks"])
                
                status = f"""🎯 ADVANCED PROJECT STATUS:
                
📊 Overall Progress:
- Total Phases: {total_phases}
- Completed Phases: {completed_phases}  
- Current Phase: {task_state['current_phase'] or 'None'}
- Progress: {(completed_phases/total_phases*100) if total_phases > 0 else 0:.1f}%

📋 Task Status:
- Active Tasks: {current_tasks_count}
- Completed Tasks: {completed_tasks_count}

🏗️ Architecture Decisions: {len(task_state['architecture_decisions'])}
🔧 Technology Stack Items: {len(task_state['technology_stack'])}
❌ Errors Encountered: {len(task_state['error_log'])}

Recent Progress:
""" + "\n".join(task_state["progress_log"][-5:])
                
                return status
                
            else:
                return f"Unknown action: {action}. Available actions: init_project, start_phase, complete_phase, add_task, complete_task, log_architecture, log_tech_stack, log_progress, log_error, get_status"
        
        return advanced_task_tracker

# Global instance
advanced_agno_generator = AdvancedAGNOGenerator()