#!/bin/bash

echo "Running custom init-schema.sh script for PostgreSQL"

# Explicitly override any Derby defaults
echo "Forcing PostgreSQL initialization..."
/opt/hive/bin/schematool \
  -dbType postgres \
  -initSchema \
  -verbose \
  -userName hiveadmin \
  -passWord hivepassword \
  -url "jdbc:postgresql://postgres:5432/metastore"

if [ $? -eq 0 ]; then
  echo "PostgreSQL schema initialized successfully"
  touch /opt/hive/conf/.postgres_initialized
  tail -f /dev/null
else
  echo "PostgreSQL schema initialization failed!"
  exit 1
fi
