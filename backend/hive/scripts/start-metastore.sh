#!/bin/bash

set -e

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

# Start metastore
echo "Starting Hive Metastore on port 9083..."
# exec /opt/hive/bin/hive --service metastore 
exec /opt/hive/bin/hive --service metastore --hiveconf hive.metastore.port=9083
echo "Hive Metastore is successfully live on port 9083!!!"
