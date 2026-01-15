"""Reconstruction quality check."""

import torch
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / 'backend'))

from network.model import RhizomeAutoencoder
from network.training import load_checkpoint
from data.loader import get_mnist_loaders


def test_reconstruction():
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = RhizomeAutoencoder()

    checkpoint_path = Path('./backend/checkpoints/rhizome_autoencoder_latest.pth')
    load_checkpoint(model, checkpoint_path, device=device)

    model.eval()

    _, test_loader = get_mnist_loaders(batch_size=10)
    images, labels = next(iter(test_loader))
    images = images.view(images.size(0), -1).to(device)

    with torch.no_grad():
        reconstructed = model(images)
        mse = torch.mean((images - reconstructed) ** 2)

    if mse.item() < 0.01:
        verdict = "excellent"
    elif mse.item() < 0.02:
        verdict = "good"
    else:
        verdict = "needs improvement"

    print(f"mse={mse.item():.6f} verdict={verdict} labels={labels.tolist()}")


if __name__ == "__main__":
    test_reconstruction()
