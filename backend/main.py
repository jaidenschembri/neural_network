"""FastAPI server for activation streaming."""

import os
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

app = FastAPI(
    title="Rhizome Network Visualization API",
    description="Real-time neural network activation streaming",
    version="1.0.0"
)

# Serve frontend static files in production
STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

def parse_origins(value: str) -> list[str]:
    if not value or value.strip() == "*":
        return ["*"]
    return [origin.strip() for origin in value.split(",") if origin.strip()]


allowed_origins = parse_origins(os.getenv("RHIZOME_ALLOWED_ORIGINS", "*"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allowed_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    # Serve frontend in production, API info in development
    if STATIC_DIR.exists():
        return FileResponse(STATIC_DIR / "index.html")
    return {
        "name": "Rhizome Network Visualization API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    import torch

    return {
        "status": "healthy",
        "cuda_available": torch.cuda.is_available(),
        "device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    }


@app.get("/model/info")
async def model_info():
    from network.model import RhizomeAutoencoder

    model = RhizomeAutoencoder()

    return {
        "architecture": "RhizomeAutoencoder",
        "parameters": model.count_parameters(),
        "layers": len(list(model.named_modules())),
        "input_size": 784,
        "bottleneck_size": 32,
        "output_size": 784
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    client_info = f"{websocket.client.host}:{websocket.client.port}"
    print(f"WebSocket connected: {client_info}")

    try:
        from streaming.engine import get_engine

        engine = get_engine()

        print("Sending topology...")
        topology_message = engine.get_topology_message()
        await websocket.send_bytes(topology_message)
        print(f"✓ Topology sent ({len(topology_message) / 1024:.2f} KB)")

        print("Starting activation stream...")
        await engine.stream_activations(websocket)

    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {client_info}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print(f"WebSocket closed: {client_info}")


if __name__ == "__main__":
    host = os.getenv("RHIZOME_HOST", "0.0.0.0")
    port = int(os.getenv("PORT", os.getenv("RHIZOME_PORT", "8001")))
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )
