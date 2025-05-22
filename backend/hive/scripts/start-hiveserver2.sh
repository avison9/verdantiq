#!/bin/bash

set -e

echo "Preparing HiveServer2..."

if [ ! -d "/usr/lib/jvm/java-11-openjdk-amd64" ]; then
  echo "Java is not installed, installing Java OpenJDK 11..."
  apt-get update && apt-get install -y openjdk-11-jdk && apt-get clean;
fi

# Set JAVA_HOME
export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

# Confirm correct config
echo "Checking Hive DB type..."
DB_TYPE=$(awk '/<name>javax.jdo.option.ConnectionURL<\/name>/ {getline; gsub(/.*<value>|<\/value>.*/, ""); print}' /opt/hive/conf/hive-site.xml)

if echo "$DB_TYPE" | grep -qi "postgresql"; then
  echo "Hive is configured to use PostgreSQL"
else
  echo "Hive is NOT configured to use PostgreSQL. DB config found: $DB_TYPE"
  echo "Please fix hive-site.xml. Aborting."
  exit 1
fi

export HIVE_LOG_DIR=/opt/hive/logs


mkdir -p "$HIVE_LOG_DIR"


echo "Starting HiveServer2 on port 10000..."
# exec /opt/hive/bin/hive --service hiveserver2 \
#   --hiveconf hive.root.logger=INFO,console \
#   --hiveconf hive.log.dir=/tmp/hive \
#   --hiveconf hive.server2.thrift.port=10000 \
#   --hiveconf hive.server2.thrift.bind.host=0.0.0.0
exec /opt/hive/bin/hive --service hiveserver2 \
  --hiveconf hive.server2.transport.mode=binary \
  --hiveconf hive.server2.thrift.port=10000 \
  --hiveconf hive.server2.thrift.bind.host=0.0.0.0 \
  --hiveconf hive.metastore.uris=thrift://hive-metastore:9083 \
  --hiveconf hive.server2.authentication=NONE

echo "HiveServer2 is successfully live on port 10000!!!"


  # >> /opt/hive/hiveserver2.log 2>&1