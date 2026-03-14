"""
VerdantIQ IoT Sensor Simulator
================================
Provides two classes:
  - SensorDataGenerator  : pure data factory — generates realistic random payloads
                           for every supported sensor type. No I/O.
  - SensorSimulator      : legacy Kafka-direct publisher (backwards-compat).
  - MQTTSensorPublisher  : MQTT publisher used by the data service to simulate
                           a live sensor. Publishes to:
                           verdantiq/{tenant_id}/{sensor_id}/data  @ 2 s interval.
"""

from __future__ import annotations

import json
import logging
import os
import random
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Any

import paho.mqtt.client as mqtt
from confluent_kafka import Producer
from confluent_kafka.error import KafkaError
from confluent_kafka.schema_registry import Schema, SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
from confluent_kafka.serialization import MessageField, SerializationContext
from dotenv import load_dotenv

load_dotenv(override=True)

_log = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


# ── helpers ──────────────────────────────────────────────────────────────────

def _r(lo: float, hi: float, decimals: int = 2) -> float:
    return round(random.uniform(lo, hi), decimals)


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ══════════════════════════════════════════════════════════════════════════════
# SensorDataGenerator  — pure data factory
# ══════════════════════════════════════════════════════════════════════════════

class SensorDataGenerator:
    """
    Generates realistic random sensor payloads for all 5 supported sensor
    types. No network I/O — pure data.

    Usage
    -----
        gen = SensorDataGenerator()
        payload = gen.generate("soil", device_id="soil_001",
                                location={"latitude": 7.3775, "longitude": 3.9470,
                                          "field_id": "farm_plot_A1"})
    """

    SENSOR_TYPES = {"soil", "co2", "weather", "temperature", "environment",
                     "humidity", "pressure", "light", "flow"}

    # type aliases accepted by generate()
    _ALIASES: dict[str, str] = {
        # soil
        "soil_moisture":      "soil",
        "soil_sensor":        "soil",
        # co2
        "co2_sensor":         "co2",
        "co2sensor":          "co2",
        # weather
        "weather_station":    "weather",
        "weather_sensor":     "weather",
        # temperature
        "temp_sensor":        "temperature",
        "temperature_sensor": "temperature",
        # environment
        "env_monitor":        "environment",
        "environment_sensor": "environment",
        "environmental":      "environment",
        "other":              "environment",
        # humidity
        "humidity_sensor":    "humidity",
        # pressure
        "pressure_sensor":    "pressure",
        "atmospheric":        "pressure",
        # light
        "light_sensor":       "light",
        "par_sensor":         "light",
        "lux_sensor":         "light",
        # flow
        "flow_sensor":        "flow",
        "water_flow":         "flow",
    }

    def generate(
        self,
        sensor_type: str,
        *,
        device_id: str = "device_001",
        location: dict | None = None,
    ) -> dict[str, Any]:
        """Return a complete sensor payload for *sensor_type*."""
        canonical = self._ALIASES.get(sensor_type.lower(), sensor_type.lower())
        method = getattr(self, f"_generate_{canonical}", None)
        if method is None:
            raise ValueError(
                f"Unknown sensor type '{sensor_type}'. "
                f"Supported: {sorted(self.SENSOR_TYPES)}"
            )
        return method(device_id=device_id, location=location or {})

    # ── per-type generators ──────────────────────────────────────────────────

    def _generate_soil(
        self, *, device_id: str, location: dict
    ) -> dict[str, Any]:
        return {
            "device_id": device_id,
            "timestamp": _ts(),
            "location": {
                "latitude":  location.get("latitude",  7.3775),
                "longitude": location.get("longitude", 3.9470),
                "field_id":  location.get("field_id",  "farm_plot_A1"),
            },
            "soil_metrics": {
                "moisture_percent":               _r(10, 80),
                "temperature_c":                  _r(15, 40),
                "ph":                             _r(4.5, 8.5),
                "electrical_conductivity_us_cm":  _r(100, 2000),
                "salinity_dS_m":                  _r(0.1, 5.0),
                "nitrogen_mg_kg":                 _r(10, 200),
                "phosphorus_mg_kg":               _r(5, 100),
                "potassium_mg_kg":                _r(50, 500),
                "organic_matter_percent":         _r(0.5, 8.0),
            },
            "battery_level_percent": _r(20, 100, 0),
            "signal_strength_dbm":   _r(-90, -40, 0),
        }

    def _generate_co2(
        self, *, device_id: str, location: dict
    ) -> dict[str, Any]:
        return {
            "device_id": device_id,
            "timestamp": _ts(),
            "location": {
                "latitude":  location.get("latitude",  7.3775),
                "longitude": location.get("longitude", 3.9470),
                "site":      location.get("site",      "greenhouse_1"),
            },
            "air_quality": {
                "co2_ppm":           _r(400, 2000),
                "temperature_c":     _r(15, 45),
                "humidity_percent":  _r(20, 95),
                "pressure_hpa":      _r(980, 1040),
                "voc_ppb":           _r(50, 500),
                "air_quality_index": _r(0, 300, 0),
            },
            "device_status": {
                "battery_percent":      _r(20, 100, 0),
                "calibration_status":   random.choice(["ok", "ok", "ok", "needs_calibration"]),
                "signal_strength_dbm":  _r(-90, -40, 0),
            },
        }

    def _generate_weather(
        self, *, device_id: str, location: dict
    ) -> dict[str, Any]:
        return {
            "device_id": device_id,
            "timestamp": _ts(),
            "location": {
                "latitude":    location.get("latitude",    7.3775),
                "longitude":   location.get("longitude",   3.9470),
                "elevation_m": location.get("elevation_m", 210),
            },
            "weather_data": {
                "temperature_c":          _r(10, 45),
                "humidity_percent":       _r(20, 100),
                "pressure_hpa":           _r(980, 1040),
                "wind_speed_m_s":         _r(0, 30),
                "wind_direction_deg":     _r(0, 360, 0),
                "rainfall_mm":            _r(0, 50),
                "uv_index":               _r(0, 11, 1),
                "solar_radiation_w_m2":   _r(0, 1200),
                "dew_point_c":            _r(5, 30),
            },
            "system": {
                "battery_percent":     _r(20, 100, 0),
                "signal_strength_dbm": _r(-90, -40, 0),
            },
        }

    def _generate_temperature(
        self, *, device_id: str, location: dict
    ) -> dict[str, Any]:
        current = _r(-20, 50)
        lo      = current - _r(0, 3)
        hi      = current + _r(0, 3)
        return {
            "device_id": device_id,
            "timestamp": _ts(),
            "location": {
                "building": location.get("building", "storage_warehouse_1"),
                "zone":     location.get("zone",     "section_A"),
            },
            "temperature_data": {
                "current_temperature_c":  current,
                "min_last_24h_c":         round(lo, 2),
                "max_last_24h_c":         round(hi, 2),
                "average_last_24h_c":     round((current + lo + hi) / 3, 2),
            },
            "environment": {
                "humidity_percent": _r(20, 95),
                "dew_point_c":      _r(-10, 30),
            },
            "device_status": {
                "battery_percent":     _r(20, 100, 0),
                "uptime_hours":        random.randint(1, 8760),
                "signal_strength_dbm": _r(-90, -40, 0),
            },
        }

    def _generate_humidity(
        self, *, device_id: str, location: dict
    ) -> dict[str, Any]:
        return {
            "device_id": device_id,
            "timestamp": _ts(),
            "location": {
                "latitude":  location.get("latitude",  7.3775),
                "longitude": location.get("longitude", 3.9470),
                "site":      location.get("site",      "greenhouse_1"),
            },
            "humidity_data": {
                "humidity_percent":       _r(20, 100),
                "temperature_c":          _r(10, 45),
                "absolute_humidity_g_m3": _r(5, 30),
                "dew_point_c":            _r(5, 30),
                "heat_index_c":           _r(15, 55),
            },
            "device_status": {
                "battery_percent":     _r(20, 100, 0),
                "signal_strength_dbm": _r(-90, -40, 0),
            },
        }

    def _generate_pressure(
        self, *, device_id: str, location: dict
    ) -> dict[str, Any]:
        return {
            "device_id": device_id,
            "timestamp": _ts(),
            "location": {
                "latitude":    location.get("latitude",    7.3775),
                "longitude":   location.get("longitude",   3.9470),
                "elevation_m": location.get("elevation_m", 100),
            },
            "pressure_data": {
                "atmospheric_hpa":      _r(980, 1040),
                "sea_level_hpa":        _r(990, 1050),
                "altitude_m":           _r(0, 500),
                "pressure_trend":       random.choice(["rising", "falling", "steady"]),
                "temperature_c":        _r(10, 45),
            },
            "device_status": {
                "battery_percent":     _r(20, 100, 0),
                "signal_strength_dbm": _r(-90, -40, 0),
            },
        }

    def _generate_light(
        self, *, device_id: str, location: dict
    ) -> dict[str, Any]:
        return {
            "device_id": device_id,
            "timestamp": _ts(),
            "location": {
                "latitude":  location.get("latitude",  7.3775),
                "longitude": location.get("longitude", 3.9470),
                "site":      location.get("site",      "field_north"),
            },
            "light_data": {
                "lux":                   _r(0, 100000),
                "par_umol_m2_s":         _r(0, 2500),
                "uv_index":              _r(0, 11, 1),
                "infrared_w_m2":         _r(0, 800),
                "visible_spectrum_lux":  _r(0, 100000),
                "photoperiod_hours":     _r(0, 24, 1),
            },
            "device_status": {
                "battery_percent":     _r(20, 100, 0),
                "signal_strength_dbm": _r(-90, -40, 0),
            },
        }

    def _generate_flow(
        self, *, device_id: str, location: dict
    ) -> dict[str, Any]:
        flow_rate = _r(0, 50)
        return {
            "device_id": device_id,
            "timestamp": _ts(),
            "location": {
                "site":    location.get("site",    "irrigation_main"),
                "zone":    location.get("zone",    "zone_1"),
                "pipe_id": location.get("pipe_id", "pipe_001"),
            },
            "flow_data": {
                "flow_rate_l_min":       flow_rate,
                "cumulative_volume_l":   _r(0, 100000),
                "velocity_m_s":          _r(0, 5),
                "pressure_bar":          _r(0, 10),
                "temperature_c":         _r(5, 40),
                "turbidity_ntu":         _r(0, 100),
            },
            "device_status": {
                "battery_percent":     _r(20, 100, 0),
                "signal_strength_dbm": _r(-90, -40, 0),
                "valve_open":          random.choice([True, True, True, False]),
            },
        }

    def _generate_environment(
        self, *, device_id: str, location: dict
    ) -> dict[str, Any]:
        return {
            "device_id": device_id,
            "timestamp": _ts(),
            "location": {
                "latitude":  location.get("latitude",  7.3775),
                "longitude": location.get("longitude", 3.9470),
                "site":      location.get("site",      "farm_boundary_north"),
            },
            "pollution_metrics": {
                "pm2_5_ug_m3": _r(0, 150),
                "pm10_ug_m3":  _r(0, 300),
                "co_ppm":      _r(0, 10),
                "no2_ppb":     _r(0, 200),
                "so2_ppb":     _r(0, 100),
                "o3_ppb":      _r(0, 100),
            },
            "environment": {
                "temperature_c":    _r(10, 45),
                "humidity_percent": _r(20, 100),
                "pressure_hpa":     _r(980, 1040),
            },
            "system": {
                "battery_percent":     _r(20, 100, 0),
                "signal_strength_dbm": _r(-90, -40, 0),
            },
        }


