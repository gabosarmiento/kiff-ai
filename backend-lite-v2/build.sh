#!/bin/bash

# Fast development build (no ML)
build_dev() {
    echo "Building development image (fast, no ML)..."
    docker build -f Dockerfile.dev -t backend-lite-v2:dev .
}

# Production build with ML (slow, but optimized layers)
build_prod() {
    echo "Building production image (with ML)..."
    docker build -t backend-lite-v2:prod .
}

# Quick deploy (assumes ML base layer exists in ECR)
deploy_quick() {
    echo "🚀 Quick deploy - only app code changes will be pushed..."
    
    # Build with layer caching
    docker build -t backend-lite-v2:latest .
    
    # Tag for ECR
    docker tag backend-lite-v2:latest 929018226542.dkr.ecr.eu-west-3.amazonaws.com/kiff/backend-lite-v2:latest
    
    echo "📦 Pushing only changed layers (should be <1 min)..."
    docker push 929018226542.dkr.ecr.eu-west-3.amazonaws.com/kiff/backend-lite-v2:latest
    
    echo "✅ Deploy complete! Update your App Runner service to use :latest"
}

# Full deploy (first time setup)
deploy_full() {
    echo "🏗️ Full deploy with ML dependencies (first time setup)..."
    build_prod
    docker tag backend-lite-v2:prod 929018226542.dkr.ecr.eu-west-3.amazonaws.com/kiff/backend-lite-v2:ml-base
    echo "📦 Pushing full image (will take ~10 min)..."
    docker push 929018226542.dkr.ecr.eu-west-3.amazonaws.com/kiff/backend-lite-v2:ml-base
    echo "✅ Full deploy complete!"
}

case "$1" in
    dev)
        build_dev
        ;;
    prod)
        build_prod
        ;;
    deploy)
        deploy_quick
        ;;
    deploy-full)
        deploy_full
        ;;
    *)
        echo "Usage: $0 {dev|prod|deploy|deploy-full}"
        echo "  dev         - Fast build for development (no ML)"
        echo "  prod        - Full production build (with ML)"  
        echo "  deploy      - Quick deploy (<1 min, only app changes)"
        echo "  deploy-full - Full deploy (~10 min, includes ML deps)"
        ;;
esac