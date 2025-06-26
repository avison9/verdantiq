#!/bin/sh
set -e  

echo "Initializing database..."
python db_config.py

echo "Starting FastAPI server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
