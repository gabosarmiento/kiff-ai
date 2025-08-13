from __future__ import annotations
import datetime as dt
from typing import Optional
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer, Boolean, Float, JSON
from sqlalchemy.orm import declarative_base, relationship
from .db_core import engine

Base = declarative_base()

class Kiff(Base):
    __tablename__ = "kiffs"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    model_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)

    messages = relationship("ConversationMessage", back_populates="kiff", cascade="all, delete-orphan")
    chat_sessions = relationship("KiffChatSession", back_populates="kiff", cascade="all, delete-orphan")

class ConversationMessage(Base):
    __tablename__ = "kiff_messages"
    id = Column(String, primary_key=True)
    kiff_id = Column(String, ForeignKey("kiffs.id", ondelete="CASCADE"), index=True, nullable=False)
    tenant_id = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=True)
    session_id = Column(String, ForeignKey("kiff_chat_sessions.id", ondelete="CASCADE"), index=True, nullable=True)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    thought = Column(Text, nullable=True)
    action_json = Column(Text, nullable=True)
    validator = Column(String, nullable=True)
    step = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)

    kiff = relationship("Kiff", back_populates="messages")
    chat_session = relationship("KiffChatSession", back_populates="messages")


class KiffChatSession(Base):
    __tablename__ = "kiff_chat_sessions"
    id = Column(String, primary_key=True)
    kiff_id = Column(String, ForeignKey("kiffs.id", ondelete="CASCADE"), index=True, nullable=False)
    tenant_id = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=True)
    agent_state = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow, nullable=False)

    kiff = relationship("Kiff", back_populates="chat_sessions")
    messages = relationship("ConversationMessage", back_populates="chat_session", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"
    email = Column(String, primary_key=True)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")
    tenant_id = Column(String, index=True, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)


class KnowledgePack(Base):
    __tablename__ = "knowledge_packs"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    vector_store = Column(String, nullable=False, default="lancedb")
    table_name = Column(String, nullable=True)
    tenant_id = Column(String, index=True, nullable=False)
    retrieval_mode = Column(String, nullable=True)
    embedder = Column(String, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)


class Model(Base):
    __tablename__ = "models"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    object = Column(String, nullable=True, default="model")
    created = Column(Integer, nullable=True)
    owned_by = Column(String, nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    public_apps = Column(JSON, nullable=True)
    modality = Column(String, nullable=True)
    family = Column(String, nullable=True)
    context_window = Column(Integer, nullable=True)
    max_output_tokens = Column(Integer, nullable=True)
    speed_tps = Column(Float, nullable=True)
    price_per_million_input = Column(Float, nullable=True)
    price_per_million_output = Column(Float, nullable=True)
    price_per_1k_input = Column(Float, nullable=True)
    price_per_1k_output = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="active")
    tags = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    model_card_url = Column(String, nullable=True)
    tenant_id = Column(String, index=True, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)


class API(Base):
    __tablename__ = "apis"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    website = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    categories = Column(JSON, nullable=True)
    docs_url = Column(String, nullable=True)
    sitemap_url = Column(String, nullable=True)
    url_filters = Column(JSON, nullable=True)
    status = Column(String, nullable=False, default="active")
    apis_count = Column(Integer, nullable=True)
    tenant_id = Column(String, index=True, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow, nullable=False)


# Create tables on import
Base.metadata.create_all(bind=engine)
