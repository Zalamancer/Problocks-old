/**
 * Sprite animation types for the ECS animation system.
 */

/** A named sequence of frames within a sprite sheet. */
export interface FrameSequence {
  /** Display name, e.g. "idle", "walk", "attack". */
  name: string;
  /** Frame indices into the sprite sheet (left-to-right, top-to-bottom). */
  frames: number[];
  /** Playback speed in frames per second. */
  frameRate: number;
  /** Whether to loop when the last frame is reached. */
  loop: boolean;
  /** If true, play forward then backward before looping/completing. */
  pingPong?: boolean;
}

/** Configuration for a sprite-sheet-based animation set. */
export interface SpriteAnimationConfig {
  /** URL or asset key for the sprite sheet texture. */
  spriteSheetUrl: string;
  /** Width of a single frame in pixels. */
  frameWidth: number;
  /** Height of a single frame in pixels. */
  frameHeight: number;
  /** Number of columns in the sprite sheet grid. */
  columns: number;
  /** Number of rows in the sprite sheet grid. */
  rows: number;
  /** Named animation sequences keyed by animation name. */
  animations: Record<string, FrameSequence>;
  /** Animation to play on registration if none is specified. */
  defaultAnimation?: string;
}

/** Events emitted during animation playback. */
export type AnimationEvent = 'complete' | 'loop' | 'frame';
