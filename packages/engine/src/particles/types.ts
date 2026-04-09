/**
 * Particle system types.
 * Hard-capped at 500 particles per emitter for Celeron N4000.
 */

export interface RangeValue {
  min: number;
  max: number;
}

export interface ParticleConfig {
  // ── Emission ──────────────────────────────────────────────
  /** Pool size (hard-capped at 500 for low-end hardware) */
  maxParticles: number;
  /** Particles per second */
  emitRate: number;
  /** Emit N particles immediately on start */
  emitBurst?: number;
  /** Lifetime in seconds */
  lifetime: RangeValue;

  // ── Spawn shape ───────────────────────────────────────────
  spawnShape: 'point' | 'rect' | 'circle';
  spawnRect?: { width: number; height: number };
  spawnRadius?: number;

  // ── Motion ────────────────────────────────────────────────
  speed: RangeValue;
  /** Emission direction range in radians */
  angle: RangeValue;
  gravity?: { x: number; y: number };
  acceleration?: { x: number; y: number };
  /** 0-1, velocity decay per second */
  damping?: number;

  // ── Visual ────────────────────────────────────────────────
  startSize: RangeValue;
  endSize?: RangeValue;
  /** Hex colour */
  startColor: number;
  /** Interpolates over lifetime */
  endColor?: number;
  startAlpha: number;
  endAlpha?: number;
  blendMode?: 'normal' | 'add' | 'multiply' | 'screen';

  // ── Rotation ──────────────────────────────────────────────
  startRotation?: RangeValue;
  rotationSpeed?: RangeValue;

  // ── Texture ───────────────────────────────────────────────
  /** Optional sprite texture (defaults to filled circle) */
  textureUrl?: string;
}

export type ParticlePreset =
  | 'fire'
  | 'smoke'
  | 'rain'
  | 'snow'
  | 'sparkle'
  | 'dust'
  | 'explosion'
  | 'bubbles';
