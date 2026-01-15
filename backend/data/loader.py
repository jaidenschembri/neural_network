"""MNIST data loading utilities."""

import torch
from torchvision import datasets, transforms
from torch.utils.data import DataLoader


def get_mnist_loaders(batch_size=64, data_dir='./data/mnist'):
    transform = transforms.Compose([
        transforms.ToTensor(),
    ])

    train_dataset = datasets.MNIST(
        root=data_dir,
        train=True,
        download=True,
        transform=transform
    )

    test_dataset = datasets.MNIST(
        root=data_dir,
        train=False,
        download=True,
        transform=transform
    )

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=2,
        pin_memory=True
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=2,
        pin_memory=True
    )

    return train_loader, test_loader


class StreamingMNIST:
    def __init__(self, data_loader):
        self.data_loader = data_loader
        self.iterator = iter(data_loader)

    def get_batch(self):
        try:
            images, labels = next(self.iterator)
        except StopIteration:
            self.iterator = iter(self.data_loader)
            images, labels = next(self.iterator)

        flat_images = images.view(images.size(0), -1)

        return flat_images, labels

    def get_single(self):
        images, labels = self.get_batch()
        return images[0], labels[0]
