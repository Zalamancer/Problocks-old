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

// Wang tile system (terrain transitions)
export type {
  TerrainId,
  WangTransition,
  PureTileSource,
  WangTileResult,
} from './wang-tile.js';
export {
  getVertexTerrain,
  buildVertexGrid,
  resolveWangTile,
  normGrassTerrain,
  TERRAIN,
  DEFAULT_TERRAIN_PRIORITY,
  DEFAULT_TRANSITIONS,
  DEFAULT_PURE_TILE_SOURCES,
} from './wang-tile.js';

// PixiJS renderer
export { TilemapRenderer } from './tilemap-renderer.js';
