from __future__ import annotations
from typing import Dict, Any, List, Optional
import os
import json
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import text

from .pricing import _to_decimal  # reuse converter


def _models_store_path() -> str:
    return os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "models.json"))


def _read_models_json() -> List[Dict[str, Any]]:
    path = _models_store_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _provider_from_model_id(mid: str, fallback: Optional[str] = None) -> str:
    # If model id contains provider prefix (e.g., "openai/gpt-oss-20b"), use it
    if "/" in mid:
        return mid.split("/", 1)[0]
    return fallback or "groq"


def sync_model_pricing_from_models_json(db: Session) -> int:
    """Upsert pricing from models.json into model_pricing table.
    Uses price_per_1k_* if present; otherwise derives from per-million if available.
    Returns count of upserts attempted.
    """
    items = _read_models_json()
    if not items:
        return 0

    stmt = text(
        """
        INSERT INTO model_pricing (provider, model, input_per_1k, output_per_1k, reasoning_per_1k, cache_discount)
        VALUES (:provider, :model, :in1k, :out1k, :reason1k, :discount)
        ON CONFLICT (provider, model, effective_from) DO NOTHING
        """
    )

    count = 0
    for m in items:
        mid = m.get("id")
        if not mid:
            continue
        provider = m.get("provider") or _provider_from_model_id(mid)
        # Prefer explicit per-1k if provided
        in1k = m.get("price_per_1k_input")
        out1k = m.get("price_per_1k_output")
        # Derive from per-million when needed
        if in1k is None and isinstance(m.get("price_per_million_input"), (int, float)):
            in1k = float(m["price_per_million_input"]) / 1000.0
        if out1k is None and isinstance(m.get("price_per_million_output"), (int, float)):
            out1k = float(m["price_per_million_output"]) / 1000.0
        if in1k is None or out1k is None:
            # Skip models without pricing; they can be filled later
            continue

        db.execute(
            stmt,
            {
                "provider": provider,
                "model": mid,
                "in1k": in1k,
                "out1k": out1k,
                "reason1k": None,
                "discount": m.get("cache_discount"),
            },
        )
        count += 1
    db.commit()
    return count


async def sync_groq_models_and_prices(db: Session) -> int:
    """Optional extension point: fetch Groq models via API to ensure model ids are fresh.
    Pricing is currently sourced from models.json; Groq API typically doesn't include prices.
    Returns number of models considered for pricing upsert.
    """
    # We currently rely on models.json for the actual pricing numbers.
    # This function can be expanded to fetch additional metadata if needed.
    return sync_model_pricing_from_models_json(db)
