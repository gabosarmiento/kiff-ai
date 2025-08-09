from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import xml.etree.ElementTree as ET
import httpx

from .providers import SEED_PROVIDERS

router = APIRouter(prefix="/api/sitemap", tags=["sitemap"]) 


class ResolveRequest(BaseModel):
    provider_id: Optional[str] = None
    sitemap_url: Optional[str] = None
    url_filters: Optional[List[str]] = None
    limit: int = 20


class ResolveResponse(BaseModel):
    provider_id: Optional[str]
    sitemap_url: str
    total_urls: int
    selected_urls: List[str]


async def fetch_text(url: str) -> str:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.text


@router.post("/resolve", response_model=ResolveResponse)
async def resolve(req: ResolveRequest):
    provider = None
    if req.provider_id:
        provider = next((p for p in SEED_PROVIDERS if p.id == req.provider_id), None)
        if not provider:
            raise HTTPException(status_code=404, detail="provider not found")
    sitemap_url = req.sitemap_url or (provider.sitemap_url if provider else None)
    if not sitemap_url:
        raise HTTPException(status_code=400, detail="sitemap_url required")

    text = await fetch_text(sitemap_url)
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        raise HTTPException(status_code=400, detail="invalid sitemap xml")

    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    urls = [loc.text.strip() for loc in root.findall(f".{ns}url/{ns}loc") if loc.text]

    filters = req.url_filters or (provider.url_filters if provider else [])
    if filters:
        urls = [u for u in urls if any(u.startswith(f) for f in filters)]

    total = len(urls)
    selected = urls[: max(0, min(req.limit, len(urls)))]

    return ResolveResponse(
        provider_id=req.provider_id,
        sitemap_url=sitemap_url,
        total_urls=total,
        selected_urls=selected,
    )
