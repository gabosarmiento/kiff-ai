# syntax=docker/dockerfile:1.6

FROM python:3.11-slim

# Environment variables for small image + external model cache
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TRANSFORMERS_CACHE=/models/hf \
    HF_HOME=/models/hf \
    SENTENCE_TRANSFORMERS_HOME=/models/sentence_transformers

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    wget \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Create non-root user and directories
RUN useradd -m appuser && \
    mkdir -p /app /models && \
    chown -R appuser:appuser /app /models

WORKDIR /app

# Install Python dependencies with CPU-only PyTorch
COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 8000

# At runtime, mount a persistent volume at /models to avoid redownloading model weights
# Example: docker run -v /mnt/ebs/models:/models -p 8000:8000 yourimage:latest
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
