FROM python:3.11-slim

# Install system dependencies for face_recognition
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories for face data
RUN mkdir -p /app/face_data /app/logs && \
    groupadd -g 1001 app && useradd -u 1001 -g app -m app && \
    chown -R app:app /app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Drop privileges
USER app

# Run the application with Gunicorn for production
ENV WORKERS=2
ENV THREADS=2
CMD ["gunicorn", "-w", "2", "-k", "gthread", "-t", "60", "-b", "0.0.0.0:8000", "main:app"]
