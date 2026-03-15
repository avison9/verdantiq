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

  GET  /sensors/{tenant_id}/{sensor_id}/hardware
      Read the latest hardware_info from the sensor's Kafka topic.
      Used by the frontend to update battery/memory every hour without
      requiring the terminal WebSocket to be open.

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

import time

import httpx
from aiokafka import AIOKafkaConsumer
from confluent_kafka import Consumer, TopicPartition
from confluent_kafka.admin import AdminClient, NewTopic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
    status:      str       # "streaming" | "failed"
    protocol:    str
    data_format: str
    steps:       dict      # {step_name: {"status": "success"|"failed"|"skipped", "message": str}}


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


@app.post("/sensors/connect", status_code=201)
async def connect_sensor(body: ConnectRequest):
    key         = f"{body.tenant_id}.{body.sensor_id}"
    mqtt_topic  = f"verdantiq/{body.tenant_id}/{body.sensor_id}/data"
    kafka_topic = f"verdantiq.{body.tenant_id}.{body.sensor_id}"

    if key in _active:
        raise HTTPException(status_code=409, detail=f"Sensor {key} already connected")

    steps: dict = {}

    def _base_payload(overall_status: str) -> dict:
        return {
            "sensor_id":   body.sensor_id,
            "tenant_id":   body.tenant_id,
            "mqtt_topic":  mqtt_topic,
            "kafka_topic": kafka_topic,
            "ws_url":      f"ws://localhost:8090/ws/{body.tenant_id}/{body.sensor_id}",
            "status":      overall_status,
            "protocol":    "mqtt",
            "data_format": "json",
            "steps":       steps,
        }

    # ── Step 1: Create Kafka topic ─────────────────────────────────────────
    try:
        _create_kafka_topic(body.tenant_id, body.sensor_id)
        steps["kafka_topic_created"] = {
            "status":  "success",
            "message": f"Kafka topic {kafka_topic} ready (2 partitions, RF=2)",
        }
    except Exception as exc:
        log.error("Kafka topic creation failed: %s", exc)
        steps["kafka_topic_created"] = {"status": "failed", "message": str(exc)}
        steps["mqtt_topic_created"]  = {"status": "skipped", "message": "Kafka step failed"}
        steps["simulator_started"]   = {"status": "skipped", "message": "Kafka step failed"}
        return JSONResponse(status_code=502, content=_base_payload("failed"))

    # ── Step 2: Register MQTT→Kafka route in bridge ────────────────────────
    try:
        await _register_bridge_route(mqtt_topic, kafka_topic)
        steps["mqtt_topic_created"] = {
            "status":  "success",
            "message": f"MQTT topic {mqtt_topic} routed to Kafka",
        }
    except Exception as exc:
        log.error("Bridge registration failed: %s", exc)
        steps["mqtt_topic_created"] = {"status": "failed", "message": str(exc)}
        steps["simulator_started"]  = {"status": "skipped", "message": "Bridge step failed"}
        return JSONResponse(status_code=502, content=_base_payload("failed"))

    # ── Step 3: Start MQTT simulator ───────────────────────────────────────
    try:
        publisher = MQTTSensorPublisher(
            tenant_id=body.tenant_id,
            sensor_id=body.sensor_id,
            sensor_type=body.sensor_type,
            device_id=body.device_id,
            location=body.location,
            interval=0.5,
            mqtt_host=MQTT_HOST,
            mqtt_port=MQTT_PORT,
        )
        publisher.start()
        _active[key] = publisher
        steps["simulator_started"] = {
            "status":  "success",
            "message": f"IoT simulator started (type={body.sensor_type})",
        }
    except Exception as exc:
        log.error("Simulator start failed: %s", exc)
        steps["simulator_started"] = {"status": "failed", "message": str(exc)}
        return JSONResponse(status_code=500, content=_base_payload("failed"))

    log.info("Sensor connected: %s (type=%s)", key, body.sensor_type)
    return JSONResponse(status_code=201, content=_base_payload("streaming"))


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


# ── Hardware info — pipeline read (no WebSocket required) ─────────────────────


