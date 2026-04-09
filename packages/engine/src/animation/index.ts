/**
 * Sprite animation and tween systems.
 */

// Types
export type { FrameSequence, SpriteAnimationConfig, AnimationEvent } from './types.js';

// ECS component
export { SpriteAnimationComponent } from './animation-component.js';

// Controller
export { AnimationController } from './animation-controller.js';
export type { AnimationEventData } from './animation-controller.js';

// Tweening
export { Tween, TweenManager, Easing } from './tween.js';
export type { TweenConfig, EasingFunction } from './tween.js';
