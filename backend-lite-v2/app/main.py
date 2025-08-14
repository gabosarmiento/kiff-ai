from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import os
import json
from dotenv import load_dotenv

# Load environment variables from .env (for local/dev) BEFORE importing routes
import pathlib
env_file = pathlib.Path(__file__).parent.parent / ".env"
load_dotenv(env_file)

from .middleware.tenant import TenantMiddleware
from .routes import generate, status, preview, account
from .routes import auth
from .routes import providers, sitemap, extract, kb, kiffs, apis, models, users, tokens, compose, packs
from .routes import deps
from .routes import launcher_chat
from .routes import launcher_project
from .routes import preview_live
from .routes import admin_url_extractor
from .routes import admin_api_gallery_editor
from .routes import admin_bulk_indexer
from .routes import api_gallery_public
from .routes import email
from .telemetry.otel import init_otel
from .observability.refresh import refresh_materialized_views, periodic_refresh_task
from .observability.pricing_sync import sync_model_pricing_from_models_json
from .observability.bootstrap import ensure_observability_schema


def get_allowed_origins() -> list[str]:
    # Comma-separated list in env, fallback to localhost
    raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://localhost:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]


def get_allowed_origin_regex() -> str | None:
    # Optional regex to allow dynamic hosts (e.g., Vercel previews)
    val = os.getenv("ALLOWED_ORIGIN_REGEX", "").strip()
    return val or None


# (Already loaded above)

app = FastAPI(title="Kiff Backend Lite v2", version="0.1.0")

# CORS first
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=get_allowed_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Tenant header enforcement
app.add_middleware(TenantMiddleware)

# GZip for smaller payloads
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routers (minimal surface matching frontend-lite)
app.include_router(auth.router)
app.include_router(generate.router)
app.include_router(status.router)
app.include_router(preview.router)
app.include_router(account.router)
app.include_router(apis.router)
app.include_router(providers.router)
app.include_router(sitemap.router)
app.include_router(extract.router)
app.include_router(kb.router)
app.include_router(kiffs.router)
app.include_router(models.router)
app.include_router(compose.router)
app.include_router(users.router)
app.include_router(tokens.router)
app.include_router(preview_live.router)
app.include_router(deps.router)
app.include_router(admin_url_extractor.router)
app.include_router(admin_api_gallery_editor.router)
app.include_router(admin_bulk_indexer.router)
app.include_router(api_gallery_public.router)
app.include_router(launcher_chat.router)
app.include_router(packs.router)
app.include_router(launcher_project.router)
app.include_router(email.router)


@app.get("/")
async def root():
    return {"service": "backend-lite-v2", "status": "ok"}


@app.get("/health")
async def health():
    """Health check endpoint with model cache status for deployment monitoring"""
    try:
        from .services.embedder_cache import get_cache_stats
        from .services.vector_storage import VectorStorageService
        
        # Check basic health
        health_data = {
            "status": "healthy",
            "service": "backend-lite-v2"
        }
        
        # Add model cache status
        try:
            cache_stats = get_cache_stats()
            health_data["model_cache"] = cache_stats
        except Exception as e:
            health_data["model_cache"] = {"error": str(e)}
        
        # Add vector storage status  
        try:
            vector_service = VectorStorageService()
            vector_health = vector_service.health_check()
            health_data["vector_storage"] = vector_health
        except Exception as e:
            health_data["vector_storage"] = {"error": str(e)}
            
        # Add deployment info
        health_data["deployment"] = {
            "image_optimized": True,
            "model_cache_external": os.path.exists("/models"),
            "cache_path": os.getenv("TRANSFORMERS_CACHE", "/models/hf")
        }
        
        return health_data
        
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


# --- Startup seeding for models catalog ---
def _seed_models_catalog_if_missing():
    try:
        base_dir = os.path.dirname(__file__)
        data_path = os.path.join(base_dir, "data", "models.json")
        if not os.path.exists(data_path):
            return
        with open(data_path, "r", encoding="utf-8") as f:
            models = json.load(f)
        changed = False

        def has_id(mid: str) -> bool:
            return any(m.get("id") == mid for m in models)

        def any_family(name: str) -> bool:
            return any((m.get("family") or "").strip().lower() == name.strip().lower() for m in models)

        # If Kimi family exists but provider id missing, add moonshot provider id entry
        if any_family("Kimi K2") and not has_id("moonshotai/kimi-k2-instruct"):
            models.append({
                "id": "moonshotai/kimi-k2-instruct",
                "name": "moonshotai/kimi-k2-instruct",
                "provider": "groq",
                "family": "Kimi K2",
                "modality": "text",
                "status": "active",
                "active": True,
                "context_window": 131072
            })
            changed = True

        if changed:
            with open(data_path, "w", encoding="utf-8") as f:
                json.dump(models, f, indent=2, ensure_ascii=False)
    except Exception:
        # Seeding is best-effort; never block startup
        pass


@app.on_event("startup")
async def _on_startup_seed_models():
    # Seed catalog entries when only non-provider ids exist
    _seed_models_catalog_if_missing()
    # Initialize OpenTelemetry (no-op if disabled)
    try:
        init_otel("kiff-backend-lite-v2")
    except Exception:
        pass
    # Ensure observability tables exist in local MySQL (no-op on Postgres where migrations are required)
    try:
        ensure_observability_schema()
    except Exception:
        pass
    # Best-effort: sync model_pricing from models.json if table exists
    try:
        from .db_core import SessionLocal as _SL
        with _SL() as _db:
            sync_model_pricing_from_models_json(_db)
    except Exception:
        pass
    # One-time refresh of materialized views (best-effort)
    try:
        refresh_materialized_views()
    except Exception:
        pass
    # Optionally start periodic refresh task if enabled
    try:
        import os as _os
        enable = (_os.getenv("OBS_REFRESH_ENABLED", "false").lower() in ("1", "true", "yes"))
        interval = int(_os.getenv("OBS_REFRESH_INTERVAL_SEC", "300"))
        if enable:
            import asyncio as _asyncio
            _asyncio.create_task(periodic_refresh_task(interval_seconds=interval))
    except Exception:
        pass
