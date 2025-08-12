from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import os
import json
from dotenv import load_dotenv

# Load environment variables from .env (for local/dev) BEFORE importing routes
load_dotenv()

from .middleware.tenant import TenantMiddleware
from .routes import generate, status, preview, account
from .routes import auth
from .routes import providers, sitemap, extract, kb, kiffs, apis, models, users, tokens, compose
from .routes import deps
from .routes import preview_live
from .routes import admin_url_extractor
from .routes import admin_api_gallery_editor
from .routes import admin_bulk_indexer
from .routes import api_gallery_public


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


@app.get("/")
async def root():
    return {"service": "backend-lite-v2", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


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
