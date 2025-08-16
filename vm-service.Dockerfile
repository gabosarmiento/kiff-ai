FROM python:3.11-slim

WORKDIR /app

# Install VM service dependencies
RUN pip install --no-cache-dir fastapi uvicorn

# Copy VM service
COPY test-vm-service.py .

# Expose port
EXPOSE 8002

# Run VM service
CMD ["python", "test-vm-service.py"]