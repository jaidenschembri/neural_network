import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY
} from 'd3-force-3d';

const LAYER_ORDER = [
  'encoder.0',
  'encoder.2',
  'encoder.4',
  'encoder.6',
  'decoder.0',
  'decoder.2',
  'decoder.4',
  'decoder.6'
];

export class NetworkGraph {
  constructor() {
    this.nodes = [];
    this.links = [];
    this.nodeMap = new Map();
    this.linkMap = new Map();
    this.simulation = null;
    this.simulationStable = false;
  }

  loadTopology(topology) {
    console.log('Loading topology...', topology.metadata);

    const layerCount = LAYER_ORDER.length;
    const layerOffset = (layerCount - 1) / 2;
    const layerSpacing = 140;

    this.nodes = topology.nodes.map((node) => ({
      id: node.id,
      layer: node.layer,
      index: node.index,
      layerIndex: Math.max(0, LAYER_ORDER.indexOf(node.layer)),
      x: 0,
      y: 0,
      layerX: 0,
      vx: 0,
      vy: 0,
      activation: 0
    })).map((node) => {
      const layerIndex = Number.isFinite(node.layerIndex) ? node.layerIndex : 0;
      const layerX = (layerIndex - layerOffset) * layerSpacing;
      node.layerX = layerX;
      node.x = layerX + (Math.random() - 0.5) * 60;
      node.y = (Math.random() - 0.5) * 360;
      return node;
    });

    this.nodes.forEach(node => {
      this.nodeMap.set(node.id, node);
    });

    const maxLinks = 50000;
    const linkStep = Math.ceil(topology.connections.length / maxLinks);

    this.links = [];
    for (let i = 0; i < topology.connections.length; i += linkStep) {
      const conn = topology.connections[i];
      const source = this.nodeMap.get(conn.source);
      const target = this.nodeMap.get(conn.target);

      if (source && target) {
        const link = {
          source: source,
          target: target,
          weight: Math.abs(conn.weight),
          pulseIntensity: 0 // For connection pulse effect
        };
        this.links.push(link);
        const key = `${conn.source}-${conn.target}`;
        this.linkMap.set(key, link);
      }
    }

    console.log(`✓ Loaded ${this.nodes.length} nodes, ${this.links.length} links`);

    this.initializeForces();
  }

  initializeForces() {
    console.log('Initializing force simulation...');

    this.simulation = forceSimulation(this.nodes, 2)
      .alpha(1)
      .alphaDecay(0.02)
      .alphaMin(0.001)
      .velocityDecay(0.4)
      .force('link', forceLink(this.links)
        .id(d => d.id)
        .distance(link => 18 + (1 - link.weight) * 32)
        .strength(link => link.weight * 0.85)
      )
      .force('charge', forceManyBody()
        .strength(-90)
        .distanceMax(220)
      )
      .force('center', forceCenter(0, 0, 0)
        .strength(0.25)
      )
      .force('x', forceX(node => node.layerX).strength(0.08))
      .force('y', forceY(0).strength(0.06))
      .force('collide', forceCollide()
        .radius(5)
        .strength(0.7)
      )
      .on('end', () => {
        this.simulationStable = true;
        console.log('✓ Force simulation stabilized (pausing physics)');
      });

    console.log('✓ Force simulation initialized');
  }

  reheat(alpha = 0.3) {
    if (this.simulation) {
      this.simulationStable = false;
      this.simulation.alpha(alpha).restart();
      console.log(`Force simulation reheated (alpha=${alpha})`);
    }
  }

  tick() {
    if (this.simulation && !this.simulationStable) {
      this.simulation.tick();
    }
  }

  updateActivations(activationFrame) {
    const activations = activationFrame.activations;

    for (const [nodeId, value] of Object.entries(activations)) {
      const node = this.nodeMap.get(nodeId);
      if (node) {
        node.activation = value;
      }
    }
  }

  computeFlowData() {
    const flows = [];

    for (const link of this.links) {
      const sourceActivation = link.source.activation || 0;
      const targetActivation = link.target.activation || 0;

      const flowMagnitude = ((sourceActivation + targetActivation) / 2) * link.weight;

      if (flowMagnitude > 0.02) {
        flows.push({
          link: link,
          magnitude: flowMagnitude,
          source: link.source,
          target: link.target
        });
      }
    }

    return flows;
  }

  getNodes() {
    return this.nodes;
  }

  getLinks() {
    return this.links;
  }

  getNode(id) {
    return this.nodeMap.get(id);
  }

  triggerLinkPulse(sourceId, targetId, intensity = 1.0) {
    const key = `${sourceId}-${targetId}`;
    const link = this.linkMap.get(key);
    if (link) {
      link.pulseIntensity = Math.min(1.0, (link.pulseIntensity || 0) + intensity);
    }
  }

  updateLinkPulses() {
    const decayRate = 0.92;

    for (const link of this.links) {
      if (link.pulseIntensity > 0.01) {
        link.pulseIntensity *= decayRate;
      } else {
        link.pulseIntensity = 0;
      }
    }
  }
}
