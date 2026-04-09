/**
 * Grid coordinate system with chunk-based tile storage.
 *
 * Handles coordinate conversion for orthogonal, isometric (diamond),
 * and hexagonal grids.  Tile data is stored in 16x16 chunks so that
 * large / infinite maps stay memory-friendly.
 */

import type {
  GridType,
  HexOrientation,
  ScreenPoint,
  GridPoint,
  TileData,
} from './types.js';

// ── Constants ────────────────────────────────────────────────────

/** Tiles per chunk axis. */
const CHUNK_SIZE = 16;

// ── Chunk storage ────────────────────────────────────────────────

/**
 * A chunk holds a fixed CHUNK_SIZE x CHUNK_SIZE block of tile IDs
 * for a single layer.  Using a flat Int32Array for cache-friendly
 * access and minimal GC pressure.
 */
class Chunk {
  /** Flat CHUNK_SIZE*CHUNK_SIZE array of tile IDs (0 = empty). */
  readonly tiles: Int32Array;

  constructor() {
    this.tiles = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
  }

  get(localX: number, localY: number): number {
    return this.tiles[localY * CHUNK_SIZE + localX];
  }

  set(localX: number, localY: number, tileId: number): void {
    this.tiles[localY * CHUNK_SIZE + localX] = tileId;
  }
}

// ── Chunk key helper ─────────────────────────────────────────────

/** Packs chunk coords + layer into a single string key. */
function chunkKey(chunkX: number, chunkY: number, layer: number): string {
  return `${chunkX},${chunkY},${layer}`;
}

// ── Grid class ───────────────────────────────────────────────────

export class Grid {
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly gridType: GridType;
  readonly hexOrientation: HexOrientation;

  /** Number of layers. */
  private layerCount: number;

  /** Chunk storage: key → Chunk. */
  private chunks: Map<string, Chunk> = new Map();

  /**
   * Per-tile property overrides (sparse — only tiles that actually
   * have custom properties are stored).  Key: "layer,x,y"
   */
  private tileProperties: Map<string, Record<string, string | number | boolean>> = new Map();

  constructor(
    tileWidth: number,
    tileHeight: number,
    gridType: GridType = 'isometric',
    layerCount: number = 1,
    hexOrientation: HexOrientation = 'pointy',
  ) {
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.gridType = gridType;
    this.layerCount = layerCount;
    this.hexOrientation = hexOrientation;
  }

  // ── Coordinate conversions ───────────────────────────────────

  /**
   * Convert grid (tile) coordinates to screen (pixel) coordinates.
   */
  worldToScreen(gridX: number, gridY: number, gridType?: GridType): ScreenPoint {
    const type = gridType ?? this.gridType;
    switch (type) {
      case 'orthogonal':
        return {
          screenX: gridX * this.tileWidth,
          screenY: gridY * this.tileHeight,
        };

      case 'isometric':
        return {
          screenX: (gridX - gridY) * (this.tileWidth / 2),
          screenY: (gridX + gridY) * (this.tileHeight / 2),
        };

      case 'hex': {
        return this.hexToScreen(gridX, gridY);
      }
    }
  }

  /**
   * Convert screen (pixel) coordinates to grid (tile) coordinates.
   * Returns floating-point grid coords — caller should Math.floor()
   * or Math.round() depending on use case.
   */
  screenToWorld(screenX: number, screenY: number, gridType?: GridType): GridPoint {
    const type = gridType ?? this.gridType;
    switch (type) {
      case 'orthogonal':
        return {
          gridX: screenX / this.tileWidth,
          gridY: screenY / this.tileHeight,
        };

      case 'isometric': {
        const halfW = this.tileWidth / 2;
        const halfH = this.tileHeight / 2;
        return {
          gridX: (screenX / halfW + screenY / halfH) / 2,
          gridY: (screenY / halfH - screenX / halfW) / 2,
        };
      }

      case 'hex':
        return this.screenToHex(screenX, screenY);
    }
  }

