"""
VerdantIQ Spark Structured Streaming — Sensor → Iceberg
=========================================================
Consumes all sensor Kafka topics (via subscribePattern), parses the JSON
payloads, and writes partitioned Avro-format Iceberg tables in MinIO.

Topic naming convention
    Kafka:   verdantiq.{tenant_id}.{sensor_id}
    Iceberg: iceberg.sensors.{sensor_type}_data

Partition scheme
    (tenant_id, year, month, day, hour)

File format
    Avro  (set per-table via TBLPROPERTIES)

Iceberg catalog
    REST catalog at http://iceberg-rest:8181  (warehouse in MinIO)

Run (inside container or via spark-submit):
    spark-submit --master spark://spark-master:7077 \
        /opt/spark/jobs/sensor_streaming_job.py
"""

from __future__ import annotations

import json
import logging
import os

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import (
    col,
    from_json,
    get_json_object,
    hour,
    lit,
    month,
    split,
    to_timestamp,
    year,
    dayofmonth,
)
from pyspark.sql.types import StringType, StructField, StructType

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("sensor-streaming")

# ── env config ────────────────────────────────────────────────────────────────

KAFKA_BROKERS        = os.getenv("KAFKA_BROKERS",        "kafka1:9092,kafka2:9093")
MINIO_ENDPOINT       = os.getenv("MINIO_ENDPOINT",       "http://minio:9000")
MINIO_ACCESS_KEY     = os.getenv("MINIO_ROOT_USER",      "admin")
MINIO_SECRET_KEY     = os.getenv("MINIO_ROOT_PASSWORD",  "myminiopassword")
ICEBERG_REST_URI     = os.getenv("ICEBERG_REST_URI",     "http://iceberg-rest:8181")
ICEBERG_WAREHOUSE    = os.getenv("ICEBERG_WAREHOUSE",    "s3a://iceberg/")
CHECKPOINT_BASE      = os.getenv("CHECKPOINT_BASE",      "s3a://bronze/checkpoints/sensor-streaming")
KAFKA_TOPIC_PATTERN  = os.getenv("KAFKA_TOPIC_PATTERN",  r"verdantiq\..+")

# Valid sensor types — maps canonical names used in Iceberg table names
SENSOR_TYPE_MAP: dict[str, str] = {
    "soil":        "soil",
    "soil_sensor": "soil",
    "co2":         "co2",
    "co2_sensor":  "co2",
    "weather":     "weather",
    "weather_sensor": "weather",
    "temperature": "temperature",
    "temp_sensor": "temperature",
    "environment": "environment",
    "env_monitor": "environment",
}

# ── SparkSession ──────────────────────────────────────────────────────────────

def build_spark() -> SparkSession:
    return (
        SparkSession.builder
        .appName("VerdantIQ-SensorStreaming")
        # ── Iceberg extensions + REST catalog ──────────────────────────────
        .config("spark.sql.extensions",
                "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions")
        .config("spark.sql.catalog.iceberg",
                "org.apache.iceberg.spark.SparkCatalog")
        .config("spark.sql.catalog.iceberg.catalog-impl",
                "org.apache.iceberg.rest.RESTCatalog")
        .config("spark.sql.catalog.iceberg.uri",           ICEBERG_REST_URI)
        .config("spark.sql.catalog.iceberg.warehouse",     ICEBERG_WAREHOUSE)
        .config("spark.sql.catalog.iceberg.io-impl",
                "org.apache.iceberg.hadoop.HadoopFileIO")
        .config("spark.sql.catalog.iceberg.s3.endpoint",  MINIO_ENDPOINT)
        .config("spark.sql.catalog.iceberg.s3.path-style-access", "true")
        # ── S3A / MinIO ────────────────────────────────────────────────────
        .config("spark.hadoop.fs.s3a.endpoint",            MINIO_ENDPOINT)
        .config("spark.hadoop.fs.s3a.access.key",          MINIO_ACCESS_KEY)
        .config("spark.hadoop.fs.s3a.secret.key",          MINIO_SECRET_KEY)
        .config("spark.hadoop.fs.s3a.path.style.access",   "true")
        .config("spark.hadoop.fs.s3a.impl",
                "org.apache.hadoop.fs.s3a.S3AFileSystem")
        .config("spark.hadoop.fs.s3a.connection.ssl.enabled", "false")
        # ── Streaming tuning ───────────────────────────────────────────────
        .config("spark.sql.streaming.schemaInference",     "true")
        .config("spark.streaming.stopGracefullyOnShutdown", "true")
        .getOrCreate()
    )


