"""  
Idea Generator API Route
========================

Uses the same AGNO agent structure as the application generator,
but with simple instructions to generate concise app ideas.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import json
import logging
from app.middleware.tenant_middleware import get_current_tenant_id
from app.services.agno_application_generator import agno_app_generator
from agno.agent import Agent
from app.config.llm_providers import llm_quick

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/test")
async def test_idea_generator(tenant_id: str = Depends(get_current_tenant_id)):
    """Simple test endpoint to verify idea generator module is loading"""
    logger.info(f"🧪 Test endpoint called with tenant_id: {tenant_id}")
    return {"status": "ok", "message": "Idea generator module is working", "tenant_id": tenant_id}

class IdeaRequest(BaseModel):
    knowledge_sources: Optional[List[str]] = None

class IdeaResponse(BaseModel):
    idea: str
    suggested_apis: List[str]
    description: str

@router.post("/generate-idea", response_model=IdeaResponse)
async def generate_app_idea(
    request: IdeaRequest = IdeaRequest(),
    tenant_id: str = Depends(get_current_tenant_id)
) -> IdeaResponse:
    """
    Generate a concise app idea using the same AGNO agent and knowledge base
    as the application generator, with dynamic knowledge sources.
    """
    logger.info("🚀 Idea generator endpoint called!")
    logger.info(f"📋 Request: {request}")
    logger.info(f"👤 Tenant ID: {tenant_id}")
    
    try:
        # Simple prompt for generating concise ideas
        idea_prompt = """
You are an AGNO Framework expert AI agent that generates simple, practical app ideas.

Using your knowledge of APIs and development frameworks, generate ONE concise app idea.

Requirements:
1. Keep it under 160 characters total
2. Focus on what the app DOES, not how to build it
3. Make it practical and buildable using available knowledge
4. Be creative but simple

Respond with ONLY the app idea description. Nothing else.

Example: "A voice-controlled recipe app that reads cooking instructions aloud while you cook"

Generate a NEW app idea:"""

        logger.info(f"🎯 Generating app idea for tenant: {tenant_id}")
        logger.info(f"📚 Knowledge sources provided: {request.knowledge_sources}")
        
        # Simple warmup - prepare knowledge base for better first-run UX
        await agno_app_generator.warmup_knowledge_base()
        
        # Initialize knowledge base with user's dynamic sources (same as main generator)
        if agno_app_generator.knowledge_base is None or (
            request.knowledge_sources and 
            agno_app_generator.current_knowledge_sources != request.knowledge_sources
        ):
            # Force reload if sources changed
            if request.knowledge_sources and agno_app_generator.current_knowledge_sources != request.knowledge_sources:
                logger.info("🔄 Knowledge sources changed for idea generation, reloading...")
                agno_app_generator.knowledge_base = None
            
            logger.info(f"📚 Loading knowledge base for idea generation with sources: {request.knowledge_sources}")
            await agno_app_generator._initialize_knowledge(request.knowledge_sources)
            
            # Validate knowledge base loaded successfully
            if agno_app_generator.knowledge_base is None:
                logger.error("❌ Knowledge base failed to load for idea generation")
                raise HTTPException(status_code=500, detail="Failed to load knowledge base")
            
            logger.info("✅ Knowledge base loaded successfully for idea generation")
        
        # Ensure knowledge base is fully loaded and ready
        if agno_app_generator.knowledge_base is None:
            logger.error("❌ Knowledge base is None after initialization")
            raise HTTPException(status_code=500, detail="Knowledge base initialization failed")
        
        # Verify knowledge base has content
        try:
            # Test if knowledge base is searchable (indicates it's properly loaded)
            test_search = agno_app_generator.knowledge_base.search("test", num_results=1)
            logger.info(f"📊 Knowledge base is ready with searchable content")
        except Exception as e:
            logger.warning(f"⚠️ Knowledge base search test failed: {e}")
            # Continue anyway - knowledge base might still work
        
        # Create a simple agent just for idea generation (no file tools, no complexity)
        logger.info("🤖 Creating AGNO agent for idea generation...")
        try:
            simple_agent = Agent(
                model=llm_quick,  # Use quick model for ideas
                knowledge=agno_app_generator.knowledge_base,  # Same dynamic knowledge base
                search_knowledge=True,
                tools=[],  # No file tools needed for ideas
                instructions=[
                    "You are an AGNO Framework expert that generates simple, practical app ideas.",
                    "Generate ONE concise app idea under 160 characters.",
                    "Focus on what the app DOES, not how to build it.",
                    "Be creative but practical."
                ]
            )
            logger.info("✅ AGNO agent created successfully")
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            logger.error(f"❌ Error in idea generation: {e}")
            logger.error(f"❌ Full traceback: {error_details}")
            raise HTTPException(status_code=500, detail=f"Failed to generate app idea: {str(e)} | Details: {error_details[:200]}...")
        
        # Run the simple agent
        try:
            response = simple_agent.run(idea_prompt)
            logger.info(f"📝 Raw AGNO response: {response}")
            
            # Extract content from AGNO RunResponse object
            if hasattr(response, 'content'):
                idea_text = str(response.content).strip()
                logger.info(f"✅ Extracted content: {idea_text}")
            else:
                idea_text = str(response).strip()
                logger.info(f"⚠️ Using string conversion: {idea_text}")
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            logger.error(f"❌ Error running AGNO agent: {e}")
            logger.error(f"❌ Full traceback: {error_details}")
            raise HTTPException(status_code=500, detail=f"Failed to generate app idea: {str(e)} | Details: {error_details[:200]}...")
        
        # Clean up the response - remove any extra formatting
        lines = idea_text.split('\n')
        clean_idea = ""
        for line in lines:
            line = line.strip()
            if line and not line.startswith('```') and not line.startswith('#') and not line.startswith('*'):
                clean_idea = line
                break
        
        if not clean_idea:
            clean_idea = "A creative app that solves everyday problems"
        
        # Ensure it's under 160 characters
        if len(clean_idea) > 160:
            clean_idea = clean_idea[:157] + "..."
        
        # Extract a simple app name from the first few words
        words = clean_idea.split()
        app_name = " ".join(words[:3]) if len(words) >= 3 else "Simple App"
        
        return IdeaResponse(
            idea=app_name,
            description=clean_idea,
            suggested_apis=["AGNO Framework", "FastAPI Backend", "React Frontend"]
        )
            
    except Exception as e:
        logger.error(f"Error generating app idea: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate app idea: {str(e)}"
        )