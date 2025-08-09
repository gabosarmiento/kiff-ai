from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
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


class ModelItem(BaseModel):
    id: str
    name: str
    provider: str
    context_window: Optional[int] = None
    speed_tps: Optional[float] = None
    price_per_million_input: Optional[float] = None
    price_per_million_output: Optional[float] = None
    price_per_1k_input: float
    price_per_1k_output: float
    active: bool = True


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


@router.post("/", response_model=ModelItem)
async def create_model(payload: ModelItem):
    items = _read_all()
    if any(m.get("id") == payload.id for m in items):
        raise HTTPException(status_code=400, detail="id already exists")
    items.append(payload.model_dump())
    _write_all(items)
    return payload


@router.put("/{model_id}", response_model=ModelItem)
async def update_model(model_id: str, payload: ModelItem):
    items = _read_all()
    found = False
    for i, m in enumerate(items):
        if m.get("id") == model_id:
            items[i] = payload.model_dump()
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="model not found")
    _write_all(items)
    return payload


@router.delete("/{model_id}")
async def delete_model(model_id: str):
    items = _read_all()
    new_items = [m for m in items if m.get("id") != model_id]
    if len(new_items) == len(items):
        raise HTTPException(status_code=404, detail="model not found")
    _write_all(new_items)
    return {"ok": True}
