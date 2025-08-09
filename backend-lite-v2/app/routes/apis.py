from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Literal, Any, Dict
import os, json, uuid
from datetime import datetime
import httpx
import xml.etree.ElementTree as ET

router = APIRouter(prefix="/api/apis", tags=["apis"])  # API catalog CRUD

# Storage path (JSON file for MVP)
_DATA_FILE = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "data", "apis.json")
)


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _load() -> List[Dict[str, Any]]:
    if not os.path.exists(_DATA_FILE):
        return []
    with open(_DATA_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _save(items: List[Dict[str, Any]]):
    os.makedirs(os.path.dirname(_DATA_FILE), exist_ok=True)
    with open(_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


Status = Literal["active", "inactive", "draft"]


class APIBase(BaseModel):
    name: str
    description: Optional[str] = None
    website: Optional[HttpUrl] = None
    icon: Optional[str] = None  # emoji or URL
    categories: List[str] = Field(default_factory=list)
    docs_url: Optional[HttpUrl] = None
    sitemap_url: Optional[HttpUrl] = None
    url_filters: List[str] = Field(default_factory=list)
    status: Status = "active"
    apis_count: Optional[int] = None


class APICreate(APIBase):
    id: Optional[str] = None  # if omitted, will be generated from uuid


class APIUpdate(APIBase):
    pass


class APIItem(APIBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@router.get("", response_model=List[APIItem])
async def list_apis(
    q: Optional[str] = Query(None, description="free-text search in name/description/categories"),
    category: Optional[str] = Query(None),
    status: Optional[Status] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    items = _load()
    def match(it: Dict[str, Any]) -> bool:
        if q:
            hay = " ".join([
                it.get("name", ""),
                it.get("description", ""),
                " ".join(it.get("categories", []) or []),
            ]).lower()
            if q.lower() not in hay:
                return False
        if category and category not in (it.get("categories") or []):
            return False
        if status and it.get("status") != status:
            return False
        return True
    filtered = [it for it in items if match(it)]
    return [APIItem(**it) for it in filtered[offset: offset + limit]]


@router.get("/{api_id}", response_model=APIItem)
async def get_api(api_id: str):
    items = _load()
    for it in items:
        if it.get("id") == api_id:
            return APIItem(**it)
    raise HTTPException(status_code=404, detail="API not found")


@router.post("", response_model=APIItem)
async def create_api(req: APICreate):
    items = _load()
    new_id = req.id or str(uuid.uuid4())
    if any(it.get("id") == new_id for it in items):
        raise HTTPException(status_code=409, detail="API id already exists")
    now = _now_iso()
    data = APIItem(
        id=new_id,
        name=req.name,
        description=req.description,
        website=req.website,
        icon=req.icon,
        categories=req.categories,
        docs_url=req.docs_url,
        sitemap_url=req.sitemap_url,
        url_filters=req.url_filters,
        status=req.status,
        apis_count=req.apis_count,
        created_at=now,
        updated_at=now,
    ).model_dump()
    items.append(data)
    _save(items)
    return APIItem(**data)


@router.put("/{api_id}", response_model=APIItem)
async def update_api(api_id: str, req: APIUpdate):
    items = _load()
    for i, it in enumerate(items):
        if it.get("id") == api_id:
            merged = {
                **it,
                **req.model_dump(exclude_unset=True),
                "updated_at": _now_iso(),
            }
            items[i] = merged
            _save(items)
            return APIItem(**merged)
    raise HTTPException(status_code=404, detail="API not found")


@router.delete("/{api_id}")
async def delete_api(api_id: str):
    items = _load()
    new_items = [it for it in items if it.get("id") != api_id]
    if len(new_items) == len(items):
        raise HTTPException(status_code=404, detail="API not found")
    _save(new_items)
    return {"ok": True}


class SitemapResponse(BaseModel):
    api_id: str
    sitemap_url: Optional[str]
    total_urls: int
    selected_urls: List[str]


@router.get("/{api_id}/sitemap", response_model=SitemapResponse)
async def get_api_sitemap(api_id: str, limit: int = 20):
    items = _load()
    api = next((it for it in items if it.get("id") == api_id), None)
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    sitemap_url = api.get("sitemap_url")
    if not sitemap_url:
        return SitemapResponse(api_id=api_id, sitemap_url=None, total_urls=0, selected_urls=[])

    filters = api.get("url_filters") or []
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(sitemap_url)
        r.raise_for_status()
        text = r.text
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        raise HTTPException(status_code=400, detail="invalid sitemap xml")

    ns = ""
    if root.tag.startswith("{"):
        ns_uri = root.tag.split("}")[0][1:]
        ns = f"{{{ns_uri}}}"
    urls = [loc.text.strip() for loc in root.findall(f".{ns}url/{ns}loc") if getattr(loc, "text", None)]
    if filters:
        urls = [u for u in urls if any(u.startswith(f) for f in filters)]
    total = len(urls)
    selected = urls[: max(0, min(limit, total))]
    return SitemapResponse(api_id=api_id, sitemap_url=sitemap_url, total_urls=total, selected_urls=selected)
