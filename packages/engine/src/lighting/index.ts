/**
 * 2D Lighting system — barrel exports.
 */

export type {
  LightType,
  LightConfig,
  AmbientConfig,
  DayNightConfig,
  OccluderRect,
} from './types.js';

export { LightComponent } from './light-component.js';
export { LightingSystem } from './lighting-system.js';