# ══════════════════════════════════════════════════════════════════════════════
# MQTTSensorPublisher  — publishes random data to Mosquitto at 2-second
#                        intervals. Used by the data service.
# ══════════════════════════════════════════════════════════════════════════════

class MQTTSensorPublisher:
    """
    Publishes simulated sensor data to MQTT broker.

    Topic pattern:  verdantiq/{tenant_id}/{sensor_id}/data

    Lifecycle
    ---------
        pub = MQTTSensorPublisher(tenant_id, sensor_id, sensor_type, device_id, location)
        pub.start()          # returns immediately — runs in background thread
        ...
        pub.stop()           # graceful shutdown
    """

    def __init__(
        self,
        tenant_id: str,
        sensor_id: str,
        sensor_type: str,
        device_id: str,
        location: dict,
        *,
        interval: float = 2.0,
        mqtt_host: str | None = None,
        mqtt_port: int | None = None,
    ):
        self.tenant_id   = tenant_id
        self.sensor_id   = sensor_id
        self.sensor_type = sensor_type
        self.device_id   = device_id
        self.location    = location
        self.interval    = interval
        self.mqtt_host   = mqtt_host or os.getenv("MQTT_HOST", "mosquitto")
        self.mqtt_port   = mqtt_port or int(os.getenv("MQTT_PORT", "1883"))
        self.topic       = f"verdantiq/{tenant_id}/{sensor_id}/data"

        self._gen    = SensorDataGenerator()
        self._stop   = threading.Event()
        self._thread: threading.Thread | None = None
        self._client = mqtt.Client(client_id=f"sim-{sensor_id}", clean_session=True)
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            _log.info("MQTTPublisher[%s] connected", self.sensor_id)
        else:
            _log.error("MQTTPublisher[%s] connect failed rc=%s", self.sensor_id, rc)

    def _on_disconnect(self, client, userdata, rc):
        if rc != 0:
            _log.warning("MQTTPublisher[%s] unexpected disconnect", self.sensor_id)

    def start(self) -> None:
        """Connect and begin publishing in a daemon thread."""
        self._client.connect(self.mqtt_host, self.mqtt_port, keepalive=60)
        self._client.loop_start()
        self._thread = threading.Thread(target=self._run, daemon=True, name=f"sim-{self.sensor_id}")
        self._thread.start()
        _log.info("MQTTPublisher[%s] started → %s", self.sensor_id, self.topic)

    def stop(self) -> None:
        """Signal the publish loop to exit and disconnect."""
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=self.interval + 2)
        self._client.loop_stop()
        self._client.disconnect()
        _log.info("MQTTPublisher[%s] stopped", self.sensor_id)

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                payload = self._gen.generate(
                    self.sensor_type,
                    device_id=self.device_id,
                    location=self.location,
                )
                payload["tenant_id"] = self.tenant_id
                payload["sensor_id"] = self.sensor_id
                message = json.dumps(payload)
                result  = self._client.publish(self.topic, message, qos=1)
                if result.rc != mqtt.MQTT_ERR_SUCCESS:
                    _log.warning("MQTTPublisher[%s] publish rc=%s", self.sensor_id, result.rc)
            except Exception as exc:
                _log.error("MQTTPublisher[%s] error: %s", self.sensor_id, exc)
            self._stop.wait(self.interval)


