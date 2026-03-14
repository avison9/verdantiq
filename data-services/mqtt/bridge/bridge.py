"""
VerdantIQ MQTT-Kafka Bridge
============================
Lightweight async bridge that:
  1. Maintains a live paho-mqtt connection to Mosquitto.
  2. Exposes a FastAPI REST API so the data-service can register new
     topic-routing rules at runtime (zero restart required).
  3. Forwards every inbound MQTT message to its mapped Kafka topic in ≤1 ms
     (fire-and-forget, Kafka producer poll on delivery only).

Topic convention
----------------
  MQTT  :  verdantiq/{tenant_id}/{sensor_id}/data
  Kafka :  verdantiq.{tenant_id}.{sensor_id}

Routes are stored in memory and persisted to /tmp/routes.json so they
survive a soft restart of this process.

Endpoints
---------
  POST /routes         register a new routing rule
  DELETE /routes/{id}  remove a rule
  GET  /routes         list all active rules
  GET  /health         liveness probe
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Dict

import paho.mqtt.client as mqtt
import uvicorn
from confluent_kafka import KafkaException, Producer
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv(override=True)

# ── config ────────────────────────────────────────────────────────────────────

MQTT_HOST      = os.getenv("MQTT_HOST",      "mosquitto")
MQTT_PORT      = int(os.getenv("MQTT_PORT",  "1883"))
KAFKA_BROKERS  = os.getenv("KAFKA_BROKERS",  "kafka1:9092,kafka2:9093,kafka3:9094,kafka4:9095")
BRIDGE_PORT    = int(os.getenv("BRIDGE_PORT", "8091"))
ROUTES_FILE    = Path(os.getenv("ROUTES_FILE", "/tmp/routes.json"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s bridge %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("bridge")

# ── shared state ──────────────────────────────────────────────────────────────

# mqtt_topic → kafka_topic
_routes: Dict[str, str] = {}
_routes_lock = threading.Lock()

# ── Kafka producer (thread-safe) ─────────────────────────────────────────────

_producer = Producer({
    "bootstrap.servers":        KAFKA_BROKERS,
    "enable.idempotence":       True,
    "message.send.max.retries": 5,
    "retry.backoff.ms":         200,
    "linger.ms":                5,   # micro-batch for throughput
    "batch.size":               16384,
    "client.id":                "mqtt-kafka-bridge",
})


def _delivery_report(err, msg):
    if err:
        log.error("Kafka delivery failed: %s", err)


# ── MQTT client ───────────────────────────────────────────────────────────────

def _on_connect(client, userdata, flags, rc):
    if rc == 0:
        log.info("Connected to Mosquitto @ %s:%s", MQTT_HOST, MQTT_PORT)
        # Re-subscribe to all persisted routes on reconnect
        with _routes_lock:
            for topic in _routes:
                client.subscribe(topic, qos=1)
                log.info("Re-subscribed: %s", topic)
    else:
        log.error("MQTT connect failed rc=%s", rc)


def _on_disconnect(client, userdata, rc):
    if rc != 0:
        log.warning("MQTT disconnected unexpectedly (rc=%s) — paho will retry", rc)


def _on_message(client, userdata, msg: mqtt.MQTTMessage):
    mqtt_topic = msg.topic
    with _routes_lock:
        kafka_topic = _routes.get(mqtt_topic)

    if not kafka_topic:
        return  # no route registered for this topic

    try:
        _producer.produce(
            topic=kafka_topic,
            value=msg.payload,
            key=mqtt_topic.encode(),
            on_delivery=_delivery_report,
        )
        _producer.poll(0)   # non-blocking flush of delivery events
    except KafkaException as exc:
        log.error("Kafka produce error [%s]: %s", kafka_topic, exc)


_mqtt_client = mqtt.Client(client_id="verdantiq-bridge", clean_session=False)
_mqtt_client.on_connect    = _on_connect
_mqtt_client.on_disconnect = _on_disconnect
_mqtt_client.on_message    = _on_message


# ── route persistence ─────────────────────────────────────────────────────────

def _load_routes() -> None:
    if ROUTES_FILE.exists():
        try:
            data = json.loads(ROUTES_FILE.read_text())
            with _routes_lock:
                _routes.update(data)
            log.info("Loaded %d persisted routes", len(data))
        except Exception as exc:
            log.warning("Could not load routes file: %s", exc)


def _save_routes() -> None:
    try:
        with _routes_lock:
            snapshot = dict(_routes)
        ROUTES_FILE.write_text(json.dumps(snapshot, indent=2))
    except Exception as exc:
        log.warning("Could not save routes: %s", exc)


# ── FastAPI ───────────────────────────────────────────────────────────────────

app = FastAPI(title="VerdantIQ MQTT-Kafka Bridge", version="1.0.0")


class RouteRequest(BaseModel):
    mqtt_topic:  str   # e.g. "verdantiq/tenant_abc/soil_001/data"
    kafka_topic: str   # e.g. "verdantiq.tenant_abc.soil_001"


class RouteResponse(BaseModel):
    mqtt_topic:  str
    kafka_topic: str
    status:      str


@app.post("/routes", response_model=RouteResponse, status_code=201)
def register_route(body: RouteRequest) -> RouteResponse:
    with _routes_lock:
        _routes[body.mqtt_topic] = body.kafka_topic
    _mqtt_client.subscribe(body.mqtt_topic, qos=1)
    _save_routes()
    log.info("Route added: %s → %s", body.mqtt_topic, body.kafka_topic)
    return RouteResponse(
        mqtt_topic=body.mqtt_topic,
        kafka_topic=body.kafka_topic,
        status="active",
    )


@app.delete("/routes/{encoded_topic}")
def remove_route(encoded_topic: str):
    mqtt_topic = encoded_topic.replace("__", "/")
    with _routes_lock:
        if mqtt_topic not in _routes:
            raise HTTPException(status_code=404, detail="Route not found")
        del _routes[mqtt_topic]
    _mqtt_client.unsubscribe(mqtt_topic)
    _save_routes()
    log.info("Route removed: %s", mqtt_topic)
    return {"status": "removed", "mqtt_topic": mqtt_topic}


@app.get("/routes")
def list_routes() -> dict:
    with _routes_lock:
        snapshot = dict(_routes)
    return {"count": len(snapshot), "routes": snapshot}


@app.get("/health")
def health() -> dict:
    with _routes_lock:
        route_count = len(_routes)
    return {
        "status":      "healthy",
        "route_count": route_count,
        "mqtt_host":   MQTT_HOST,
        "kafka":       KAFKA_BROKERS,
    }


# ── startup ───────────────────────────────────────────────────────────────────

def _connect_mqtt_with_retry(max_attempts: int = 20, delay: float = 3.0) -> None:
    for attempt in range(1, max_attempts + 1):
        try:
            _mqtt_client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
            _mqtt_client.loop_start()
            log.info("MQTT connection attempt %d succeeded", attempt)
            return
        except Exception as exc:
            log.warning("MQTT connect attempt %d/%d failed: %s", attempt, max_attempts, exc)
            time.sleep(delay)
    raise RuntimeError(f"Could not connect to MQTT broker after {max_attempts} attempts")


def main() -> None:
    _load_routes()
    _connect_mqtt_with_retry()

    # Subscribe to any routes that were loaded from disk
    with _routes_lock:
        for topic in _routes:
            _mqtt_client.subscribe(topic, qos=1)

    uvicorn.run(app, host="0.0.0.0", port=BRIDGE_PORT, log_level="info")


if __name__ == "__main__":
    main()
