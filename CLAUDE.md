# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rhizome Network Visualization is a real-time neural network activation visualizer. A FastAPI backend streams PyTorch model activations via WebSocket to a JavaScript frontend that renders an interactive force-directed graph using Canvas 2D and D3-Force-3D.

## Commands

### Development
```bash
# Start both servers (recommended)
./start_visualization.sh

# Or run separately:
# Backend (port 8001, WebSocket at /ws)
PYTHONPATH=./backend ./venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend dev server (port 3000)
cd frontend && npm run dev
```

### Build
```bash
cd frontend && npm run build    # Output to dist/
```

### Training
```bash
python train_model.py           # Train autoencoder on MNIST (10 epochs)
python test_reconstruction.py   # Validate model reconstruction quality
```

### Dependencies
```bash
./venv/bin/pip install -r backend/requirements.txt
cd frontend && npm install
```

## Architecture

### Data Flow
```
MNIST Image (784) → RhizomeAutoencoder → Activation Hooks → WebSocket Binary → Canvas Render
```

### Backend (Python/FastAPI)
- `backend/main.py` - FastAPI app with `/ws` WebSocket endpoint
- `backend/network/model.py` - RhizomeAutoencoder (784→512→256→128→32→128→256→512→784)
- `backend/network/hooks.py` - PyTorch forward hooks capturing layer activations
- `backend/streaming/engine.py` - StreamingEngine singleton managing WebSocket clients
- `backend/streaming/serializer.py` - Topology and activation frame serialization (orjson)
- `backend/data/loader.py` - MNIST loaders and StreamingMNIST iterator

### Frontend (JavaScript/Vite)
- `frontend/src/main.js` - Entry point, RhizomeVisualization orchestrator class
- `frontend/src/connection/websocket.js` - NetworkWebSocket handling binary protocol
- `frontend/src/visualization/network.js` - NetworkGraph with D3 force simulation
- `frontend/src/visualization/scene.js` - NetworkScene Canvas 2D rendering
- `frontend/src/visualization/particles.js` - ParticlePool and PathCache for flow animation

### Key Patterns
- **Singleton**: StreamingEngine uses global `_engine` instance
- **Hook Pattern**: PyTorch forward hooks for activation capture
- **Path Caching**: Frontend caches Bézier paths for particle animation performance

### Performance Constraints
- Max 50,000 rendered connections (dynamic downsampling)
- Max 2,000 active particles
- Target 30 FPS backend streaming, 60 FPS frontend rendering

## Environment Variables

See `backend/.env.example`:
- `RHIZOME_PORT` - Backend port (default: 8001)
- `RHIZOME_TARGET_FPS` - Activation stream FPS (default: 30)
- `RHIZOME_CHECKPOINT_PATH` - Model weights path
