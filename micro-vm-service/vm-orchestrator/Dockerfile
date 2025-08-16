# Use Python 3.11-slim for minimal size and security
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN useradd -m -u 1001 vmuser && \
    mkdir -p /app /tmp && \
    chown -R vmuser:vmuser /app /tmp

# Copy requirements first for better caching
COPY requirements.txt /app/
WORKDIR /app

# Install Python dependencies with optimizations
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=vmuser:vmuser . /app/

# Switch to non-root user
USER vmuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

# Expose port
EXPOSE 8002

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]