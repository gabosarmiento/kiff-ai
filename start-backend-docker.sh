#!/bin/bash

# Script to start the backend using Docker instead of virtual environment
# This resolves NumPy/PyTorch compatibility issues

echo "🐳 Starting backend with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first:"
    echo "   Visit: https://www.docker.com/products/docker-desktop/"
    echo "   Or use Homebrew: brew install --cask docker"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Determine which Docker Compose command to use
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Docker Compose is not available. Please install Docker Desktop."
    exit 1
fi

echo "Using: $DOCKER_COMPOSE"

# Stop any existing containers
echo "Stopping existing containers..."
$DOCKER_COMPOSE down

# Build and start services
echo "Building and starting services..."
$DOCKER_COMPOSE up --build -d postgres redis

# Wait for database to be ready
echo "Waiting for database to be ready..."
until $DOCKER_COMPOSE exec postgres pg_isready -U postgres; do
  echo "Waiting for postgres..."
  sleep 2
done

# Start backend
echo "Starting backend..."
$DOCKER_COMPOSE up --build backend

echo "✅ Backend is running on http://localhost:8000"
echo "📊 Database is running on localhost:5432"
echo "🔴 Redis is running on localhost:6379"
echo ""
echo "To stop all services: $DOCKER_COMPOSE down"
echo "To view logs: $DOCKER_COMPOSE logs -f backend"
