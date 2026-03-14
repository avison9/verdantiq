FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends librdkafka-dev gcc curl && \
    rm -rf /var/lib/apt/lists/*

COPY data-services/data_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY data-services/data_service/main.py .

# IoT simulator package — imported by main.py
COPY data-services/iot /app/iot

EXPOSE 8090

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]
