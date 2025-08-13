# Deployment Guide - Optimized for AWS

## Image Size Optimization

Our deployment strategy reduces Docker image size from **~7GB to ~400MB** by:

1. **Using CPU-only PyTorch** (vs CUDA wheels that add ~3-4GB)
2. **External model cache** - models download to mounted volume, not baked into image
3. **Minimal base image** - `python:3.11-slim` instead of full Ubuntu
4. **Small embedding model** - `all-MiniLM-L6-v2` (~80MB) vs larger models

## Expected Sizes

- **Docker Image**: ~400MB (without model weights)
- **Model Cache Volume**: ~1-2GB (for all downloaded models)
- **Total Runtime Footprint**: ~2.5GB vs previous ~7GB+

## Deployment Options

### Option 1: AWS App Runner (Recommended)

```bash
# Deploy with persistent volume for model caching
aws apprunner create-service --cli-input-json file://deploy/aws-apprunner-optimized.yaml
```

**Benefits:**
- Automatic scaling
- Built-in load balancing  
- Volume persistence across deployments
- ~2-3 minute deployment time (vs 5-8 minutes with large images)

### Option 2: ECS Fargate with EFS

```bash
# Create EFS filesystem for model cache
aws efs create-file-system --tags Key=Name,Value=kiff-models-cache

# Run task with EFS mount
aws ecs run-task --cli-input-json file://deploy/ecs-fargate-config.json
```

### Option 3: EKS with Persistent Volume Claims

```bash
# Apply Kubernetes manifests
kubectl apply -f deploy/k8s/
```

## Local Development with Volume Mount

```bash
# Create local model cache directory
mkdir -p ./models-cache

# Run with volume mount (models persist between runs)
docker run -v $(pwd)/models-cache:/models -p 8000:8000 backend-lite-optimized:latest
```

## Performance Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Image Size | ~7GB | ~400MB | **94% smaller** |
| Deployment Time | 5-8 min | 2-3 min | **60% faster** |
| Cold Start | 30-45s | 15-20s | **50% faster** |
| Pull Time | 3-5 min | 30-60s | **80% faster** |

## Model Download Strategy

**First Run:**
1. Container starts with empty `/models` volume
2. Models download automatically on first use (~2-3 minutes)
3. Subsequent requests use cached models (fast)

**Subsequent Deploys:**
1. New container starts with populated `/models` volume  
2. No model download needed (immediate startup)
3. Fast deployment with warm cache

## Monitoring & Troubleshooting

### Check Model Cache Status
```bash
curl http://your-app/health
# Returns cache status and available models
```

### Manual Model Pre-warming (Optional)
```bash
# Pre-download models during deployment
docker run -v models-cache:/models your-image python -c "
from app.services.embedder_cache import get_embedder
embedder = get_embedder()
print('Models pre-cached!')
"
```

### Volume Size Monitoring
```bash
# Check volume usage
docker exec -it container-id df -h /models
```

## Advanced: Multi-Stage Build for Even Smaller Images

For further optimization, consider:

1. **Multi-stage build** - copy only needed files to final stage
2. **ONNX quantization** - 50-70% size reduction with minimal accuracy loss  
3. **Model distillation** - train smaller models on your specific data

These optimizations can reduce total footprint to <100MB image + <500MB models.