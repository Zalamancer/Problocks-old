/**
 * AudioSource component — attaches named sounds to an entity.
 * Supports spatial positioning for 2D distance-based panning and attenuation.
 */
import { Component } from '../core/component.js';
import type { SoundConfig } from './types.js';

export class AudioSourceComponent extends Component {
  readonly type = 'audio-source';

  /** Named sounds available on this entity (e.g. { footstep: {...}, jump: {...} }). */
  sounds: Record<string, SoundConfig> = {};

  /** World-space position for spatial audio calculations. */
  position: { x: number; y: number } = { x: 0, y: 0 };
}
