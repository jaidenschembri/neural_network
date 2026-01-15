import { NetworkWebSocket } from './connection/websocket.js';
import { NetworkGraph } from './visualization/network.js';
import { NetworkScene } from './visualization/scene.js';
import { ParticlePool, PathCache } from './visualization/particles.js';
import { WS_URL } from './config.js';

class RhizomeVisualization {
  constructor() {
    this.ws = null;
    this.graph = null;
    this.scene = null;
    this.particlePool = null;
    this.pathCache = null;
    this.frameCount = 0;
    this.fps = 0;
    this.fpsUpdateTime = performance.now();
    this.frameTimes = [];
    this.maxFrameTimeSamples = 60;
    this.performanceLogInterval = 5000;
    this.lastPerformanceLog = performance.now();
    this.paused = false;
    this.animationSpeed = 1.0;
    this.flowDensity = 0.5;
    this.tickAccumulator = 0;
    this.viewState = null;
    this.targetFps = 60;
    this.autoPaused = false;
    this.pauseButton = null;

    this.initialize();
  }

  initialize() {
    console.log('='.repeat(70));
    console.log('Rhizome Network Visualization');
    console.log('='.repeat(70));

    this.graph = new NetworkGraph();
    this.ws = new NetworkWebSocket(WS_URL);
    this.ws.onConnected = () => {
      this.updateStatus('connected', 'Connected');
      this.hideLoading();
      if (this.autoPaused) {
        this.setPaused(false, true);
      }
    };

    this.ws.onDisconnected = () => {
      this.updateStatus('disconnected', 'Disconnected');
      if (!this.paused) {
        this.setPaused(true, true);
      }
    };

    this.ws.onReconnecting = (attempt, maxAttempts) => {
      this.updateStatus('reconnecting', `Reconnecting ${attempt}/${maxAttempts}`);
    };

    this.ws.onTopologyReceived = (topology) => {
      this.handleTopology(topology);
    };

    this.ws.onActivationFrame = (frame) => {
      this.handleActivationFrame(frame);
    };

    this.ws.onError = (error) => {
      console.error('WebSocket error:', error);
      this.updateStatus('disconnected', 'Error: ' + error.message);
    };

    const wsUrlEl = document.getElementById('ws-url');
    if (wsUrlEl) {
      wsUrlEl.textContent = this.ws.url;
    }

    this.ws.connect();
  }

  handleTopology(topology) {
    console.log('Handling topology...');

    this.graph.loadTopology(topology);

    const container = document.getElementById('canvas-container');
    if (this.scene) {
      this.scene.dispose();
      container.replaceChildren();
    }
    this.scene = new NetworkScene(container);

    const nodes = this.graph.getNodes();
    const links = this.graph.getLinks();

    this.scene.createNodes(nodes);
    this.scene.createLinks(links);

    this.particlePool = new ParticlePool(2000);
    this.pathCache = new PathCache();

    console.log('✓ Particle system initialized');

    document.getElementById('node-count').textContent = topology.metadata.total_nodes;
    document.getElementById('connection-count').textContent = topology.metadata.total_connections;

    console.log('✓ Topology loaded and visualized');

    this.setupUIControls();

    this.animate();
  }

  handleActivationFrame(frame) {
    this.graph.updateActivations(frame);

    this.spawnParticles();

    document.getElementById('frame-count').textContent = frame.frame;
    document.getElementById('current-label').textContent = frame.label;

    this.frameCount++;
  }

  spawnParticles() {
    if (!this.particlePool || !this.pathCache) return;

    const flows = this.graph.computeFlowData();

    const performanceFactor = this.getPerformanceFactor();
    const spawnRate = (0.2 + this.flowDensity * 0.8) * performanceFactor;
    const flowThreshold = 0.08 + (1 - this.flowDensity) * 0.2 + (1 - performanceFactor) * 0.08;
    const maxSpawns = Math.round(120 * performanceFactor);
    let spawned = 0;

    for (const flow of flows) {
      const chance = Math.min(1, flow.magnitude * spawnRate);
      if (flow.magnitude > flowThreshold && Math.random() < chance) {
        const path = this.pathCache.getPath(
          flow.source.id,
          flow.target.id,
          flow.source,
          flow.target
        );

        this.particlePool.spawn(flow.source, flow.target, path);
        const pulseIntensity = flow.magnitude * (0.6 + this.flowDensity * 1.6);
        this.graph.triggerLinkPulse(flow.source.id, flow.target.id, pulseIntensity);
        spawned += 1;
        if (spawned >= maxSpawns) break;
      }
    }
  }

