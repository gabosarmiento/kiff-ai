#!/bin/bash

# Docker cleanup script - removes old large images and frees disk space

set -e

echo "🧹 Docker Image Cleanup"
echo "This will remove old large images and free up disk space"
echo ""

# Show current disk usage
echo "📊 Current Docker disk usage:"
docker system df

echo ""
echo "🔍 Current backend images:"
docker images | grep -E "(backend|kiff)" || echo "No backend images found"

echo ""
read -p "❓ Remove old backend images? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing old backend images..."
    
    # Remove old backend images (keep the new optimized one)
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}" | grep -E "(backend|kiff)" | grep -v "backend-lite-optimized:latest" | awk '{print $3}' | xargs -r docker rmi -f || echo "No old images to remove"
    
    echo "✅ Old backend images removed"
fi

echo ""
read -p "❓ Clean up unused Docker resources? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧽 Cleaning up unused Docker resources..."
    
    # Remove unused containers, networks, images, and build cache
    docker system prune -a -f
    
    echo "✅ Docker cleanup complete"
fi

echo ""
echo "📊 New Docker disk usage:"
docker system df

echo ""
echo "💾 Disk space freed up! Your optimized image should be ~400MB vs the old ~7GB images."