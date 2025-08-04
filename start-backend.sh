#!/bin/bash

# TradeForge AI Backend Startup Script
# Solves all dependency issues with Docker

echo "🚀 Starting TradeForge AI Backend with Docker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Copy environment variables if they exist
if [ -f ".env" ]; then
    echo "✅ Found .env file"
else
    echo "⚠️  No .env file found. Creating minimal .env..."
    cat > .env << EOF
# TradeForge AI Environment Variables
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-key
ENCRYPTION_KEY=dev-encryption-key-32-chars-long
GROQ_API_KEY=your_groq_api_key_here
ENVIRONMENT=development
DEBUG=true
RESEND_API_KEY=your_resend_api_key_here
DEFAULT_FROM_EMAIL=noreply@tradeforge.ai
FRONTEND_URL=http://localhost:3000
EOF
    echo "📝 Created .env file. Please add your API keys."
fi

# Build and start services
echo "🔨 Building backend Docker image..."
docker-compose -f docker-compose.dev.yml build backend

echo "🚀 Starting all services..."
docker-compose -f docker-compose.dev.yml up -d postgres redis

echo "⏳ Waiting for database to be ready..."
sleep 10

echo "🚀 Starting backend..."
docker-compose -f docker-compose.dev.yml up backend

echo "✅ Backend should be running at http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
