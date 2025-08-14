from __future__ import annotations
from typing import Optional
from sqlalchemy import text
from ..db_core import engine
from ..models.observability import BaseObs


def ensure_observability_schema() -> str:
    """Ensure observability tables exist in non-Postgres dev (e.g., MySQL local).
    - For MySQL: uses SQLAlchemy metadata.create_all to create tables.
    - For Postgres: no-op (we rely on SQL migrations for tables + materialized views).
    Returns a short status string.
    """
    dialect = engine.dialect.name
    if dialect == "mysql":
        # Create tables if not present
        BaseObs.metadata.create_all(bind=engine, checkfirst=True)
        return "mysql_tables_created"
    elif dialect == "postgresql":
        # Rely on SQL migrations for full schema (incl materialized views)
        return "postgres_migrations_required"
    else:
        # Fallback: try to create tables; skip views
        BaseObs.metadata.create_all(bind=engine, checkfirst=True)
        return f"{dialect}_tables_created"
