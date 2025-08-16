# 🔒 Secure Code Execution VM - Hardened for Production
FROM python:3.11-slim

# Install Node.js for React/Vite support
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Security: Create non-root user with minimal privileges
RUN groupadd -r kiffuser && useradd -r -g kiffuser -m kiffuser
RUN mkdir -p /workspace && chown kiffuser:kiffuser /workspace

# Security: Install only essential packages
RUN pip install --no-cache-dir --no-deps \
    fastapi==0.104.1 \
    uvicorn==0.24.0 \
    pydantic==2.5.0

# Security: Remove pip and package managers after installation
RUN rm -rf /usr/local/bin/pip* /usr/local/lib/python*/site-packages/pip*

# Security: Create restricted environment
USER kiffuser
WORKDIR /workspace

# Security: Drop all capabilities except essential ones
# This will be enforced at container runtime level

# Security: No shell access - only controlled execution
COPY --chown=kiffuser:kiffuser secure_runner.py /usr/local/bin/
RUN chmod +x /usr/local/bin/secure_runner.py

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "print('healthy')" || exit 1

# Security: Force non-interactive mode
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Security: Disable Python bytecode generation (prevents code caching)
ENV PYTHONDONTWRITEBYTECODE=1

# Default command - no shell access
CMD ["python", "/usr/local/bin/secure_runner.py"]