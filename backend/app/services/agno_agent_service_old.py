"""
AGNO Agent Service
Integrates with AGNO's agent architecture for knowledge-driven application generation
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional, AsyncGenerator
from dataclasses import dataclass
from datetime import datetime
import os

# AGNO imports
from agno.agent import Agent, RunResponseEvent
from agno.tools import tool
from agno.memory.v2 import Memory
from app.config.llm_providers import llm_agentic

logger = logging.getLogger(__name__)

# AGNO Tools for Knowledge-Driven Development
@tool(
    name="knowledge_retriever",
    description="Retrieve relevant API documentation and code patterns from the knowledge base",
    show_result=True,
    cache_results=True,
    cache_ttl=300  # Cache for 5 minutes
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
    """AGNO Agent Event following the event-driven pattern"""
    type: str
    content: Any
    timestamp: datetime
    session_id: str
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class GeneratedFile:
    """Generated file structure"""
    name: str
    path: str
    content: str
    language: str
    size: int

@dataclass
class ProjectInfo:
    """Generated project information"""
    name: str
    description: str
    framework: str
    files: List[GeneratedFile]
    status: str = "generating"
    live_url: Optional[str] = None
    download_url: Optional[str] = None

class AGNOAgentService:
    """
    AGNO Agent Service implementing the proper agent patterns:
    - Agent.run() method pattern
    - Streaming responses with events
    - Stateful session management  
    - Knowledge integration through RAG
    - Tool integration for file generation
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
            instructions="""You are a knowledge-driven AI developer assistant powered by AGNO.
            
            Use the 'retrieve_knowledge' tool to access indexed API documentation when users ask about specific APIs or need examples.
            
            Always ground your code suggestions in actual API knowledge from the indexed documentation.
            
            Current session state: {conversation_history}
            Current project: {current_project}
            Knowledge context: {knowledge_context}
            """
        )
        self.sessions = {}  # Store session data

    def _initialize_knowledge_base(self) -> Dict[str, Any]:
        """Initialize knowledge base with API documentation and patterns"""
        # This would connect to AGNO's knowledge management system
        return {
            "apis": [],
            "patterns": [],
            "frameworks": ["React", "Vue", "Angular", "FastAPI", "Express"],
            "templates": []
        }
        
    def _initialize_tools(self) -> Dict[str, Any]:
        """Initialize AGNO tools for file generation and project creation"""
        return {
            "file_generator": self._file_generator_tool,
            "project_creator": self._project_creator_tool,
            "knowledge_retriever": self._knowledge_retriever_tool,
            "code_analyzer": self._code_analyzer_tool
        }
    
    async def create_session(self, user_id: str, session_id: Optional[str] = None) -> str:
        """Create a new AGNO agent session with persistent memory"""
        if not session_id:
            session_id = f"session_{user_id}_{int(datetime.now().timestamp())}"
            
        self.sessions[session_id] = {
            "user_id": user_id,
            "created_at": datetime.now(),
            "memory": [],  # Persistent conversation memory
            "context": {},  # Session context and state
            "active_project": None,
            "knowledge_context": []
        }
        
        logger.info(f"Created AGNO session: {session_id} for user: {user_id}")
        return session_id
    
    def get_session_info(self, session_id: str) -> Dict[str, Any]:
        """Get session information"""
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        return self.sessions[session_id]
    
    async def run_agent(
        self, 
        session_id: str, 
        user_input: str, 
        stream: bool = True
    ) -> AsyncGenerator[AgentEvent, None]:
        """
        Main agent.run() implementation using real AGNO streaming
        Captures AGNO agent's streaming output and reasoning process
        """
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
            
        session = self.sessions[session_id]
        
        # Add user input to session memory
        session["memory"].append({
            "role": "user",
            "content": user_input,
            "timestamp": datetime.now()
        })
        
        # Yield initial event
        yield AgentEvent(
            type="RunStarted",
            content={"message": "Starting AGNO agent processing..."},
            timestamp=datetime.now(),
            session_id=session_id
        )
        
        try:
            # Prepare context with knowledge and session memory
            context = await self._prepare_agent_context(user_input, session, session_id)
            
            # Create enhanced prompt with context
            enhanced_prompt = self._create_enhanced_prompt(user_input, context, session)
            
            yield AgentEvent(
                type="AgentThinking",
                content={"message": "Agent is analyzing your request..."},
                timestamp=datetime.now(),
                session_id=session_id
            )
            
            # Use AGNO agent streaming - capture both stdout and the response
            response_buffer = []
            
            # Create a custom stream handler to capture AGNO's streaming output
            async for chunk in self._stream_agno_response(enhanced_prompt, session_id):
                if chunk.get('type') == 'reasoning':
                    yield AgentEvent(
                        type="ReasoningStep",
                        content={
                            "message": chunk.get('content', ''),
                            "step": chunk.get('step', '')
                        },
                        timestamp=datetime.now(),
                        session_id=session_id
                    )
                elif chunk.get('type') == 'content':
                    response_buffer.append(chunk.get('content', ''))
                    yield AgentEvent(
                        type="ContentChunk",
                        content={
                            "chunk": chunk.get('content', ''),
                            "partial_response": ''.join(response_buffer)
                        },
                        timestamp=datetime.now(),
                        session_id=session_id
                    )
                elif chunk.get('type') == 'tool_call':
                    yield AgentEvent(
                        type="ToolCallStarted",
                        content={
                            "tool": chunk.get('tool_name', ''),
                            "message": f"Using {chunk.get('tool_name', 'tool')}..."
                        },
                        timestamp=datetime.now(),
                        session_id=session_id
                    )
                elif chunk.get('type') == 'tool_result':
                    yield AgentEvent(
                        type="ToolCallCompleted",
                        content={
                            "tool": chunk.get('tool_name', ''),
                            "result": chunk.get('result', {})
                        },
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
    
    async def _prepare_agent_context(self, user_input: str, session: Dict[str, Any], session_id: str) -> Dict[str, Any]:
        """Prepare context for the AGNO agent including knowledge and memory"""
        # Retrieve relevant knowledge
        knowledge_results = await self._retrieve_knowledge(user_input, session_id)
        
        # Get recent conversation memory
        recent_memory = session["memory"][-5:] if len(session["memory"]) > 5 else session["memory"]
        
        return {
            "knowledge": knowledge_results,
            "memory": recent_memory,
            "session_context": session.get("context", {})
        }
    
    def _create_enhanced_prompt(self, user_input: str, context: Dict[str, Any], session: Dict[str, Any]) -> str:
        """Create an enhanced prompt with context for the AGNO agent"""
        knowledge_context = ""
        if context.get("knowledge"):
            knowledge_context = "\n\nRelevant API Documentation:\n"
            for item in context["knowledge"][:3]:  # Top 3 most relevant
                knowledge_context += f"- {item['title']}: {item['content'][:200]}...\n"
        
        memory_context = ""
        if context.get("memory"):
            memory_context = "\n\nConversation History:\n"
            for msg in context["memory"][-3:]:  # Last 3 messages
                role = msg["role"].title()
                content = msg["content"][:150] + "..." if len(msg["content"]) > 150 else msg["content"]
                memory_context += f"{role}: {content}\n"
        
        enhanced_prompt = f"""
You are an AI development assistant powered by AGNO. Your role is to help users build applications using knowledge from indexed APIs and best practices.

{knowledge_context}
{memory_context}

User Request: {user_input}

Please provide a helpful response. If the user is asking to create an application, provide detailed implementation guidance with code examples based on the available API documentation.
"""
        
        return enhanced_prompt.strip()
    
    async def _stream_agno_response(self, prompt: str, session_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream response from AGNO agent with real-time output capture"""
        try:
            # Use AGNO's actual streaming API as observed in the test
            response_stream = self.agent.run(
                prompt,
                stream=True,
                stream_intermediate_steps=True
            )
            
            # Process the actual AGNO RunResponseEvent stream
            for event in response_stream:
                if event.event == "RunStarted":
                    yield {
                        "type": "run_started",
                        "content": "Agent started processing..."
                    }
                    
                elif event.event == "RunResponseContent":
                    # Stream individual content chunks (tokens) as they arrive
                    content_chunk = getattr(event, 'content', '')
                    if content_chunk:  # Only yield non-empty chunks
                        yield {
                            "type": "content",
                            "content": content_chunk
                        }
                        
                elif event.event == "RunCompleted":
                    # Final response with complete content
                    final_content = getattr(event, 'content', '')
                    yield {
                        "type": "run_completed",
                        "content": final_content,
                        "final_response": final_content
                    }
                    
                elif event.event == "ToolCallStarted":
                    tool_name = getattr(event, 'tool', 'unknown')
                    yield {
                        "type": "tool_call",
                        "tool_name": tool_name,
                        "content": f"Using tool: {tool_name}"
                    }
                    
                elif event.event == "ToolCallCompleted":
                    tool_name = getattr(event, 'tool', 'unknown')
                    yield {
                        "type": "tool_result",
                        "tool_name": tool_name,
                        "result": getattr(event, 'result', {})
                    }
                    
                elif event.event == "ReasoningStep":
                    reasoning_content = getattr(event, 'content', '')
                    yield {
                        "type": "reasoning",
                        "content": reasoning_content,
                        "step": "reasoning"
                    }
                    
                elif event.event == "RunError":
                    error_content = getattr(event, 'content', 'Unknown error')
                    yield {
                        "type": "error",
                        "content": error_content
                    }
                    
        except Exception as e:
            logger.error(f"Error in AGNO streaming: {e}")
            yield {
                "type": "error",
                "content": f"Streaming error: {str(e)}"
            }
    
    async def _retrieve_knowledge(self, query: str, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve relevant knowledge using RAG patterns"""
        # This would integrate with AGNO's vector database and knowledge retrieval
        # For now, simulate with mock data
        
        mock_knowledge = [
            {
                "type": "api_documentation",
                "title": "React Hooks API",
                "content": "React Hooks allow you to use state and lifecycle methods in functional components",
                "relevance_score": 0.85,
                "source": "React Official Docs"
            },
            {
                "type": "code_pattern",
                "title": "FastAPI CRUD Operations", 
                "content": "Standard patterns for Create, Read, Update, Delete operations in FastAPI",
                "relevance_score": 0.78,
                "source": "FastAPI Best Practices"
            },
            {
                "type": "framework_guide",
                "title": "TypeScript Integration",
                "content": "Best practices for TypeScript in modern web applications",
                "relevance_score": 0.72,
                "source": "TypeScript Handbook"
            }
        ]
        
        # Update session knowledge context
        self.sessions[session_id]["knowledge_context"] = mock_knowledge
        
        return mock_knowledge
    
    # Note: Project generation is now handled by the AGNO agent's built-in capabilities
    # No manual generation methods needed
    
    # Note: File generation is now handled by the AGNO agent's built-in capabilities
    
    # All project analysis and generation is handled by AGNO agent's built-in capabilities
    
    def get_session_info(self, session_id: str) -> Dict[str, Any]:
        """Generate React app content using knowledge context"""
        return '''import React, { useState, useEffect } from 'react';
import './App.css';

interface Task {
  id: number;
  text: string;
  completed: boolean;
  createdAt: Date;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const addTask = () => {
    if (newTask.trim()) {
      const task: Task = {
        id: Date.now(),
        text: newTask.trim(),
        completed: false,
        createdAt: new Date()
      };
      setTasks([...tasks, task]);
      setNewTask('');
    }
  };

  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (id: number) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  return (
    <div className="App">
      <header className="App-header">
        <h1>Task Manager</h1>
        <p>Organize your tasks efficiently</p>
      </header>
      
      <main className="App-main">
        <div className="task-input-section">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a new task..."
            onKeyPress={(e) => e.key === 'Enter' && addTask()}
            className="task-input"
          />
          <button onClick={addTask} className="add-button">
            Add Task
          </button>
        </div>

        <div className="filter-section">
          <button 
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All ({tasks.length})
          </button>
          <button 
            className={filter === 'active' ? 'active' : ''}
            onClick={() => setFilter('active')}
          >
            Active ({tasks.filter(t => !t.completed).length})
          </button>
          <button 
            className={filter === 'completed' ? 'active' : ''}
            onClick={() => setFilter('completed')}
          >
            Completed ({tasks.filter(t => t.completed).length})
          </button>
        </div>

        <div className="task-list">
          {filteredTasks.length === 0 ? (
            <p className="no-tasks">No tasks {filter !== 'all' ? filter : 'yet'}!</p>
          ) : (
            filteredTasks.map(task => (
              <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                  className="task-checkbox"
                />
                <span className="task-text">{task.text}</span>
                <button 
                  onClick={() => deleteTask(task.id)}
                  className="delete-button"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default App;'''
    
    def _generate_package_json(self, user_input: str) -> str:
        """Generate package.json for the project"""
        return '''{
  "name": "task-manager-app",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@types/node": "^16.18.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "typescript": "^4.9.4",
    "web-vitals": "^2.1.4"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}'''
    
    def _generate_css_content(self) -> str:
        """Generate CSS content for the application"""
        return '''.App {
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
}

.App-header {
  margin-bottom: 30px;
}

.App-header h1 {
  color: #333;
  margin-bottom: 10px;
}

.App-header p {
  color: #666;
  font-size: 16px;
}

.task-input-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  justify-content: center;
}

.task-input {
  flex: 1;
  max-width: 400px;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s;
}

.task-input:focus {
  border-color: #007bff;
}

.add-button {
  padding: 12px 24px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-button:hover {
  background-color: #0056b3;
}

.filter-section {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 20px;
}

.filter-section button {
  padding: 8px 16px;
  border: 2px solid #e0e0e0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-section button.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.task-list {
  text-align: left;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.task-item.completed {
  opacity: 0.7;
  background: #e8f5e8;
}

.task-checkbox {
  width: 18px;
  height: 18px;
}

.task-text {
  flex: 1;
  font-size: 16px;
}

.task-item.completed .task-text {
  text-decoration: line-through;
  color: #666;
}

.delete-button {
  padding: 6px 12px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.delete-button:hover {
  background-color: #c82333;
}

.no-tasks {
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 40px;
}'''
    
    async def _generate_response(
        self, 
        user_input: str, 
        knowledge_results: List[Dict[str, Any]], 
        session: Dict[str, Any]
    ) -> str:
        """Generate conversational response using AGNO patterns"""
        
        if session.get("active_project"):
            project = session["active_project"]
            return f"""I've created a **{project.name}** for you! Here's what I built:

**🚀 Features:**
- Modern {project.framework} application
- Responsive design with clean UI
- Full TypeScript support
- State management with React hooks
- Interactive task management

**📁 Files Generated:**
- `App.tsx` - Main application component with full functionality
- `package.json` - Project dependencies and scripts
- `App.css` - Modern styling with hover effects

**🔧 Technical Details:**
- Built with {project.framework}
- Uses modern React patterns from the indexed API documentation
- Implements best practices for state management
- Responsive design that works on all devices

The application is ready to run! You can preview it in the right panel, explore the source code, or download the complete project. 

Would you like me to add any additional features or modify the existing functionality?"""
        
        else:
            # Generate knowledge-based response
            knowledge_context = "\n".join([
                f"- {item['title']}: {item['content'][:100]}..."
                for item in knowledge_results[:3]
            ])
            
            return f"""I can help you build applications using the latest API documentation and development patterns. Based on your request, I found relevant knowledge:

{knowledge_context}

What kind of application would you like me to create? I can build:

- **Web Applications** (React, Vue, Angular)
- **APIs & Backends** (FastAPI, Express, Django)  
- **Dashboards & Analytics** (Data visualization, admin panels)
- **Mobile-first Apps** (Progressive Web Apps)

Just describe what you need, and I'll generate a complete, working application with all the necessary files!"""
    
    # Tool implementations
    async def _file_generator_tool(self, **kwargs):
        """AGNO tool for file generation"""
        pass
        
    async def _project_creator_tool(self, **kwargs):
        """AGNO tool for project creation"""
        pass
        
    async def _knowledge_retriever_tool(self, **kwargs):
        """AGNO tool for knowledge retrieval"""
        pass
        
    async def _code_analyzer_tool(self, **kwargs):
        """AGNO tool for code analysis"""
        pass

# Global service instance
agno_service = AGNOAgentService()