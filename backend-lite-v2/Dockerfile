# syntax=docker/dockerfile:1.6

# ================================
# Stage 1: Dependencies Builder
# ================================
FROM python:3.11-slim as builder

# Build environment for compiling Python packages
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies (heavier packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    build-essential \
    cmake \
    git \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy and install Python dependencies (core version without ML)
COPY requirements-core.txt ./requirements.txt
RUN pip install --upgrade pip setuptools wheel

# Install core dependencies (no ML libraries for faster builds)
RUN pip install -r requirements.txt

# ================================  
# Stage 2: Runtime Image
# ================================
FROM python:3.11-slim as runtime

# Runtime environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/opt/venv/bin:$PATH"

# Install minimal runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get autoremove -y \
    && apt-get clean

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv

# Create non-root user and directories
RUN useradd -m -u 1001 appuser && \
    mkdir -p /app /tmp && \
    chown -R appuser:appuser /app /tmp

WORKDIR /app

# Copy application code (done last for better layer caching)
COPY --chown=appuser:appuser app ./app

# Switch to non-root user
USER appuser

EXPOSE 8000

# Health check using built-in urllib (no extra dependencies)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=2)" || exit 1

# Core backend now delegates ML operations to separate ML service  
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
