export class Particle {
  constructor() {
    this.active = false;
    this.position = { x: 0, y: 0 };
    this.sourceNode = null;
    this.targetNode = null;
    this.path = null;
    this.progress = 0;
    this.speed = 0.02;
    this.life = 0;
    this.maxLife = 1.0;
    this.size = 1.0;
  }

  activate(sourceNode, targetNode, path) {
    this.active = true;
    this.sourceNode = sourceNode;
    this.targetNode = targetNode;
    this.path = path;
    this.progress = 0;
    this.life = this.maxLife;
    this.speed = 0.015 + Math.random() * 0.015;
    this.size = 0.8 + Math.random() * 0.6;

    this.position.x = sourceNode.x;
    this.position.y = sourceNode.y;
  }

  deactivate() {
    this.active = false;
    this.sourceNode = null;
    this.targetNode = null;
    this.path = null;
    this.progress = 0;
    this.life = 0;
  }

  update(speedMultiplier = 1.0) {
    if (!this.active) return false;

    this.progress += this.speed * speedMultiplier;

    if (this.progress >= 1.0) {
      return true;
    }

    if (this.path) {
      this.path.getPointAt(this.progress, this.position);
    }

    this.life -= 0.01 * speedMultiplier;
    if (this.life <= 0) {
      this.deactivate();
      return false;
    }

    return false;
  }
}

export class ParticlePool {
  constructor(size = 2000) {
    this.size = size;
    this.particles = [];
    this.activeCount = 0;

    for (let i = 0; i < size; i++) {
      this.particles.push(new Particle());
    }

    console.log(`✓ Particle pool created (${size} particles)`);
  }

  spawn(sourceNode, targetNode, path) {
    for (let i = 0; i < this.size; i++) {
      const particle = this.particles[i];
      if (!particle.active) {
        particle.activate(sourceNode, targetNode, path);
        this.activeCount++;
        return particle;
      }
    }

    return null;
  }

  update(speedMultiplier = 1.0) {
    const arrivals = [];

    for (let i = 0; i < this.size; i++) {
      const particle = this.particles[i];
      if (particle.active) {
        const arrived = particle.update(speedMultiplier);
        if (arrived) {
          arrivals.push({
            particle: particle,
            targetNode: particle.targetNode
          });
          particle.deactivate();
          this.activeCount--;
        }
      }
    }

    return arrivals;
  }

  getActiveParticles() {
    return this.particles.filter(p => p.active);
  }

  getActiveCount() {
    return this.activeCount;
  }
}

export function generateBezierPath(sourceNode, targetNode) {
  const sx = sourceNode.x;
  const sy = sourceNode.y;
  const tx = targetNode.x;
  const ty = targetNode.y;

  const mx = (sx + tx) * 0.5;
  const my = (sy + ty) * 0.5;

  const dx = tx - sx;
  const dy = ty - sy;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const curve = (Math.random() - 0.5) * Math.min(80, length * 0.4);

  const cx = mx + nx * curve;
  const cy = my + ny * curve;

  return {
    sx,
    sy,
    cx,
    cy,
    tx,
    ty,
    getPointAt(t, out) {
      const u = 1 - t;
      out.x = u * u * sx + 2 * u * t * cx + t * t * tx;
      out.y = u * u * sy + 2 * u * t * cy + t * t * ty;
    }
  };
}

export class PathCache {
  constructor() {
    this.cache = new Map();
  }

  getPath(sourceId, targetId, sourceNode, targetNode) {
    const key = `${sourceId}-${targetId}`;

    if (!this.cache.has(key)) {
      const path = generateBezierPath(sourceNode, targetNode);
      this.cache.set(key, path);
    }

    return this.cache.get(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}
