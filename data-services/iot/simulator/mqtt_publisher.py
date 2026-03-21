"""
VerdantIQ MQTT Sensor Publisher
================================
Lightweight module used exclusively by the data-service.
No Kafka, no Avro, no schema-registry — only MQTT + stdlib.

Classes
-------
  SensorDataGenerator  : pure data factory, no I/O.
  MQTTSensorPublisher  : publishes JSON to Mosquitto every 0.5 s.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import random
import threading
from datetime import datetime, timezone
from typing import Any

import paho.mqtt.client as mqtt

_log = logging.getLogger(__name__)


# ── helpers ───────────────────────────────────────────────────────────────────

def _r(lo: float, hi: float, decimals: int = 2) -> float:
    return round(random.uniform(lo, hi), decimals)


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _mac_from_id(seed: str) -> str:
    """Deterministic MAC address derived from device ID."""
    h = hashlib.md5(seed.encode()).hexdigest()
    return ":".join(h[i:i+2].upper() for i in range(0, 12, 2))


def _ip_from_id(seed: str) -> str:
    """Deterministic local IP address derived from device ID."""
    h = hashlib.md5(seed.encode()).digest()
    return f"192.168.{h[0] % 256}.{(h[1] % 253) + 2}"


# ══════════════════════════════════════════════════════════════════════════════
# SensorDataGenerator
# ══════════════════════════════════════════════════════════════════════════════

class SensorDataGenerator:
    SENSOR_TYPES = {"soil", "co2", "weather", "temperature", "environment",
                    "humidity", "pressure", "light", "flow"}

    _ALIASES: dict[str, str] = {
        "soil_moisture": "soil", "soil_sensor": "soil",
        "co2_sensor": "co2", "co2sensor": "co2",
        "weather_station": "weather", "weather_sensor": "weather",
        "temp_sensor": "temperature", "temperature_sensor": "temperature",
        "env_monitor": "environment", "environment_sensor": "environment",
        "environmental": "environment", "other": "environment",
        "humidity_sensor": "humidity",
        "pressure_sensor": "pressure", "atmospheric": "pressure",
        "light_sensor": "light", "par_sensor": "light", "lux_sensor": "light",
        "flow_sensor": "flow", "water_flow": "flow",
    }

    def generate(self, sensor_type: str, *, device_id: str = "device_001",
                 location: dict | None = None) -> dict[str, Any]:
        canonical = self._ALIASES.get(sensor_type.lower(), sensor_type.lower())
        method = getattr(self, f"_generate_{canonical}", None)
        if method is None:
            raise ValueError(f"Unknown sensor type '{sensor_type}'.")
        return method(device_id=device_id, location=location or {})

    def _generate_soil(self, *, device_id, location):
        return {"device_id": device_id, "timestamp": _ts(),
                "location": {"latitude": location.get("latitude", 7.3775),
                             "longitude": location.get("longitude", 3.9470),
                             "field_id": location.get("field_id", "farm_plot_A1")},
                "soil_metrics": {"moisture_percent": _r(10, 80), "temperature_c": _r(15, 40),
                                 "ph": _r(4.5, 8.5), "electrical_conductivity_us_cm": _r(100, 2000),
                                 "nitrogen_mg_kg": _r(10, 200), "phosphorus_mg_kg": _r(5, 100),
                                 "potassium_mg_kg": _r(50, 500), "organic_matter_percent": _r(0.5, 8.0)},
                "battery_level_percent": _r(20, 100, 0), "signal_strength_dbm": _r(-90, -40, 0)}

    def _generate_co2(self, *, device_id, location):
        return {"device_id": device_id, "timestamp": _ts(),
                "location": {"latitude": location.get("latitude", 7.3775),
                             "longitude": location.get("longitude", 3.9470),
                             "site": location.get("site", "greenhouse_1")},
                "air_quality": {"co2_ppm": _r(400, 2000), "temperature_c": _r(15, 45),
                                "humidity_percent": _r(20, 95), "pressure_hpa": _r(980, 1040),
                                "voc_ppb": _r(50, 500), "air_quality_index": _r(0, 300, 0)},
                "device_status": {"battery_percent": _r(20, 100, 0), "signal_strength_dbm": _r(-90, -40, 0)}}

    def _generate_weather(self, *, device_id, location):
        return {"device_id": device_id, "timestamp": _ts(),
                "location": {"latitude": location.get("latitude", 7.3775),
                             "longitude": location.get("longitude", 3.9470),
                             "elevation_m": location.get("elevation_m", 210)},
                "weather_data": {"temperature_c": _r(10, 45), "humidity_percent": _r(20, 100),
                                 "pressure_hpa": _r(980, 1040), "wind_speed_m_s": _r(0, 30),
                                 "wind_direction_deg": _r(0, 360, 0), "rainfall_mm": _r(0, 50),
                                 "uv_index": _r(0, 11, 1), "solar_radiation_w_m2": _r(0, 1200)},
                "system": {"battery_percent": _r(20, 100, 0), "signal_strength_dbm": _r(-90, -40, 0)}}

    def _generate_temperature(self, *, device_id, location):
        current = _r(-20, 50)
        return {"device_id": device_id, "timestamp": _ts(),
                "location": {"building": location.get("building", "storage_warehouse_1"),
                             "zone": location.get("zone", "section_A")},
                "temperature_data": {"current_temperature_c": current,
                                     "min_last_24h_c": round(current - _r(0, 3), 2),
                                     "max_last_24h_c": round(current + _r(0, 3), 2)},
                "environment": {"humidity_percent": _r(20, 95), "dew_point_c": _r(-10, 30)},
                "device_status": {"battery_percent": _r(20, 100, 0), "signal_strength_dbm": _r(-90, -40, 0)}}

    def _generate_humidity(self, *, device_id, location):
        return {"device_id": device_id, "timestamp": _ts(),
                "location": {"latitude": location.get("latitude", 7.3775),
                             "longitude": location.get("longitude", 3.9470)},
                "humidity_data": {"humidity_percent": _r(20, 100), "temperature_c": _r(10, 45),
                                  "dew_point_c": _r(5, 30), "heat_index_c": _r(15, 55)},
                "device_status": {"battery_percent": _r(20, 100, 0), "signal_strength_dbm": _r(-90, -40, 0)}}

    def _generate_pressure(self, *, device_id, location):
        return {"device_id": device_id, "timestamp": _ts(),
                "location": {"latitude": location.get("latitude", 7.3775),
                             "longitude": location.get("longitude", 3.9470)},
                "pressure_data": {"atmospheric_hpa": _r(980, 1040), "sea_level_hpa": _r(990, 1050),
                                  "pressure_trend": random.choice(["rising", "falling", "steady"]),
                                  "temperature_c": _r(10, 45)},
                "device_status": {"battery_percent": _r(20, 100, 0), "signal_strength_dbm": _r(-90, -40, 0)}}

    def _generate_light(self, *, device_id, location):
        return {"device_id": device_id, "timestamp": _ts(),
                "location": {"latitude": location.get("latitude", 7.3775),
                             "longitude": location.get("longitude", 3.9470)},
                "light_data": {"lux": _r(0, 100000), "par_umol_m2_s": _r(0, 2500),
                               "uv_index": _r(0, 11, 1), "infrared_w_m2": _r(0, 800)},
                "device_status": {"battery_percent": _r(20, 100, 0), "signal_strength_dbm": _r(-90, -40, 0)}}

    def _generate_flow(self, *, device_id, location):
        return {"device_id": device_id, "timestamp": _ts(),
                "location": {"site": location.get("site", "irrigation_main"),
                             "zone": location.get("zone", "zone_1")},
                "flow_data": {"flow_rate_l_min": _r(0, 50), "cumulative_volume_l": _r(0, 100000),
                              "velocity_m_s": _r(0, 5), "pressure_bar": _r(0, 10),
                              "temperature_c": _r(5, 40)},
                "device_status": {"battery_percent": _r(20, 100, 0),
                                  "valve_open": random.choice([True, True, True, False])}}

    def _generate_environment(self, *, device_id, location):
        return {"device_id": device_id, "timestamp": _ts(),
                "location": {"latitude": location.get("latitude", 7.3775),
                             "longitude": location.get("longitude", 3.9470)},
                "pollution_metrics": {"pm2_5_ug_m3": _r(0, 150), "pm10_ug_m3": _r(0, 300),
                                      "co_ppm": _r(0, 10), "no2_ppb": _r(0, 200),
                                      "so2_ppb": _r(0, 100), "o3_ppb": _r(0, 100)},
                "environment": {"temperature_c": _r(10, 45), "humidity_percent": _r(20, 100),
                                "pressure_hpa": _r(980, 1040)},
                "system": {"battery_percent": _r(20, 100, 0), "signal_strength_dbm": _r(-90, -40, 0)}}


# ══════════════════════════════════════════════════════════════════════════════
# MQTTSensorPublisher
# ══════════════════════════════════════════════════════════════════════════════

class MQTTSensorPublisher:
    def __init__(self, tenant_id: str, sensor_id: str, sensor_type: str,
                 device_id: str, location: dict, *, farm_id: str | None = None,
                 interval: float = 2.0,
                 mqtt_host: str | None = None, mqtt_port: int | None = None):
        self.tenant_id   = tenant_id
        self.farm_id     = farm_id
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

        # Hardware identifiers — stable per device, derived deterministically
        self._mac          = _mac_from_id(sensor_id)
        self._ip           = _ip_from_id(sensor_id)
        self._firmware     = f"v{random.randint(1,3)}.{random.randint(0,9)}.{random.randint(0,9)}"
        self._memory_total = random.choice([256, 512, 1024, 2048])

        # paho 2.x requires CallbackAPIVersion as the first arg; fall back to 1.x API
        try:
            self._client = mqtt.Client(
                mqtt.CallbackAPIVersion.VERSION1,
                client_id=f"verdantiq-sim-{sensor_id}",
                clean_session=True,
            )
        except AttributeError:
            self._client = mqtt.Client(  # type: ignore[call-overload]
                client_id=f"verdantiq-sim-{sensor_id}",
                clean_session=True,
            )

        def _on_connect(client, userdata, flags, rc):
            if rc == 0:
                _log.info("Publisher[%s] connected to MQTT", sensor_id)
            else:
                _log.error("Publisher[%s] MQTT connect failed rc=%s", sensor_id, rc)

        def _on_disconnect(client, userdata, rc):
            if rc != 0:
                _log.warning("Publisher[%s] unexpected MQTT disconnect rc=%s", sensor_id, rc)

        self._client.on_connect    = _on_connect
        self._client.on_disconnect = _on_disconnect

    def start(self) -> None:
        self._client.connect(self.mqtt_host, self.mqtt_port, keepalive=60)
        self._client.loop_start()
        self._thread = threading.Thread(target=self._run, daemon=True, name=f"sim-{self.sensor_id}")
        self._thread.start()
        _log.info("Publisher[%s] started → %s", self.sensor_id, self.topic)

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=self.interval + 2)
        self._client.loop_stop()
        self._client.disconnect()
        _log.info("Publisher[%s] stopped", self.sensor_id)

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                payload = self._gen.generate(self.sensor_type, device_id=self.device_id,
                                             location=self.location)
                payload["tenant_id"]   = self.tenant_id
                payload["farm_id"]     = self.farm_id
                payload["sensor_id"]   = self.sensor_id
                payload["sensor_type"] = self.sensor_type
                payload["hardware_info"] = {
                    "firmware_version":      self._firmware,
                    "mac_address":           self._mac,
                    "ip_address":            self._ip,
                    "battery_level_percent": _r(20, 100, 0),
                    "memory_free_mb":        round(_r(self._memory_total * 0.1,
                                                     self._memory_total * 0.85, 0)),
                    "memory_total_mb":       self._memory_total,
                }
                result = self._client.publish(self.topic, json.dumps(payload), qos=1)
                if result.rc != mqtt.MQTT_ERR_SUCCESS:
                    _log.warning("Publisher[%s] publish rc=%s", self.sensor_id, result.rc)
            except Exception as exc:
                _log.error("Publisher[%s] error: %s", self.sensor_id, exc)
            self._stop.wait(self.interval)
