"""This is the test file for the infrastructures of the VerdantIQ project"""
import os
import time
import pytest
import requests
from confluent_kafka import Producer, Consumer, KafkaException
from confluent_kafka.admin import AdminClient, NewTopic
from pyspark.sql import SparkSession
from minio import Minio
from minio.error import S3Error
import psycopg2
import logging
import socket
import re


"""Setting up logging"""
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

"""Declearing the variable for access"""
KAFKA_BROKERS =  "kafka1:9092,kafka2:9093,kafka3:9094,kafka4:9095"
SCHEMA_REGISTRY_URL =  "http://schema-registry:8089"
MINIO_ENDPOINT =  "minio:9000"
MINIO_ACCESS_KEY =  "admin"
MINIO_SECRET_KEY = "myminiopassword"
GRAFANA_URL =  "http://grafana:3000"
GRAFANA_USER =  "admin"
GRAFANA_PASSWORD = "myDevPass123"
PROMETHEUS_URL = "http://prometheus:9090"
SPARK_MASTER = "spark://spark-master:7077"
TEST_TOPIC = "infra_test_topic"
TEST_BUCKET = "test-sensor"
WAIT_TIMEOUT = 60  


"""Function to wait and check each services are up are running before making test..."""
def wait_for_service(host, port=None, service_name="Service", timeout=30, use_http=False):
    """Wait for a service to become available (HTTP or TCP)"""
    start_time = time.time()
    while True:
        try:
            """For services using http request"""
            if use_http:
                url = f"http://{host}" if not host.startswith("http") else host
                response = requests.get(url, timeout=5)
                if response.status_code < 500:
                    logger.info(f"{service_name} is ready at {host}")
                    return True
            else:
                """For services not using http"""
                with socket.create_connection((host, port), timeout=5):
                    logger.info(f"{service_name} is ready at {host}:{port}")
                    return True
        except (requests.RequestException, socket.error) as e:
            logger.debug(f"Waiting for {service_name} at {host}:{port or ''}: {str(e)}")

        if time.time() - start_time > timeout:
            logger.error(f"{service_name} at {host}:{port or ''} did not start within {timeout} seconds")
            return False

        time.sleep(1)
"""Function to create a SparkSession"""
@pytest.fixture(scope="session")
def spark_session():
    """Fixture for Spark session"""
    spark = None
    try:
        spark = SparkSession.builder \
            .appName("InfraTest") \
            .master(SPARK_MASTER) \
            .config("spark.jars.packages", "org.apache.iceberg:iceberg-spark-runtime-3.5_2.12:1.4.2,org.apache.hadoop:hadoop-aws:3.3.0,com.amazonaws:aws-java-sdk-bundle:1.12.100") \
            .config("spark.sql.catalog.iceberg_catalog", "org.apache.iceberg.spark.SparkCatalog") \
            .config("spark.sql.catalog.iceberg_catalog.type", "hadoop") \
            .config("spark.sql.catalog.iceberg_catalog.warehouse", f"s3a://{TEST_BUCKET}/") \
            .config("spark.hadoop.fs.s3a.endpoint", f"http://{MINIO_ENDPOINT}") \
            .config("spark.hadoop.fs.s3a.access.key", MINIO_ACCESS_KEY) \
            .config("spark.hadoop.fs.s3a.secret.key", MINIO_SECRET_KEY) \
            .config("spark.hadoop.fs.s3a.path.style.access", "true") \
            .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
            .config("spark.executor.memory", "1g") \
            .config("spark.cores.max", "1") \
            .getOrCreate()
        yield spark
    finally:
        if spark:
            spark.stop()
"""Function to create a MinIO session to simulate bulb storage (S3/GCS)"""
@pytest.fixture(scope="session")
def minio_client():
    """Fixture for MinIO client"""
    return Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=False
    )

