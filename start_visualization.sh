#!/bin/bash

# Rhizome Network Visualization - Startup Script

echo "======================================================================"
echo "Starting Rhizome Network Visualization"
echo "======================================================================"

if ! ./venv/bin/python - <<'PY' >/dev/null 2>&1; then
import uvicorn  # noqa: F401
import websockets  # noqa: F401
import orjson  # noqa: F401
import torch  # noqa: F401
import torchvision  # noqa: F401
PY
    echo "Backend dependencies missing."
    echo "Run: ./venv/bin/pip install -r backend/requirements.txt"
    exit 1
fi

# Check if backend server is running
if ! pgrep -f "uvicorn.*8001" > /dev/null; then
    echo "Starting backend server..."
    cd "$(dirname "$0")"
    PYTHONPATH=./backend nohup ./venv/bin/uvicorn backend.main:app \
        --host 0.0.0.0 \
        --port 8001 \
        --ws-max-size 20971520 \
        > backend_server.log 2>&1 &

    echo "Backend server started (PID: $!)"
    echo "Log: backend_server.log"
    sleep 3
else
    echo "✓ Backend server already running"
fi

# Start frontend dev server
echo ""
echo "Starting frontend server..."
cd frontend
npm run dev

echo ""
echo "======================================================================"
echo "Visualization Ready!"
echo "======================================================================"
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8001"
echo "WebSocket: ws://localhost:8001/ws"
echo "======================================================================"
