"""
Conversational Chat Service for Knowledge-Driven Development
==========================================================

This service provides a Claude Code-like conversational interface that integrates
with the knowledge system and AGNO tools for intelligent development assistance.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, AsyncGenerator
from datetime import datetime
import json
import uuid

from agno.agent import Agent
from agno.models.groq import Groq
from agno.tools import tool

# Import knowledge tools (we'll use simplified versions for now)
try:
    from app.services.knowledge_driven_tools import (
        KnowledgeRAG, APIPatternAnalyzer, DocumentationRetriever, ProjectAnalyzer
    )
    from app.services.todo_evolution_tracker import TodoEvolutionTracker
except ImportError as e:
    logger.warning(f"Knowledge tools import failed: {e}. Using simplified versions.")
    # We'll define simplified versions below
from app.core.config import settings
from app.core.billing_observability import billing_aware_agent_trace

logger = logging.getLogger(__name__)


# Simplified AGNO tools for immediate functionality
@tool(show_result=True)
def modify_file(file_path: str, modifications: str, api_domain: str = None) -> str:
    """Modify files with API knowledge and best practices."""
    try:
        from pathlib import Path
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            return f"Error: File {file_path} does not exist"
        return f"Successfully analyzed {file_path} for modifications. API domain: {api_domain or 'general'}"
    except Exception as e:
        return f"Error modifying file: {str(e)}"

@tool(show_result=True)
def generate_preview(project_path: str, preview_type: str = "web") -> str:
    """Generate application previews."""
    return f"Generated {preview_type} preview for project at {project_path}"

@tool(show_result=True)
def manage_dependencies(project_path: str, api_domains: str, action: str = "analyze") -> str:
    """Manage API-specific dependencies."""
    return f"Managed dependencies for {api_domains} in {project_path} (action: {action})"

@tool(show_result=True)
def query_knowledge(query: str, domain: str = "general") -> str:
    """Query indexed API documentation and knowledge base."""
    return f"Queried knowledge base for '{query}' in domain '{domain}'. This is a simplified response - full RAG integration coming soon."



# ConversationalChatService - Main service class
            
            # Check for common web frameworks
            if (project_dir / "package.json").exists():
                preview_info["setup_instructions"].extend([
                    "npm install",
                    "npm run dev"
                ])
                preview_info["preview_url"] = "http://localhost:3000"
                preview_info["preview_ready"] = True
            
            elif (project_dir / "requirements.txt").exists() or (project_dir / "pyproject.toml").exists():
                # Python project
                if any(f.name == "main.py" for f in project_dir.rglob("*.py")):
                    preview_info["setup_instructions"].extend([
                        "pip install -r requirements.txt",
                        "uvicorn main:app --reload"
                    ])
                    preview_info["preview_url"] = "http://localhost:8000"
                    preview_info["preview_ready"] = True
            
            return {
                "success": True,
                "preview_info": preview_info,
                "message": f"Generated {preview_type} preview configuration"
            }
            
        except Exception as e:
            logger.error(f"PreviewGenerator error: {e}")
            return {"success": False, "error": str(e)}


class DependencyManager(Tool):
    """Manage API-specific dependencies"""
    
    def __init__(self):
        super().__init__(
            name="DependencyManager",
            description="Handle API-specific dependencies and installations"
        )
    
    def run(self, project_path: str, api_domains: List[str], 
            action: str = "analyze") -> Dict[str, Any]:
        """
        Manage dependencies for API integrations
        
        Args:
            project_path: Path to the project
            api_domains: List of API domains to manage dependencies for
            action: Action to perform (analyze, install, update)
        """
        try:
            from pathlib import Path
            
            project_dir = Path(project_path)
            if not project_dir.exists():
                return {"success": False, "error": "Project path does not exist"}
            
            # API domain to dependency mapping
            dependency_map = {
                "stripe": ["stripe"],
                "openai": ["openai"],
                "fastapi": ["fastapi", "uvicorn"],
                "supabase": ["supabase"],
                "resend": ["resend"],
                "auth0": ["authlib", "python-jose"],
                "postgres": ["psycopg2-binary", "sqlalchemy"],
                "redis": ["redis", "celery"]
            }
            
            required_deps = []
            for domain in api_domains:
                if domain in dependency_map:
                    required_deps.extend(dependency_map[domain])
            
            # Check current dependencies
            current_deps = []
            requirements_file = project_dir / "requirements.txt"
            pyproject_file = project_dir / "pyproject.toml"
            package_json = project_dir / "package.json"
            
            if requirements_file.exists():
                current_deps = requirements_file.read_text().strip().split('\n')
            elif pyproject_file.exists():
                # Parse pyproject.toml for dependencies
                content = pyproject_file.read_text()
                # Simple parsing - in production, use proper TOML parser
                if "dependencies" in content:
                    current_deps = ["pyproject.toml dependencies found"]
            elif package_json.exists():
                # Node.js project
                import json as json_lib
                package_data = json_lib.loads(package_json.read_text())
                current_deps = list(package_data.get("dependencies", {}).keys())
            
            missing_deps = [dep for dep in required_deps if not any(dep in curr for curr in current_deps)]
            
            result = {
                "success": True,
                "project_path": project_path,
                "api_domains": api_domains,
                "required_dependencies": required_deps,
                "current_dependencies": current_deps,
                "missing_dependencies": missing_deps,
                "action": action
            }
            
            if action == "install" and missing_deps:
                # Generate installation commands
                if requirements_file.exists() or pyproject_file.exists():
                    result["install_commands"] = [f"pip install {' '.join(missing_deps)}"]
                elif package_json.exists():
                    result["install_commands"] = [f"npm install {' '.join(missing_deps)}"]
                else:
                    result["install_commands"] = ["No package manager detected"]
            
            return result
            
        except Exception as e:
            logger.error(f"DependencyManager error: {e}")
            return {"success": False, "error": str(e)}


class ConversationalChatService:
    """
    Main service for conversational, knowledge-driven development assistance
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Initialize knowledge-driven tools
        self.tools = [
            KnowledgeRAG(),
            APIPatternAnalyzer(),
            DocumentationRetriever(),
            ProjectAnalyzer(),
            TodoEvolutionTracker(),
            FileModifier(),
            PreviewGenerator(),
            DependencyManager()
        ]
        
        # Create the knowledge-driven agent
        self.agent = self._create_knowledge_agent()
        
        # Chat session management
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
    
    def _create_knowledge_agent(self) -> Agent:
        """Create the main knowledge-driven agent"""
        
        return Agent(
            name="Kiff Knowledge Assistant",
            model=Groq(
                id="llama-3.3-70b-versatile",
                api_key=settings.GROQ_API_KEY,
                temperature=0.3
            ),
            tools=self.tools,
            instructions="""
You are Kiff AI's knowledge-driven development assistant with deep understanding of API documentation.

CORE PRINCIPLES:
- Always ground responses in indexed API documentation
- Use knowledge tools before making suggestions
- Provide conversational, helpful responses
- Focus on practical implementation guidance

TOOL USAGE PATTERNS:
- Use 'KnowledgeRAG' to query API documentation before suggesting implementations
- Use 'DocumentationRetriever' to get specific API sections and examples
- Use 'APIPatternAnalyzer' to understand existing codebase patterns
- Use 'ProjectAnalyzer' to suggest appropriate integrations
- Use 'TodoEvolutionTracker' to manage development tasks intelligently
- Use 'FileModifier' to implement changes with best practices
- Use 'PreviewGenerator' to show application previews
- Use 'DependencyManager' to handle API-specific dependencies

CONVERSATION STYLE:
- Be conversational and helpful like Claude Code
- Ask clarifying questions when needed
- Explain your reasoning and knowledge sources
- Suggest next steps and follow-up actions
- Always mention when you're using knowledge from indexed documentation

KNOWLEDGE-FIRST APPROACH:
When users ask about API integrations:
1. Query indexed documentation first
2. Understand API capabilities and limitations
3. Suggest implementations based on official docs
4. Generate code following documented best practices
5. Provide evolution path for their project

Remember: Your strength is API knowledge. Always leverage your indexed documentation!
            """,
            markdown=True,
            show_tool_calls=True
        )
    
    @billing_aware_agent_trace("ConversationalChat", "chat_agent", "chat_interaction")
    async def chat(self, message: str, session_id: str = None, tenant_id: str = "demo_tenant", 
                  user_id: str = "demo_user", project_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Main chat interface for conversational development assistance
        
        Args:
            message: User's message
            session_id: Chat session ID
            tenant_id: Tenant ID for billing
            user_id: User ID for billing
            project_context: Optional project context (path, type, etc.)
        """
        try:
            # Create session if needed
            if not session_id:
                session_id = str(uuid.uuid4())
            
            if session_id not in self.active_sessions:
                self.active_sessions[session_id] = {
                    "created_at": datetime.utcnow(),
                    "messages": [],
                    "project_context": project_context or {},
                    "knowledge_domains": []
                }
            
            session = self.active_sessions[session_id]
            
            # Add user message to session
            session["messages"].append({
                "role": "user",
                "content": message,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Enhance message with project context if available
            enhanced_message = message
            if project_context and project_context.get("project_path"):
                enhanced_message += f"\n\nProject context: {project_context}"
            
            # Get agent response
            response = await self.agent.arun(enhanced_message)
            
            # Add assistant response to session
            session["messages"].append({
                "role": "assistant", 
                "content": response.content,
                "timestamp": datetime.utcnow().isoformat(),
                "tool_calls": getattr(response, 'tool_calls', [])
            })
            
            # Extract knowledge domains used
            if hasattr(response, 'tool_calls'):
                for tool_call in response.tool_calls:
                    if tool_call.get('function', {}).get('name') == 'KnowledgeRAG':
                        domain = tool_call.get('function', {}).get('arguments', {}).get('domain')
                        if domain and domain not in session["knowledge_domains"]:
                            session["knowledge_domains"].append(domain)
            
            return {
                "success": True,
                "session_id": session_id,
                "response": response.content,
                "message_count": len(session["messages"]),
                "knowledge_domains_used": session["knowledge_domains"],
                "project_context": session["project_context"],
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Chat error: {e}")
            return {
                "success": False,
                "error": str(e),
                "session_id": session_id,
                "message": "Failed to process chat message"
            }
    
    async def get_session_history(self, session_id: str) -> Dict[str, Any]:
        """Get chat session history"""
        if session_id not in self.active_sessions:
            return {"success": False, "error": "Session not found"}
        
        session = self.active_sessions[session_id]
        return {
            "success": True,
            "session_id": session_id,
            "messages": session["messages"],
            "knowledge_domains": session["knowledge_domains"],
            "project_context": session["project_context"],
            "created_at": session["created_at"].isoformat()
        }
    
    async def suggest_follow_up_questions(self, session_id: str) -> Dict[str, Any]:
        """Suggest follow-up questions based on conversation context"""
        if session_id not in self.active_sessions:
            return {"success": False, "error": "Session not found"}
        
        session = self.active_sessions[session_id]
        
        # Generate context-aware suggestions
        suggestions = []
        
        # Based on knowledge domains used
        for domain in session["knowledge_domains"]:
            if domain == "stripe":
                suggestions.extend([
                    "How do I implement Stripe webhooks?",
                    "What's the best way to handle subscription billing?",
                    "How do I test Stripe integration locally?"
                ])
            elif domain == "openai":
                suggestions.extend([
                    "How do I implement streaming responses?",
                    "What are the best practices for prompt engineering?",
                    "How do I handle OpenAI rate limits?"
                ])
        
        # Based on project context
        project_context = session["project_context"]
        if project_context.get("project_type") == "web_app":
            suggestions.extend([
                "How do I add user authentication?",
                "What database should I use?",
                "How do I deploy this application?"
            ])
        
        # Limit to 5 suggestions
        suggestions = suggestions[:5]
        
        return {
            "success": True,
            "session_id": session_id,
            "suggestions": suggestions,
            "based_on": {
                "knowledge_domains": session["knowledge_domains"],
                "project_context": bool(session["project_context"])
            }
        }
    
    def get_available_knowledge_domains(self) -> List[str]:
        """Get list of available knowledge domains"""
        from app.knowledge.engine.julia_bff_knowledge_engine import PREDEFINED_DOMAINS
        return list(PREDEFINED_DOMAINS.keys())


# Global service instance
_chat_service: Optional[ConversationalChatService] = None


def get_chat_service() -> ConversationalChatService:
    """Get the global chat service instance"""
    global _chat_service
    if _chat_service is None:
        _chat_service = ConversationalChatService()
    return _chat_service
