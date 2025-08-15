from __future__ import annotations
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

# Prefer POSTGRES_URL, fallback to DATABASE_URL
DATABASE_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL") or "sqlite:///./kiff_dev.db"

# Debug: print the database URL being used (remove in production)
print(f"[DEBUG] Using DATABASE_URL: {DATABASE_URL[:20]}..." if DATABASE_URL.startswith("postgresql") else f"[DEBUG] Using DATABASE_URL: {DATABASE_URL}")

# Engine
if DATABASE_URL.startswith("sqlite"):
    # SQLite: configure to reduce locking in concurrent access (ASGI)
    # - check_same_thread=False allows usage across threads (FastAPI workers)
    # - timeout increases wait for file lock
    # - NullPool avoids long-held pooled connections holding write locks
    engine = create_engine(
        DATABASE_URL,
        connect_args={
            "check_same_thread": False,
            "timeout": 30,
        },
        poolclass=NullPool,
        pool_pre_ping=True,
    )
    # Enable WAL mode and relaxed sync to improve write concurrency
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("PRAGMA journal_mode=WAL;")
            conn.exec_driver_sql("PRAGMA synchronous=NORMAL;")
    except Exception:
        # Best-effort; continue if pragmas not supported in environment
        pass
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
