#!/usr/bin/env python3
"""
Semantic Chunking demo using AGNO example.

Supports LanceDB (default) or PgVector via environment variables.
- KIFF_VECTOR_DB: 'lancedb' (default) or 'pgvector'
- KIFF_LANCEDB_DIR: directory path for LanceDB (default: ./lancedb-data)
- KIFF_PG_URL: postgresql+psycopg URL for PgVector
- KIFF_ST_EMBEDDER_MODEL: sentence-transformers model id (optional)

Requires:
- agno
- chonkie (or agno[semantic])
- For local embeddings (optional): sentence-transformers
- For LanceDB: lancedb
- For PgVector: psycopg, pgvector ext, running Postgres
"""
import os
import sys
from typing import Optional

from agno.agent import Agent
from agno.document.chunking.semantic import SemanticChunking
from agno.knowledge.pdf_url import PDFUrlKnowledgeBase

# Vector DB selection
VECTOR_DB = os.getenv("KIFF_VECTOR_DB", "lancedb").lower()

kb_vector_db = None
if VECTOR_DB == "pgvector":
    try:
        from agno.vectordb.pgvector import PgVector  # type: ignore
    except Exception as e:
        print(f"ERROR: PgVector driver not available: {e}")
        sys.exit(1)
    DB_URL = os.getenv("KIFF_PG_URL", "postgresql+psycopg://ai:ai@localhost:5532/ai")
    kb_vector_db = PgVector(table_name="recipes_semantic_chunking", db_url=DB_URL)
else:
    try:
        from agno.vectordb.lancedb import LanceDb  # type: ignore
    except Exception as e:
        print(f"ERROR: LanceDb driver not available: {e}")
        sys.exit(1)
    LANCEDB_DIR = os.getenv("KIFF_LANCEDB_DIR", os.path.join(os.getcwd(), "lancedb-data"))
    os.makedirs(LANCEDB_DIR, exist_ok=True)
    kb_vector_db = LanceDb(table_name="recipes_semantic_chunking", uri=LANCEDB_DIR)

# Optional: prefer local sentence-transformers embedder if available
embedder = None
ST_MODEL = os.getenv("KIFF_ST_EMBEDDER_MODEL")
if ST_MODEL:
    try:
        from agno.embedder.sentence_transformer import SentenceTransformerEmbedder  # type: ignore
        embedder = SentenceTransformerEmbedder(model_name=ST_MODEL)  # tolerant kw for common versions
        print(f"Using SentenceTransformerEmbedder: {ST_MODEL}")
    except Exception as e:
        print(f"Could not initialize SentenceTransformerEmbedder('{ST_MODEL}'): {e}. Falling back to default embedder.")

# Compose chunking strategy
# Note: Depending on your installed AGNO version, SemanticChunking may accept
# 'similarity_threshold' (older) or 'threshold' (newer). We try both gracefully.
threshold_val: Optional[float] = float(os.getenv("KIFF_SEM_THRESHOLD", "0.55"))
chunking = None
try:
    if embedder is not None:
        chunking = SemanticChunking(embedder=embedder, chunk_size=5000, threshold=threshold_val)  # type: ignore[arg-type]
    else:
        chunking = SemanticChunking(chunk_size=5000, threshold=threshold_val)  # type: ignore[arg-type]
    print("Initialized SemanticChunking with 'threshold' parameter.")
except TypeError:
    if embedder is not None:
        chunking = SemanticChunking(embedder=embedder, chunk_size=5000, similarity_threshold=threshold_val)  # type: ignore[arg-type]
    else:
        chunking = SemanticChunking(chunk_size=5000, similarity_threshold=threshold_val)  # type: ignore[arg-type]
    print("Initialized SemanticChunking with 'similarity_threshold' parameter.")

# Build knowledge base
knowledge_base = PDFUrlKnowledgeBase(
    urls=["https://agno-public.s3.amazonaws.com/recipes/ThaiRecipes.pdf"],
    vector_db=kb_vector_db,
    chunking_strategy=chunking,
)

print("Loading knowledge base (this may take a moment)...")
knowledge_base.load(recreate=False)
print("Knowledge base loaded.")

# Create agent
agent = Agent(
    knowledge_base=knowledge_base,
    search_knowledge=True,
)

print("\nAsking agent: How to make Thai curry?\n")
agent.print_response("How to make Thai curry?", markdown=True)