  // ── Hex helpers (offset coords) ──────────────────────────────

  private hexToScreen(col: number, row: number): ScreenPoint {
    if (this.hexOrientation === 'pointy') {
      // Pointy-top hex: odd-row offset
      const size = this.tileWidth / 2;       // horizontal half-width
      const h = this.tileHeight;
      const xOffset = row % 2 !== 0 ? size : 0;
      return {
        screenX: col * this.tileWidth + xOffset,
        screenY: row * (h * 0.75),
      };
    }
    // Flat-top hex: odd-column offset
    const w = this.tileWidth;
    const size = this.tileHeight / 2;
    const yOffset = col % 2 !== 0 ? size : 0;
    return {
      screenX: col * (w * 0.75),
      screenY: row * this.tileHeight + yOffset,
    };
  }

  private screenToHex(screenX: number, screenY: number): GridPoint {
    if (this.hexOrientation === 'pointy') {
      // Approximate using axial conversion then round
      const size = this.tileWidth / 2;
      const h = this.tileHeight * 0.75;
      const row = screenY / h;
      const xOffset = Math.round(row) % 2 !== 0 ? size : 0;
      const col = (screenX - xOffset) / this.tileWidth;
      return { gridX: col, gridY: row };
    }
    const w = this.tileWidth * 0.75;
    const size = this.tileHeight / 2;
    const col = screenX / w;
    const yOffset = Math.round(col) % 2 !== 0 ? size : 0;
    const row = (screenY - yOffset) / this.tileHeight;
    return { gridX: col, gridY: row };
  }

  // ── Chunk access ─────────────────────────────────────────────

  /** Get (or lazily create) a chunk. */
  getChunk(chunkX: number, chunkY: number, layer: number = 0): Chunk {
    const key = chunkKey(chunkX, chunkY, layer);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk();
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  /** Return true if a chunk exists (has been touched). */
  hasChunk(chunkX: number, chunkY: number, layer: number = 0): boolean {
    return this.chunks.has(chunkKey(chunkX, chunkY, layer));
  }

  // ── Tile access ──────────────────────────────────────────────

  /** Read tile ID at the given layer / world position. */
  getTile(layer: number, x: number, y: number): number {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const key = chunkKey(cx, cy, layer);
    const chunk = this.chunks.get(key);
    if (!chunk) return 0;
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.get(lx, ly);
  }

  /** Write a tile ID. Lazily creates the chunk. */
  setTile(layer: number, x: number, y: number, tileId: number): void {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cy, layer);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.set(lx, ly, tileId);
  }

  /** Get full TileData (id + optional properties) at a position. */
  getTileData(layer: number, x: number, y: number): TileData {
    const id = this.getTile(layer, x, y);
    const propKey = `${layer},${x},${y}`;
    const properties = this.tileProperties.get(propKey);
    return properties ? { id, properties } : { id };
  }

  /** Set per-tile properties (separate from tile ID). */
  setTileProperties(
    layer: number,
    x: number,
    y: number,
    properties: Record<string, string | number | boolean>,
  ): void {
    this.tileProperties.set(`${layer},${x},${y}`, properties);
  }

  // ── Bulk loading ─────────────────────────────────────────────

