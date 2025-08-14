from __future__ import annotations
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from ..models.observability import ModelPricing


@dataclass
class PriceRow:
    input_per_1k: Decimal
    output_per_1k: Decimal
    reasoning_per_1k: Optional[Decimal]
    cache_discount: Optional[Decimal]


def _to_decimal(x: float | int | Decimal | None) -> Optional[Decimal]:
    if x is None:
        return None
    if isinstance(x, Decimal):
        return x
    return Decimal(str(x))


def get_latest_model_price(db: Session, provider: str, model: str) -> Optional[PriceRow]:
    row = (
        db.query(ModelPricing)
        .filter(ModelPricing.provider == provider, ModelPricing.model == model)
        .order_by(ModelPricing.effective_from.desc())
        .first()
    )
    if not row:
        return None
    return PriceRow(
        input_per_1k=_to_decimal(row.input_per_1k) or Decimal("0"),
        output_per_1k=_to_decimal(row.output_per_1k) or Decimal("0"),
        reasoning_per_1k=_to_decimal(row.reasoning_per_1k) if row.reasoning_per_1k is not None else None,
        cache_discount=_to_decimal(row.cache_discount) if row.cache_discount is not None else None,
    )


def compute_cost_usd(
    price: PriceRow,
    prompt_tokens: int,
    completion_tokens: int,
    reasoning_tokens: int = 0,
    cache_hit: bool = False,
) -> Decimal:
    input_cost = (Decimal(prompt_tokens) / Decimal(1000)) * price.input_per_1k
    output_cost = (Decimal(completion_tokens) / Decimal(1000)) * price.output_per_1k
    reasoning_cost = Decimal(0)
    if price.reasoning_per_1k is not None and reasoning_tokens > 0:
        reasoning_cost = (Decimal(reasoning_tokens) / Decimal(1000)) * price.reasoning_per_1k

    total = input_cost + output_cost + reasoning_cost

    # Apply cache discount to input side if present
    if cache_hit and price.cache_discount is not None:
        try:
            discount = Decimal(1) - price.cache_discount  # e.g., 0.5 discount => pay 50%
            input_cost_discounted = (Decimal(prompt_tokens) / Decimal(1000)) * price.input_per_1k * discount
            total = input_cost_discounted + output_cost + reasoning_cost
        except Exception:
            # If discount malformed, ignore gracefully
            pass

    return total.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)


def seed_default_models(db: Session) -> int:
    """Upsert a small set of commonly used models with example prices.
    Returns number of upserts attempted (not necessarily rows changed).
    NOTE: Adjust prices to your contracts.
    """
    from sqlalchemy import text

    entries = [
        # provider, model, input_per_1k, output_per_1k, reasoning_per_1k, cache_discount
        ("groq", "moonshotai/kimi-k2-instruct", 0.15, 0.60, None, 0.5),
        ("openai", "gpt-oss-20b", 0.05, 0.15, None, None),
        ("openai", "gpt-oss-120b", 0.30, 0.90, None, None),
        ("groq", "llama-3.1-70b-versatile", 0.59, 0.79, None, 0.5),
    ]

    sql = text(
        """
        INSERT INTO model_pricing (provider, model, input_per_1k, output_per_1k, reasoning_per_1k, cache_discount)
        VALUES (:provider, :model, :in1k, :out1k, :reason1k, :discount)
        ON CONFLICT (provider, model, effective_from) DO NOTHING
        """
    )
    count = 0
    for (provider, model, in1k, out1k, reason1k, discount) in entries:
        db.execute(
            sql,
            {
                "provider": provider,
                "model": model,
                "in1k": in1k,
                "out1k": out1k,
                "reason1k": reason1k,
                "discount": discount,
            },
        )
        count += 1
    db.commit()
    return count
