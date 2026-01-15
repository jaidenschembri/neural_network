export class NetworkScene {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    this.nodes = [];
    this.links = [];
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.autoCenter = true;
    this.minZoom = 0.35;
    this.maxZoom = 6.0;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.cameraStart = { x: 0, y: 0 };
    this.pixelRatio = window.devicePixelRatio || 1;
    this.width = 0;
    this.height = 0;
    this.accentColor = { r: 239, g: 108, b: 77 };
    this.hoveredNodeId = null;
    this.focusedNodeId = null;
    this.neighborMap = new Map();
    this.isolationSet = null;
    this.selection = { active: false, start: null, end: null };
    this.pointerDown = null;
    this.clickThreshold = 4;
    this.isolateMode = false;
    this.performance = { fps: 60 };
    this.linkDensity = 1;
    this.nodeScale = 1;
    this.backgroundOpacity = 0;
    this.backgroundColor = { r: 244, g: 242, b: 237 };
    this.renderStats = { links: 0, nodes: 0, particles: 0 };

    this.initialize();
  }

  initialize() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'network-canvas';
    this.canvas.style.touchAction = 'none';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.resize();
    this.setupInput();
    this.setupKeyboard();
    window.addEventListener('resize', () => this.onWindowResize());

    console.log('✓ 2D canvas scene initialized');
  }

  setupInput() {
    this.onPointerDown = (event) => {
      const point = this.getCanvasPoint(event);
      this.pointerDown = point;
      if (event.shiftKey || this.isolateMode) {
        this.selection.active = true;
        this.selection.start = point;
        this.selection.end = point;
        this.isDragging = false;
      } else {
        this.isDragging = true;
        this.dragStart = point;
        this.cameraStart = { x: this.camera.x, y: this.camera.y };
      }
      this.canvas.setPointerCapture(event.pointerId);
    };

    this.onPointerMove = (event) => {
      const point = this.getCanvasPoint(event);
      if (this.selection.active) {
        this.selection.end = point;
        return;
      }
      if (this.isDragging) {
        const dx = (point.x - this.dragStart.x) / this.camera.zoom;
        const dy = (point.y - this.dragStart.y) / this.camera.zoom;
        this.camera.x = this.cameraStart.x - dx;
        this.camera.y = this.cameraStart.y - dy;
        return;
      }
      this.updateHover(point);
    };

    this.onPointerUp = (event) => {
      const point = this.getCanvasPoint(event);
      if (this.selection.active) {
        this.finishSelection();
      } else {
        this.handleClick(point);
      }
      this.isDragging = false;
      this.pointerDown = null;
      if (this.canvas.hasPointerCapture && this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    };

    this.onPointerLeave = () => {
      if (!this.selection.active) {
        this.hoveredNodeId = null;
      }
    };

    this.onDoubleClick = () => {
      this.focusedNodeId = null;
      this.isolationSet = null;
    };

    this.onWheel = (event) => {
      event.preventDefault();
      const point = this.getCanvasPoint(event);
      const zoomFactor = Math.exp(-event.deltaY * 0.0012);
      this.zoomAt(point.x, point.y, zoomFactor);
    };

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this.onDoubleClick);
  }

  setupKeyboard() {
    this.onKeyDown = (event) => {
      if (event.key === 'Shift') {
        this.isolateMode = true;
      }
      if (event.key === 'Escape') {
        this.focusedNodeId = null;
        this.isolationSet = null;
      }
    };

    this.onKeyUp = (event) => {
      if (event.key === 'Shift') {
        this.isolateMode = false;
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  getCanvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  screenToWorld(point) {
    return {
      x: (point.x - this.width / 2) / this.camera.zoom + this.camera.x,
      y: (point.y - this.height / 2) / this.camera.zoom + this.camera.y
    };
  }

  updateHover(point) {
    const world = this.screenToWorld(point);
    const hit = this.pickNode(world);
    this.hoveredNodeId = hit ? hit.id : null;
  }

  pickNode(worldPoint) {
    if (!this.nodes.length) return null;
    let best = null;
    let bestDist = Infinity;
    const hitPadding = 8 / this.camera.zoom;
    const visibleSet = this.isolationSet && this.isolationSet.size > 0 ? this.isolationSet : null;

    for (const node of this.nodes) {
      if (visibleSet && !visibleSet.has(node.id)) continue;
      const dx = worldPoint.x - node.x;
      const dy = worldPoint.y - node.y;
      const radius = (node.baseRadius || 2) + hitPadding;
      const dist = dx * dx + dy * dy;
      if (dist <= radius * radius && dist < bestDist) {
        best = node;
        bestDist = dist;
      }
    }

    return best;
  }

  handleClick(point) {
    if (!this.pointerDown) return;
    const dist = Math.hypot(point.x - this.pointerDown.x, point.y - this.pointerDown.y);
    if (dist > this.clickThreshold) return;

    this.updateHover(point);
    if (this.hoveredNodeId) {
      this.focusedNodeId = this.focusedNodeId === this.hoveredNodeId ? null : this.hoveredNodeId;
    } else {
      this.focusedNodeId = null;
    }
  }

  finishSelection() {
    if (!this.selection.start || !this.selection.end) {
      this.selection.active = false;
      return;
    }

    const start = this.screenToWorld(this.selection.start);
    const end = this.screenToWorld(this.selection.end);
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    const selected = new Set();
    for (const node of this.nodes) {
      if (node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY) {
        selected.add(node.id);
      }
    }

    this.isolationSet = selected.size > 0 ? selected : null;
    if (this.focusedNodeId && this.isolationSet && !this.isolationSet.has(this.focusedNodeId)) {
      this.focusedNodeId = null;
    }
    if (this.isolationSet && this.isolationSet.size === 0) {
      this.isolationSet = null;
    }
    this.selection.active = false;
    this.selection.start = null;
    this.selection.end = null;
  }

  zoomAt(screenX, screenY, zoomFactor) {
    const zoom = this.camera.zoom;
    const newZoom = this.clamp(zoom * zoomFactor, this.minZoom, this.maxZoom);

    const worldX = (screenX - this.width / 2) / zoom + this.camera.x;
    const worldY = (screenY - this.height / 2) / zoom + this.camera.y;

    this.camera.zoom = newZoom;
    this.camera.x = worldX - (screenX - this.width / 2) / newZoom;
    this.camera.y = worldY - (screenY - this.height / 2) / newZoom;
  }

  setAutoCenter(enabled) {
    this.autoCenter = enabled;
  }

  setPerformance(fps) {
    if (Number.isFinite(fps) && fps > 0) {
      this.performance.fps = fps;
    }
  }

  setLinkDensity(value) {
    if (Number.isFinite(value)) {
      this.linkDensity = this.clamp(value, 0.2, 1.5);
    }
  }

  setNodeScale(value) {
    if (Number.isFinite(value)) {
      this.nodeScale = this.clamp(value, 0.6, 2.5);
    }
  }

  setBackgroundOpacity(value) {
    if (Number.isFinite(value)) {
      this.backgroundOpacity = this.clamp(value, 0, 0.8);
    }
  }

  getRenderStats() {
    return { ...this.renderStats };
  }

  getViewState() {
    return {
      width: this.width,
      height: this.height,
      pixelRatio: this.pixelRatio,
      zoom: this.camera.zoom,
      autoCenter: this.autoCenter
    };
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Get color for node based on layer
   * Creates subtle gradient across network layers
   */
  getLayerColor(layerName, layerIndex) {
    const layerMap = {
      'encoder.0': 0,
      'encoder.2': 1,
      'encoder.4': 2,
      'encoder.6': 3,
      'decoder.0': 4,
      'decoder.2': 5,
      'decoder.4': 6,
      'decoder.6': 7
    };

    const index = Number.isFinite(layerIndex) ? layerIndex : (layerMap[layerName] || 0);
    const totalLayers = 8;

    const hueStart = 185;
    const hueEnd = 35;
    const hue = hueStart + (hueEnd - hueStart) * (index / (totalLayers - 1));

    return this.hslToRgb(hue / 360, 0.45, 0.42);
  }

  hslToRgb(h, s, l) {
    if (s === 0) {
      const gray = Math.round(l * 255);
      return { r: gray, g: gray, b: gray };
    }

    const hue2rgb = (p, q, t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    return {
      r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      g: Math.round(hue2rgb(p, q, h) * 255),
      b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
    };
  }

  mixColor(base, accent, intensity) {
    const t = this.clamp(intensity, 0, 1);
    return {
      r: Math.round(base.r + (accent.r - base.r) * t),
      g: Math.round(base.g + (accent.g - base.g) * t),
      b: Math.round(base.b + (accent.b - base.b) * t)
    };
  }

  createNodes(nodes) {
    console.log(`Creating ${nodes.length} nodes...`);

    this.nodes = nodes;
    this.nodes.forEach((node) => {
      node.baseColor = this.getLayerColor(node.layer, node.layerIndex);
      node.baseRadius = 2.1 + (node.layerIndex || 0) * 0.15;
    });

    this.fitToView();
    console.log(`✓ Created ${this.nodes.length} nodes`);
  }

  createLinks(links) {
    console.log(`Creating ${links.length} links...`);
    this.links = links;
    this.neighborMap.clear();
    for (const link of this.links) {
      this.addNeighbor(link.source.id, link.target.id);
      this.addNeighbor(link.target.id, link.source.id);
    }
    console.log(`✓ Created ${this.links.length} links`);
  }

  addNeighbor(sourceId, targetId) {
    if (!this.neighborMap.has(sourceId)) {
      this.neighborMap.set(sourceId, new Set());
    }
    this.neighborMap.get(sourceId).add(targetId);
  }

  updateLinkPulses(links) {
    this.links = links;
  }

  updatePositions(nodes) {
    this.nodes = nodes;
  }

  updateActivations(nodes) {
    this.nodes = nodes;
    this.nodes.forEach((node) => {
      if (node.pulseIntensity && node.pulseIntensity > 0) {
        node.pulseIntensity *= 0.92;
        if (node.pulseIntensity < 0.01) {
          node.pulseIntensity = 0;
        }
      }
    });
  }

  pulseNode(node, intensity = 2.0) {
    if (!node.pulseIntensity) {
      node.pulseIntensity = 0;
    }
    node.pulseIntensity = Math.max(node.pulseIntensity, intensity);
  }

  updateCamera() {
    if (!this.autoCenter || this.isDragging || this.selection.active || this.nodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    this.nodes.forEach((node) => {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    if (Number.isFinite(centerX)) {
      this.camera.x += (centerX - this.camera.x) * 0.04;
      this.camera.y += (centerY - this.camera.y) * 0.04;
    }
  }

  fitToView() {
    if (this.nodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    this.nodes.forEach((node) => {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    const padding = 140;
    const width = Math.max(1, maxX - minX + padding);
    const height = Math.max(1, maxY - minY + padding);

    const zoomX = this.width / width;
    const zoomY = this.height / height;
    const targetZoom = Math.min(zoomX, zoomY) * 0.9;

    this.camera.zoom = this.clamp(targetZoom, this.minZoom, this.maxZoom);
  }

  render(activeParticles = []) {
    if (!this.ctx) return;

    this.updateCamera();
    const focusState = this.getFocusState();
    const densityFactor = this.getDensityFactor();

    const ctx = this.ctx;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (this.backgroundOpacity > 0) {
      ctx.fillStyle = `rgba(${this.backgroundColor.r}, ${this.backgroundColor.g}, ${this.backgroundColor.b}, ${this.backgroundOpacity.toFixed(3)})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    this.renderStats = { links: 0, nodes: 0, particles: 0 };
    this.drawLinks(ctx, focusState, densityFactor);
    this.drawLinkPulses(ctx, focusState);
    this.drawParticles(ctx, activeParticles, focusState, densityFactor);
    this.drawNodes(ctx, focusState, densityFactor);
    this.drawSelectionOverlay(ctx);
  }

  getDensityFactor() {
    const fps = this.performance.fps || 60;
    const fpsFactor = this.clamp(fps / 60, 0.35, 1.2);
    const zoomFactor = this.clamp(this.camera.zoom / 1.1, 0.4, 1.6);
    return this.clamp(fpsFactor * zoomFactor, 0.2, 1.6);
  }

  getFocusState() {
    const activeId = this.focusedNodeId || this.hoveredNodeId;
    if (!activeId) {
      return { activeId: null, focusIds: null };
    }
    const neighbors = this.neighborMap.get(activeId) || new Set();
    const focusIds = new Set(neighbors);
    focusIds.add(activeId);
    return { activeId, focusIds };
  }

  drawLinks(ctx, focusState, densityFactor) {
    if (!this.links.length) return;

    const focusIds = focusState.focusIds;
    const hasFocus = Boolean(focusIds);
    const isolateIds = this.isolationSet;
    const hasIsolation = isolateIds && isolateIds.size > 0;
    const linkFactor = this.clamp(densityFactor * this.linkDensity, 0.2, 1.6);
    let stride = Math.max(1, Math.round(1 / linkFactor));
    if (hasFocus || hasIsolation) {
      stride = 1;
    }

    ctx.save();
    for (let i = 0; i < this.links.length; i += stride) {
      const link = this.links[i];
      const sourceId = link.source.id;
      const targetId = link.target.id;
      const inIsolation = !hasIsolation || (isolateIds.has(sourceId) && isolateIds.has(targetId));
      const inFocus = hasFocus && focusIds.has(sourceId) && focusIds.has(targetId);
      let alpha = 0.25;

      if (!inIsolation) {
        alpha = 0.04;
      }
      if (hasFocus) {
        alpha = inFocus ? 0.55 : alpha * 0.35;
      }
      if (alpha < 0.01) return;

      ctx.strokeStyle = inFocus
        ? `rgb(${this.accentColor.r}, ${this.accentColor.g}, ${this.accentColor.b})`
        : '#2b5a57';
      ctx.globalAlpha = alpha;
      ctx.lineWidth = (inFocus ? 1.6 : 0.9) / this.camera.zoom;
      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
      ctx.stroke();
      this.renderStats.links += 1;
    }
    ctx.restore();
  }

  drawLinkPulses(ctx, focusState) {
    const focusIds = focusState.focusIds;
    const hasFocus = Boolean(focusIds);
    const isolateIds = this.isolationSet;
    const hasIsolation = isolateIds && isolateIds.size > 0;

    ctx.save();
    ctx.lineCap = 'round';
    this.links.forEach((link) => {
      const intensity = link.pulseIntensity || 0;
      if (intensity < 0.05) return;
      const sourceId = link.source.id;
      const targetId = link.target.id;
      if (hasIsolation && !(isolateIds.has(sourceId) && isolateIds.has(targetId))) return;
      if (hasFocus && !(focusIds.has(sourceId) && focusIds.has(targetId))) return;
      const alpha = 0.2 + intensity * 0.6;
      ctx.strokeStyle = `rgba(${this.accentColor.r}, ${this.accentColor.g}, ${this.accentColor.b}, ${alpha.toFixed(3)})`;
      ctx.lineWidth = (1.2 + intensity * 2.4) / this.camera.zoom;
      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
      ctx.stroke();
    });
    ctx.restore();
  }

  drawParticles(ctx, particles, focusState, densityFactor) {
    if (!particles || particles.length === 0) return;

    const focusIds = focusState.focusIds;
    const hasFocus = Boolean(focusIds);
    const isolateIds = this.isolationSet;
    const hasIsolation = isolateIds && isolateIds.size > 0;
    const stride = Math.max(1, Math.round(1 / densityFactor));

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < particles.length; i += stride) {
      const particle = particles[i];
      const sourceId = particle.sourceNode?.id;
      const targetId = particle.targetNode?.id;
      if (hasIsolation && (!isolateIds.has(sourceId) || !isolateIds.has(targetId))) continue;
      if (hasFocus && (!focusIds.has(sourceId) || !focusIds.has(targetId))) continue;

      const alpha = Math.min(1, particle.life);
      const radius = particle.size * 1.4;

      ctx.fillStyle = `rgba(${this.accentColor.r}, ${this.accentColor.g}, ${this.accentColor.b}, ${0.6 + alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(particle.position.x, particle.position.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 245, 238, ${0.2 + alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(particle.position.x, particle.position.y, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      this.renderStats.particles += 1;
    }

    ctx.restore();
  }

  drawNodes(ctx, focusState, densityFactor) {
    if (!this.nodes.length) return;

    const activeId = focusState.activeId;
    const focusIds = focusState.focusIds;
    const hasFocus = Boolean(focusIds);
    const isolateIds = this.isolationSet;
    const hasIsolation = isolateIds && isolateIds.size > 0;
    let stride = Math.max(1, Math.round(1 / densityFactor));
    if (hasFocus || hasIsolation || this.camera.zoom > 1.4) {
      stride = 1;
    }

    ctx.save();

    for (let i = 0; i < this.nodes.length; i += stride) {
      const node = this.nodes[i];
      const isFocused = activeId && node.id === activeId;
      const isNeighbor = hasFocus && focusIds.has(node.id);
      const isIsolated = !hasIsolation || isolateIds.has(node.id);
      const activation = node.activation || 0;
      const pulse = node.pulseIntensity || 0;
      let intensity = this.clamp(activation * 0.9 + pulse * 0.5, 0, 1);
      if (isNeighbor) {
        intensity = this.clamp(intensity + 0.2, 0, 1);
      }
      if (isFocused) {
        intensity = this.clamp(intensity + 0.35, 0, 1);
      }
      const color = this.mixColor(node.baseColor, this.accentColor, intensity);
      const radius = ((node.baseRadius || 2) + intensity * 1.2 + (isFocused ? 1.2 : isNeighbor ? 0.4 : 0)) * this.nodeScale;
      let alpha = isIsolated ? 1 : 0.12;
      if (hasFocus && !isNeighbor && !isFocused) {
        alpha *= 0.35;
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (isFocused || isNeighbor) {
        ctx.lineWidth = (isFocused ? 1.8 : 1.0) / this.camera.zoom;
        ctx.strokeStyle = isFocused
          ? `rgb(${this.accentColor.r}, ${this.accentColor.g}, ${this.accentColor.b})`
          : 'rgb(16, 37, 36)';
        ctx.stroke();
      } else if (intensity > 0.12) {
        ctx.lineWidth = 0.6 / this.camera.zoom;
        ctx.strokeStyle = 'rgb(16, 37, 36)';
        ctx.stroke();
      }
      this.renderStats.nodes += 1;
    }

    ctx.restore();
  }

  drawSelectionOverlay(ctx) {
    if (!this.selection.active || !this.selection.start || !this.selection.end) return;
    const start = this.selection.start;
    const end = this.selection.end;
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    ctx.save();
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.fillStyle = 'rgba(47, 127, 120, 0.12)';
    ctx.strokeStyle = 'rgba(47, 127, 120, 0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }

  onWindowResize() {
    this.resize();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.pixelRatio = window.devicePixelRatio || 1;

    this.canvas.width = Math.max(1, Math.floor(this.width * this.pixelRatio));
    this.canvas.height = Math.max(1, Math.floor(this.height * this.pixelRatio));
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  dispose() {
    if (!this.canvas) return;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('dblclick', this.onDoubleClick);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
