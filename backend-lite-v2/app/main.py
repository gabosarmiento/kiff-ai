from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import os

from .middleware.tenant import TenantMiddleware
from .routes import generate, status, preview, account
from .routes import auth
from .routes import providers, sitemap, extract, kb, kiffs, apis, models, users


def get_allowed_origins() -> list[str]:
    # Comma-separated list in env, fallback to localhost
    raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://localhost:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(title="Kiff Backend Lite v2", version="0.1.0")

# CORS first
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
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
app.include_router(users.router)


@app.get("/")
async def root():
    return {"service": "backend-lite-v2", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
