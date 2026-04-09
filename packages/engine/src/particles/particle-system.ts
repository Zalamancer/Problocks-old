/**
 * 2D Particle System.
 *
 * Object-pooled, zero-allocation per-frame design.
 * Hard-capped at 500 particles per emitter for Celeron N4000.
 *
 * Rendering: each particle is a Graphics circle or a Sprite (if textureUrl provided).
 * A PixiJS Container holds all particle display objects per emitter.
 */

import {
  Container,
  Graphics,
  Sprite,
  Texture,
  BLEND_MODES,
} from 'pixi.js';
import { ParticleEmitterComponent } from './particle-component.js';
import type { ParticleConfig, RangeValue } from './types.js';

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_PARTICLES_CAP = 500;

// ── Helpers ─────────────────────────────────────────────────────────────────

function rangeRandom(r: RangeValue): number {
  return r.min + Math.random() * (r.max - r.min);
}

function hexR(c: number): number {
  return (c >> 16) & 0xff;
}
function hexG(c: number): number {
  return (c >> 8) & 0xff;
}
function hexB(c: number): number {
  return c & 0xff;
}
function rgbHex(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}
function lerpColor(a: number, b: number, t: number): number {
  const r = Math.round(hexR(a) + (hexR(b) - hexR(a)) * t);
  const g = Math.round(hexG(a) + (hexG(b) - hexG(a)) * t);
  const bl = Math.round(hexB(a) + (hexB(b) - hexB(a)) * t);
  return rgbHex(r, g, bl);
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function blendModeFromString(mode: string | undefined): BLEND_MODES {
  switch (mode) {
    case 'add':
      return 'add' as BLEND_MODES;
    case 'multiply':
      return 'multiply' as BLEND_MODES;
    case 'screen':
      return 'screen' as BLEND_MODES;
    default:
      return 'normal' as BLEND_MODES;
  }
}

// ── Particle (internal, pooled) ─────────────────────────────────────────────

class Particle {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  life = 0;
  maxLife = 1;
  size = 4;
  startSize = 4;
  endSize = 4;
  color = 0xffffff;
  startColor = 0xffffff;
  endColor = 0xffffff;
  alpha = 1;
  startAlpha = 1;
  endAlpha = 0;
  rotation = 0;
  rotationSpeed = 0;
  active = false;

  /** Spawn-position for worldSpace=false offset tracking. */
  spawnX = 0;
  spawnY = 0;
}

// ── EmitterState (internal) ─────────────────────────────────────────────────

class EmitterState {
  component: ParticleEmitterComponent;
  particles: Particle[];
  container: Container;
  displayObjects: (Graphics | Sprite)[];
  texture: Texture | null = null;

  /** Accumulator for fractional emission. */
  emitAccum = 0;

  constructor(component: ParticleEmitterComponent, parentContainer: Container) {
    this.component = component;
    const cfg = component.config;
    const poolSize = Math.min(cfg.maxParticles, MAX_PARTICLES_CAP);

    // PixiJS container for this emitter's particles
    this.container = new Container();
    this.container.blendMode = blendModeFromString(cfg.blendMode);
    parentContainer.addChild(this.container);

    // Load texture once if provided
    if (cfg.textureUrl) {
      this.texture = Texture.from(cfg.textureUrl);
    }

    // Pre-allocate pool
    this.particles = new Array(poolSize);
    this.displayObjects = new Array(poolSize);

    for (let i = 0; i < poolSize; i++) {
      this.particles[i] = new Particle();

      if (this.texture) {
        const spr = new Sprite(this.texture);
        spr.anchor.set(0.5, 0.5);
        spr.visible = false;
        this.container.addChild(spr);
        this.displayObjects[i] = spr;
      } else {
        const g = new Graphics();
        g.circle(0, 0, 1); // unit circle, scaled at render time
        g.fill(0xffffff);
        g.visible = false;
        this.container.addChild(g);
        this.displayObjects[i] = g;
      }
    }
  }

  dispose(): void {
    this.container.destroy({ children: true });
  }
}

// ── ParticleSystem ──────────────────────────────────────────────────────────

export class ParticleSystem {
  private emitters: Map<string, EmitterState> = new Map();
  private container: Container;

  constructor(parentContainer: Container) {
    this.container = new Container();
    parentContainer.addChild(this.container);
  }

  // ── Emitter management ──────────────────────────────────────

  addEmitter(id: string, component: ParticleEmitterComponent): void {
    if (this.emitters.has(id)) {
      this.removeEmitter(id);
    }
    const state = new EmitterState(component, this.container);

    // Handle initial burst
    if (component.config.emitBurst && component.config.emitBurst > 0) {
      this.emitParticles(state, component.config.emitBurst);
    }

    this.emitters.set(id, state);
  }

  removeEmitter(id: string): void {
    const state = this.emitters.get(id);
    if (state) {
      state.dispose();
      this.emitters.delete(id);
    }
  }

  // ── Control ─────────────────────────────────────────────────

  start(id: string): void {
    const state = this.emitters.get(id);
    if (state) {
      state.component.emitting = true;
    }
  }

  stop(id: string): void {
    const state = this.emitters.get(id);
    if (state) {
      state.component.emitting = false;
    }
  }

  burst(id: string, count: number): void {
    const state = this.emitters.get(id);
    if (state) {
      this.emitParticles(state, count);
    }
  }

  // ── Per-frame update ────────────────────────────────────────

  update(deltaTime: number): void {
    for (const state of this.emitters.values()) {
      this.updateEmitter(state, deltaTime);
    }
  }

  // ── Render (sync PixiJS display objects from particle state) ─

  render(): void {
    for (const state of this.emitters.values()) {
      this.renderEmitter(state);
    }
  }

  // ── Dispose ─────────────────────────────────────────────────

  dispose(): void {
    for (const state of this.emitters.values()) {
      state.dispose();
    }
    this.emitters.clear();
    this.container.destroy({ children: true });
  }

  // ── Private: update a single emitter ────────────────────────

  private updateEmitter(state: EmitterState, dt: number): void {
    const cfg = state.component.config;

    // Emit new particles
    if (state.component.emitting) {
      state.emitAccum += cfg.emitRate * dt;
      const toEmit = Math.floor(state.emitAccum);
      if (toEmit > 0) {
        state.emitAccum -= toEmit;
        this.emitParticles(state, toEmit);
      }
    }

    // Update existing particles
    const gx = cfg.gravity?.x ?? 0;
    const gy = cfg.gravity?.y ?? 0;
    const ax = cfg.acceleration?.x ?? 0;
    const ay = cfg.acceleration?.y ?? 0;
    const damping = cfg.damping ?? 0;
    const dampFactor = damping > 0 ? Math.pow(1 - damping, dt) : 1;

    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      if (!p.active) continue;

      // Age
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      // Motion
      p.vx += (gx + ax) * dt;
      p.vy += (gy + ay) * dt;
      p.vx *= dampFactor;
      p.vy *= dampFactor;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Rotation
      p.rotation += p.rotationSpeed * dt;

      // Interpolate visual properties based on normalised life
      const lifeRatio = 1 - p.life / p.maxLife; // 0 = just born, 1 = about to die

      // Size
      p.size = p.startSize + (p.endSize - p.startSize) * lifeRatio;

      // Colour
      if (p.startColor !== p.endColor) {
        p.color = lerpColor(p.startColor, p.endColor, lifeRatio);
      }

      // Alpha
      p.alpha = clamp(p.startAlpha + (p.endAlpha - p.startAlpha) * lifeRatio, 0, 1);
    }
  }

  // ── Private: emit N particles from pool ─────────────────────

  private emitParticles(state: EmitterState, count: number): void {
    const cfg = state.component.config;
    const pos = state.component.position;
    let emitted = 0;

    for (let i = 0; i < state.particles.length && emitted < count; i++) {
      const p = state.particles[i];
      if (p.active) continue;

      // Reset particle
      p.active = true;
      p.life = rangeRandom(cfg.lifetime);
      p.maxLife = p.life;

      // Spawn position
      let sx = 0;
      let sy = 0;
      if (cfg.spawnShape === 'rect' && cfg.spawnRect) {
        sx = (Math.random() - 0.5) * cfg.spawnRect.width;
        sy = (Math.random() - 0.5) * cfg.spawnRect.height;
      } else if (cfg.spawnShape === 'circle' && cfg.spawnRadius) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * cfg.spawnRadius; // uniform distribution in circle
        sx = Math.cos(a) * r;
        sy = Math.sin(a) * r;
      }

      p.x = pos.x + sx;
      p.y = pos.y + sy;
      p.spawnX = pos.x;
      p.spawnY = pos.y;

      // Velocity
      const speed = rangeRandom(cfg.speed);
      const angle = rangeRandom(cfg.angle);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;

      // Size
      p.startSize = rangeRandom(cfg.startSize);
      p.endSize = cfg.endSize ? rangeRandom(cfg.endSize) : p.startSize;
      p.size = p.startSize;

      // Colour
      p.startColor = cfg.startColor;
      p.endColor = cfg.endColor ?? cfg.startColor;
      p.color = p.startColor;

      // Alpha
      p.startAlpha = cfg.startAlpha;
      p.endAlpha = cfg.endAlpha ?? cfg.startAlpha;
      p.alpha = p.startAlpha;

      // Rotation
      p.rotation = cfg.startRotation ? rangeRandom(cfg.startRotation) : 0;
      p.rotationSpeed = cfg.rotationSpeed ? rangeRandom(cfg.rotationSpeed) : 0;

      emitted++;
    }
  }

  // ── Private: sync PixiJS display objects ────────────────────

  private renderEmitter(state: EmitterState): void {
    const worldSpace = state.component.worldSpace;
    const emitterX = state.component.position.x;
    const emitterY = state.component.position.y;

    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      const dObj = state.displayObjects[i];

      if (!p.active) {
        dObj.visible = false;
        continue;
      }

      dObj.visible = true;

      // Position: if not worldSpace, offset from current emitter position
      let drawX = p.x;
      let drawY = p.y;
      if (!worldSpace) {
        // Particle position is relative to spawn position; re-anchor to current emitter pos
        drawX = emitterX + (p.x - p.spawnX);
        drawY = emitterY + (p.y - p.spawnY);
      }

      dObj.position.set(drawX, drawY);
      dObj.rotation = p.rotation;
      dObj.alpha = p.alpha;

      if (dObj instanceof Sprite) {
        dObj.width = p.size;
        dObj.height = p.size;
        dObj.tint = p.color;
      } else {
        // Graphics: scale to desired size (the base circle is radius 1)
        const s = p.size / 2; // radius = size/2, base circle has radius 1
        dObj.scale.set(s, s);
        dObj.tint = p.color;
      }
    }
  }
}
