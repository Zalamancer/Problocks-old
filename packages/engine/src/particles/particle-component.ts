/**
 * ParticleEmitterComponent — pure data container for a particle emitter.
 */

import { Component } from '../core/component.js';
import type { ParticleConfig } from './types.js';

export class ParticleEmitterComponent extends Component {
  readonly type = 'particle-emitter';

  config: ParticleConfig;
  position: { x: number; y: number };
  /** Whether the emitter is actively emitting */
  emitting: boolean;
  /** true = particles stay in world space, false = follow emitter */
  worldSpace: boolean;

  constructor(config: ParticleConfig, x = 0, y = 0) {
    super();
    this.config = { ...config };
    this.position = { x, y };
    this.emitting = true;
    this.worldSpace = true;
  }
}
