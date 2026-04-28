# Use official Python runtime
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY server/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code
COPY server/ .

# Expose the port Cloud Run expects
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Start the server listening on Cloud Run's PORT (default 8080)
ENV PORT=8080
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
