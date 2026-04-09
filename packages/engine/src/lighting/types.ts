/**
 * 2D Lighting system types.
 * Designed for PixiJS v8 — cheap enough for Celeron N4000 / Intel UHD 600.
 */

export type LightType = 'point' | 'spot' | 'ambient';

export interface LightConfig {
  type: LightType;
  /** Hex colour, e.g. 0xffaa44 */
  color: number;
  /** 0-1 */
  intensity: number;
  /** Radius in pixels (point / spot only) */
  radius: number;
  /** 0-1: how quickly light fades. 1 = linear, 0.5 = quadratic feel */
  falloff: number;
  /** Radians, direction (spot only) */
  angle?: number;
  /** Radians, cone spread (spot only) */
  coneAngle?: number;
  /** Whether this light casts shadows */
  castShadows?: boolean;
}

export interface AmbientConfig {
  /** Ambient light colour */
  color: number;
  /** 0-1 */
  intensity: number;
}

export interface DayNightConfig {
  /** Seconds for a full cycle */
  cycleDuration: number;
  dawn: AmbientConfig;
  noon: AmbientConfig;
  dusk: AmbientConfig;
  night: AmbientConfig;
}

export interface OccluderRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
