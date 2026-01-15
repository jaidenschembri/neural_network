"""Streaming engine for activation frames."""

import os
import torch
import asyncio
import time
from pathlib import Path
from typing import Optional

from network.model import RhizomeAutoencoder
from network.hooks import ActivationCapture
from network.training import load_checkpoint
from data.loader import StreamingMNIST, get_mnist_loaders
from streaming.serializer import (
    serialize_topology,
    serialize_activations,
    serialize_to_json
)


class StreamingEngine:
    def __init__(
        self,
        checkpoint_path: str = "./checkpoints/rhizome_autoencoder_latest.pth",
        device: str = "cuda",
        target_fps: int = 30,
        data_dir: str = "./data/mnist"
    ):
        self.device = device if torch.cuda.is_available() else "cpu"
        self.target_fps = target_fps
        self.frame_time = 1.0 / target_fps
        self.running = False

        print(f"Loading model from {checkpoint_path}...")
        self.model = RhizomeAutoencoder()
        if Path(checkpoint_path).exists():
            load_checkpoint(self.model, checkpoint_path, device=self.device)
        else:
            print(f"Warning: Checkpoint not found at {checkpoint_path}, using untrained model")
            self.model = self.model.to(self.device)

        self.model.eval()
        print(f"✓ Model loaded on {self.device}")

        self.capture = ActivationCapture(self.model)

        print("Loading MNIST data stream...")
        train_loader, _ = get_mnist_loaders(batch_size=1, data_dir=data_dir)
        self.data_stream = StreamingMNIST(train_loader)

        print("Generating network topology...")
        self.topology = serialize_topology(self.model)
        print(f"✓ Topology: {self.topology['metadata']['total_nodes']} nodes, "
              f"{self.topology['metadata']['total_connections']} connections")

    def get_topology_message(self) -> bytes:
        return serialize_to_json(self.topology)

    async def stream_activations(self, websocket):
        print(f"Starting activation stream (target: {self.target_fps} FPS)...")
        self.running = True

        frame_count = 0
        start_time = time.time()

        try:
            while self.running:
                frame_start = time.time()

                sample, label = self.data_stream.get_single()

                sample = sample.unsqueeze(0)
                if sample.device != torch.device(self.device):
                    sample = sample.to(self.device)

                with torch.no_grad():
                    _ = self.model(sample)

                activations = self.capture.get_activations(normalize=True)

                timestamp = time.time() - start_time
                activation_frame = serialize_activations(
                    activations,
                    timestamp=timestamp,
                    batch_idx=0
                )

                activation_frame["frame"] = frame_count
                activation_frame["label"] = int(label.item())

                message = serialize_to_json(activation_frame)
                await websocket.send_bytes(message)

                frame_count += 1

                elapsed = time.time() - frame_start
                sleep_time = max(0, self.frame_time - elapsed)

                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)

                if frame_count % 100 == 0:
                    total_elapsed = time.time() - start_time
                    actual_fps = frame_count / total_elapsed
                    print(f"Frame {frame_count} | FPS: {actual_fps:.1f} | "
                          f"Label: {label.item()}")

        except Exception as e:
            print(f"Stream error: {e}")
            raise
        finally:
            self.running = False
            print(f"Stream ended. Total frames: {frame_count}")

    def stop(self):
        self.running = False
        self.capture.remove_hooks()

    def __del__(self):
        self.stop()


_engine: Optional[StreamingEngine] = None


def get_engine() -> StreamingEngine:
    global _engine

    if _engine is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        checkpoint_path = os.getenv("RHIZOME_CHECKPOINT_PATH", "./checkpoints/rhizome_autoencoder_latest.pth")
        data_dir = os.getenv("RHIZOME_DATA_DIR", "./data/mnist")
        target_fps = int(os.getenv("RHIZOME_TARGET_FPS", "30"))
        _engine = StreamingEngine(
            checkpoint_path=checkpoint_path,
            device=device,
            target_fps=target_fps,
            data_dir=data_dir
        )

    return _engine
