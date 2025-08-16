# Optimized Python 3.11-slim container for secure code execution
FROM python:3.11-slim

# Set environment variables for optimization
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

# Install minimal system dependencies with optimizations
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Essential tools
    curl \
    wget \
    git \
    # Build tools (minimal)
    gcc \
    g++ \
    make \
    # Node.js for JavaScript execution
    nodejs \
    npm \
    # Additional utilities
    jq \
    unzip \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && apt-get autoremove -y

# Create non-root user for security
RUN useradd -m -u 1001 -s /bin/bash vmuser && \
    mkdir -p /app /workspace /tmp/vmuser && \
    chown -R vmuser:vmuser /app /workspace /tmp/vmuser

# Copy requirements and install Python packages
COPY requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt && \
    rm /tmp/requirements.txt

# Install common Python packages for data science and ML
RUN pip install --no-cache-dir \
    requests \
    numpy \
    pandas \
    matplotlib \
    scikit-learn \
    scipy \
    pillow \
    beautifulsoup4 \
    lxml \
    pyyaml \
    jsonschema \
    python-dotenv

# Set up workspace
WORKDIR /workspace
RUN chown vmuser:vmuser /workspace

# Copy execution scripts
COPY --chown=vmuser:vmuser scripts/ /app/scripts/
RUN chmod +x /app/scripts/*.sh

# Switch to non-root user
USER vmuser

# Create user directories
RUN mkdir -p /home/vmuser/.local/lib/python3.11/site-packages

# Health check script
COPY --chown=vmuser:vmuser healthcheck.py /app/
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python /app/healthcheck.py

# Default working directory for code execution
WORKDIR /workspace

# Keep container running
CMD ["python", "-c", "import time; print('VM ready for code execution'); [time.sleep(60) for _ in iter(int, 1)]"]