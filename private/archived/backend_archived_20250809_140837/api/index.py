"""
Vercel-compatible entry point for FastAPI application
This file serves as the serverless function handler for Vercel deployment
"""

from app.main_vercel import app

# Vercel will use this as the ASGI application
handler = app