from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, window, lit
from pyspark.sql.types import StructType, StringType, TimestampType
import requests
from requests.auth import HTTPBasicAuth
import time
from functools import wraps
from dotenv import load_dotenv
import json
import os


load_dotenv(override=True)

SCHEMA_REGISTRY_URL = os.getenv('SCHEMA_REGISTRY_URL', "http://schema-registry:8089")
SCHEMA_REGISTRY_AUTH_ENABLED = False  
SCHEMA_REGISTRY_USER =os.getenv('SCHEMA_REGISTRY_USER')        
SCHEMA_REGISTRY_PASSWORD = os.getenv('SCHEMA_REGISTRY_PASSWORD')
CLUSTER = os.getenv('KAFKA_BROKER', "kafka1:9092,kafka2:9092,kafka3:9092,kafka4:9092")
MINIO_ACESS_KEY=os.getenv('MINIO_ROOT_USER')
MINIO_SECRET_KEY=os.getenv('MINIO_ROOT_PASSWORD')
MINIO_ENDPOINT=os.getenv('MINIO_ENDPOINT')


# --- Retry Decorator for Schema Registry API ---
def retry_api(max_retries=3, delay=1, backoff=2):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            retries, current_delay = 0, delay
            while retries < max_retries:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    retries += 1
                    if retries == max_retries:
                        raise Exception(f"API call failed after {max_retries} retries: {str(e)}")
                    time.sleep(current_delay)
                    current_delay *= backoff
        return wrapper
    return decorator

# --- Fetch Schema with Auth/Retry Support ---
@retry_api(max_retries=3, delay=1, backoff=2)
def fetch_avro_schema(sensor_type: str):
    url = f"{SCHEMA_REGISTRY_URL}/subjects/sensor_{sensor_type}-value/versions/latest"
    auth = HTTPBasicAuth(SCHEMA_REGISTRY_USER, SCHEMA_REGISTRY_PASSWORD) if SCHEMA_REGISTRY_AUTH_ENABLED else None
    response = requests.get(url, auth=auth)
    response.raise_for_status()  # Raises HTTPError for bad responses
    return response.json()["schema"]

# --- Initialize Spark ---
spark = SparkSession.builder \
    .appName("DynamicSchemaBronzeIngestion") \
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension") \
    .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog") \
    .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0,io.delta:delta-core_2.12:2.4.0") \
    .config("spark.hadoop.fs.s3a.access.key", MINIO_ACESS_KEY) \
    .config("spark.hadoop.fs.s3a.secret.key", MINIO_SECRET_KEY) \
    .config("spark.hadoop.fs.s3a.endpoint", MINIO_ENDPOINT) \
    .config("spark.hadoop.fs.s3a.connection.maximum", "100") \
    .config("spark.hadoop.fs.s3a.path.style.access", "true") \
    .config("spark.hadoop.fs.s3a.region", 'us-east-1') \
    .getOrCreate()

# Enable schema evolution
spark.conf.set("spark.databricks.delta.schema.autoMerge.enabled", "true")

# --- Stream Processing ---
def parse_kafka_data(batch_df, batch_id):
    sensor_types = batch_df.select("value").rdd \
        .map(lambda x: x.value.decode("utf-8").split(",")[0]) \
        .distinct() \
        .collect()
    
    for sensor_type in sensor_types:
        try:
            schema = fetch_avro_schema(sensor_type)
            parsed_df = batch_df.filter(col("value").contains(sensor_type)) \
                .select(from_json(col("value").cast("string"), schema).alias("data")) \
                .select("data.*")
            
            windowed_df = parsed_df \
                .withWatermark("timestamp", "10 minutes") \
                .groupBy(
                    window("timestamp", "5 minutes", "15 seconds"),
                    "farm_id",
                    lit(sensor_type).alias("sensor_type")
                ).agg({"*": "count"})
            
            windowed_df.write \
                .format("delta") \
                .mode("append") \
                .save(f"s3a://bronze/sensor_events/")
        except Exception as e:
            print(f"Failed to process {sensor_type}: {str(e)}")  # Log errors (or push to DLQ)

# --- Start Streaming Query ---
df = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", CLUSTER) \
    .option("subscribe", "raw-sensor-data") \
    .option("startingOffsets", "latest") \
    .load()

query = df.writeStream \
    .foreachBatch(parse_kafka_data) \
    .option("checkpointLocation", "s3a://bronze/checkpoints/sensor_ingestion") \
    .start()

query.awaitTermination()