# ── Iceberg DDL ───────────────────────────────────────────────────────────────

def ensure_namespace(spark: SparkSession) -> None:
    spark.sql("CREATE NAMESPACE IF NOT EXISTS iceberg.sensors")


_TABLE_DDL_TEMPLATE = """
CREATE TABLE IF NOT EXISTS iceberg.sensors.{table_name} (
    tenant_id   STRING  COMMENT 'Tenant identifier',
    sensor_id   STRING  COMMENT 'Sensor identifier',
    device_id   STRING  COMMENT 'Physical device ID',
    event_time  TIMESTAMP COMMENT 'Event timestamp from device',
    location    STRING  COMMENT 'JSON location metadata',
    metrics     STRING  COMMENT 'JSON sensor-specific metric payload',
    raw_topic   STRING  COMMENT 'Source Kafka topic',
    year        INT,
    month       INT,
    day         INT,
    hour        INT
)
USING iceberg
PARTITIONED BY (tenant_id, year, month, day, hour)
TBLPROPERTIES (
    'write.format.default'        = 'avro',
    'write.delete.format.default' = 'avro',
    'write.update.format.default' = 'avro',
    'write.avro.compression-codec' = 'snappy',
    'write.metadata.compression-codec' = 'gzip',
    'history.expire.max-snapshot-age-ms' = '604800000'
)
"""


def ensure_table(spark: SparkSession, sensor_type: str) -> str:
    canonical   = SENSOR_TYPE_MAP.get(sensor_type.lower(), sensor_type.lower())
    table_name  = f"{canonical}_data"
    full_name   = f"iceberg.sensors.{table_name}"
    spark.sql(_TABLE_DDL_TEMPLATE.format(table_name=table_name))
    log.info("Ensured table: %s", full_name)
    return full_name


# ── micro-batch processor ─────────────────────────────────────────────────────

# Minimal schema to parse the envelope fields we always expect
_ENVELOPE_SCHEMA = StructType([
    StructField("device_id",  StringType()),
    StructField("timestamp",  StringType()),
    StructField("sensor_id",  StringType()),
    StructField("tenant_id",  StringType()),
])

# Metric key → JSON path for each sensor type
_METRICS_PATHS: dict[str, str] = {
    "soil":        "soil_metrics",
    "co2":         "air_quality",
    "weather":     "weather_data",
    "temperature": "temperature_data",
    "environment": "pollution_metrics",
}


