/**
 * Particle system — barrel exports.
 */

export type {
  ParticleConfig,
  ParticlePreset,
  RangeValue,
} from './types.js';

export { ParticleEmitterComponent } from './particle-component.js';
export { ParticleSystem } from './particle-system.js';
export { getParticlePreset, PARTICLE_PRESETS } from './presets.js';
