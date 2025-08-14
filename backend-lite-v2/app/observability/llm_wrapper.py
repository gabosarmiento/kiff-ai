from __future__ import annotations
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional, Iterable
from decimal import Decimal

from sqlalchemy.orm import Session

from ..db_core import SessionLocal
from .redaction import redact
from .pricing import get_latest_model_price, compute_cost_usd
from ..models.observability import UsageEvent
from ..telemetry.otel import get_tracer
from ..services.budget_guard import evaluate_budget, send_budget_alert

try:
    import tiktoken  # type: ignore
except Exception:
    tiktoken = None  # optional

FALLBACK_TENANT_ID = "4485db48-71b7-47b0-8128-c6dca5be352d"


def _estimate_tokens(messages: Iterable[Dict[str, Any]], model: str) -> int:
    """Rough token estimator. Prefer provider counts when available.
    Uses tiktoken if present; otherwise fallback to a naive char/4 heuristic.
    """
    try:
        text = "\n".join([str(m.get("content") or "") for m in messages])
        if tiktoken is not None:
            enc = tiktoken.get_encoding("cl100k_base")
            return len(enc.encode(text))
        # naive fallback
        return max(1, len(text) // 4)
    except Exception:
        return 0


def _estimate_tokens_text(text: str, model: str) -> int:
    """Estimate tokens for raw text payloads (embeddings).
    Prefer provider counts when available; otherwise char/4 fallback.
    """
    try:
        if tiktoken is not None:
            enc = tiktoken.get_encoding("cl100k_base")
            return len(enc.encode(text))
        return max(1, len(text) // 4)
    except Exception:
        return 0


@dataclass
class SessionContext:
    tenant_id: Optional[str]
    user_id: Optional[str]
    workspace_id: Optional[str]
    session_id: str
    run_id: str
    step_id: str
    parent_step_id: Optional[str] = None
    agent_name: Optional[str] = None
    tool_name: Optional[str] = None


def record_usage_event(
    db: Session,
    *,
    ctx: SessionContext,
    provider: str,
    model: str,
    model_version: Optional[str],
    prompt_tokens: int,
    completion_tokens: int,
    token_breakdown: Optional[Dict[str, int]] = None,
    cache_hit: bool = False,
    retries: int = 0,
    latency_ms: int = 0,
    cost_usd: Decimal = Decimal("0"),
    status: str = "ok",
    error_code: Optional[str] = None,
    source: str = "provider",
    prompt_digest: Optional[str] = None,
    completion_digest: Optional[str] = None,
    redaction_applied: bool = False,
) -> str:
    ev = UsageEvent(
        id=str(uuid.uuid4()),
        tenant_id=ctx.tenant_id or FALLBACK_TENANT_ID,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
        session_id=ctx.session_id,
        run_id=ctx.run_id,
        step_id=ctx.step_id,
        parent_step_id=ctx.parent_step_id,
        agent_name=ctx.agent_name,
        tool_name=ctx.tool_name,
        provider=provider,
        model=model,
        model_version=model_version,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=(prompt_tokens + completion_tokens),
        token_breakdown=token_breakdown,
        cache_hit=cache_hit,
        retries=retries,
        latency_ms=latency_ms,
        cost_usd=cost_usd,
        status=status,
        error_code=error_code,
        source=source,
        redaction_applied=redaction_applied,
        prompt_digest=prompt_digest,
        completion_digest=completion_digest,
    )
    db.add(ev)
    db.commit()
    return ev.id


async def call_llm_and_track(
    *,
    provider: str,
    model: str,
    model_version: Optional[str],
    messages: list[Dict[str, Any]],
    session_ctx: SessionContext,
    tool_name: Optional[str] = None,
    stream: bool = False,
    attempt_n: int = 1,
    cache_hit: bool = False,
    llm_callable=None,  # async function to call: await llm_callable(messages, stream=...)
) -> Any:
    """Generic async wrapper for an LLM call with full accounting.
    - Expects llm_callable that performs the provider call.
    - Emits OTel span with token/cost attributes.
    - Persists one usage_event row per logical call.
    """
    tracer = get_tracer("llm_wrapper")
    start = time.perf_counter()

    # Redact prompt before persistence
    prompt_text = "\n".join([str(m.get("content") or "") for m in messages])
    red_prompt, prompt_digest, red_applied = redact(prompt_text)

    # Defaults until provider reports
    prompt_tokens = _estimate_tokens(messages, model)
    completion_tokens = 0
    reasoning_tokens = 0
    source = "estimated"

    provider_error: Optional[str] = None
    result: Any = None

    with tracer.start_as_current_span("llm.call") as span:
        span.set_attribute("provider", provider)
        span.set_attribute("model", model)
        span.set_attribute("tenant_id", session_ctx.tenant_id or FALLBACK_TENANT_ID)
        span.set_attribute("session_id", session_ctx.session_id)
        span.set_attribute("run_id", session_ctx.run_id)
        span.set_attribute("step_id", session_ctx.step_id)
        if session_ctx.parent_step_id:
            span.set_attribute("parent_step_id", session_ctx.parent_step_id)
        if session_ctx.agent_name:
            span.set_attribute("agent_name", session_ctx.agent_name)
        if tool_name:
            span.set_attribute("tool_name", tool_name)

        try:
            if not llm_callable:
                raise RuntimeError("llm_callable is required")

            if stream:
                # Aggregate streaming
                chunks: list[str] = []
                async for piece in llm_callable(messages=messages, stream=True):
                    # piece should carry token deltas if available; else accumulate text
                    if isinstance(piece, dict):
                        completion_tokens += int(piece.get("delta_tokens", 0))
                        reasoning_tokens += int(piece.get("delta_reasoning_tokens", 0))
                        if txt := piece.get("delta_text"):
                            chunks.append(str(txt))
                    else:
                        chunks.append(str(piece))
                result = "".join(chunks)
            else:
                result = await llm_callable(messages=messages, stream=False)

            # Try to extract provider counts from the result if it has them
            try:
                usage = None
                if isinstance(result, dict):
                    usage = result.get("usage") or result.get("metadata", {}).get("usage")
                if usage:
                    prompt_tokens = int(usage.get("prompt_tokens", prompt_tokens))
                    completion_tokens = int(usage.get("completion_tokens", completion_tokens))
                    if "total_tokens" in usage:
                        total = int(usage.get("total_tokens"))
                        # enforce exactness when provider supplies totals (±0)
                        if (prompt_tokens + completion_tokens) != total:
                            completion_tokens = max(0, total - prompt_tokens)
                    source = "provider"
            except Exception:
                pass

            # Persist
            latency_ms = int((time.perf_counter() - start) * 1000)
            with SessionLocal() as db:
                price = get_latest_model_price(db, provider=provider, model=model)
                cost = compute_cost_usd(price, prompt_tokens, completion_tokens, reasoning_tokens, cache_hit) if price else Decimal("0")

                span.set_attribute("tokens.prompt", prompt_tokens)
                span.set_attribute("tokens.completion", completion_tokens)
                span.set_attribute("tokens.total", prompt_tokens + completion_tokens)
                span.set_attribute("cost.usd", float(cost))
                span.set_attribute("cache.hit", cache_hit)
                span.set_attribute("retries", max(0, attempt_n - 1))
                span.set_attribute("status", "ok")

                record_usage_event(
                    db,
                    ctx=session_ctx,
                    provider=provider,
                    model=model,
                    model_version=model_version,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    token_breakdown={"reasoning": reasoning_tokens} if reasoning_tokens else None,
                    cache_hit=cache_hit,
                    retries=max(0, attempt_n - 1),
                    latency_ms=latency_ms,
                    cost_usd=cost,
                    status="ok",
                    error_code=None,
                    source=source,
                    prompt_digest=prompt_digest,
                    completion_digest=None,
                    redaction_applied=red_applied,
                )
            return result
        except Exception as e:
            provider_error = type(e).__name__
            raise
        finally:
            if provider_error is not None:
                latency_ms = int((time.perf_counter() - start) * 1000)
                with SessionLocal() as db:
                    price = get_latest_model_price(db, provider=provider, model=model)
                    cost = compute_cost_usd(price, prompt_tokens, completion_tokens, reasoning_tokens, cache_hit) if price else Decimal("0")

                    span.set_attribute("tokens.prompt", prompt_tokens)
                    span.set_attribute("tokens.completion", completion_tokens)
                    span.set_attribute("tokens.total", prompt_tokens + completion_tokens)
                    span.set_attribute("cost.usd", float(cost))
                    span.set_attribute("cache.hit", cache_hit)
                    span.set_attribute("retries", max(0, attempt_n - 1))
                    span.set_attribute("status", "error")
                    span.set_attribute("error_code", provider_error)

                    record_usage_event(
                        db,
                        ctx=session_ctx,
                        provider=provider,
                        model=model,
                        model_version=model_version,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        token_breakdown={"reasoning": reasoning_tokens} if reasoning_tokens else None,
                        cache_hit=cache_hit,
                        retries=max(0, attempt_n - 1),
                        latency_ms=latency_ms,
                        cost_usd=cost,
                        status="error",
                        error_code=provider_error,
                        source=source,
                        prompt_digest=prompt_digest,
                        completion_digest=None,
                        redaction_applied=red_applied,
                    )


async def embed_and_track(
    *,
    provider: str,
    model: str,
    model_version: Optional[str],
    text: str,
    session_ctx: SessionContext,
    tool_name: Optional[str] = None,
    attempt_n: int = 1,
    cache_hit: bool = False,
    embed_callable=None,  # async function to call: await embed_callable(text)
) -> Any:
    """Generic async wrapper for an embedding call with full accounting.
    - Expects embed_callable that performs the provider call.
    - Emits OTel span with token/cost attributes.
    - Persists one usage_event row per logical call.
    """
    tracer = get_tracer("embed_wrapper")
    start = time.perf_counter()

    # Redact prompt before persistence
    red_text, text_digest, red_applied = redact(text)

    # Defaults until provider reports
    prompt_tokens = _estimate_tokens_text(text, model)
    source = "estimated"

    provider_error: Optional[str] = None
    result: Any = None

    with tracer.start_as_current_span("embed.call") as span:
        span.set_attribute("provider", provider)
        span.set_attribute("model", model)
        span.set_attribute("tenant_id", session_ctx.tenant_id or FALLBACK_TENANT_ID)
        span.set_attribute("session_id", session_ctx.session_id)
        span.set_attribute("run_id", session_ctx.run_id)
        span.set_attribute("step_id", session_ctx.step_id)
        if session_ctx.parent_step_id:
            span.set_attribute("parent_step_id", session_ctx.parent_step_id)
        if session_ctx.agent_name:
            span.set_attribute("agent_name", session_ctx.agent_name)
        if tool_name:
            span.set_attribute("tool_name", tool_name)

        try:
            if not embed_callable:
                raise RuntimeError("embed_callable is required")

            # Budget pre-check using projected cost
            with SessionLocal() as db:
                price = get_latest_model_price(db, provider=provider, model=model)
                projected_cost = compute_cost_usd(price, prompt_tokens, 0, 0, cache_hit) if price else Decimal("0")
                decision = evaluate_budget(db, session_ctx.tenant_id, projected_cost)
                if decision.notify:
                    try:
                        send_budget_alert(session_ctx.tenant_id or FALLBACK_TENANT_ID, decision)
                    except Exception:
                        pass
                if decision.should_block:
                    span.set_attribute("status", "blocked")
                    span.set_attribute("budget.state", decision.state)
                    raise RuntimeError(f"Embedding call blocked by budget: {decision.state}")

            result = await embed_callable(text=text)

            # Try to extract provider counts from the result if it has them
            try:
                usage = None
                if isinstance(result, dict):
                    usage = result.get("usage") or result.get("metadata", {}).get("usage")
                if usage:
                    prompt_tokens = int(usage.get("prompt_tokens", prompt_tokens))
                    source = "provider"
            except Exception:
                pass

            # Persist
            latency_ms = int((time.perf_counter() - start) * 1000)
            with SessionLocal() as db:
                price = get_latest_model_price(db, provider=provider, model=model)
                cost = compute_cost_usd(price, prompt_tokens, 0, 0, cache_hit) if price else Decimal("0")

                span.set_attribute("tokens.prompt", prompt_tokens)
                span.set_attribute("tokens.completion", 0)
                span.set_attribute("tokens.total", prompt_tokens)
                span.set_attribute("cost.usd", float(cost))
                span.set_attribute("cache.hit", cache_hit)
                span.set_attribute("retries", max(0, attempt_n - 1))
                span.set_attribute("status", "ok")

                record_usage_event(
                    db,
                    ctx=session_ctx,
                    provider=provider,
                    model=model,
                    model_version=model_version,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=0,
                    token_breakdown=None,
                    cache_hit=cache_hit,
                    retries=max(0, attempt_n - 1),
                    latency_ms=latency_ms,
                    cost_usd=cost,
                    status="ok",
                    error_code=None,
                    source=source,
                    prompt_digest=text_digest,
                    completion_digest=None,
                    redaction_applied=red_applied,
                )
            return result
        except Exception as e:
            provider_error = type(e).__name__
            raise
        finally:
            if provider_error is not None:
                latency_ms = int((time.perf_counter() - start) * 1000)
                with SessionLocal() as db:
                    price = get_latest_model_price(db, provider=provider, model=model)
                    cost = compute_cost_usd(price, prompt_tokens, 0, 0, cache_hit) if price else Decimal("0")

                    span.set_attribute("tokens.prompt", prompt_tokens)
                    span.set_attribute("tokens.completion", 0)
                    span.set_attribute("tokens.total", prompt_tokens)
                    span.set_attribute("cost.usd", float(cost))
                    span.set_attribute("cache.hit", cache_hit)
                    span.set_attribute("retries", max(0, attempt_n - 1))
                    span.set_attribute("status", "error")
                    span.set_attribute("error_code", provider_error)

                    record_usage_event(
                        db,
                        ctx=session_ctx,
                        provider=provider,
                        model=model,
                        model_version=model_version,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=0,
                        token_breakdown=None,
                        cache_hit=cache_hit,
                        retries=max(0, attempt_n - 1),
                        latency_ms=latency_ms,
                        cost_usd=cost,
                        status="error",
                        error_code=provider_error,
                        source=source,
                        prompt_digest=text_digest,
                        completion_digest=None,
                        redaction_applied=red_applied,
                    )

