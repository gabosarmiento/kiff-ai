"""
Vector Service - LanceDB Operations and Knowledge Search
Handles vector storage, search, and pack indexing
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional
import lancedb
from .embedder_service import EmbedderService

class VectorService:
    """Service for vector operations using LanceDB"""
    
    def __init__(self):
        self.db_path = os.getenv("LANCEDB_DIR", "./kiff_vectors")
        self.db = lancedb.connect(self.db_path)
        self.embedder = EmbedderService()
        
        print(f"[VECTOR] Initialized with LanceDB at: {self.db_path}")
    
    async def search(self, query: str, tenant_id: str, pack_ids: Optional[List[str]] = None, limit: int = 4) -> List[Dict[str, Any]]:
        """Search vectors with tenant and pack filtering"""
        try:
            table_name = f"tenant_{tenant_id}_kiff_packs"
            
            # Check if table exists
            try:
                table = self.db.open_table(table_name)
            except Exception:
                return []  # Table doesn't exist yet
            
            # Generate query embedding
            query_embedding = await self.embedder.embed_text(query)
            
            # Build filters
            search_query = table.search(query_embedding)
            
            if pack_ids:
                # Build SQL-style filter for LanceDB
                pack_filter = " OR ".join([f"pack_id = '{pid}'" for pid in pack_ids])
                where_clause = f"tenant_id = '{tenant_id}' AND ({pack_filter})"
                search_query = search_query.where(where_clause)
            else:
                search_query = search_query.where(f"tenant_id = '{tenant_id}'")
            
            # Execute search
            results = search_query.limit(limit).to_list()
            
            # Format results
            formatted_results = []
            for r in results:
                formatted_results.append({
                    "content": r.get("content", ""),
                    "pack_id": r.get("pack_id", ""),
                    "pack_name": r.get("display_name", ""),
                    "document_type": r.get("document_type", ""),
                    "metadata": r.get("metadata_json", "")
                })
            
            return formatted_results
            
        except Exception as e:
            print(f"[VECTOR] Search error: {e}")
            return []
    
    async def index_pack(self, pack_id: str, tenant_id: str, display_name: str, api_url: str, description: str):
        """Index a pack's documentation into vectors"""
        try:
            print(f"[VECTOR] 🚀 Starting indexing for pack {pack_id}")
            
            # This is a simplified version - you'd want to:
            # 1. Fetch API documentation from api_url
            # 2. Extract and chunk the content
            # 3. Generate embeddings for each chunk
            # 4. Store in LanceDB
            
            # For now, let's create some basic documents
            documents = [
                {
                    "content": f"{display_name}: {description}",
                    "type": "overview"
                },
                {
                    "content": f"API documentation for {display_name} at {api_url}",
                    "type": "api_docs"
                }
            ]
            
            # Generate embeddings for documents
            texts = [doc["content"] for doc in documents]
            embeddings = await self.embedder.embed_batch(texts)
            
            # Prepare data for LanceDB
            table_name = f"tenant_{tenant_id}_kiff_packs"
            vectors_data = []
            
            for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
                vectors_data.append({
                    "vector": embedding,
                    "content": doc["content"],
                    "pack_id": pack_id,
                    "tenant_id": tenant_id,
                    "display_name": display_name,
                    "description": description,
                    "api_url": api_url,
                    "document_type": doc["type"],
                    "metadata_json": json.dumps({"section": doc["type"]})
                })
            
            # Store in LanceDB
            try:
                table = self.db.open_table(table_name)
                # Delete existing vectors for this pack
                try:
                    table.delete(f"pack_id = '{pack_id}'")
                except Exception:
                    pass
                table.add(vectors_data)
            except Exception:
                # Create new table
                table = self.db.create_table(table_name, vectors_data)
            
            print(f"[VECTOR] ✅ Indexed {len(vectors_data)} documents for pack {pack_id}")
            
        except Exception as e:
            print(f"[VECTOR] ❌ Indexing failed for pack {pack_id}: {e}")
            raise