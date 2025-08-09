from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/providers", tags=["providers"]) 


class Provider(BaseModel):
    id: str
    name: str
    icon: Optional[str] = None
    categories: List[str] = []
    docs_url: Optional[str] = None
    sitemap_url: Optional[str] = None
    url_filters: List[str] = []  # only keep URLs that start with any of these


# Seed a minimal catalog to start. Admin backoffice can extend this later.
SEED_PROVIDERS: List[Provider] = [
    Provider(
        id="openai",
        name="OpenAI",
        icon="🤖",
        categories=["AI/ML", "Text Generation", "Conversation"],
        docs_url="https://platform.openai.com/docs/overview",
        sitemap_url="https://platform.openai.com/sitemap.xml",
        url_filters=["https://platform.openai.com/docs"],
    ),
    Provider(
        id="stripe",
        name="Stripe",
        icon="💳",
        categories=["Payments", "Finance"],
        docs_url="https://docs.stripe.com/",
        sitemap_url="https://docs.stripe.com/sitemap.xml",
        url_filters=["https://docs.stripe.com/api/"],
    ),
    Provider(
        id="elevenlabs",
        name="ElevenLabs",
        icon="🗣️",
        categories=["Voice", "AI/ML"],
        docs_url="https://elevenlabs.io/docs/",
        sitemap_url="https://elevenlabs.io/docs/sitemap.xml",
        url_filters=["https://elevenlabs.io/docs/"],
    ),
    Provider(
        id="agno",
        name="Agno",
        icon="🧩",
        categories=["AI/ML", "RAG"],
        docs_url="https://docs.agno.com/",
        sitemap_url="https://docs.agno.com/sitemap.xml",
        url_filters=["https://docs.agno.com/"],
    ),
]


@router.get("", response_model=List[Provider])
async def list_providers() -> List[Provider]:
    return SEED_PROVIDERS
