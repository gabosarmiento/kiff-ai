from __future__ import annotations
import asyncio
import os
from sqlalchemy import text
from ..db_core import SessionLocal


def refresh_materialized_views() -> None:
    """Best-effort refresh of observability materialized views.
    Safe to call on startup and periodically.
    """
    stmts = [
        "REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS mv_cost_by_tenant_day;",
        "REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS mv_model_mix_day;",
        "REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS mv_p95_tokens_by_route_day;",
    ]
    try:
        with SessionLocal() as db:
            for s in stmts:
                try:
                    db.execute(text(s))
                except Exception:
                    # Try non-concurrent fallback (e.g., lack of privileges)
                    db.execute(text(s.replace(" CONCURRENTLY", "")))
            db.commit()
    except Exception:
        # Never block app due to refresh issues
        pass


async def periodic_refresh_task(interval_seconds: int = 300):
    while True:
        try:
            refresh_materialized_views()
        except Exception:
            pass
        await asyncio.sleep(interval_seconds)
