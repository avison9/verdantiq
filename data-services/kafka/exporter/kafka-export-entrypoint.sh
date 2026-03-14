#!/bin/sh

echo "Waiting for Kafka brokers to be ready..."

for host in kafka1:9092 kafka2:9093; do
  until nc -z ${host%:*} ${host#*:}; do
    echo "Waiting for $host..."
    sleep 3
  done
done

echo "All Kafka brokers are reachable. Starting exporter..."

exec kafka_exporter \
  --kafka.server=kafka1:9092 \
  --kafka.server=kafka2:9093 \
  --log.level=debug
