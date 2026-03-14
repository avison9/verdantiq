FROM python:3.11-slim

WORKDIR /app

COPY data-services/mqtt/bridge/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY data-services/mqtt/bridge/bridge.py .

EXPOSE 8091

CMD ["python", "bridge.py"]
