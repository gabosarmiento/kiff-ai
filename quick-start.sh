#!/bin/bash

# TradeForge AI Quick Start - No Docker Required
echo "🚀 TradeForge AI Quick Start (No Docker)"

cd backend

# Activate virtual environment
source venv/bin/activate

# Install missing dependencies quickly
echo "📦 Installing missing dependencies..."
pip install lancedb psutil --quiet

# Start the backend
echo "🚀 Starting backend server..."
echo "✅ Backend will be available at: http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
