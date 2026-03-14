FROM python:3.11-slim

WORKDIR /app

# Install system deps (paho needs no extras; confluent-kafka needs librdkafka)
RUN apt-get update && \
    apt-get install -y --no-install-recommends librdkafka-dev gcc && \
    rm -rf /var/lib/apt/lists/*

COPY data-services/data_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the data service
COPY data-services/data_service/main.py .

# Mount the iot simulator package (simulator.py) so main.py can import it
COPY data-services/iot /app/iot

EXPOSE 8090

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]
