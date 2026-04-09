/**
 * Shared types for the tilemap subsystem.
 */

/** Supported grid projection types. */
export type GridType = 'orthogonal' | 'isometric' | 'hex';

/** Hex orientation: pointy-top or flat-top. */
export type HexOrientation = 'pointy' | 'flat';

/** A single tile within the grid. */
export interface TileData {
  /** Tile ID from the tileset (0 = empty/no tile). */
  id: number;
  /** Arbitrary per-tile properties (collision flag, animation index, etc.). */
  properties?: Record<string, string | number | boolean>;
}

/** Configuration for a single map layer. */
export interface LayerConfig {
  /** Human-readable layer name (e.g. "ground", "objects", "overlay"). */
  name: string;
  /**
   * 2D array of tile IDs indexed as data[row][col].
   * 0 means empty / no tile.
   */
  data: number[][];
  /** Whether this layer is rendered. */
  visible: boolean;
  /** Layer opacity 0..1. */
  opacity: number;
}

/** Top-level tilemap configuration. */
export interface TilemapConfig {
  /** Projection type used for coordinate conversion. */
  gridType: GridType;
  /** Width of a single tile in pixels. */
  tileWidth: number;
  /** Height of a single tile in pixels. */
  tileHeight: number;
  /** Number of tile columns in the map. */
  mapWidth: number;
  /** Number of tile rows in the map. */
  mapHeight: number;
  /** Ordered list of layers (rendered bottom to top). */
  layers: LayerConfig[];
  /** Hex orientation — only used when gridType is 'hex'. */
  hexOrientation?: HexOrientation;
}

/** Bitmask-to-tile mapping rule for auto-tiling. */
export interface AutoTileRule {
  /** 8-bit bitmask value representing neighbor configuration. */
  bitmask: number;
  /** Tile ID to use when this bitmask matches. */
  tileId: number;
}

/** Configuration for a tileset (image atlas). */
export interface TilesetConfig {
  /** URL or asset path to the tileset image. */
  imageSource: string;
  /** Width of a single tile in the tileset image (px). */
  tileWidth: number;
  /** Height of a single tile in the tileset image (px). */
  tileHeight: number;
  /** Number of tile columns in the tileset image. */
  columns: number;
  /** First tile ID this tileset covers (inclusive). */
  firstGid: number;
  /** Total number of tiles in this tileset. */
  tileCount: number;
  /** Optional auto-tile rules keyed by terrain name. */
  autoTileRules?: Record<string, AutoTileRule[]>;
}

/** 2D screen coordinate. */
export interface ScreenPoint {
  screenX: number;
  screenY: number;
}

/** 2D grid coordinate. */
export interface GridPoint {
  gridX: number;
  gridY: number;
}

/** Camera state for viewport culling. */
export interface Camera2D {
  x: number;
  y: number;
  zoom: number;
}