  getPerformanceFactor() {
    const fps = this.fps > 0 ? this.fps : this.targetFps;
    const fpsFactor = this.clamp(fps / this.targetFps, 0.3, 1);
    const zoomFactor = this.viewState ? this.clamp(this.viewState.zoom / 1.1, 0.4, 1.6) : 1;
    return this.clamp(fpsFactor * zoomFactor, 0.2, 1.6);
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  setupUIControls() {
    console.log('Setting up UI controls...');

    const pauseBtn = document.getElementById('pause-btn');
    this.pauseButton = pauseBtn;
    pauseBtn.addEventListener('click', () => {
      this.setPaused(!this.paused, false);
    });

    const autoCenterCheckbox = document.getElementById('auto-center');
    autoCenterCheckbox.addEventListener('change', (e) => {
      this.scene.setAutoCenter(e.target.checked);
      console.log(`Auto-center ${e.target.checked ? 'enabled' : 'disabled'}`);
    });
    this.scene.setAutoCenter(autoCenterCheckbox.checked);

    const flowSlider = document.getElementById('flow-slider');
    const flowValue = document.getElementById('flow-value');
    flowSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.flowDensity = value;
      flowValue.textContent = value.toFixed(2);
      console.log(`Flow density: ${value.toFixed(2)}`);
    });
    this.flowDensity = parseFloat(flowSlider.value);
    flowValue.textContent = this.flowDensity.toFixed(2);

    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    speedSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.animationSpeed = value;
      speedValue.textContent = `${value.toFixed(1)}x`;
      console.log(`Animation speed: ${value}x`);
    });
    this.animationSpeed = parseFloat(speedSlider.value);
    speedValue.textContent = `${this.animationSpeed.toFixed(1)}x`;

    const linkDensitySlider = document.getElementById('link-density');
    const linkDensityValue = document.getElementById('link-density-value');
    linkDensitySlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      linkDensityValue.textContent = value.toFixed(2);
      this.scene.setLinkDensity(value);
    });
    const linkDensity = parseFloat(linkDensitySlider.value);
    linkDensityValue.textContent = linkDensity.toFixed(2);
    this.scene.setLinkDensity(linkDensity);

    const nodeScaleSlider = document.getElementById('node-scale');
    const nodeScaleValue = document.getElementById('node-scale-value');
    nodeScaleSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      nodeScaleValue.textContent = value.toFixed(2);
      this.scene.setNodeScale(value);
    });
    const nodeScale = parseFloat(nodeScaleSlider.value);
    nodeScaleValue.textContent = nodeScale.toFixed(2);
    this.scene.setNodeScale(nodeScale);

    const backdropSlider = document.getElementById('backdrop');
    const backdropValue = document.getElementById('backdrop-value');
    backdropSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      backdropValue.textContent = value.toFixed(2);
      this.scene.setBackgroundOpacity(value);
    });
    const backdrop = parseFloat(backdropSlider.value);
    backdropValue.textContent = backdrop.toFixed(2);
    this.scene.setBackgroundOpacity(backdrop);

    console.log('✓ UI controls initialized');
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const frameStart = performance.now();
    let activeParticles = [];
    if (this.scene) {
      this.viewState = this.scene.getViewState();
    }

    // Skip simulation updates if paused, but still render
    if (!this.paused) {
      const maxTicks = 6;
      this.tickAccumulator = Math.min(this.tickAccumulator + this.animationSpeed, maxTicks);
      while (this.tickAccumulator >= 1) {
        this.graph.tick();
        this.tickAccumulator -= 1;
      }

      const nodes = this.graph.getNodes();
      this.scene.updatePositions(nodes);

      if (this.particlePool) {
        const arrivals = this.particlePool.update(this.animationSpeed);

        for (const arrival of arrivals) {
          this.scene.pulseNode(arrival.targetNode, 2.0);
        }

        activeParticles = this.particlePool.getActiveParticles();
      }

      this.scene.updateActivations(nodes);

      this.graph.updateLinkPulses();
      this.scene.updateLinkPulses(this.graph.getLinks());
    }

    if (this.particlePool && activeParticles.length === 0) {
      activeParticles = this.particlePool.getActiveParticles();
    }
    this.scene.render(activeParticles);

    const frameEnd = performance.now();
    const frameTime = frameEnd - frameStart;
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxFrameTimeSamples) {
      this.frameTimes.shift();
    }

    const now = performance.now();
    if (now - this.fpsUpdateTime > 1000) {
      this.fps = Math.round(this.frameCount / ((now - this.fpsUpdateTime) / 1000));
      document.getElementById('fps').textContent = this.fps;
      document.getElementById('particle-count').textContent = this.particlePool ? this.particlePool.getActiveCount() : 0;
      this.frameCount = 0;
      this.fpsUpdateTime = now;
      if (this.scene) {
        this.scene.setPerformance(this.fps);
        const stats = this.scene.getRenderStats();
        if (stats) {
          document.getElementById('links-drawn').textContent = stats.links.toLocaleString();
          document.getElementById('nodes-drawn').textContent = stats.nodes.toLocaleString();
          document.getElementById('particles-drawn').textContent = stats.particles.toLocaleString();
        }
      }
    }

    if (now - this.lastPerformanceLog > this.performanceLogInterval) {
      this.logPerformanceMetrics();
      this.lastPerformanceLog = now;
    }
  }

  logPerformanceMetrics() {
    if (this.frameTimes.length === 0) return;

    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const minFrameTime = Math.min(...this.frameTimes);
    const maxFrameTime = Math.max(...this.frameTimes);
    const targetFrameTime = 1000 / 60;

    const sorted = [...this.frameTimes].sort((a, b) => b - a);
    const onePercentIndex = Math.floor(sorted.length * 0.01);
    const onePercentLow = sorted[onePercentIndex];

    console.log('━'.repeat(70));
    console.log('📊 PERFORMANCE METRICS');
    console.log('━'.repeat(70));
    console.log(`FPS: ${this.fps} fps (target: 60 fps)`);
    console.log(`Frame Time (avg): ${avgFrameTime.toFixed(2)}ms (target: ${targetFrameTime.toFixed(2)}ms)`);
    console.log(`Frame Time (min): ${minFrameTime.toFixed(2)}ms`);
    console.log(`Frame Time (max): ${maxFrameTime.toFixed(2)}ms`);
    console.log(`Frame Time (1% low): ${onePercentLow.toFixed(2)}ms`);

    const nodes = this.graph ? this.graph.getNodes().length : 0;
    const links = this.graph ? this.graph.getLinks().length : 0;
    const particles = this.particlePool ? this.particlePool.getActiveCount() : 0;

    console.log(`\n📦 Scene Complexity:`);
    console.log(`  Nodes: ${nodes.toLocaleString()}`);
    console.log(`  Links: ${links.toLocaleString()}`);
    console.log(`  Active Particles: ${particles.toLocaleString()}`);
    console.log(`  Path Cache Size: ${this.pathCache ? this.pathCache.size() : 0}`);

    const performanceOK = avgFrameTime < targetFrameTime * 1.2;
    const fpsOK = this.fps >= 50;

    console.log(`\n✓ Performance Status:`);
    if (performanceOK && fpsOK) {
      console.log(`  ✅ EXCELLENT - Smooth 60 FPS rendering`);
    } else if (this.fps >= 40) {
      console.log(`  ⚠️  ACCEPTABLE - Minor frame drops (${this.fps} fps)`);
    } else {
      console.log(`  ❌ POOR - Significant performance issues (${this.fps} fps)`);
    }

    const viewState = this.scene.getViewState();
    if (viewState) {
      console.log(`\nCanvas: ${viewState.width}x${viewState.height} (dpr: ${viewState.pixelRatio.toFixed(2)})`);
      console.log(`View: zoom ${viewState.zoom.toFixed(2)} | auto-center ${viewState.autoCenter ? 'on' : 'off'}`);
    }

    console.log('━'.repeat(70));
  }

  updateStatus(className, text) {
    const statusEl = document.getElementById('status');
    statusEl.className = `status ${className}`;
    statusEl.textContent = text;
  }

  hideLoading() {
    const loadingEl = document.getElementById('loading');
    loadingEl.classList.add('hidden');
  }

  setPaused(paused, autoPaused) {
    this.paused = paused;
    this.autoPaused = autoPaused;
    if (this.pauseButton) {
      this.pauseButton.textContent = this.paused ? 'Resume' : 'Pause';
      this.pauseButton.classList.toggle('active', this.paused);
    }
  }
}

const app = new RhizomeVisualization();
