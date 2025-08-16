# ML Agent VM - Lightweight container that connects to existing ML infrastructure
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    git \
    # Minimal build tools for some Python packages
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && apt-get autoremove -y

# Create non-root user
RUN useradd -m -u 1001 -s /bin/bash agentuser && \
    mkdir -p /app /workspace /tmp/agentuser && \
    chown -R agentuser:agentuser /app /workspace /tmp/agentuser

# Copy requirements and install dependencies
COPY requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt && \
    rm /tmp/requirements.txt

# Copy agent framework and utilities
COPY --chown=agentuser:agentuser agent_framework/ /app/agent_framework/
COPY --chown=agentuser:agentuser scripts/ /app/scripts/
RUN chmod +x /app/scripts/*.sh

# Set up ML service connection configuration
COPY --chown=agentuser:agentuser ml_client.py /app/
COPY --chown=agentuser:agentuser vector_client.py /app/

# Switch to non-root user
USER agentuser

# Set working directory
WORKDIR /workspace

# Health check
COPY --chown=agentuser:agentuser healthcheck.py /app/
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python /app/healthcheck.py

# Default command - run agent framework
CMD ["python", "/app/agent_framework/main.py"]