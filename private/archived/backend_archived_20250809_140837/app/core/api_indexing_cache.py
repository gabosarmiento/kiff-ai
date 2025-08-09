"""
API Indexing Cache System
=========================

Implements the cost-sharing model for API documentation indexing:
1. Admin pre-indexes APIs into cached vector databases
2. Users pay fractional costs (e.g., $0.20) to access pre-indexed data
3. Users get immediate access to "cached" vectors with simulated indexing UX
4. Transparent billing tracks fractional usage costs

Key Features:
- Pre-indexing with admin account for popular APIs
- Fractional cost sharing model
- Cached vector database access
- Simulated real-time indexing UX
- Integration with billing observability
"""

import asyncio
import logging
import time
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timezone
from decimal import Decimal
import json

from app.knowledge.api_gallery import get_api_gallery, APIDocumentation
from app.knowledge.engine.knowledge_management_engine import (
    get_knowledge_engine, DomainConfig, KnowledgeManagementEngine
)
from app.core.billing_observability import get_billing_service, BillingObservabilityService
from app.core.fractional_billing import get_fractional_billing_service, FractionalBillingService, AccessType
from agno.knowledge.agent import AgentKnowledge

logger = logging.getLogger(__name__)

class IndexingCacheStatus(Enum):
    """Status of API indexing cache"""
    NOT_CACHED = "not_cached"
    INDEXING = "indexing"
    CACHED = "cached"
    FAILED = "failed"
    EXPIRED = "expired"

@dataclass
class IndexingCacheEntry:
    """Represents a cached API indexing result"""
    api_name: str
    display_name: str
    cache_key: str
    status: IndexingCacheStatus
    knowledge_base_path: str
    original_indexing_cost: Decimal
    fractional_cost: Decimal  # What users pay
    total_urls_indexed: int
    tokens_used: int
    model_used: str
    created_at: datetime
    expires_at: Optional[datetime]
    admin_batch_id: str
    usage_count: int = 0  # How many tenants have accessed this
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass 
class UserAPIAccess:
    """Tracks user access to cached API indexing"""
    tenant_id: str
    user_id: str
    api_name: str
    cache_key: str
    access_token: str  # Unique token for this access
    cost_paid: Decimal
    accessed_at: datetime
    expires_at: datetime
    status: str = "active"  # active, expired, revoked

