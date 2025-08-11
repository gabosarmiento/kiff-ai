from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import xml.etree.ElementTree as ET
import gzip
import io
import re
from ..util.admin_guard import require_admin
from ..util.gallery_store import (
    bulk_upsert_doc_urls,
    create_kb_collection,
    mark_api_indexed,
)

router = APIRouter(prefix="/admin/url_extractor", tags=["admin:url_extractor"])  # admin only


DEFAULT_PREFIXES = [
    "/docs",
    "/api",
    "/reference",
    "/guide",
    "/guides",
    "/developer",
]


class ExtractBody(BaseModel):
    base_url: str
    doc_prefixes: Optional[List[str]] = None


class ExtractResp(BaseModel):
    base_url: str
    total_urls: int
    urls: List[str]
    meta: Optional[Dict[str, Any]] = None


def _is_gz(url: str) -> bool:
    return url.endswith(".gz")


async def _fetch_text(url: str) -> str:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url)
        r.raise_for_status()
        if _is_gz(url):
            data = gzip.decompress(r.content)
            return data.decode("utf-8", errors="ignore")
        return r.text


def _xml_ns(root) -> str:
    if root.tag.startswith("{"):
        ns_uri = root.tag.split("}")[0][1:]
        return f"{{{ns_uri}}}"
    return ""


async def _discover_sitemaps(base_url: str) -> List[str]:
    base = base_url.rstrip("/")
    candidates = [
        f"{base}/sitemap.xml",
        f"{base}/sitemap_index.xml",
        f"{base}/docs/sitemap.xml",
        f"{base}/sitemap.xml.gz",
        f"{base}/sitemap_index.xml.gz",
        f"{base}/docs/sitemap.xml.gz",
    ]
    # Include robots.txt discovery
    robots = f"{base}/robots.txt"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            rr = await client.get(robots)
            if rr.status_code == 200:
                for line in rr.text.splitlines():
                    if line.lower().startswith("sitemap:"):
                        sm = line.split(":", 1)[1].strip()
                        if sm:
                            candidates.append(sm)
    except Exception:
        pass
    # Dedup while preserving order
    seen = set()
    out: List[str] = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out


def _filter_urls(urls: List[str], base_url: str, prefixes: List[str]) -> List[str]:
    # Normalize prefixes (absolute): keep if url startswith base+prefix or absolute prefix
    base = base_url.rstrip("/")
    keep: List[str] = []
    for u in urls:
        try:
            u_str = u.strip()
        except Exception:
            continue
        if not u_str:
            continue
        ok = False
        for p in prefixes:
            p = p.strip()
            if not p:
                continue
            if p.startswith("http://") or p.startswith("https://"):
                if u_str.startswith(p):
                    ok = True
                    break
            else:
                if u_str.startswith(base + p):
                    ok = True
                    break
        if ok:
            keep.append(u_str)
    # Dedup and simple normalization (drop anchors)
    seen = set()
    dedup: List[str] = []
    for u in keep:
        u_n = re.sub(r"#[^#]*$", "", u)
        if u_n not in seen:
            seen.add(u_n)
            dedup.append(u_n)
    return dedup


async def _parse_sitemap(url: str) -> List[str]:
    text = await _fetch_text(url)
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []
    ns = _xml_ns(root)
    # sitemap index
    if root.tag.endswith("sitemapindex") or root.tag.endswith("sitemapindex}"):
        urls = []
        children = [loc.text.strip() for loc in root.findall(f".{ns}sitemap/{ns}loc") if getattr(loc, "text", None)]
        # Soft limit to keep under SLA
        for child in children[:25]:
            urls.extend(await _parse_sitemap(child))
        return urls
    # urlset
    urls = [loc.text.strip() for loc in root.findall(f".{ns}url/{ns}loc") if getattr(loc, "text", None)]
    return urls


@router.post("/extract", response_model=ExtractResp)
async def extract(req: Request, body: ExtractBody):
    require_admin(req)
    base = body.base_url.rstrip("/")
    prefixes = body.doc_prefixes or DEFAULT_PREFIXES

    # Try all discovered sitemaps; return first usable list
    sitemaps = await _discover_sitemaps(base)
    all_urls: List[str] = []
    for sm in sitemaps:
        try:
            urls = await _parse_sitemap(sm)
            if urls:
                all_urls.extend(urls)
        except Exception:
            continue
    if not all_urls:
        # No sitemaps produced results
        return ExtractResp(base_url=base, total_urls=0, urls=[], meta={"note": "no-sitemap"})

    filtered = _filter_urls(all_urls, base, prefixes)
    # SLA: do not return too many (preview first 20)
    preview = filtered[: min(20, len(filtered))]
    return ExtractResp(base_url=base, total_urls=len(filtered), urls=preview, meta=None)


class SaveToKbBody(BaseModel):
    api_service_id: str
    urls: List[str]


class SaveToKbResp(BaseModel):
    kb_collection_id: str
    total_items: int


@router.post("/save_to_kb", response_model=SaveToKbResp)
async def save_to_kb(req: Request, body: SaveToKbBody):
    require_admin(req)
    # Persist URLs as DocUrl rows
    url_tuples = [(u, None, None) for u in body.urls]
    bulk_upsert_doc_urls(body.api_service_id, url_tuples)
    # Update API service counters
    mark_api_indexed(body.api_service_id, url_count=len(body.urls))
    # Create a KB collection entry
    kb = create_kb_collection(api_service_id=body.api_service_id, title="Docs", total_items=len(body.urls))
    return SaveToKbResp(kb_collection_id=kb["id"], total_items=kb["total_items"])  # type: ignore
