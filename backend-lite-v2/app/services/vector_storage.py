"""
Vector Storage Service
=====================

Service for managing vector embeddings of Kiff Packs in LanceDB
for efficient similarity search and recommendations.
"""

import lancedb
import asyncio
from typing import List, Dict, Any, Optional
import json
from datetime import datetime
import uuid

from app.services.embedder_cache import get_embedder
from app.services.embedder_cache import EMBEDDING_MODEL_NAME
from app.observability.llm_wrapper import embed_and_track, SessionContext

class VectorStorageService:
    """Manage vector storage for Kiff Packs"""
    
    def __init__(self, db_path: str = "./kiff_vectors"):
        self.db_path = db_path
        self.db = lancedb.connect(db_path)
        
        # Use cached embedder
        self.embedder = get_embedder()
    
    def _embed_text(self, text: str) -> List[float]:
        """Generate embeddings for text using Agno's embedder (sync fallback)."""
        if self.embedder:
            return self.embedder.get_embedding(text)
        else:
            # Fallback: use simple hash-based embedding
            return [float(hash(text) % 100) / 100.0 for _ in range(384)]

    async def _embed_text_tracked(self, text: str, tenant_id: Optional[str], *, tool_name: str) -> List[float]:
        """Generate embeddings via embed_and_track for observability and budgeting."""
        provider = "sentence-transformers"
        model = EMBEDDING_MODEL_NAME
        # Build minimal session context
        ctx = SessionContext(
            tenant_id=tenant_id,
            user_id=None,
            workspace_id=None,
            session_id=str(uuid.uuid4()),
            run_id=str(uuid.uuid4()),
            step_id=str(uuid.uuid4()),
            agent_name="vector_storage",
            tool_name=tool_name,
        )

        # Define async callable that returns embedding and optional usage
        async def _call(text: str):
            # Run sync embedder in a thread to avoid blocking
            if self.embedder:
                vec = await asyncio.to_thread(self.embedder.get_embedding, text)
            else:
                vec = [float(hash(text) % 100) / 100.0 for _ in range(384)]
            return {"embedding": vec}

        result = await embed_and_track(
            provider=provider,
            model=model,
            model_version=None,
            text=text,
            session_ctx=ctx,
            tool_name=tool_name,
            attempt_n=1,
            cache_hit=False,
            embed_callable=_call,
        )
        return result.get("embedding") if isinstance(result, dict) else result
    
    def _combine_pack_content_for_embedding(self, pack) -> str:
        """Combine pack content into searchable text"""
        content_parts = [
            pack.display_name,
            pack.description,
            pack.category,
            json.dumps(pack.api_structure) if pack.api_structure else "",
            " ".join(pack.code_examples.values()) if pack.code_examples else "",
            " ".join(pack.integration_patterns) if pack.integration_patterns else ""
        ]
        
        return " ".join(filter(None, content_parts))
    
    def _create_pack_documents(self, pack, tenant_id: str) -> List[Dict[str, Any]]:
        """Create chunked documents from pack content for vector storage"""
        documents = []
        
        # Basic pack info document
        if pack.description:
            documents.append({
                "content": f"{pack.display_name}: {pack.description}",
                "type": "overview",
                "metadata": {"section": "description"}
            })
        
        # API structure document
        if pack.api_structure:
            import json
            api_content = json.dumps(pack.api_structure, indent=2)
            documents.append({
                "content": f"API Structure for {pack.display_name}:\n{api_content}",
                "type": "api_structure", 
                "metadata": {"section": "api_endpoints"}
            })
        
        # Code examples documents
        if pack.code_examples:
            for lang, code in pack.code_examples.items():
                if code and code.strip():
                    documents.append({
                        "content": f"{lang} code example for {pack.display_name}:\n{code}",
                        "type": "code_example",
                        "metadata": {"section": "code", "language": lang}
                    })
        
        # Integration patterns documents
        if pack.integration_patterns:
            for i, pattern in enumerate(pack.integration_patterns):
                if pattern and pattern.strip():
                    documents.append({
                        "content": f"Integration pattern for {pack.display_name}:\n{pattern}",
                        "type": "integration_pattern",
                        "metadata": {"section": "patterns", "pattern_index": i}
                    })
        
        return documents
    
    async def store_pack_vectors(self, pack, tenant_id: str) -> bool:
        """Store pack content as vectors in LanceDB for retrieval"""
        try:
            table_name = f"tenant_{tenant_id}_kiff_packs"
            
            # Create chunked documents from pack content
            documents = self._create_pack_documents(pack, tenant_id)
            
            if not documents:
                print(f"⚠️ No documents to store for pack {pack.id}")
                return True
                
            # Prepare data for LanceDB
            vectors_data = []
            for doc in documents:
                embedding = await self._embed_text_tracked(doc["content"], tenant_id, tool_name="store_pack_vectors")
                vectors_data.append({
                    "vector": embedding,
                    "content": doc["content"],
                    "pack_id": pack.id,
                    "tenant_id": tenant_id,
                    "pack_name": pack.name,
                    "display_name": pack.display_name,
                    "description": pack.description,
                    "category": pack.category,
                    "usage_count": pack.usage_count or 0,
                    "avg_rating": pack.avg_rating or 0.0,
                    "is_verified": pack.is_verified,
                    "api_url": pack.api_url,
                    "created_by": pack.created_by,
                    "document_type": doc["type"],
                    "metadata": doc["metadata"]
                })
            
            # Create or get table
            try:
                table = self.db.open_table(table_name)
                # Delete existing vectors for this pack to avoid duplicates
                try:
                    table.delete(f"pack_id = '{pack.id}'")
                except Exception:
                    pass  # Table might not exist yet
            except Exception:
                # Create new table if it doesn't exist
                if vectors_data:
                    table = self.db.create_table(table_name, vectors_data[:1])
                    vectors_data = vectors_data[1:]  # Skip first record as it's used for schema
                else:
                    return True
            
            # Add vectors to table
            if vectors_data:
                table.add(vectors_data)
            
            print(f"✅ Stored {len(vectors_data) + 1} vector documents for pack {pack.id}")
            return True
            
        except Exception as e:
            print(f"❌ Error storing pack vectors: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def search_similar_packs(
        self, 
        query: str, 
        tenant_id: str, 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Search for similar packs using vector similarity"""
        try:
            table_name = f"tenant_{tenant_id}_kiff_packs"
            
            # Generate query embedding (tracked)
            query_embedding = await self._embed_text_tracked(query, tenant_id, tool_name="search_similar_packs")
            
            # Search in LanceDB
            table = self.db.open_table(table_name)
            results = table.search(query_embedding).limit(limit).to_list()
            
            # Format results
            similar_packs = []
            for result in results:
                pack_data = {
                    "id": result["pack_id"],
                    "name": result["name"],
                    "display_name": result["display_name"],
                    "description": result["description"],
                    "category": result["category"],
                    "usage_count": result["usage_count"],
                    "avg_rating": result["avg_rating"],
                    "is_verified": result["is_verified"],
                    "api_url": result["api_url"],
                    "similarity_score": result.get("_distance", 0.0),
                    "created_by": result["created_by"]
                }
                similar_packs.append(pack_data)
            
            return similar_packs
            
        except Exception as e:
            print(f"Error searching similar packs: {e}")
            return []
    
    async def remove_pack_vectors(self, pack_id: str, tenant_id: str) -> bool:
        """Remove pack vectors from LanceDB"""
        try:
            table_name = f"tenant_{tenant_id}_kiff_packs"
            table = self.db.open_table(table_name)
            table.delete(f"pack_id = '{pack_id}'")
            
            print(f"✅ Removed vectors for pack {pack_id}")
            return True
            
        except Exception as e:
            print(f"❌ Error removing pack vectors: {e}")
            return False
    
    async def get_pack_recommendations(
        self, 
        user_id: str, 
        tenant_id: str, 
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get pack recommendations based on user's usage history"""
        try:
            table_name = f"tenant_{tenant_id}_kiff_packs"
            table = self.db.open_table(table_name)
            
            # For now, return most popular packs
            # In the future, this could use collaborative filtering
            all_packs = table.to_pandas()
            
            if len(all_packs) == 0:
                return []
            
            # Sort by usage count and rating
            recommended = all_packs.nlargest(limit, ['usage_count', 'avg_rating'])
            
            recommendations = []
            for _, pack in recommended.iterrows():
                pack_data = {
                    "id": pack["pack_id"],
                    "name": pack["name"],
                    "display_name": pack["display_name"],
                    "description": pack["description"],
                    "category": pack["category"],
                    "usage_count": pack["usage_count"],
                    "avg_rating": pack["avg_rating"],
                    "is_verified": pack["is_verified"],
                    "recommendation_reason": "Popular with your team"
                }
                recommendations.append(pack_data)
            
            return recommendations
            
        except Exception as e:
            print(f"Error getting pack recommendations: {e}")
            return []
    
    async def get_tenant_pack_stats(self, tenant_id: str) -> Dict[str, Any]:
        """Get statistics about tenant's pack collection"""
        try:
            table_name = f"tenant_{tenant_id}_kiff_packs"
            table = self.db.open_table(table_name)
            all_packs = table.to_pandas()
            
            if len(all_packs) == 0:
                return {
                    "total_packs": 0,
                    "categories": {},
                    "total_usage": 0,
                    "avg_rating": 0.0,
                    "verified_packs": 0
                }
            
            stats = {
                "total_packs": len(all_packs),
                "categories": all_packs['category'].value_counts().to_dict(),
                "total_usage": all_packs['usage_count'].sum(),
                "avg_rating": all_packs['avg_rating'].mean(),
                "verified_packs": all_packs['is_verified'].sum(),
                "top_pack": {
                    "name": all_packs.loc[all_packs['usage_count'].idxmax()]['display_name'],
                    "usage_count": all_packs['usage_count'].max()
                } if len(all_packs) > 0 else None
            }
            
            return stats
            
        except Exception as e:
            print(f"Error getting tenant pack stats: {e}")
            return {}
    
    def health_check(self) -> Dict[str, bool]:
        """Check if vector storage is working properly"""
        try:
            # Test database connection
            tables = self.db.table_names()
            
            # Test embedding generation
            test_embedding = self._embed_text("test")
            
            return {
                "database_connected": True,
                "embeddings_working": len(test_embedding) > 0,
                "tables_count": len(tables)
            }
            
        except Exception as e:
            print(f"Vector storage health check failed: {e}")
            return {
                "database_connected": False,
                "embeddings_working": False,
                "tables_count": 0
            }


# Factory function
def create_vector_storage_service() -> VectorStorageService:
    """Create a new vector storage service instance"""
    return VectorStorageService()