class APIIndexingCacheService:
    """
    Manages the cost-sharing cached indexing system for APIs
    """
    
    def __init__(self, cache_dir: str = None):
        self.logger = logging.getLogger(__name__)
        
        # Cache storage
        if cache_dir is None:
            cache_dir = Path(__file__).parent.parent / "data" / "api_cache"
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # In-memory caches (should be database in production)
        self.cache_entries: Dict[str, IndexingCacheEntry] = {}
        self.user_access: Dict[str, List[UserAPIAccess]] = {}
        
        # Configuration
        self.fractional_cost_ratio = Decimal("0.05")  # Users pay 5% of original cost
        self.default_fractional_cost = Decimal("0.20")  # $0.20 default
        self.access_duration_days = 30  # Access expires after 30 days
        
        # Services
        self.gallery = get_api_gallery()
        self.knowledge_engine = get_knowledge_engine()
        self.billing_service = get_billing_service()
        self.fractional_billing = get_fractional_billing_service()
        
        self.logger.info(f"🏦 API Indexing Cache Service initialized")
        self.logger.info(f"💰 Fractional cost ratio: {self.fractional_cost_ratio*100}%")
        self.logger.info(f"💵 Default fractional cost: ${self.default_fractional_cost}")
    
    async def admin_pre_index_api(
        self, 
        api_name: str,
        force_reindex: bool = False
    ) -> Tuple[bool, IndexingCacheEntry]:
        """
        Admin function to pre-index an API for the cache.
        This is the expensive operation that gets done once.
        """
        try:
            # Get API from gallery
            api = self.gallery.get_api(api_name)
            if not api:
                raise ValueError(f"API '{api_name}' not found in gallery")
            
            cache_key = f"{api_name}_{int(time.time())}"
            
            # Check if already cached and not forcing reindex
            if not force_reindex and api_name in self.cache_entries:
                existing = self.cache_entries[api_name]
                if existing.status == IndexingCacheStatus.CACHED:
                    self.logger.info(f"📦 API {api.display_name} already cached")
                    return True, existing
            
            # Create cache entry
            cache_entry = IndexingCacheEntry(
                api_name=api_name,
                display_name=api.display_name,
                cache_key=cache_key,
                status=IndexingCacheStatus.INDEXING,
                knowledge_base_path=str(self.cache_dir / f"{cache_key}.db"),
                original_indexing_cost=Decimal("0"),  # Will be calculated
                fractional_cost=self.default_fractional_cost,
                total_urls_indexed=0,
                tokens_used=0,
                model_used="",
                created_at=datetime.now(timezone.utc),
                expires_at=None,  # Admin cache doesn't expire
                admin_batch_id=f"admin_batch_{uuid.uuid4().hex[:8]}",
                metadata={
                    "api_category": api.category.value,
                    "api_priority": api.priority.name,
                    "documentation_urls": api.documentation_urls,
                    "discovery_method": "fallback",
                    "total_discovered_urls": len(api.documentation_urls)
                }
            )
            
            self.cache_entries[api_name] = cache_entry
            
            self.logger.info(f"🚀 Starting admin pre-indexing for {api.display_name}")
            
            # Discover comprehensive URLs using URL discovery service
            from app.knowledge.url_discovery_service import get_url_discovery_service
            url_discovery = get_url_discovery_service()
            
            self.logger.info(f"🔍 Discovering comprehensive URLs for {api.display_name}...")
            discovery_result = await url_discovery.discover_api_urls(api)
            
            # Use discovered URLs or fallback to configured URLs
            if discovery_result.url_list and len(discovery_result.url_list) > 0:
                comprehensive_urls = discovery_result.url_list
                self.logger.info(f"✅ Using {len(comprehensive_urls)} discovered URLs for {api.display_name}")
                self.logger.info(f"📊 Discovery method: {discovery_result.discovery_method}")
            else:
                comprehensive_urls = api.documentation_urls
                self.logger.warning(f"⚠️ URL discovery failed, using {len(comprehensive_urls)} fallback URLs")
            
            # Update cache entry metadata with discovered URLs
            cache_entry.metadata.update({
                "documentation_urls": comprehensive_urls,
                "discovery_method": discovery_result.discovery_method,
                "total_discovered_urls": discovery_result.total_urls,
                "documentation_urls_count": len(comprehensive_urls)
            })
            
            # Create domain configuration with comprehensive URLs
            domain_config = DomainConfig(
                name=api_name,
                display_name=api.display_name,
                description=api.description,
                sources=comprehensive_urls,
                keywords=api.tags
            )
            
            # Track admin consumption
            start_time = time.time()
            
            # Perform the actual indexing using knowledge engine
            knowledge_base, metrics = await self.knowledge_engine.create_domain_knowledge_base(
                domain_config
            )
            
            processing_time = time.time() - start_time
            
            if knowledge_base and metrics.status == "completed":
                # Calculate original cost based on tokens used
                original_cost = self.billing_service.get_token_cost(
                    "llama-3.3-70b-versatile",  # Model name first
                    metrics.tokens_used  # Token count second
                )
                
                # Calculate suggested fractional cost
                suggested_fractional = max(
                    original_cost * self.fractional_cost_ratio,
                    self.default_fractional_cost
                )
                
                # Update cache entry
                cache_entry.status = IndexingCacheStatus.CACHED
                cache_entry.original_indexing_cost = original_cost
                cache_entry.fractional_cost = suggested_fractional
                cache_entry.total_urls_indexed = metrics.urls_processed
                cache_entry.tokens_used = metrics.tokens_used
                cache_entry.model_used = "llama-3.3-70b-versatile"
                
                # Track admin consumption for transparency
                await self.billing_service.track_admin_consumption(
                    operation_type=f"pre_index_api_{api_name}",
                    input_tokens=metrics.tokens_used // 2,
                    output_tokens=metrics.tokens_used // 2,
                    model_used="llama-3.3-70b-versatile",
                    agent_name="api_indexing_cache",
                    agent_type="admin_pre_indexing",
                    success=True,
                    batch_id=cache_entry.admin_batch_id,
                    api_endpoint=f"/api/gallery/{api_name}/pre-index"
                )
                
                # Save cache metadata
                await self._save_cache_metadata(cache_entry)
                
                self.logger.info(f"✅ Pre-indexing completed for {api.display_name}")
                self.logger.info(f"💰 Original cost: ${original_cost:.4f}, Fractional: ${suggested_fractional:.2f}")
                self.logger.info(f"📊 URLs indexed: {metrics.urls_processed}, Tokens: {metrics.tokens_used}")
                
                return True, cache_entry
            else:
                cache_entry.status = IndexingCacheStatus.FAILED
                cache_entry.metadata["error"] = "Knowledge base creation failed"
                
                self.logger.error(f"❌ Pre-indexing failed for {api.display_name}")
                return False, cache_entry
                
        except Exception as e:
            self.logger.error(f"❌ Admin pre-indexing failed for {api_name}: {e}")
            if api_name in self.cache_entries:
                self.cache_entries[api_name].status = IndexingCacheStatus.FAILED
                self.cache_entries[api_name].metadata["error"] = str(e)
            return False, None
    
    async def user_request_api_access(
        self,
        tenant_id: str,
        user_id: str,
        api_name: str,
        simulate_indexing: bool = True
    ) -> Tuple[bool, Optional[UserAPIAccess], str]:
        """
        User requests access to an API. If cached, they pay fractional cost.
        If simulate_indexing=True, shows indexing progress UI while setting up access.
        """
        try:
            # Check if API exists in gallery
            api = self.gallery.get_api(api_name)
            if not api:
                return False, None, f"API '{api_name}' not found in gallery"
            
            # Check if cached
            if api_name not in self.cache_entries:
                return False, None, f"API '{api_name}' not yet cached by admin"
            
            cache_entry = self.cache_entries[api_name]
            
            if cache_entry.status != IndexingCacheStatus.CACHED:
                return False, None, f"API '{api_name}' cache status: {cache_entry.status.value}"
            
            # Check if user already has access
            existing_access = self._get_user_access(tenant_id, user_id, api_name)
            if existing_access and existing_access.status == "active":
                if existing_access.expires_at > datetime.now(timezone.utc):
                    self.logger.info(f"👤 User {user_id} already has active access to {api_name}")
                    return True, existing_access, "Already have active access"
            
            # Process fractional billing
            billing_success, billing_event, billing_message = await self.fractional_billing.process_api_access_billing(
                tenant_id=tenant_id,
                user_id=user_id,
                api_name=api_name,
                original_cost=cache_entry.original_indexing_cost,
                access_type=AccessType.ONE_TIME,
                access_duration_days=self.access_duration_days
            )
            
            if not billing_success:
                return False, None, billing_message
            
            # Simulate indexing progress for UX
            if simulate_indexing:
                await self._simulate_indexing_progress(api, cache_entry)
            
            # Create user access
            access_token = f"access_{uuid.uuid4().hex[:16]}"
            expires_at = datetime.now(timezone.utc).replace(
                day=datetime.now(timezone.utc).day + self.access_duration_days
            )
            
            user_access = UserAPIAccess(
                tenant_id=tenant_id,
                user_id=user_id,
                api_name=api_name,
                cache_key=cache_entry.cache_key,
                access_token=access_token,
                cost_paid=billing_event.fractional_amount,
                accessed_at=datetime.now(timezone.utc),
                expires_at=expires_at,
                status="active"
            )
            
            # Store user access
            if tenant_id not in self.user_access:
                self.user_access[tenant_id] = []
            self.user_access[tenant_id].append(user_access)
            
            # Update cache usage count
            cache_entry.usage_count += 1
            
            # Track user consumption for billing
            await self.billing_service.track_user_consumption(
                tenant_id=tenant_id,
                user_id=user_id,
                agent_name="api_cache_access",
                agent_type="cached_api_access",
                operation_type=f"access_cached_api_{api_name}",
                input_tokens=0,  # No actual processing
                output_tokens=0,  # No actual processing  
                model_used="cached",
                success=True,
                api_endpoint=f"/api/gallery/{api_name}/access"
            )
            
            # Log successful access
            self.logger.info(f"🎫 Granted access to {user_id} for {api.display_name}")
            self.logger.info(f"💰 Charged: ${billing_event.fractional_amount} (saved ${billing_event.cost_savings})")
            self.logger.info(f"🔑 Access token: {access_token[:12]}...")
            
            return True, user_access, billing_message
            
        except Exception as e:
            self.logger.error(f"❌ Failed to grant user access: {e}")
            return False, None, f"Failed to grant access: {str(e)}"
    
    async def get_user_api_knowledge_base(
        self,
        tenant_id: str,
        user_id: str,
        api_name: str,
        access_token: str
    ) -> Optional[AgentKnowledge]:
        """
        Get the cached knowledge base for a user with valid access
        """
        try:
            # Validate access
            user_access = self._get_user_access(tenant_id, user_id, api_name)
            if not user_access:
                self.logger.warning(f"No access found for {user_id} to {api_name}")
                return None
            
            if user_access.access_token != access_token:
                self.logger.warning(f"Invalid access token for {user_id} to {api_name}")
                return None
            
            if user_access.expires_at <= datetime.now(timezone.utc):
                self.logger.warning(f"Expired access for {user_id} to {api_name}")
                return None
            
            # Get cached knowledge base
            if api_name not in self.cache_entries:
                return None
            
            cache_entry = self.cache_entries[api_name]
            if cache_entry.status != IndexingCacheStatus.CACHED:
                return None
            
            # In a real implementation, you'd load the actual AgentKnowledge
            # from the cached vector database at cache_entry.knowledge_base_path
            
            # For now, return a placeholder indicating access is valid
            self.logger.info(f"📚 Providing cached knowledge base access to {user_id} for {api_name}")
            
            # Return cached knowledge base (this would be the actual AgentKnowledge object)
            return self.knowledge_engine.knowledge_bases.get(api_name)
            
        except Exception as e:
            self.logger.error(f"❌ Failed to get knowledge base for {user_id}: {e}")
            return None
    
    def _get_user_access(self, tenant_id: str, user_id: str, api_name: str) -> Optional[UserAPIAccess]:
        """Get user access record if exists"""
        if tenant_id not in self.user_access:
            return None
        
        for access in self.user_access[tenant_id]:
            if access.user_id == user_id and access.api_name == api_name:
                return access
        return None
    
    async def _simulate_indexing_progress(self, api: APIDocumentation, cache_entry: IndexingCacheEntry):
        """
        Simulate indexing progress for better UX while setting up cached access.
        This gives users the impression that indexing is happening in real-time.
        """
        self.logger.info(f"🎭 Simulating indexing progress for {api.display_name}")
        
        # Simulate progress steps
        progress_steps = [
            ("Initializing indexing pipeline...", 0.1),
            ("Discovering documentation URLs...", 0.3),
            ("Processing API documentation...", 1.5),
            ("Creating knowledge chunks...", 1.0), 
            ("Vectorizing content...", 0.8),
            ("Optimizing search index...", 0.5),
            ("Finalizing knowledge base...", 0.3)
        ]
        
        for step_msg, duration in progress_steps:
            self.logger.info(f"📝 {step_msg}")
            await asyncio.sleep(duration)
        
        self.logger.info(f"✨ Indexing simulation complete for {api.display_name}")
    
    async def _save_cache_metadata(self, cache_entry: IndexingCacheEntry):
        """Save cache entry metadata to disk"""
        try:
            metadata_file = self.cache_dir / f"{cache_entry.cache_key}_metadata.json"
            
            # Convert to serializable format
            metadata = {
                "api_name": cache_entry.api_name,
                "display_name": cache_entry.display_name,
                "cache_key": cache_entry.cache_key,
                "status": cache_entry.status.value,
                "knowledge_base_path": cache_entry.knowledge_base_path,
                "original_indexing_cost": float(cache_entry.original_indexing_cost),
                "fractional_cost": float(cache_entry.fractional_cost),
                "total_urls_indexed": cache_entry.total_urls_indexed,
                "tokens_used": cache_entry.tokens_used,
                "model_used": cache_entry.model_used,
                "created_at": cache_entry.created_at.isoformat(),
                "admin_batch_id": cache_entry.admin_batch_id,
                "usage_count": cache_entry.usage_count,
                "metadata": cache_entry.metadata
            }
            
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
                
            self.logger.info(f"💾 Saved cache metadata: {metadata_file}")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to save cache metadata: {e}")
    
    def get_cache_status(self, api_name: str) -> Dict[str, Any]:
        """Get cache status for an API"""
        if api_name not in self.cache_entries:
            return {
                "api_name": api_name,
                "status": "not_cached",
                "message": "API not yet cached by admin"
            }
        
        cache_entry = self.cache_entries[api_name]
        return {
            "api_name": api_name,
            "display_name": cache_entry.display_name,
            "status": cache_entry.status.value,
            "fractional_cost": float(cache_entry.fractional_cost),
            "original_cost": float(cache_entry.original_indexing_cost),
            "cost_savings": float(cache_entry.original_indexing_cost - cache_entry.fractional_cost),
            "urls_indexed": cache_entry.total_urls_indexed,
            "tokens_used": cache_entry.tokens_used,
            "created_at": cache_entry.created_at.isoformat(),
            "usage_count": cache_entry.usage_count,
            "metadata": cache_entry.metadata
        }
    
    def get_tenant_api_access_summary(self, tenant_id: str) -> Dict[str, Any]:
        """Get summary of tenant's API access"""
        if tenant_id not in self.user_access:
            return {
                "tenant_id": tenant_id,
                "total_apis_accessed": 0,
                "total_cost_paid": 0.0,
                "active_access": [],
                "expired_access": []
            }
        
        access_list = self.user_access[tenant_id]
        total_cost = sum(access.cost_paid for access in access_list)
        
        now = datetime.now(timezone.utc)
        active_access = [
            {
                "api_name": access.api_name,
                "cost_paid": float(access.cost_paid),
                "accessed_at": access.accessed_at.isoformat(),
                "expires_at": access.expires_at.isoformat()
            }
            for access in access_list 
            if access.expires_at > now and access.status == "active"
        ]
        
        expired_access = [
            {
                "api_name": access.api_name,
                "cost_paid": float(access.cost_paid),
                "accessed_at": access.accessed_at.isoformat(),
                "expired_at": access.expires_at.isoformat()
            }
            for access in access_list 
            if access.expires_at <= now or access.status != "active"
        ]
        
        return {
            "tenant_id": tenant_id,
            "total_apis_accessed": len(set(access.api_name for access in access_list)),
            "total_cost_paid": float(total_cost),
            "active_access": active_access,
            "expired_access": expired_access
        }
    
    def get_admin_cache_overview(self) -> Dict[str, Any]:
        """Get overview of all cached APIs for admin dashboard"""
        total_original_cost = sum(
            entry.original_indexing_cost for entry in self.cache_entries.values()
        )
        total_fractional_revenue = sum(
            entry.fractional_cost * entry.usage_count 
            for entry in self.cache_entries.values()
        )
        
        cached_apis = []
        for entry in self.cache_entries.values():
            cached_apis.append({
                "api_name": entry.api_name,
                "display_name": entry.display_name,
                "status": entry.status.value,
                "original_cost": float(entry.original_indexing_cost),
                "fractional_cost": float(entry.fractional_cost),
                "usage_count": entry.usage_count,
                "revenue_generated": float(entry.fractional_cost * entry.usage_count),
                "created_at": entry.created_at.isoformat(),
                "urls_indexed": entry.total_urls_indexed
            })
        
        return {
            "total_cached_apis": len(self.cache_entries),
            "total_original_indexing_cost": float(total_original_cost),
            "total_fractional_revenue": float(total_fractional_revenue),
            "cost_recovery_ratio": float(total_fractional_revenue / total_original_cost) if total_original_cost > 0 else 0,
            "cached_apis": cached_apis
        }

# Global cache service instance
_cache_service: Optional[APIIndexingCacheService] = None

def get_cache_service() -> APIIndexingCacheService:
    """Get the global API indexing cache service instance"""
    global _cache_service
    if _cache_service is None:
        _cache_service = APIIndexingCacheService()
    return _cache_service