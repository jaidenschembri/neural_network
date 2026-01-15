"""Activation capture helpers for forward passes."""

import torch
import torch.nn as nn
from typing import Dict


class ActivationCapture:
    def __init__(self, model: nn.Module):
        self.model = model
        self.activations: Dict[str, torch.Tensor] = {}
        self.hooks = []
        self._register_hooks()

    def _register_hooks(self):
        def get_activation(name):
            def hook(module, input, output):
                self.activations[name] = output.detach()
            return hook

        for name, module in self.model.named_modules():
            if isinstance(module, nn.Linear):
                hook = module.register_forward_hook(get_activation(name))
                self.hooks.append(hook)

    def clear_activations(self):
        self.activations.clear()

    def get_activations(self, normalize=True) -> Dict[str, torch.Tensor]:
        if normalize:
            return self._normalize_activations(self.activations)
        return self.activations.copy()

    def _normalize_activations(self, activations: Dict[str, torch.Tensor]) -> Dict[str, torch.Tensor]:
        normalized = {}
        for name, activation in activations.items():
            act = torch.relu(activation)

            max_val = act.max()
            if max_val > 0:
                normalized[name] = act / max_val
            else:
                normalized[name] = act

        return normalized

    def remove_hooks(self):
        for hook in self.hooks:
            hook.remove()
        self.hooks.clear()

    def __del__(self):
        self.remove_hooks()
