from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, AnyUrl
from typing import List, Optional, Dict, Any
from enum import Enum
import os
import asyncio
import httpx
import json

router = APIRouter(prefix="/api/models", tags=["models"]) 


def _models_store_path() -> str:
    return os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "models.json"))


def _read_all() -> List[Dict[str, Any]]:
    path = _models_store_path()
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        try:
            items = json.load(f)
        except json.JSONDecodeError:
            return []
    return items


def _write_all(items: List[Dict[str, Any]]):
    path = _models_store_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


class Modality(str, Enum):
    text = "text"
    vision = "vision"
    audio = "audio"
    multimodal = "multimodal"


class ModelItem(BaseModel):
    # Identity
    id: str
    name: str
    provider: str

    # Groq model list compatibility
    object: Optional[str] = "model"
    created: Optional[int] = None  # epoch seconds
    owned_by: Optional[str] = None
    active: bool = True
    public_apps: Optional[Any] = None

    # Capabilities
    modality: Optional[Modality] = None
    family: Optional[str] = None
    context_window: Optional[int] = None
    max_output_tokens: Optional[int] = None
    speed_tps: Optional[float] = None

    # Pricing
    price_per_million_input: Optional[float] = None
    price_per_million_output: Optional[float] = None
    price_per_1k_input: Optional[float] = None
    price_per_1k_output: Optional[float] = None

    # Metadata
    status: Optional[str] = "active"  # active | preview | deprecated
    tags: List[str] = []
    notes: Optional[str] = None
    model_card_url: Optional[AnyUrl] = None  # Hugging Face model card


@router.get("/", response_model=List[ModelItem])
async def list_models():
    return _read_all()


@router.get("/{model_id}", response_model=ModelItem)
async def get_model(model_id: str):
    items = _read_all()
    for m in items:
        if m.get("id") == model_id:
            return m
    raise HTTPException(status_code=404, detail="model not found")


def _derive_prices(item: Dict[str, Any]) -> Dict[str, Any]:
    # If per-1k prices are missing but per-million present, derive them.
    pin = item.get("price_per_million_input")
    pout = item.get("price_per_million_output")
    if item.get("price_per_1k_input") is None and isinstance(pin, (int, float)):
        item["price_per_1k_input"] = float(pin) / 1_000.0
    if item.get("price_per_1k_output") is None and isinstance(pout, (int, float)):
        item["price_per_1k_output"] = float(pout) / 1_000.0
    return item


def _guess_modality(model_id: str) -> Optional[str]:
    mid = model_id.lower()
    if any(x in mid for x in ["whisper", "tts"]):
        return "audio"
    return "text"


def _guess_family(model_id: str) -> Optional[str]:
    mid = model_id.lower()
    if "llama-3.3" in mid:
        return "Llama 3.3"
    if "llama-3.1" in mid:
        return "Llama 3.1"
    if "llama3-" in mid or "llama-3" in mid:
        return "Llama 3"
    if "llama-guard-4" in mid:
        return "Llama Guard 4"
    if "llama-guard-3" in mid:
        return "Llama Guard 3"
    if "gemma2" in mid:
        return "Gemma 2"
    if "qwen3" in mid:
        return "Qwen3"
    if "kimi-k2" in mid:
        return "Kimi K2"
    return None


