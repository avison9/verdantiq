#!/bin/sh
set -e

echo "Initializing tenant service database tables..."
python db_config.py

echo "Starting Tenant Service on port 8002..."
exec uvicorn main:app --host 0.0.0.0 --port 8002
