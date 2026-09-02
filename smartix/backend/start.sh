#!/bin/bash
set -e

echo "Installing dependencies from requirements.txt..."
pip install --quiet -r requirements.txt

echo "Starting backend server..."
uvicorn server:app --host 0.0.0.0 --port 8000