def _guess_model_card_url(model_id: str) -> Optional[str]:
    # Best-effort mapping using known patterns
    m = model_id
    mapping = {
        "llama-3.1-8b-instant": "https://huggingface.co/meta-llama/Llama-3.1-8B",
        "llama-3.3-70b-versatile": "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct",
        "llama3-70b-8192": "https://huggingface.co/meta-llama/Meta-Llama-3-70B-Instruct",
        "llama3-8b-8192": "https://huggingface.co/meta-llama/Meta-Llama-3-8B",
        "llama-guard-3-8b": "https://huggingface.co/meta-llama/Llama-Guard-3-8B",
        "meta-llama/llama-guard-4-12b": "https://huggingface.co/meta-llama/Llama-Guard-4-12B",
        "gemma2-9b-it": "https://huggingface.co/google/gemma-2-9b",
        "distil-whisper-large-v3-en": "https://huggingface.co/distil-whisper/distil-large-v3",
        "whisper-large-v3": "https://huggingface.co/openai/whisper-large-v3",
        "whisper-large-v3-turbo": "https://huggingface.co/openai/whisper-large-v3-turbo",
        "moonshotai/kimi-k2-instruct": "https://huggingface.co/moonshotai/Kimi-K2-Instruct",
        "openai/gpt-oss-20b": "https://console.groq.com/docs/model/openai/gpt-oss-20b",
        "openai/gpt-oss-120b": "https://console.groq.com/docs/model/openai/gpt-oss-120b",
        "qwen/qwen3-32b": "https://huggingface.co/Qwen/Qwen3-32B",
        "meta-llama/llama-4-maverick-17b-128e-instruct": "https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E-Instruct",
        "meta-llama/llama-4-scout-17b-16e-instruct": "https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E-Instruct",
        "meta-llama/llama-prompt-guard-2-22m": "https://huggingface.co/meta-llama/Llama-Prompt-Guard-2-22M",
        "meta-llama/llama-prompt-guard-2-86m": "https://huggingface.co/meta-llama/Llama-Prompt-Guard-2-86M",
        "playai-tts": "https://console.groq.com/docs/model/playai-tts",
        "playai-tts-arabic": "https://console.groq.com/docs/model/playai-tts-arabic",
    }
    return mapping.get(m)


def _merge_preserving_prices(existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    out = {**existing, **incoming}
    # Preserve existing pricing if present
    for k in [
        "price_per_million_input",
        "price_per_million_output",
        "price_per_1k_input",
        "price_per_1k_output",
    ]:
        if existing.get(k) is not None:
            out[k] = existing[k]
    return _derive_prices(out)


@router.post("/sync/groq")
async def sync_groq_models():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="GROQ_API_KEY not configured")

    url = "https://api.groq.com/openai/v1/models"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=f"groq models fetch failed: {resp.text}")
        data = resp.json()

    items = _read_all()
    by_id = {m.get("id"): m for m in items}

    created = 0
    updated = 0
    for entry in data.get("data", []):
        mid = entry.get("id")
        if not mid:
            continue
        incoming = {
            "id": mid,
            "name": mid,
            "provider": "groq",
            "object": entry.get("object", "model"),
            "created": entry.get("created"),
            "owned_by": entry.get("owned_by"),
            "active": entry.get("active", True),
            "context_window": entry.get("context_window"),
            "public_apps": entry.get("public_apps"),
            "modality": _guess_modality(mid),
            "family": _guess_family(mid),
            "model_card_url": _guess_model_card_url(mid),
            "status": "active",
        }
        if mid in by_id:
            merged = _merge_preserving_prices(by_id[mid], incoming)
            by_id[mid] = merged
            updated += 1
        else:
            by_id[mid] = _derive_prices(incoming)
            created += 1

    new_list = list(by_id.values())
    _write_all(new_list)
    return {"ok": True, "created": created, "updated": updated, "total": len(new_list)}


@router.post("/", response_model=ModelItem)
async def create_model(payload: ModelItem):
    items = _read_all()
    if any(m.get("id") == payload.id for m in items):
        raise HTTPException(status_code=400, detail="id already exists")
    item = _derive_prices(payload.model_dump())
    items.append(item)
    _write_all(items)
    return item


@router.put("/{model_id}", response_model=ModelItem)
async def update_model(model_id: str, payload: ModelItem):
    items = _read_all()
    found = False
    for i, m in enumerate(items):
        if m.get("id") == model_id:
            items[i] = _derive_prices(payload.model_dump())
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="model not found")
    _write_all(items)
    return items[i]


@router.delete("/{model_id}")
async def delete_model(model_id: str):
    items = _read_all()
    new_items = [m for m in items if m.get("id") != model_id]
    if len(new_items) == len(items):
        raise HTTPException(status_code=404, detail="model not found")
    _write_all(new_items)
    return {"ok": True}
