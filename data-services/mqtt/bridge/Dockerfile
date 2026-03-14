FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY data-services/mqtt/bridge/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY data-services/mqtt/bridge/bridge.py .

EXPOSE 8091

CMD ["python", "bridge.py"]
