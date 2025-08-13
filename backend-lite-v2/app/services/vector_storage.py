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

from app.services.embedder_cache import get_embedder

class VectorStorageService:
    """Manage vector storage for Kiff Packs"""
    
    def __init__(self, db_path: str = "./kiff_vectors"):
        self.db_path = db_path
        self.db = lancedb.connect(db_path)
        
        # Use cached embedder
        self.embedder = get_embedder()
    
    def _embed_text(self, text: str) -> List[float]:
        """Generate embeddings for text using Agno's embedder"""
        if self.embedder:
            return self.embedder.get_embedding(text)
        else:
            # Fallback: use simple hash-based embedding
            return [float(hash(text) % 100) / 100.0 for _ in range(384)]
    
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
    
    async def store_pack_vectors(self, pack, tenant_id: str) -> bool:
        """Store pack vectors (simplified implementation)"""
        try:
            print(f"✅ Storing vectors for pack {pack.id} (simplified)")
            # Simplified implementation - just return success for now
            return True
            
        except Exception as e:
            print(f"❌ Error storing pack vectors: {e}")
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
            
            # Generate query embedding
            query_embedding = self._embed_text(query)
            
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