# 🏗️ Build stage
FROM python:3.12-slim as builder

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV POETRY_NO_INTERACTION=1
ENV POETRY_VENV_IN_PROJECT=1
ENV POETRY_CACHE_DIR=/tmp/poetry_cache
ENV PATH="/app/venv/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install poetry==1.8.3

WORKDIR /app

# Copy project files
COPY pyproject.toml poetry.lock* ./

# Create virtual environment
RUN python -m venv /app/venv

# ⛳ Install everything INTO that venv
RUN . /app/venv/bin/activate && \
    pip install --upgrade pip && \
    pip install --no-cache-dir numpy==1.26.4 && \
    pip install --no-cache-dir torch==2.2.2 --index-url https://download.pytorch.org/whl/cpu && \
    poetry config virtualenvs.create false && \
    poetry lock --no-update && \
    poetry install --only=main --no-root && \
    pip install --no-cache-dir \
        uvicorn[standard]==0.24.0 \
        fastapi==0.104.1 \
        sqlalchemy==2.0.23 \
        asyncpg==0.30.0 \
        cryptography==45.0.5 \
        lancedb==0.15.0 \
        psutil==6.1.0 && \
    pip uninstall -y yfinance playwright sentence-transformers || true && \
    rm -rf $POETRY_CACHE_DIR /tmp/* /root/.cache /root/.playwright

# 🐳 Final image
FROM python:3.12-slim as production

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PATH="/opt/venv/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

# Copy venv to /opt to avoid volume mount conflicts
COPY --from=builder /app/venv /opt/venv
COPY backend/ .

RUN mkdir -p /app/lancedb_data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["/opt/venv/bin/python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
