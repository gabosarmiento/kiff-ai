# 🔒 Secure VM Orchestrator for Production
FROM python:3.11-slim

WORKDIR /app

# Security: Install only essential packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    fastapi==0.104.1 \
    uvicorn==0.24.0 \
    httpx==0.25.2 \
    boto3==1.34.0 \
    pydantic==2.5.0

# Security: Create non-root user
RUN groupadd -r orchestrator && useradd -r -g orchestrator orchestrator

# Copy enhanced VM service
COPY test-vm-service.py ./vm_orchestrator.py

# Security: Set proper ownership
RUN chown -R orchestrator:orchestrator /app
USER orchestrator

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8002/health || exit 1

# Security: Run with minimal environment
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8002

CMD ["python", "vm_orchestrator.py"]