# ══════════════════════════════════════════════════════════════════════════════
# SensorSimulator  — legacy Kafka-direct publisher (backwards-compat)
# ══════════════════════════════════════════════════════════════════════════════

class SensorSimulator:
    """
    Legacy simulator that publishes directly to Kafka with Avro serialisation.
    Kept for backwards compatibility with existing tests and CI pipeline.
    """

    SENSORS = [
        {"type": "soil_moisture", "fields": {"moisture": float, "ph": float}},
        {"type": "poultry_temp",  "fields": {"temp_celsius": float, "humidity": float}},
        {"type": "bird_feeder",   "fields": {"food_level": float, "battery": float}},
    ]

    def __init__(self):
        self._setup_logging()
        self.kafka_brokers        = os.getenv("KAFKA_BROKER", "kafka1:9092,kafka2:9093")
        self.schema_registry_url  = os.getenv("SCHEMA_REGISTRY_URL", "http://schema-registry:8089")
        self.max_retries          = int(os.getenv("MAX_RETRIES", "5"))
        self.retry_delay          = int(os.getenv("RETRY_DELAY", "2"))

        self.schema_registry_client = SchemaRegistryClient({"url": self.schema_registry_url})
        self.registered_schemas: dict = {}
        self._register_all_schemas()
        self.producer, self.serializers = self._create_avro_producer()

    def _setup_logging(self):
        self.logger = logging.getLogger(self.__class__.__name__)

    def _register_all_schemas(self):
        self.logger.info("Registering schemas…")
        for sensor in self.SENSORS:
            schema_str = self._get_avro_schema(sensor["type"], sensor["fields"])
            subject    = f"{sensor['type']}-value"
            schema_obj = Schema(schema_str, schema_type="AVRO")
            try:
                reg = self.schema_registry_client.get_latest_version(subject)
                self.registered_schemas[subject] = reg.version
                self.logger.info("Schema %s already registered (v%s)", subject, reg.version)
            except Exception as exc:
                if "404" in str(exc):
                    sid = self.schema_registry_client.register_schema(subject, schema_obj)
                    self.registered_schemas[subject] = sid
                    self.logger.info("Registered schema %s id=%s", subject, sid)
                else:
                    raise

    def _create_avro_producer(self) -> tuple[Producer, dict]:
        def _strategy(ctx: SerializationContext, record_name: str) -> str:
            return f"{ctx.topic}-{record_name}"

        serializers = {}
        for sensor in self.SENSORS:
            schema_str = self._get_avro_schema(sensor["type"], sensor["fields"])
            subject    = f"{sensor['type']}-value"
            sid        = self.registered_schemas.get(subject)
            if not sid:
                raise ValueError(f"Schema not registered for {subject}")
            serializers[sensor["type"]] = AvroSerializer(
                self.schema_registry_client,
                schema_str=schema_str,
                to_dict=lambda data, ctx: data,
                conf={"subject.name.strategy": _strategy},
            )

        producer = Producer({
            "bootstrap.servers":          self.kafka_brokers,
            "message.send.max.retries":   self.max_retries,
            "retry.backoff.ms":           self.retry_delay * 1000,
            "retry.backoff.max.ms":       2000,
            "enable.idempotence":         True,
            "client.id":                  "legacy-sensor-producer",
        })
        return producer, serializers

    @staticmethod
    def _get_avro_schema(sensor_type: str, fields: dict) -> str:
        schema = {
            "type": "record",
            "name": sensor_type,
            "namespace": "com.verdantiq.sensors",
            "fields": [
                {"name": "farm_id",   "type": "string"},
                {"name": "timestamp", "type": "long"},
                *[{"name": k, "type": "float" if v in (int, float) else "string"}
                  for k, v in fields.items()],
            ],
        }
        return json.dumps(schema)

    def generate_sensor_data(self) -> list[dict]:
        return [
            {
                "type": s["type"],
                "data": {
                    "farm_id":   f"farm_{random.randint(1, 100)}",
                    "timestamp": int(time.time() * 1000),
                    **{k: round(random.uniform(0, 100), 2) for k in s["fields"]},
                },
            }
            for s in self.SENSORS
        ]

    def send_data(self, data: dict) -> bool:
        try:
            serializer = self.serializers.get(data["type"])
            if not serializer:
                self.logger.error("No serializer for %s", data["type"])
                return False
            value = serializer(
                data["data"],
                SerializationContext(topic="raw-sensor-data", field=MessageField.VALUE),
            )
            if value is None:
                return False
            self.producer.produce(topic="raw-sensor-data", value=value, callback=self._delivery_callback)
            self.producer.poll(0)
            return True
        except Exception as exc:
            self.logger.error("send_data error: %s", exc, exc_info=True)
            return False

    def _delivery_callback(self, err: KafkaError, msg):
        if err:
            self.logger.error("Delivery failed: %s", err)
        else:
            self.logger.debug("Delivered to %s[%s]@%s", msg.topic(), msg.partition(), msg.offset())

    def run(self, interval: int = 15):
        self.logger.info("Starting legacy Kafka simulation…")
        try:
            while True:
                for sd in self.generate_sensor_data():
                    self.send_data(sd)
                time.sleep(interval)
        except KeyboardInterrupt:
            self.logger.info("Shutting down…")
        finally:
            self.producer.flush()


if __name__ == "__main__":
    try:
        SensorSimulator().run()
    except Exception as exc:
        logging.getLogger("sensor-simulator").critical("Fatal: %s", exc, exc_info=True)
        sys.exit(1)
