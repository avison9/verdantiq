FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

ENV PYTHONPATH=/app

# RUN python -c "import app.main"  

RUN chmod +x /app/start.sh

EXPOSE 8000



# Command to run the FastAPI app with Uvicorn
CMD ["sh", "-c", "python -m pytest tests/test_services.py"]