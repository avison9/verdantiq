# Use official Python 3.10 slim image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . /app

# Expose port 8000 for FastAPI
EXPOSE 8000

# Command to run the FastAPI app with Uvicorn
CMD ["sh", "-c", "python -m pytest tests/test_services.py"]