"""
VerdantIQ Data Service
======================
Central orchestrator for the IoT data pipeline. Exposes:

  POST /sensors/connect
      1. Register MQTT topic → Kafka topic routing in the bridge
      2. Create the Kafka topic (via AdminClient)
      3. Start a per-sensor MQTT simulator (background asyncio task)

  DELETE /sensors/{tenant_id}/{sensor_id}/disconnect
      Stop the simulator and unregister the route

  GET  /sensors/active
      List all currently simulating sensors

  WS  /ws/{tenant_id}/{sensor_id}
      Live Kafka consumer → WebSocket stream for the terminal card

  GET  /health
      Liveness probe

Port: 8090 (exposed on host)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import Dict

import httpx
from aiokafka import AIOKafkaConsumer
from confluent_kafka.admin import AdminClient, NewTopic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# mqtt_publisher lives in the iot package (mounted into the container)
sys.path.insert(0, "/app/iot")
from simulator.mqtt_publisher import MQTTSensorPublisher  # noqa: E402

load_dotenv(override=True)

# ── config ────────────────────────────────────────────────────────────────────

KAFKA_BROKERS       = os.getenv("KAFKA_BROKERS",       "kafka1:9092,kafka2:9093")
BRIDGE_URL          = os.getenv("BRIDGE_URL",          "http://mqtt-bridge:8091")
MQTT_HOST           = os.getenv("MQTT_HOST",           "mosquitto")
MQTT_PORT           = int(os.getenv("MQTT_PORT",       "1883"))
SENSOR_SERVICE_URL  = os.getenv("SENSOR_SERVICE_URL",  "http://sensor:8003")
MSG_FLUSH_EVERY     = int(os.getenv("MSG_FLUSH_EVERY", "5"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s data-service %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("data-service")

# ── in-process simulator registry ────────────────────────────────────────────
# sensor_key → MQTTSensorPublisher
_active: Dict[str, MQTTSensorPublisher] = {}

# ── per-sensor Kafka message counter ─────────────────────────────────────────
# Accumulates counts and flushes to sensor service every MSG_FLUSH_EVERY msgs
_msg_counts: Dict[str, int] = {}


async def _flush_message_count(sensor_id: str, count: int) -> None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"{SENSOR_SERVICE_URL}/internal/sensors/{sensor_id}/messages",
                json={"message_increment": count},
            )
    except Exception as exc:
        log.warning("Message count flush failed for sensor %s: %s", sensor_id, exc)


# ── Kafka admin client ────────────────────────────────────────────────────────

def _get_admin() -> AdminClient:
    return AdminClient({"bootstrap.servers": KAFKA_BROKERS})


def _create_kafka_topic(tenant_id: str, sensor_id: str) -> str:
    topic = f"verdantiq.{tenant_id}.{sensor_id}"
    admin = _get_admin()
    fs = admin.create_topics([
        NewTopic(topic, num_partitions=2, replication_factor=2,
                 config={"retention.ms": "604800000", "cleanup.policy": "delete",
                         "compression.type": "lz4"})
    ])
    for t, f in fs.items():
        try:
            f.result()
            log.info("Kafka topic created: %s", t)
        except Exception as exc:
            if "TopicExistsException" in type(exc).__name__ or "already exists" in str(exc).lower():
                log.info("Kafka topic already exists: %s", t)
            else:
                raise
    return topic


# ── bridge integration ────────────────────────────────────────────────────────

async def _register_bridge_route(mqtt_topic: str, kafka_topic: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{BRIDGE_URL}/routes",
            json={"mqtt_topic": mqtt_topic, "kafka_topic": kafka_topic},
        )
        resp.raise_for_status()
        log.info("Bridge route registered: %s → %s", mqtt_topic, kafka_topic)


async def _unregister_bridge_route(mqtt_topic: str) -> None:
    encoded = mqtt_topic.replace("/", "__")
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.delete(f"{BRIDGE_URL}/routes/{encoded}")
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code != 404:
                raise


# ── API models ────────────────────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    sensor_id:   str
    tenant_id:   str
    sensor_type: str
    device_id:   str
    location:    dict = {}

    model_config = {"coerce_numbers_to_str": True}


class ConnectResponse(BaseModel):
    sensor_id:   str
    tenant_id:   str
    mqtt_topic:  str
    kafka_topic: str
    ws_url:      str
    status:      str
    protocol:    str
    data_format: str


# ── FastAPI app ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Data service starting up")
    yield
    log.info("Data service shutting down — stopping %d simulators", len(_active))
    for pub in list(_active.values()):
        pub.stop()


app = FastAPI(title="VerdantIQ Data Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "healthy", "active_sensors": len(_active)}


@app.get("/kafka/topic-info")
def kafka_topic_info(topic: str):
    """Return metadata for a Kafka topic — primarily the replication factor."""
    admin = _get_admin()
    meta  = admin.list_topics(topic=topic, timeout=5)
    t     = meta.topics.get(topic)
    if t is None or t.error is not None:
        raise HTTPException(status_code=404, detail=f"Topic '{topic}' not found")
    # All partitions in a single topic share the same replication factor
    partitions        = list(t.partitions.values())
    replication_factor = len(partitions[0].replicas) if partitions else 0
    return {
        "topic":              topic,
        "partitions":         len(partitions),
        "replication_factor": replication_factor,
    }


@app.get("/sensors/active")
def list_active():
    return {
        "count": len(_active),
        "sensors": [
            {
                "key":         key,
                "sensor_type": pub.sensor_type,
                "topic":       pub.topic,
            }
            for key, pub in _active.items()
        ],
    }


@app.post("/sensors/connect", response_model=ConnectResponse, status_code=201)
async def connect_sensor(body: ConnectRequest):
    key = f"{body.tenant_id}.{body.sensor_id}"

    if key in _active:
        raise HTTPException(status_code=409, detail=f"Sensor {key} already connected")

    mqtt_topic  = f"verdantiq/{body.tenant_id}/{body.sensor_id}/data"
    kafka_topic = f"verdantiq.{body.tenant_id}.{body.sensor_id}"

    # Step 1 — create Kafka topic
    try:
        _create_kafka_topic(body.tenant_id, body.sensor_id)
    except Exception as exc:
        log.error("Kafka topic creation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Kafka topic creation failed: {exc}")

    # Step 2 — register MQTT→Kafka routing in bridge
    try:
        await _register_bridge_route(mqtt_topic, kafka_topic)
    except Exception as exc:
        log.error("Bridge registration failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Bridge registration failed: {exc}")

    # Step 3 — start MQTT simulator (background thread, non-blocking)
    publisher = MQTTSensorPublisher(
        tenant_id=body.tenant_id,
        sensor_id=body.sensor_id,
        sensor_type=body.sensor_type,
        device_id=body.device_id,
        location=body.location,
        interval=2.0,
        mqtt_host=MQTT_HOST,
        mqtt_port=MQTT_PORT,
    )
    publisher.start()
    _active[key] = publisher

    log.info("Sensor connected: %s (type=%s)", key, body.sensor_type)

    return ConnectResponse(
        sensor_id=body.sensor_id,
        tenant_id=body.tenant_id,
        mqtt_topic=mqtt_topic,
        kafka_topic=kafka_topic,
        ws_url=f"ws://localhost:8090/ws/{body.tenant_id}/{body.sensor_id}",
        status="streaming",
        protocol="mqtt",
        data_format="json",
    )


@app.delete("/sensors/{tenant_id}/{sensor_id}/disconnect")
async def disconnect_sensor(tenant_id: str, sensor_id: str):
    key = f"{tenant_id}.{sensor_id}"
    publisher = _active.pop(key, None)
    if not publisher:
        raise HTTPException(status_code=404, detail=f"Sensor {key} not connected")

    publisher.stop()

    mqtt_topic = f"verdantiq/{tenant_id}/{sensor_id}/data"
    await _unregister_bridge_route(mqtt_topic)

    log.info("Sensor disconnected: %s", key)
    return {"status": "disconnected", "sensor_id": sensor_id}


# ── WebSocket — live Kafka consumer → terminal ────────────────────────────────

@app.websocket("/ws/{tenant_id}/{sensor_id}")
async def websocket_stream(websocket: WebSocket, tenant_id: str, sensor_id: str):
    """
    Consume the sensor's Kafka topic and forward every message to the
    connected WebSocket client (browser terminal card).
    Max 20 messages shown (enforced on the frontend); no server-side limit.
    """
    await websocket.accept()
    topic = f"verdantiq.{tenant_id}.{sensor_id}"
    log.info("WebSocket opened for %s", topic)

    consumer = AIOKafkaConsumer(
        topic,
        bootstrap_servers=KAFKA_BROKERS,
        auto_offset_reset="latest",
        group_id=None,   # no consumer group — each browser tab is independent
        enable_auto_commit=False,
        consumer_timeout_ms=1000,
    )
    pending_count = 0
    try:
        await consumer.start()
        async for msg in consumer:
            try:
                # msg.value is raw JSON bytes from the bridge
                text = msg.value.decode("utf-8", errors="replace")
                # Enrich with partition/offset metadata for the terminal
                envelope = json.dumps({
                    "offset":    msg.offset,
                    "partition": msg.partition,
                    "ts":        msg.timestamp,
                    "payload":   json.loads(text),
                })
                await websocket.send_text(envelope)

                # Count messages and flush to sensor service periodically
                pending_count += 1
                if pending_count >= MSG_FLUSH_EVERY:
                    asyncio.create_task(_flush_message_count(sensor_id, pending_count))
                    pending_count = 0

            except WebSocketDisconnect:
                log.info("WebSocket closed for %s", topic)
                break
            except Exception as exc:
                log.warning("WebSocket send error [%s]: %s", topic, exc)
                break
    except Exception as exc:
        log.error("Kafka consumer error [%s]: %s", topic, exc)
    finally:
        # Flush any remaining count on disconnect
        if pending_count > 0:
            asyncio.create_task(_flush_message_count(sensor_id, pending_count))
        try:
            await consumer.stop()
        except Exception:
            pass
        log.info("WebSocket consumer stopped for %s", topic)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8090, reload=False)
