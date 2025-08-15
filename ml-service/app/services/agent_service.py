"""
Agent Service - AGNO Framework Integration
Handles AI agent operations and reasoning
"""

import os
from typing import Dict, Any, List
from .vector_service import VectorService

# Optional AGNO imports
try:
    from agno.agent import Agent
    from agno.models.groq import Groq
    _HAS_AGNO = True
except ImportError:
    _HAS_AGNO = False

class AgentService:
    """Service for running AGNO agents with knowledge integration"""
    
    def __init__(self):
        self.vector_service = VectorService()
        self.agent = None
        
        if _HAS_AGNO:
            self._setup_agent()
        else:
            print("[AGENT] ⚠️ AGNO not available")
    
    def _setup_agent(self):
        """Initialize AGNO agent"""
        try:
            # Check if GROQ API key is available
            groq_api_key = os.getenv("GROQ_API_KEY")
            if not groq_api_key:
                print(f"[AGENT] ⚠️ GROQ_API_KEY not set. Agent will be unavailable.")
                self.agent = None
                return
            
            model_id = os.getenv("AGENT_MODEL_ID", "llama-3.1-8b-instant")
            groq_model = Groq(id=model_id)
            
            self.agent = Agent(
                model=groq_model,
                instructions=[
                    "You are an AI agent with access to indexed API knowledge.",
                    "Use the search_knowledge tool to find relevant information.",
                    "Provide citations from your searches in your responses."
                ],
                show_tool_calls=True,
                markdown=True
            )
            
            print(f"[AGENT] ✅ AGNO agent initialized with model: {model_id}")
            
        except Exception as e:
            print(f"[AGENT] ❌ Failed to initialize agent: {e}")
            self.agent = None
    
    async def run_agent(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Run agent with knowledge search capabilities"""
        if not self.agent:
            return {"error": "Agent not available"}
        
        try:
            message = request.get("message", "")
            tenant_id = request.get("tenant_id", "")
            pack_ids = request.get("selected_packs", [])
            
            # If pack knowledge is requested, search first
            if pack_ids and message:
                knowledge_results = await self.vector_service.search(
                    query=message,
                    tenant_id=tenant_id,
                    pack_ids=pack_ids,
                    limit=4
                )
                
                # Add knowledge context to the message
                if knowledge_results:
                    context = "\n".join([
                        f"- {r['pack_name']}: {r['content'][:200]}..."
                        for r in knowledge_results
                    ])
                    enhanced_message = f"{message}\n\nRelevant knowledge:\n{context}"
                else:
                    enhanced_message = message
            else:
                enhanced_message = message
            
            # Run the agent
            response = await self.agent.arun(enhanced_message)
            
            return {
                "content": getattr(response, "content", str(response)),
                "tool_calls": getattr(response, "tool_calls", None),
                "knowledge_used": len(knowledge_results) if 'knowledge_results' in locals() else 0
            }
            
        except Exception as e:
            print(f"[AGENT] Error running agent: {e}")
            return {"error": f"Agent execution failed: {str(e)}"}
    
    async def search_knowledge(self, query: str, tenant_id: str, pack_ids: List[str]) -> List[Dict[str, Any]]:
        """Wrapper for knowledge search"""
        return await self.vector_service.search(query, tenant_id, pack_ids)