@app.get("/sensors/{tenant_id}/{sensor_id}/hardware")
async def get_sensor_hardware(tenant_id: str, sensor_id: str):
    """
    Read the latest hardware_info from the sensor's Kafka topic by seeking
    to near the end of each partition.  Runs confluent_kafka (blocking) in
    a thread-pool executor so it does not block the event loop.
    Returns 404 if the topic is empty or contains no hardware_info yet.
    """
    topic = f"verdantiq.{tenant_id}.{sensor_id}"

    def _read_latest_hardware() -> dict | None:
        conf = {
            "bootstrap.servers": KAFKA_BROKERS,
            "group.id":          f"hw-fetch-{sensor_id}-{int(time.time())}",
            "enable.auto.commit": False,
        }
        c = Consumer(conf)
        try:
            # Discover partitions
            meta = c.list_topics(topic, timeout=5)
            if topic not in meta.topics or meta.topics[topic].error:
                return None
            partition_ids = list(meta.topics[topic].partitions.keys())
            if not partition_ids:
                return None

            # Build TopicPartition objects and seek each to (end - 10)
            tps = []
            for pid in partition_ids:
                tp    = TopicPartition(topic, pid)
                lo, hi = c.get_watermark_offsets(tp, timeout=5)
                seek_to = max(lo, hi - 10)
                tps.append(TopicPartition(topic, pid, seek_to))

            c.assign(tps)

            hardware_info: dict | None = None
            deadline = time.monotonic() + 4.0   # read for up to 4 s
            while time.monotonic() < deadline:
                msg = c.poll(timeout=0.3)
                if msg is None:
                    continue
                if msg.error():
                    continue
                try:
                    payload = json.loads(msg.value().decode("utf-8", errors="replace"))
                    hw = payload.get("hardware_info")
                    if hw and isinstance(hw, dict):
                        hardware_info = hw  # keep updating; last one wins
                except Exception:
                    pass
            return hardware_info
        finally:
            c.close()

    hardware_info = await asyncio.get_event_loop().run_in_executor(
        None, _read_latest_hardware
    )
    if not hardware_info:
        raise HTTPException(
            status_code=404,
            detail="No hardware_info found in recent Kafka messages for this sensor",
        )
    return {"tenant_id": tenant_id, "sensor_id": sensor_id, "hardware_info": hardware_info}


# ── Message count — read Kafka watermarks (no WebSocket required) ─────────────


def _get_topic_message_count(topic: str) -> int:
    """Return total messages in a Kafka topic (sum of partition high-watermarks)."""
    conf = {
        "bootstrap.servers": KAFKA_BROKERS,
        "group.id":          f"msgcount-{int(time.time())}",
        "enable.auto.commit": False,
    }
    c = Consumer(conf)
    try:
        meta = c.list_topics(topic, timeout=5)
        if topic not in meta.topics or meta.topics[topic].error:
            return 0
        total = 0
        for pid in meta.topics[topic].partitions:
            tp = TopicPartition(topic, pid)
            _, hi = c.get_watermark_offsets(tp, timeout=5)
            total += max(0, hi)
        return total
    except Exception:
        return 0
    finally:
        c.close()


@app.get("/sensors/message-counts")
async def get_all_message_counts():
    """
    Return Kafka message counts for all active sensors.
    Reads partition high-watermarks in parallel — no terminal/WebSocket needed.
    """
    if not _active:
        return {"counts": {}}

    def _read_one(key: str) -> tuple:
        _, sensor_id = key.split(".", 1)
        topic = f"verdantiq.{key}"
        return sensor_id, _get_topic_message_count(topic)

    loop    = asyncio.get_event_loop()
    results = await asyncio.gather(
        *[loop.run_in_executor(None, _read_one, k) for k in list(_active)]
    )
    return {"counts": dict(results)}


@app.get("/sensors/{tenant_id}/{sensor_id}/message-count")
async def get_sensor_message_count(tenant_id: str, sensor_id: str):
    """Return the Kafka message count for a single sensor's topic."""
    topic = f"verdantiq.{tenant_id}.{sensor_id}"
    count = await asyncio.get_event_loop().run_in_executor(
        None, _get_topic_message_count, topic
    )
    return {"tenant_id": tenant_id, "sensor_id": sensor_id, "message_count": count}


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
