"""
Train Rhizome Autoencoder - Full Training Run

Trains the model for 10 epochs on MNIST and saves checkpoints.
"""

import torch
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / 'backend'))

from network.model import RhizomeAutoencoder
from network.training import train_autoencoder
from data.loader import get_mnist_loaders


def main():
    print("\n" + "=" * 70)
    print("RHIZOME AUTOENCODER - FULL TRAINING")
    print("=" * 70)

    # Check CUDA
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    if device == 'cuda':
        print(f"✓ GPU: {torch.cuda.get_device_name(0)}")
        print(f"✓ VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
    else:
        print("⚠ Running on CPU (CUDA not available)")

    # Create model
    print("\nInitializing model...")
    model = RhizomeAutoencoder()
    model.summary()

    # Load data
    print("\nLoading MNIST dataset...")
    train_loader, test_loader = get_mnist_loaders(batch_size=64)

    # Train
    print("\n" + "=" * 70)
    print("Starting training...")
    print("=" * 70)

    history = train_autoencoder(
        model=model,
        train_loader=train_loader,
        test_loader=test_loader,
        epochs=10,
        learning_rate=0.001,
        device=device,
        checkpoint_dir='./backend/checkpoints',
        save_every=2
    )

    print("\n" + "=" * 70)
    print("TRAINING COMPLETE!")
    print("=" * 70)
    print(f"Initial train loss: {history['train_loss'][0]:.6f}")
    print(f"Final train loss: {history['train_loss'][-1]:.6f}")
    print(f"Final test loss: {history['test_loss'][-1]:.6f}")
    print(f"Improvement: {((history['train_loss'][0] - history['train_loss'][-1]) / history['train_loss'][0] * 100):.1f}%")
    print(f"\nCheckpoint saved: ./backend/checkpoints/rhizome_autoencoder_latest.pth")
    print("=" * 70)


if __name__ == "__main__":
    main()
