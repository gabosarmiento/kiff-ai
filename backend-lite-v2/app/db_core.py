from __future__ import annotations
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Prefer POSTGRES_URL, fallback to DATABASE_URL
DATABASE_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL") or "sqlite:///./kiff_dev.db"

# Engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
