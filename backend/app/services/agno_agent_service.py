import logging
import uuid
from datetime import datetime
from dataclasses import dataclass
from typing import Dict, Any, List, Optional, AsyncGenerator
from contextlib import asynccontextmanager

# AGNO imports
from agno.agent import Agent, RunResponseEvent
from agno.tools import tool
from agno.memory.v2 import Memory
from app.config.llm_providers import llm_agentic

logger = logging.getLogger(__name__)

# AGNO Knowledge Retrieval Tool
@tool(
    name="knowledge_retriever",
    description="Retrieve relevant API documentation and examples from the indexed knowledge base",
    show_result=True,
    cache_results=True
)
def retrieve_knowledge(query: str, max_results: int = 5) -> str:
    """
    Retrieve relevant knowledge from the indexed API documentation.
    
    Args:
        query: Search query for API documentation
        max_results: Maximum number of results to return
        
    Returns:
        str: Formatted knowledge results with API documentation
    """
    # This would integrate with your actual knowledge base
    # For now, return mock data that matches your knowledge structure
    mock_results = [
        {
            "title": "React Hooks API",
            "content": "React Hooks allow you to use state and lifecycle methods in functional components. Key hooks include useState, useEffect, useContext.",
            "source": "React Official Docs",
            "relevance_score": 0.95
        },
        {
            "title": "FastAPI CRUD Operations",
            "content": "Standard patterns for Create, Read, Update, Delete operations in FastAPI using SQLAlchemy and Pydantic models.",
            "source": "FastAPI Documentation",
            "relevance_score": 0.87
        }
    ]
    
    formatted_results = []
    for result in mock_results[:max_results]:
        formatted_results.append(
            f"**{result['title']}** (Relevance: {result['relevance_score']:.2f})\n"
            f"Source: {result['source']}\n"
            f"Content: {result['content']}\n"
        )
    
    return "\n".join(formatted_results)

@dataclass
class AgentEvent:
    """Event emitted during AGNO agent streaming"""
    type: str
    content: Dict[str, Any]
    timestamp: datetime
    session_id: str

class AGNOAgentService:
    """
    Clean AGNO Agent Service for knowledge-driven development.
    
    Features:
    - AGNO streaming with real RunResponseEvent handling
    - Session and state management with Memory.v2
    - Knowledge retrieval through RAG
    - Minimal, focused on letting AGNO agent handle code generation through its built-in capabilities
    """
    
    def __init__(self):
        """Initialize the AGNO agent with proper tools and configuration."""
        # Initialize memory for session persistence
        self.memory = Memory()
        
        self.agent = Agent(
            model=llm_agentic,
            tools=[retrieve_knowledge],
            markdown=True,
            monitoring=True,
            show_tool_calls=True,
            memory=self.memory,
            # Enable session state management
            session_state={
                "conversation_history": [],
                "current_project": None,
                "knowledge_context": [],
                "user_preferences": {}
            },
            add_state_in_messages=True,
            instructions=f"""You are a knowledge-driven AI developer assistant powered by Agno Framework.
            
            Always use first the 'retrieve_knowledge' to understand the indexed API documentation to solve the user's prompt or ask about specific APIs or need examples.
            
            Always ground your code suggestions in actual API knowledge from the indexed documentation.
            
            Current session state: {{conversation_history}}
            Current project: {{current_project}}
            Knowledge context: {{knowledge_context}}
            """
        )
        self.sessions = {}  # Store session data

    def create_session(self, user_id: str) -> str:
        """Create a new AGNO chat session"""
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            "user_id": user_id,
            "created_at": datetime.now(),
            "memory": [],
            "context": {}
        }
        logger.info(f"Created AGNO session {session_id} for user {user_id}")
        return session_id

    def get_session_info(self, session_id: str) -> Dict[str, Any]:
        """Get session information"""
        return self.sessions.get(session_id, {})

    async def run_agent(self, session_id: str, user_input: str, stream: bool = True) -> AsyncGenerator[AgentEvent, None]:
        """
        Run the AGNO agent with streaming support using real RunResponseEvent handling.
        
        Args:
            session_id: Session identifier
            user_input: User's message/request
            stream: Whether to stream the response
            
        Yields:
            AgentEvent: Streaming events from the AGNO agent
        """
        # Auto-create session if it doesn't exist (handles server restarts)
        if session_id not in self.sessions:
            logger.warning(f"Session {session_id} not found, creating new session")
            self.sessions[session_id] = {
                "user_id": "unknown",
                "created_at": datetime.now(),
                "memory": [],
                "context": {}
            }
        
        session = self.sessions[session_id]
        
        # Add user message to memory
        session["memory"].append({
            "role": "user", 
            "content": user_input,
            "timestamp": datetime.now()
        })
        
        yield AgentEvent(
            type="RunStarted",
            content={"message": "Starting AGNO agent processing..."},
            timestamp=datetime.now(),
            session_id=session_id
        )
        
        try:
            # Use AGNO agent streaming with real RunResponseEvent handling
            response_stream = self.agent.run(
                user_input, 
                stream=True, 
                stream_intermediate_steps=True
            )
            
            response_buffer = []
            
            for event in response_stream:
                if event.event == "RunResponseContent":
                    content = getattr(event, 'content', '')
                    response_buffer.append(content)
                    yield AgentEvent(
                        type="content",
                        content={
                            "chunk": content,
                            "partial_response": ''.join(response_buffer)
                        },
                        timestamp=datetime.now(),
                        session_id=session_id
                    )
                    
                elif event.event == "ToolCallStarted":
                    tool_name = getattr(event, 'tool_name', 'unknown')
                    yield AgentEvent(
                        type="tool_call_started",
                        content={
                            "tool": tool_name,
                            "message": f"Using {tool_name}..."
                        },
                        timestamp=datetime.now(),
                        session_id=session_id
                    )
                    
                elif event.event == "ToolCallCompleted":
                    tool_name = getattr(event, 'tool_name', 'unknown')
                    result = getattr(event, 'result', {})
                    yield AgentEvent(
                        type="tool_call_completed",
                        content={
                            "tool": tool_name,
                            "result": result
                        },
                        timestamp=datetime.now(),
                        session_id=session_id
                    )
                    
                elif event.event == "RunError":
                    error_content = getattr(event, 'content', 'Unknown error')
                    yield AgentEvent(
                        type="error",
                        content={"error": error_content},
                        timestamp=datetime.now(),
                        session_id=session_id
                    )
                    
            # Final response
            final_response = ''.join(response_buffer)
            
            # Add assistant response to memory
            session["memory"].append({
                "role": "assistant", 
                "content": final_response,
                "timestamp": datetime.now()
            })
            
            yield AgentEvent(
                type="RunCompleted",
                content={
                    "message": final_response,
                    "full_response": final_response
                },
                timestamp=datetime.now(),
                session_id=session_id
            )
            
        except Exception as e:
            logger.error(f"Error in AGNO agent run: {e}")
            yield AgentEvent(
                type="RunError", 
                content={"error": str(e)},
                timestamp=datetime.now(),
                session_id=session_id
            )

# Global service instance
agno_service = AGNOAgentService()