  /**
   * Import a 2D array of tile IDs into a layer.
   * data is indexed data[row][col] (y then x).
   */
  loadLayer(layer: number, data: number[][]): void {
    for (let y = 0; y < data.length; y++) {
      const row = data[y];
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== 0) {
          this.setTile(layer, x, y, row[x]);
        }
      }
    }
  }

  // ── Neighbor queries ─────────────────────────────────────────

  /**
   * Return the coordinates of all direct neighbors for a tile,
   * respecting the topology of the grid type.
   */
  getNeighbors(x: number, y: number, gridType?: GridType): GridPoint[] {
    const type = gridType ?? this.gridType;

    switch (type) {
      case 'orthogonal':
        // 8 neighbors (Moore neighborhood)
        return [
          { gridX: x - 1, gridY: y - 1 },
          { gridX: x,     gridY: y - 1 },
          { gridX: x + 1, gridY: y - 1 },
          { gridX: x - 1, gridY: y },
          { gridX: x + 1, gridY: y },
          { gridX: x - 1, gridY: y + 1 },
          { gridX: x,     gridY: y + 1 },
          { gridX: x + 1, gridY: y + 1 },
        ];

      case 'isometric':
        // Same as orthogonal — isometric is just a visual projection
        return [
          { gridX: x - 1, gridY: y - 1 },
          { gridX: x,     gridY: y - 1 },
          { gridX: x + 1, gridY: y - 1 },
          { gridX: x - 1, gridY: y },
          { gridX: x + 1, gridY: y },
          { gridX: x - 1, gridY: y + 1 },
          { gridX: x,     gridY: y + 1 },
          { gridX: x + 1, gridY: y + 1 },
        ];

      case 'hex':
        return this.hexNeighbors(x, y);
    }
  }

  private hexNeighbors(col: number, row: number): GridPoint[] {
    const isOdd = row % 2 !== 0;
    if (this.hexOrientation === 'pointy') {
      // Pointy-top, odd-row offset coords
      if (isOdd) {
        return [
          { gridX: col + 1, gridY: row - 1 },
          { gridX: col,     gridY: row - 1 },
          { gridX: col + 1, gridY: row },
          { gridX: col - 1, gridY: row },
          { gridX: col + 1, gridY: row + 1 },
          { gridX: col,     gridY: row + 1 },
        ];
      }
      return [
        { gridX: col,     gridY: row - 1 },
        { gridX: col - 1, gridY: row - 1 },
        { gridX: col + 1, gridY: row },
        { gridX: col - 1, gridY: row },
        { gridX: col,     gridY: row + 1 },
        { gridX: col - 1, gridY: row + 1 },
      ];
    }

    // Flat-top, odd-column offset coords
    const isOddCol = col % 2 !== 0;
    if (isOddCol) {
      return [
        { gridX: col,     gridY: row - 1 },
        { gridX: col + 1, gridY: row },
        { gridX: col + 1, gridY: row + 1 },
        { gridX: col,     gridY: row + 1 },
        { gridX: col - 1, gridY: row + 1 },
        { gridX: col - 1, gridY: row },
      ];
    }
    return [
      { gridX: col,     gridY: row - 1 },
      { gridX: col + 1, gridY: row - 1 },
      { gridX: col + 1, gridY: row },
      { gridX: col,     gridY: row + 1 },
      { gridX: col - 1, gridY: row },
      { gridX: col - 1, gridY: row - 1 },
    ];
  }

  // ── Utilities ────────────────────────────────────────────────

  /** Get the chunk coordinate for a world tile position. */
  static worldToChunk(x: number, y: number): { chunkX: number; chunkY: number } {
    return {
      chunkX: Math.floor(x / CHUNK_SIZE),
      chunkY: Math.floor(y / CHUNK_SIZE),
    };
  }

  /** Number of tiles per chunk axis. */
  static readonly CHUNK_SIZE = CHUNK_SIZE;

  /** Get the current layer count. */
  getLayerCount(): number {
    return this.layerCount;
  }

  /** Add a new layer. Returns the new layer index. */
  addLayer(): number {
    return this.layerCount++;
  }

  /** Clear all tile data for a layer. */
  clearLayer(layer: number): void {
    const toDelete: string[] = [];
    for (const key of this.chunks.keys()) {
      if (key.endsWith(`,${layer}`)) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) {
      this.chunks.delete(key);
    }
  }

  /** Remove all chunks and properties — full reset. */
  clear(): void {
    this.chunks.clear();
    this.tileProperties.clear();
  }
}
