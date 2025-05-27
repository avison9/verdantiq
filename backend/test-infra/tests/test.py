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




os.environ["PYSPARK_SUBMIT_ARGS"] = (
    "--jars /home/avison/projects/verdantiq/backend/libs/jdbc/iceberg-spark-runtime-3.5_2.12-1.4.2.jar "
    + "pyspark-shell"
)



spark = SparkSession.builder \
            .appName("InfraTest") \
            .master("spark://localhost:7077") \
            .config("spark.executor.extraClassPath","/home/avison/projects/verdantiq/backend/libs/jdbc/*") \
            .config("spark.driver.extraClassPath", "/home/avison/projects/verdantiq/backend/libs/jdbc/*") \
            .config("spark.sql.catalog.test_catalog", "org.apache.iceberg.spark.SparkCatalog") \
            .config("spark.sql.catalog.test_catalog.type", "hadoop") \
            .config("spark.sql.catalog.test_catalog.warehouse", f"s3a://test-sensor/") \
            .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \
            .config("spark.hadoop.fs.s3a.impl.disable.cache", "true") \
            .config("spark.driver.extraJavaOptions", "-Dcom.amazonaws.services.s3.enableV4=true") \
            .config("spark.hadoop.fs.s3a.endpoint", f"http://localhost:9000") \
            .config("spark.hadoop.fs.s3a.access.key", "admin") \
            .config("spark.hadoop.fs.s3a.secret.key", "myminiopassword") \
            .config("spark.hadoop.fs.s3a.path.style.access", "true") \
            .config("spark.hadoop.fs.s3a.aws.credentials.provider", "org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider") \
            .config("spark.hadoop.fs.s3a.prefetch.enabled", "false") \
            .config("spark.executor.memory", "1g") \
            .config("spark.cores.max", "1") \
            .getOrCreate()


classpath = spark._jvm.java.lang.System.getProperty("java.class.path")

if "hadoop-common" in classpath:
    print(f"'hadoop-common' FOUND in Java classpath:\n{classpath}")
else:
    print(f"'hadoop-common' NOT found in Java classpath:\n{classpath}")
