#!/bin/bash

# Build script for optimized Docker image
# Expected size: ~400MB (vs ~7GB unoptimized)

set -e

echo "🚀 Building optimized Docker image..."
echo "Expected optimizations:"
echo "  - CPU-only PyTorch (saves ~3-4GB)"
echo "  - External model cache (saves ~2-3GB)"
echo "  - Minimal base image"
echo "  - Target size: ~400MB"
echo ""

# Enable Docker BuildKit for better caching
export DOCKER_BUILDKIT=1

# Build the image
echo "📦 Building image..."
docker build --platform linux/amd64 -t backend-lite-optimized:latest .

# Check image size
echo ""
echo "📊 Image size analysis:"
docker images backend-lite-optimized:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Get detailed size breakdown
echo ""
echo "🔍 Layer size breakdown:"
docker history backend-lite-optimized:latest --format "table {{.CreatedBy}}\t{{.Size}}" | head -10

echo ""
echo "✅ Build complete!"
echo ""
echo "💡 To run with model cache:"
echo "  mkdir -p ./models-cache"
echo "  docker run -v \$(pwd)/models-cache:/models -p 8000:8000 backend-lite-optimized:latest"
echo ""
echo "🏥 Health check:"
echo "  curl http://localhost:8000/health"