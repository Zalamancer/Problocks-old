import { Component } from '../core/component.js';
import type { SpriteAnimationConfig } from './types.js';

/**
 * ECS component that stores sprite animation state for an entity.
 * Pure data container — the AnimationController drives the logic.
 */
export class SpriteAnimationComponent extends Component {
  readonly type = 'sprite-animation';

  /** Sprite sheet and frame layout configuration. */
  config: SpriteAnimationConfig;
  /** Name of the currently active animation sequence. */
  currentAnimation: string;
  /** Index into the current FrameSequence.frames array. */
  currentFrame: number = 0;
  /** Whether the animation is actively advancing frames. */
  playing: boolean = false;
  /** Playback speed multiplier (1.0 = normal, 2.0 = double speed). */
  speed: number = 1.0;
  /** Mirror the sprite horizontally. */
  flipX: boolean = false;
  /** Mirror the sprite vertically. */
  flipY: boolean = false;

  constructor(config: SpriteAnimationConfig) {
    super();
    this.config = config;
    this.currentAnimation = config.defaultAnimation ?? '';
  }
}
