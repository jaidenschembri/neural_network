"""Serialization helpers for WebSocket streaming."""

import orjson
from typing import Dict, Any
import torch
import torch.nn as nn


def serialize_topology(model: nn.Module) -> Dict[str, Any]:
    nodes = []
    connections = []
    node_id = 0
    layer_info: Dict[str, Dict[str, Any]] = {}

    linear_layers = [
        (layer_name, module)
        for layer_name, module in model.named_modules()
        if isinstance(module, nn.Linear)
    ]

    for layer_name, module in linear_layers:
        layer_nodes = []
        for i in range(module.out_features):
            nodes.append({
                "id": f"node_{node_id}",
                "layer": layer_name,
                "index": i
            })
            layer_nodes.append(node_id)
            node_id += 1

        layer_info[layer_name] = {
            "nodes": layer_nodes,
            "weights": module.weight.detach().cpu().numpy().tolist()
        }

    layer_names = sorted(name for name, _ in linear_layers)

    for source_layer, target_layer in zip(layer_names, layer_names[1:]):
        source_nodes = layer_info[source_layer]["nodes"]
        target_nodes = layer_info[target_layer]["nodes"]
        weights = layer_info[target_layer]["weights"]

        for target_idx, target_node in enumerate(target_nodes):
            for source_idx, source_node in enumerate(source_nodes):
                weight = weights[target_idx][source_idx]
                if abs(weight) > 0.1:
                    connections.append({
                        "source": f"node_{source_node}",
                        "target": f"node_{target_node}",
                        "weight": float(weight)
                    })

    topology = {
        "type": "topology",
        "nodes": nodes,
        "connections": connections,
        "metadata": {
            "total_nodes": len(nodes),
            "total_connections": len(connections),
            "layers": len(layer_names)
        }
    }

    return topology


def serialize_activations(activations: Dict[str, torch.Tensor], timestamp: float, batch_idx: int = 0) -> Dict[str, Any]:
    node_activations = {}
    node_id = 0

    for layer_name in sorted(activations.keys()):
        act_tensor = activations[layer_name][batch_idx]

        if len(act_tensor.shape) > 0:
            values = act_tensor.cpu().numpy().tolist()
        else:
            values = [act_tensor.cpu().item()]

        for value in values:
            node_activations[f"node_{node_id}"] = float(value)
            node_id += 1

    activation_frame = {
        "type": "activation",
        "timestamp": timestamp,
        "activations": node_activations
    }

    return activation_frame


def serialize_to_json(data: Dict[str, Any]) -> bytes:
    return orjson.dumps(data)
