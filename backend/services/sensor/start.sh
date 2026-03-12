#!/bin/sh
set -e

echo "Initializing sensor service database tables..."
python db_config.py

echo "Starting Sensor Service on port 8003..."
exec uvicorn main:app --host 0.0.0.0 --port 8003
