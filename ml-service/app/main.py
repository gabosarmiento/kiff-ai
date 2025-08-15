"""
ML Service - Embeddings, Vector Search, and AI Processing
Handles all the heavy ML operations separated from the core API
"""

import os
import asyncio
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import uvicorn

# Import the services we need
from .services.embedder_service import EmbedderService
from .services.vector_service import VectorService
from .services.agent_service import AgentService

app = FastAPI(
    title="Kiff ML Service",
    description="AI/ML microservice for embeddings, vector search, and agent processing",
    version="1.0.0"
)

# Initialize services
embedder_service = EmbedderService()
vector_service = VectorService()
agent_service = AgentService()

# Request/Response Models
class EmbedRequest(BaseModel):
    text: str
    
class EmbedResponse(BaseModel):
    embedding: List[float]
    model: str
    
class SearchRequest(BaseModel):
    query: str
    tenant_id: str
    pack_ids: Optional[List[str]] = None
    limit: int = 4
    
class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    
class IndexPackRequest(BaseModel):
    pack_id: str
    tenant_id: str
    display_name: str
    api_url: str
    description: str
    
class IndexPackResponse(BaseModel):
    status: str
    message: str

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ml-service"}

@app.post("/embed", response_model=EmbedResponse)
async def embed_text(request: EmbedRequest):
    """Generate embeddings for text"""
    try:
        embedding = await embedder_service.embed_text(request.text)
        return EmbedResponse(
            embedding=embedding,
            model=embedder_service.model_name
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

@app.post("/search", response_model=SearchResponse)
async def search_knowledge(request: SearchRequest):
    """Search knowledge vectors with tenant and pack filtering"""
    try:
        results = await vector_service.search(
            query=request.query,
            tenant_id=request.tenant_id,
            pack_ids=request.pack_ids,
            limit=request.limit
        )
        return SearchResponse(results=results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.post("/index-pack", response_model=IndexPackResponse)
async def index_pack(request: IndexPackRequest, background_tasks: BackgroundTasks):
    """Start indexing a pack in the background"""
    try:
        # Start background indexing
        background_tasks.add_task(
            vector_service.index_pack,
            request.pack_id,
            request.tenant_id,
            request.display_name,
            request.api_url,
            request.description
        )
        
        return IndexPackResponse(
            status="processing",
            message=f"Started indexing pack {request.pack_id}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")

@app.post("/agent/run")
async def run_agent(request: dict):
    """Run AGNO agent with knowledge search capabilities"""
    try:
        result = await agent_service.run_agent(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        workers=1
    )