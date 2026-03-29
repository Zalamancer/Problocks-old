/**
 * @problocks/sdk
 *
 * The public API surface available to simulation developers.
 * Everything students import comes from this package.
 *
 * Tier 1 (Basic): World, Entity, Shape, Color, Physics, Camera, Light, UI, Input
 * Tier 2 (Domain): @problocks/circuits, @problocks/mechanics, etc. (separate packages)
 * Tier 3 (Advanced): Multiplayer, Storage, Network (requires review)
 */

// Re-export core types for simulation developers
export { World } from '@problocks/engine';
export { Entity } from '@problocks/engine';
export { Component } from '@problocks/engine';

// SDK-specific helpers (the friendly API students actually use)
export { Shape } from './api/shape.js';
export { Color } from './api/color.js';
export { ProblocksMath as PBMath } from './api/math.js';
