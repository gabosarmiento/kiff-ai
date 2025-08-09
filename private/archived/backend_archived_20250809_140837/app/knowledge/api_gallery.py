"""
Kiff API Gallery System
=======================

Curated collection of high-value API documentation for indexing and vectorization.
Provides organized access to popular APIs that developers commonly use.

Features:
- Curated API collection with documentation URLs
- Multi-tenant knowledge sharing (index once, serve many clients)
- Always up-to-date documentation refresh mechanism
- Categorized APIs for easy discovery
- Priority-based indexing for high-value APIs

Usage:
    from app.knowledge.api_gallery import APIGallery, get_api_gallery
    
    gallery = get_api_gallery()
    apis = gallery.get_all_apis()
    high_priority = gallery.get_apis_by_priority("high")
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Set
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class APIPriority(Enum):
    """Priority levels for API indexing"""
    CRITICAL = 1    # Must-have APIs (AGNO, OpenAI, Stripe)
    HIGH = 2        # Popular developer APIs (ElevenLabs, Stability)
    MEDIUM = 3      # Useful specialized APIs
    LOW = 4         # Nice-to-have APIs


class APICategory(Enum):
    """Categories for API organization"""
    AI_ML = "ai_ml"                    # AI/ML APIs (OpenAI, Stability, ElevenLabs)
    FRAMEWORKS = "frameworks"          # Development frameworks (AGNO)
    PAYMENTS = "payments"              # Payment processing (Stripe)
    MEDIA = "media"                    # Media generation/processing
    DEVELOPER_TOOLS = "developer_tools" # Development utilities
    CLOUD_SERVICES = "cloud_services"  # Cloud platforms
    DATABASES = "databases"            # Database services
    COMMUNICATION = "communication"    # Email, SMS, etc.


@dataclass
class APIDocumentation:
    """Represents an API documentation source"""
    name: str
    display_name: str
    description: str
    base_url: str
    documentation_urls: List[str]
    category: APICategory
    priority: APIPriority
    tags: List[str]
    last_updated: Optional[str] = None
    indexing_status: str = "pending"  # pending, indexing, completed, failed
    
    def __post_init__(self):
        """Validate API documentation configuration"""
        if not self.documentation_urls:
            raise ValueError(f"API {self.name} must have at least one documentation URL")
        
        # Ensure all URLs are valid
        for url in self.documentation_urls:
            if not url.startswith(('http://', 'https://')):
                raise ValueError(f"Invalid URL format: {url}")


class APIGallery:
    """Manages the curated collection of API documentation"""
    
    def __init__(self):
        self.apis: Dict[str, APIDocumentation] = {}
        self._initialize_gallery()
    
    def _initialize_gallery(self):
        """Initialize the gallery with curated APIs"""
        
        # AGNO Framework - Critical for our system
        self.add_api(APIDocumentation(
            name="agno",
            display_name="AGNO Framework",
            description="Multi-agent AI framework for building intelligent applications",
            base_url="https://docs.agno.com",
            documentation_urls=[
                "https://docs.agno.com/llms-full.txt"  # Comprehensive AGNO documentation
            ],
            category=APICategory.FRAMEWORKS,
            priority=APIPriority.CRITICAL,
            tags=["ai", "agents", "framework", "multi-agent", "workflows"]
        ))
        
        # Stability AI - Popular AI image generation
        self.add_api(APIDocumentation(
            name="stability_ai",
            display_name="Stability AI",
            description="AI-powered image generation and editing platform",
            base_url="https://platform.stability.ai",
            documentation_urls=[
                "https://platform.stability.ai/docs/getting-started",
                "https://platform.stability.ai/docs/api-reference",
                "https://platform.stability.ai/docs/features/text-to-image",
                "https://platform.stability.ai/docs/features/image-to-image",
                "https://platform.stability.ai/docs/features/inpainting"
            ],
            category=APICategory.AI_ML,
            priority=APIPriority.HIGH,
            tags=["ai", "image-generation", "stable-diffusion", "text-to-image"]
        ))
        
        # ElevenLabs - AI voice generation
        self.add_api(APIDocumentation(
            name="elevenlabs",
            display_name="ElevenLabs",
            description="AI voice generation and text-to-speech platform",
            base_url="https://elevenlabs.io",
            documentation_urls=[
                "https://elevenlabs.io/docs/overview",
                "https://elevenlabs.io/docs/api-reference",
                "https://elevenlabs.io/docs/voices",
                "https://elevenlabs.io/docs/speech-synthesis",
                "https://elevenlabs.io/docs/voice-cloning"
            ],
            category=APICategory.AI_ML,
            priority=APIPriority.HIGH,
            tags=["ai", "voice", "text-to-speech", "voice-cloning", "audio"]
        ))
        
        # Leonardo AI - AI art generation
        self.add_api(APIDocumentation(
            name="leonardo_ai",
            display_name="Leonardo AI",
            description="AI-powered art and image generation platform",
            base_url="https://docs.leonardo.ai",
            documentation_urls=[
                "https://docs.leonardo.ai/docs",
                "https://docs.leonardo.ai/reference/creategeneration",
                "https://docs.leonardo.ai/reference/getgenerationbyid",
                "https://docs.leonardo.ai/reference/getgenerationsbyuserid",
                "https://docs.leonardo.ai/reference/uploadinitimage"
            ],
            category=APICategory.AI_ML,
            priority=APIPriority.HIGH,
            tags=["ai", "art-generation", "image-generation", "creative-ai"]
        ))
        
        # OpenAI - Critical AI platform
        self.add_api(APIDocumentation(
            name="openai",
            display_name="OpenAI",
            description="Leading AI platform with GPT models and advanced AI capabilities",
            base_url="https://platform.openai.com",
            documentation_urls=[
                "https://platform.openai.com/docs/introduction",
                "https://platform.openai.com/docs/api-reference",
                "https://platform.openai.com/docs/guides/text-generation",
                "https://platform.openai.com/docs/guides/vision",
                "https://platform.openai.com/docs/guides/function-calling",
                "https://platform.openai.com/docs/guides/assistants"
            ],
            category=APICategory.AI_ML,
            priority=APIPriority.CRITICAL,
            tags=["ai", "gpt", "language-model", "chat", "completions", "assistants"]
        ))
        
        # Stripe - Critical payment processing
        self.add_api(APIDocumentation(
            name="stripe",
            display_name="Stripe",
            description="Complete payments platform for internet businesses",
            base_url="https://stripe.com",
            documentation_urls=[
                "https://stripe.com/docs",
                "https://stripe.com/docs/api",
                "https://stripe.com/docs/payments",
                "https://stripe.com/docs/billing",
                "https://stripe.com/docs/connect",
                "https://stripe.com/docs/identity"
            ],
            category=APICategory.PAYMENTS,
            priority=APIPriority.CRITICAL,
            tags=["payments", "billing", "subscriptions", "marketplace", "fintech"]
        ))
        
        logger.info(f"🎨 API Gallery initialized with {len(self.apis)} APIs")
    
    def add_api(self, api: APIDocumentation) -> bool:
        """Add an API to the gallery"""
        try:
            self.apis[api.name] = api
            logger.info(f"✅ Added API: {api.display_name} ({api.name})")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to add API {api.name}: {e}")
            return False
    
    def get_api(self, name: str) -> Optional[APIDocumentation]:
        """Get a specific API by name"""
        return self.apis.get(name)
    
    def get_all_apis(self) -> Dict[str, APIDocumentation]:
        """Get all APIs in the gallery"""
        return self.apis.copy()
    
    def get_apis_by_category(self, category: APICategory) -> Dict[str, APIDocumentation]:
        """Get APIs by category"""
        return {
            name: api for name, api in self.apis.items()
            if api.category == category
        }
    
    def get_apis_by_priority(self, priority: APIPriority) -> Dict[str, APIDocumentation]:
        """Get APIs by priority level"""
        return {
            name: api for name, api in self.apis.items()
            if api.priority == priority
        }
    
    def get_high_priority_apis(self) -> Dict[str, APIDocumentation]:
        """Get critical and high priority APIs"""
        return {
            name: api for name, api in self.apis.items()
            if api.priority in [APIPriority.CRITICAL, APIPriority.HIGH]
        }
    
    def search_apis(self, query: str) -> Dict[str, APIDocumentation]:
        """Search APIs by name, description, or tags"""
        query = query.lower()
        results = {}
        
        for name, api in self.apis.items():
            # Search in name, display_name, description, and tags
            searchable_text = f"{api.name} {api.display_name} {api.description} {' '.join(api.tags)}".lower()
            if query in searchable_text:
                results[name] = api
        
        return results
    
    def get_indexing_queue(self) -> List[APIDocumentation]:
        """Get APIs that need to be indexed (pending status)"""
        return [
            api for api in self.apis.values()
            if api.indexing_status == "pending"
        ]
    
    def update_indexing_status(self, api_name: str, status: str) -> bool:
        """Update the indexing status of an API"""
        if api_name in self.apis:
            self.apis[api_name].indexing_status = status
            logger.info(f"📊 Updated {api_name} indexing status to: {status}")
            return True
        return False
    
    def get_gallery_stats(self) -> Dict[str, int]:
        """Get statistics about the API gallery"""
        stats = {
            "total_apis": len(self.apis),
            "by_priority": {},
            "by_category": {},
            "by_status": {}
        }
        
        for api in self.apis.values():
            # Count by priority
            priority_name = api.priority.name.lower()
            stats["by_priority"][priority_name] = stats["by_priority"].get(priority_name, 0) + 1
            
            # Count by category
            category_name = api.category.value
            stats["by_category"][category_name] = stats["by_category"].get(category_name, 0) + 1
            
            # Count by status
            status = api.indexing_status
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
        
        return stats


# Global gallery instance
_api_gallery: Optional[APIGallery] = None


def get_api_gallery() -> APIGallery:
    """Get the global API gallery instance"""
    global _api_gallery
    if _api_gallery is None:
        _api_gallery = APIGallery()
    return _api_gallery


def reset_api_gallery():
    """Reset the global API gallery (useful for testing)"""
    global _api_gallery
    _api_gallery = None


# Export main components
__all__ = [
    "APIGallery",
    "APIDocumentation", 
    "APIPriority",
    "APICategory",
    "get_api_gallery",
    "reset_api_gallery"
]
