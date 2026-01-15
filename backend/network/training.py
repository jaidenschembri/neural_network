"""Training utilities for the autoencoder."""

import torch
import torch.nn as nn
import torch.optim as optim
from pathlib import Path
import time


def train_autoencoder(
    model,
    train_loader,
    test_loader,
    epochs=10,
    learning_rate=0.001,
    device='cuda',
    checkpoint_dir='./checkpoints',
    save_every=5
):
    model = model.to(device)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)

    checkpoint_path = Path(checkpoint_dir)
    checkpoint_path.mkdir(parents=True, exist_ok=True)

    history = {
        'train_loss': [],
        'test_loss': [],
        'epochs': []
    }

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()

        train_loss = train_epoch(model, train_loader, criterion, optimizer, device)
        test_loss = validate_epoch(model, test_loader, criterion, device)

        history['train_loss'].append(train_loss)
        history['test_loss'].append(test_loss)
        history['epochs'].append(epoch)

        epoch_time = time.time() - epoch_start
        print(f"Epoch {epoch:2d}/{epochs} "
              f"train={train_loss:.6f} "
              f"test={test_loss:.6f} "
              f"time={epoch_time:.2f}s")

        if epoch % save_every == 0 or epoch == epochs:
            save_checkpoint(model, optimizer, epoch, train_loss, checkpoint_path)

    return history


def train_epoch(model, train_loader, criterion, optimizer, device):
    model.train()
    total_loss = 0.0

    for images, _ in train_loader:
        images = images.view(images.size(0), -1).to(device)

        reconstructed = model(images)
        loss = criterion(reconstructed, images)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    avg_loss = total_loss / len(train_loader)
    return avg_loss


def validate_epoch(model, test_loader, criterion, device):
    model.eval()
    total_loss = 0.0

    with torch.no_grad():
        for images, _ in test_loader:
            images = images.view(images.size(0), -1).to(device)

            reconstructed = model(images)
            loss = criterion(reconstructed, images)

            total_loss += loss.item()

    avg_loss = total_loss / len(test_loader)
    return avg_loss


def save_checkpoint(model, optimizer, epoch, loss, checkpoint_dir):
    checkpoint_path = Path(checkpoint_dir)
    filename = checkpoint_path / f"rhizome_autoencoder_epoch_{epoch}.pth"

    torch.save({
        'epoch': epoch,
        'model_state_dict': model.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
        'loss': loss,
    }, filename)

    latest_path = checkpoint_path / "rhizome_autoencoder_latest.pth"
    torch.save({
        'epoch': epoch,
        'model_state_dict': model.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
        'loss': loss,
    }, latest_path)

    print(f"Checkpoint saved: {filename.name}")


def load_checkpoint(model, checkpoint_path, device='cuda'):
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=True)
    model.load_state_dict(checkpoint['model_state_dict'])
    model = model.to(device)

    print(f"Loaded checkpoint epoch {checkpoint['epoch']} loss {checkpoint['loss']:.6f}")

    return checkpoint
