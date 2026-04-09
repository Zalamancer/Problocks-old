/**
 * ECS Component for isometric tilemaps.
 *
 * Follows the exact pattern from core/component.ts:
 * extends Component, declares readonly type, stores pure data.
 */

import { Component } from '../core/component.js';
import type { TilemapConfig, TilesetConfig } from './types.js';

/**
 * Isometric tilemap component — attaches tilemap configuration and
 * tileset data to an entity so the rendering and logic systems can
 * operate on it.
 */
export class IsometricTilemapComponent extends Component {
  readonly type = 'isometric-tilemap';

  /** Full tilemap configuration (grid type, dimensions, layers). */
  config: TilemapConfig;

  /** Tilesets used by this tilemap. */
  tilesets: TilesetConfig[];

  constructor(config: TilemapConfig, tilesets: TilesetConfig[] = []) {
    super();
    this.config = config;
    this.tilesets = tilesets;
  }
}
