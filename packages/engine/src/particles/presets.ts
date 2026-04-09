/**
 * Built-in particle presets.
 *
 * All presets are tuned for Celeron N4000 (low particle counts, simple visuals).
 */

import type { ParticleConfig, ParticlePreset } from './types.js';

const DEG_TO_RAD = Math.PI / 180;

const presetMap: Record<ParticlePreset, ParticleConfig> = {
  /**
   * Fire — orange to red, shrinking, upward drift, additive blend.
   */
  fire: {
    maxParticles: 100,
    emitRate: 30,
    lifetime: { min: 0.4, max: 1.0 },
    spawnShape: 'circle',
    spawnRadius: 6,
    speed: { min: 40, max: 80 },
    angle: { min: -110 * DEG_TO_RAD, max: -70 * DEG_TO_RAD }, // upward with spread
    gravity: { x: 0, y: -20 },
    damping: 0.1,
    startSize: { min: 10, max: 18 },
    endSize: { min: 2, max: 4 },
    startColor: 0xff8800,
    endColor: 0xcc2200,
    startAlpha: 0.9,
    endAlpha: 0,
    blendMode: 'add',
    startRotation: { min: 0, max: Math.PI * 2 },
    rotationSpeed: { min: -1, max: 1 },
  },

  /**
   * Smoke — gray, large and growing, slow upward drift, low alpha.
   */
  smoke: {
    maxParticles: 50,
    emitRate: 10,
    lifetime: { min: 1.5, max: 3.0 },
    spawnShape: 'circle',
    spawnRadius: 4,
    speed: { min: 15, max: 35 },
    angle: { min: -100 * DEG_TO_RAD, max: -80 * DEG_TO_RAD },
    gravity: { x: 0, y: -10 },
    damping: 0.05,
    startSize: { min: 12, max: 20 },
    endSize: { min: 30, max: 50 },
    startColor: 0x888888,
    endColor: 0x444444,
    startAlpha: 0.35,
    endAlpha: 0,
    blendMode: 'normal',
    startRotation: { min: 0, max: Math.PI * 2 },
    rotationSpeed: { min: -0.3, max: 0.3 },
  },

  /**
   * Rain — blue-white, fast downward, slight angle, narrow streaks.
   */
  rain: {
    maxParticles: 200,
    emitRate: 80,
    lifetime: { min: 0.4, max: 0.8 },
    spawnShape: 'rect',
    spawnRect: { width: 600, height: 10 },
    speed: { min: 400, max: 600 },
    angle: { min: 80 * DEG_TO_RAD, max: 95 * DEG_TO_RAD }, // mostly down, slight wind
    startSize: { min: 2, max: 3 },
    endSize: { min: 2, max: 3 },
    startColor: 0xaaccff,
    startAlpha: 0.7,
    endAlpha: 0.3,
    blendMode: 'add',
  },

  /**
   * Snow — white, slow downward, random horizontal drift, small.
   */
  snow: {
    maxParticles: 150,
    emitRate: 25,
    lifetime: { min: 3.0, max: 6.0 },
    spawnShape: 'rect',
    spawnRect: { width: 600, height: 10 },
    speed: { min: 20, max: 50 },
    angle: { min: 70 * DEG_TO_RAD, max: 110 * DEG_TO_RAD },
    gravity: { x: 0, y: 10 },
    acceleration: { x: 0, y: 0 },
    damping: 0.02,
    startSize: { min: 2, max: 5 },
    endSize: { min: 2, max: 5 },
    startColor: 0xffffff,
    startAlpha: 0.8,
    endAlpha: 0.2,
    blendMode: 'normal',
    startRotation: { min: 0, max: Math.PI * 2 },
    rotationSpeed: { min: -0.5, max: 0.5 },
  },

  /**
   * Sparkle — yellow/white, burst outward from centre, fast fade, additive.
   */
  sparkle: {
    maxParticles: 80,
    emitRate: 40,
    lifetime: { min: 0.2, max: 0.6 },
    spawnShape: 'point',
    speed: { min: 80, max: 200 },
    angle: { min: 0, max: Math.PI * 2 }, // all directions
    damping: 0.3,
    startSize: { min: 2, max: 5 },
    endSize: { min: 0, max: 1 },
    startColor: 0xffff88,
    endColor: 0xffffff,
    startAlpha: 1,
    endAlpha: 0,
    blendMode: 'add',
  },

  /**
   * Dust — brown/tan, slow random drift, very low alpha, large spawn area.
   */
  dust: {
    maxParticles: 30,
    emitRate: 5,
    lifetime: { min: 2.0, max: 5.0 },
    spawnShape: 'rect',
    spawnRect: { width: 300, height: 200 },
    speed: { min: 5, max: 15 },
    angle: { min: 0, max: Math.PI * 2 },
    damping: 0.02,
    startSize: { min: 3, max: 7 },
    endSize: { min: 3, max: 7 },
    startColor: 0xc4a56e,
    endColor: 0x8b7355,
    startAlpha: 0.15,
    endAlpha: 0,
    blendMode: 'normal',
  },

  /**
   * Explosion — orange to gray, burst outward, fast then slow (high damping),
   * size grows then shrinks.
   */
  explosion: {
    maxParticles: 60,
    emitRate: 0,
    emitBurst: 60,
    lifetime: { min: 0.4, max: 1.2 },
    spawnShape: 'circle',
    spawnRadius: 4,
    speed: { min: 100, max: 300 },
    angle: { min: 0, max: Math.PI * 2 },
    damping: 0.6,
    startSize: { min: 6, max: 14 },
    endSize: { min: 1, max: 3 },
    startColor: 0xff8800,
    endColor: 0x666666,
    startAlpha: 1,
    endAlpha: 0,
    blendMode: 'add',
    startRotation: { min: 0, max: Math.PI * 2 },
    rotationSpeed: { min: -3, max: 3 },
  },

  /**
   * Bubbles — light blue, slow upward, slight wobble, grow slightly.
   */
  bubbles: {
    maxParticles: 40,
    emitRate: 8,
    lifetime: { min: 2.0, max: 4.0 },
    spawnShape: 'rect',
    spawnRect: { width: 80, height: 10 },
    speed: { min: 20, max: 50 },
    angle: { min: -100 * DEG_TO_RAD, max: -80 * DEG_TO_RAD },
    gravity: { x: 0, y: -15 },
    acceleration: { x: 0, y: 0 },
    damping: 0.02,
    startSize: { min: 4, max: 8 },
    endSize: { min: 6, max: 12 },
    startColor: 0x88ccff,
    endColor: 0xaaddff,
    startAlpha: 0.6,
    endAlpha: 0.1,
    blendMode: 'normal',
  },
};

/**
 * Get a deep copy of a built-in particle preset configuration.
 */
export function getParticlePreset(preset: ParticlePreset): ParticleConfig {
  const cfg = presetMap[preset];
  // Return a fresh copy so callers can mutate without affecting the template
  return JSON.parse(JSON.stringify(cfg));
}

/**
 * All available preset names.
 */
export const PARTICLE_PRESETS: readonly ParticlePreset[] = Object.keys(presetMap) as ParticlePreset[];
