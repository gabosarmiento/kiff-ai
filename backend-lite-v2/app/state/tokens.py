from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional, Any
import threading
import time
import os

# Pricing config (USD per 1K tokens)
DEFAULT_USD_PER_1K = float(os.getenv("USD_PER_1K_TOKENS", "0.20"))


def now_ts() -> float:
    return time.time()


@dataclass
class TokenEvent:
    id: str
    tenant_id: str
    user_key: str  # e.g., email or user_id
    model: Optional[str]
    action: Optional[str]
    tokens: int
    input_tokens: Optional[int]
    output_tokens: Optional[int]
    usd_charged: float
    created_at: float
    meta: Optional[Dict[str, Any]] = None


@dataclass
class TokenBalance:
    tenant_id: str
    user_key: str
    total_tokens: int
    total_usd: float
    updated_at: float


class _TokenStore:
    def __init__(self) -> None:
        self._balances: Dict[str, TokenBalance] = {}
        self._events: List[TokenEvent] = []
        self._lock = threading.Lock()
        self._usd_per_1k = DEFAULT_USD_PER_1K

    # Key: f"{tenant_id}:{user_key}"
    def _key(self, tenant_id: str, user_key: str) -> str:
        return f"{tenant_id}:{user_key.lower()}"

    def get_pricing(self) -> float:
        with self._lock:
            return self._usd_per_1k

    def set_pricing(self, usd_per_1k: float) -> None:
        with self._lock:
            self._usd_per_1k = float(usd_per_1k)

    def list_balances(self, tenant_id: str, user_key: Optional[str] = None) -> List[TokenBalance]:
        with self._lock:
            if user_key:
                kb = self._balances.get(self._key(tenant_id, user_key))
                return [kb] if kb else []
            return [b for k, b in self._balances.items() if k.startswith(f"{tenant_id}:")]

    def list_events(self, tenant_id: str, user_key: Optional[str] = None, limit: int = 100) -> List[TokenEvent]:
        with self._lock:
            filtered = [e for e in self._events if e.tenant_id == tenant_id and (not user_key or e.user_key.lower() == user_key.lower())]
            return filtered[-limit:]

    def record(self,
               *,
               event_id: str,
               tenant_id: str,
               user_key: str,
               tokens: int,
               model: Optional[str] = None,
               action: Optional[str] = None,
               input_tokens: Optional[int] = None,
               output_tokens: Optional[int] = None,
               meta: Optional[Dict[str, Any]] = None) -> TokenEvent:
        if tokens < 0:
            raise ValueError("tokens must be non-negative")
        ts = now_ts()
        with self._lock:
            usd = round((tokens / 1000.0) * self._usd_per_1k, 6)
            ev = TokenEvent(
                id=event_id,
                tenant_id=tenant_id,
                user_key=user_key.lower(),
                model=model,
                action=action,
                tokens=tokens,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                usd_charged=usd,
                created_at=ts,
                meta=meta or {},
            )
            self._events.append(ev)

            k = self._key(tenant_id, user_key)
            prev = self._balances.get(k)
            if prev:
                new_total_tokens = prev.total_tokens + tokens
                new_total_usd = round(prev.total_usd + usd, 6)
            else:
                new_total_tokens = tokens
                new_total_usd = usd
            bal = TokenBalance(
                tenant_id=tenant_id,
                user_key=user_key.lower(),
                total_tokens=new_total_tokens,
                total_usd=new_total_usd,
                updated_at=ts,
            )
            self._balances[k] = bal
            return ev


TOKENS = _TokenStore()


# Convenience function for other routes
from uuid import uuid4

def record_consumption(tenant_id: str, *, user_key: str, tokens: int, model: Optional[str] = None,
                       action: Optional[str] = None, input_tokens: Optional[int] = None,
                       output_tokens: Optional[int] = None, meta: Optional[Dict[str, Any]] = None) -> TokenEvent:
    return TOKENS.record(
        event_id=str(uuid4()),
        tenant_id=tenant_id,
        user_key=user_key,
        tokens=tokens,
        model=model,
        action=action,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        meta=meta,
    )