def test_kafka_produce_consume():
    """Test producing and consuming messages from Kafka"""
    host, port = KAFKA_BROKERS.split(",")[0].split(":")
    assert wait_for_service(host, port, "Kafka"), "Kafka not available"
    
    admin_client = AdminClient({'bootstrap.servers': KAFKA_BROKERS})

    new_topic = NewTopic(TEST_TOPIC, num_partitions=3, replication_factor=3)
    fs = admin_client.create_topics([new_topic])

    for topic, f in fs.items():
        try:
            f.result()  
        except Exception as e:
            pytest.fail(f"Failed to create Kafka topic {topic}: {e}")

    
    producer = Producer({
        'bootstrap.servers': KAFKA_BROKERS,
        'client.id': 'test_producer'
    })

    test_message = b"test_message"
    try:
        producer.produce(TEST_TOPIC, test_message)
        producer.flush()
    except KafkaException as e:
        pytest.fail(f"Failed to produce message: {str(e)}")


    consumer = Consumer({
        'bootstrap.servers': KAFKA_BROKERS,
        'group.id': 'test_group',
        'auto.offset.reset': 'earliest',
        'session.timeout.ms': 6000
    })

    try:
        consumer.subscribe([TEST_TOPIC])
        msg = consumer.poll(timeout=10.0)
        assert msg is not None, "No message received from Kafka"
        assert msg.value() == test_message, "Message content mismatch"
    finally:
        consumer.close()

    fs_delete = admin_client.delete_topics([TEST_TOPIC])
    for topic, f in fs_delete.items():
        try:
            f.result()
        except Exception as e:
            pytest.fail(f"Failed to delete Kafka topic {topic}: {e}")

def test_schema_registry():
    """Test Schema Registry connectivity"""
    assert wait_for_service(SCHEMA_REGISTRY_URL, service_name="Schema Registry", use_http=True ), "Schema Registry not available"
    response = requests.get(f"{SCHEMA_REGISTRY_URL}/subjects")
    assert response.status_code == 200, "Schema Registry not responding"

def test_minio_operations(minio_client):
    """Test MinIO bucket operations"""
    assert wait_for_service(f"{MINIO_ENDPOINT}/minio/health/live", service_name="MinIO", use_http=True), "MinIO not available"
    
    if minio_client.bucket_exists(TEST_BUCKET):
        try:
            minio_client.remove_bucket(TEST_BUCKET)
        except S3Error as e:
            pytest.fail(f"Failed to clean up test bucket: {str(e)}")
    

    try:
        minio_client.make_bucket(TEST_BUCKET)
        assert minio_client.bucket_exists(TEST_BUCKET), "MinIO bucket creation failed"
    except S3Error as e:
        pytest.fail(f"Failed to create bucket: {str(e)}")
    finally:
        try:
            minio_client.remove_bucket(TEST_BUCKET)
        except S3Error:
            pass 

def test_grafana_dashboard():
    """Test Grafana dashboard availability"""
    assert wait_for_service(GRAFANA_URL, service_name="Grafana", use_http=True), "Grafana not available"
    auth = (GRAFANA_USER, GRAFANA_PASSWORD)
    response = requests.get(f"{GRAFANA_URL}/api/search", auth=auth)
    assert response.status_code == 200, "Grafana API not accessible"
    assert len(response.json()) >= 0, "No dashboards found in Grafana"

def test_prometheus_metrics():
    """Test Prometheus metrics collection"""
    assert wait_for_service(PROMETHEUS_URL, service_name="Prometheus", use_http=True), "Prometheus not available"
    response = requests.get(f"{PROMETHEUS_URL}/api/v1/targets")
    assert response.status_code == 200, "Prometheus API not accessible"
    assert any(t["labels"]["job"] == "kafka-exporter" for t in response.json()["data"]["activeTargets"]), "Kafka exporter not registered"

def test_spark_cluster(spark_session):
    """Test Spark cluster connectivity"""
    data = [("Test", 1), ("Infra", 2)]
    df = spark_session.createDataFrame(data, ["Name", "Value"])
    assert df.count() == 2, "Spark DataFrame count mismatch"


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main(["-v", __file__]))