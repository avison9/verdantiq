#!/bin/sh
set -e

echo "Initializing auth service database tables..."
python db_config.py

echo "Starting Auth Service on port 8001..."
exec uvicorn main:app --host 0.0.0.0 --port 8001
