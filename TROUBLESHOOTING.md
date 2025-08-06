# Backend Setup Troubleshooting Guide

## Current Issue: NumPy/PyTorch Compatibility

You're experiencing NumPy initialization issues with PyTorch. Here are three solutions:

## Solution 1: Fix Docker Desktop (Recommended for Deployment)

### Docker Desktop File System Error Fix:
```bash
# 1. Restart Docker Desktop completely
# 2. Clear Docker cache and data
docker system prune -a -f
docker builder prune -a -f

# 3. If still failing, reset Docker Desktop:
# Go to Docker Desktop > Troubleshoot > Reset to factory defaults
```

### Alternative Docker Commands:
```bash
# Try building without cache
docker compose build --no-cache backend

# Or build with different builder
DOCKER_BUILDKIT=0 docker compose build backend
```

## Solution 2: Clean Virtual Environment (Quick Fix)

### Create a new virtual environment with fixed dependencies:
```bash
# Remove existing virtual environment
rm -rf .venv

# Create new virtual environment
python3.12 -m venv .venv
source .venv/bin/activate

# Install dependencies in correct order
pip install --upgrade pip
pip install numpy==1.26.4
pip install torch==2.2.2 --index-url https://download.pytorch.org/whl/cpu
pip install -r backend/requirements-fixed.txt

# Start backend
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Solution 3: Use Poetry with Fixed Dependencies

### Update pyproject.toml to fix NumPy/PyTorch order:
```bash
# Remove existing poetry environment
poetry env remove python3.12

# Create new environment and install dependencies
poetry install

# Add specific NumPy/PyTorch versions
poetry add numpy==1.26.4
poetry add torch==2.2.2 --source https://download.pytorch.org/whl/cpu

# Start backend
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Environment Variables for NumPy/PyTorch Compatibility

Add these to your `.env` file:
```bash
NUMPY_EXPERIMENTAL_ARRAY_FUNCTION=0
OMP_NUM_THREADS=1
PYTORCH_ENABLE_MPS_FALLBACK=1
```

## Quick Test

Test if NumPy/PyTorch work together:
```python
import numpy as np
import torch
print("NumPy version:", np.__version__)
print("PyTorch version:", torch.__version__)
print("Test successful!")
```

## Next Steps

1. **For Development**: Use Solution 2 (Clean Virtual Environment)
2. **For Production**: Fix Docker Desktop and use Docker
3. **For Vercel Deployment**: Use the fixed requirements file

Choose the solution that works best for your current needs!
