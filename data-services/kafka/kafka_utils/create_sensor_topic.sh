#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  create_sensor_topic.sh
#  Create a per-sensor Kafka topic for a given tenant.
#
#  Usage:
#    ./create_sensor_topic.sh <bootstrap-server> <tenant-id> <sensor-id> \
#                             [partitions] [replication-factor]
#
#  Example:
#    ./create_sensor_topic.sh kafka1:9092 tenant_abc soil_001 3 3
#
#  The script is idempotent — it exits 0 even if the topic already exists.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BOOTSTRAP="${1:?Usage: $0 <bootstrap-server> <tenant-id> <sensor-id> [partitions] [replication-factor]}"
TENANT_ID="${2:?Missing tenant-id}"
SENSOR_ID="${3:?Missing sensor-id}"
PARTITIONS="${4:-3}"
REPLICATION="${5:-3}"

TOPIC="verdantiq.${TENANT_ID}.${SENSOR_ID}"

echo "[create_sensor_topic] Creating topic: ${TOPIC}"
echo "  bootstrap      : ${BOOTSTRAP}"
echo "  partitions     : ${PARTITIONS}"
echo "  replication    : ${REPLICATION}"

kafka-topics \
  --bootstrap-server "${BOOTSTRAP}" \
  --create \
  --if-not-exists \
  --topic "${TOPIC}" \
  --partitions "${PARTITIONS}" \
  --replication-factor "${REPLICATION}" \
  --config retention.ms=604800000 \
  --config cleanup.policy=delete \
  --config compression.type=lz4

echo "[create_sensor_topic] Done: ${TOPIC}"
