/**
 * @problocks/engine — Tilemap subsystem
 *
 * Isometric, orthogonal, and hexagonal tilemap support with
 * chunk-based storage, auto-tiling, depth sorting, and PixiJS rendering.
 */

// Types
export type {
  GridType,
  HexOrientation,
  TileData,
  TilemapConfig,
  LayerConfig,
  AutoTileRule,
  TilesetConfig,
  ScreenPoint,
  GridPoint,
  Camera2D,
} from './types.js';

// Grid coordinate system & chunk storage
export { Grid } from './grid.js';

// Auto-tiling (bitmask)
export {
  calculateBitmask,
  resolveTileId,
  buildRuleLookup,
  updateAutoTiles,
  updateAutoTilesAround,
} from './auto-tile.js';

// Isometric utilities
export {
  getDepthIndex,
  depthSort,
  worldToScreenWithHeight,
  diamondPolygon,
  isPointInDiamond,
  pickTileAtScreen,
  getTileScreenAABB,
} from './isometric.js';
export type {
  DepthSortable,
  PickCandidate,
  ScreenAABB,
} from './isometric.js';

// ECS component
export { IsometricTilemapComponent } from './tilemap-component.js';

// PixiJS renderer
export { TilemapRenderer } from './tilemap-renderer.js';
