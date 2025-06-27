# Use official Python 3.10 slim image
FROM python:3.10-slim

WORKDIR /app

# Copy requirements first to leverage Docker caching
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

RUN chmod +x /app/start.sh

EXPOSE 8000

# Command to run the FastAPI app with Uvicorn
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
CMD ["/app/start.sh"]