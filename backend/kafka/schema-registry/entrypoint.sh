#!/bin/bash

set -e

echo "Waiting for Kafka brokers to be available..."

for host in kafka1:9092 kafka2:9093 kafka3:9094 kafka4:9095; do
  while ! nc -z ${host%:*} ${host#*:}; do
    echo "Waiting for $host..."
    sleep 2
  done
  echo "$host is available"
done

echo "All Kafka brokers are reachable. Starting Schema Registry..."


exec /etc/confluent/docker/run