def _process_batch(df: DataFrame, batch_id: int, spark: SparkSession) -> None:
    if df.isEmpty():
        return

    log.info("Processing batch %d (%d rows)", batch_id, df.count())

    # ── 1. Parse raw Kafka message ──────────────────────────────────────────
    parsed = (
        df
        .withColumn("json_str",  col("value").cast("string"))
        .withColumn("kafka_topic", col("topic").cast("string"))
        .withColumn("env",       from_json(col("json_str"), _ENVELOPE_SCHEMA))
        .withColumn("device_id", col("env.device_id"))
        .withColumn("timestamp_str", col("env.timestamp"))
        # tenant_id / sensor_id come from the envelope OR from topic
        .withColumn("tenant_id_env", col("env.tenant_id"))
        .withColumn("sensor_id_env", col("env.sensor_id"))
        # Also derive from topic:  verdantiq.{tenant}.{sensor}
        .withColumn("topic_parts", split(col("kafka_topic"), r"\."))
        .withColumn("tenant_id",
                    col("topic_parts").getItem(1))
        .withColumn("sensor_id",
                    col("topic_parts").getItem(2))
    )

    # ── 2. Group by topic (= per sensor) ───────────────────────────────────
    topics = [row.kafka_topic for row in parsed.select("kafka_topic").distinct().collect()]

    for topic in topics:
        parts = topic.split(".")   # verdantiq, tenant_id, sensor_id
        if len(parts) < 3:
            log.warning("Unexpected topic format: %s — skipping", topic)
            continue

        tenant_id = parts[1]
        sensor_id = parts[2]

        # ── 3. Determine sensor_type ────────────────────────────────────────
        # We embed sensor_type in the payload as part of the simulator.
        # Fall back to "unknown" if absent; those rows still get stored.
        topic_df = parsed.filter(col("kafka_topic") == topic)
        types_found = [
            r.sensor_type
            for r in topic_df
            .withColumn("sensor_type",
                        get_json_object(col("json_str"), "$.sensor_type"))
            .select("sensor_type").distinct().collect()
            if r.sensor_type
        ]
        sensor_type = SENSOR_TYPE_MAP.get(
            (types_found[0] or "").lower(), "unknown"
        ) if types_found else "unknown"

        metrics_key = _METRICS_PATHS.get(sensor_type, "")

        # ── 4. Build the row to write ───────────────────────────────────────
        rows_df = (
            topic_df
            .withColumn("event_time",
                        to_timestamp(col("timestamp_str"), "yyyy-MM-dd'T'HH:mm:ss'Z'"))
            .withColumn("location",
                        get_json_object(col("json_str"), "$.location"))
            .withColumn("metrics",
                        get_json_object(col("json_str"),
                                        f"$.{metrics_key}") if metrics_key
                        else lit(None).cast(StringType()))
            .withColumn("year",  year(col("event_time")))
            .withColumn("month", month(col("event_time")))
            .withColumn("day",   dayofmonth(col("event_time")))
            .withColumn("hour",  hour(col("event_time")))
            .select(
                col("tenant_id"),
                col("sensor_id"),
                col("device_id"),
                col("event_time"),
                col("location"),
                col("metrics"),
                col("kafka_topic").alias("raw_topic"),
                col("year"),
                col("month"),
                col("day"),
                col("hour"),
            )
        )

        # ── 5. Ensure Iceberg table exists + write ──────────────────────────
        try:
            ensure_namespace(spark)
            table = ensure_table(spark, sensor_type)
            rows_df.writeTo(table).using("iceberg").append()
            log.info("Wrote %d rows to %s", rows_df.count(), table)
        except Exception as exc:
            log.error("Failed writing to Iceberg [%s]: %s", sensor_type, exc, exc_info=True)


# ── main streaming query ──────────────────────────────────────────────────────

def main() -> None:
    spark = build_spark()
    spark.sparkContext.setLogLevel("WARN")

    log.info("Starting sensor streaming job")
    log.info("  Kafka:   %s", KAFKA_BROKERS)
    log.info("  Pattern: %s", KAFKA_TOPIC_PATTERN)
    log.info("  Iceberg: %s", ICEBERG_REST_URI)
    log.info("  MinIO:   %s", MINIO_ENDPOINT)

    # ── Kafka source — subscribePattern auto-discovers new topics ─────────
    kafka_df = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers",       KAFKA_BROKERS)
        .option("subscribePattern",              KAFKA_TOPIC_PATTERN)
        .option("startingOffsets",               "latest")
        # Refresh metadata every 30 s so new topics are picked up quickly
        .option("kafka.metadata.max.age.ms",     "30000")
        .option("kafka.consumer.metadata.max.age.ms", "30000")
        .option("failOnDataLoss",                "false")
        .option("maxOffsetsPerTrigger",          "10000")
        .load()
        .select(
            col("topic"),
            col("value"),
            col("partition"),
            col("offset"),
            col("timestamp"),
        )
    )

    query = (
        kafka_df.writeStream
        .foreachBatch(lambda df, bid: _process_batch(df, bid, spark))
        .option("checkpointLocation", CHECKPOINT_BASE)
        .trigger(processingTime="5 seconds")
        .start()
    )

    log.info("Streaming query started — awaiting termination")
    query.awaitTermination()


if __name__ == "__main__":
    main()
