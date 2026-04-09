/**
 * Bitmask auto-tiling system.
 *
 * Uses the standard 8-bit (8-neighbor) bitmask approach compatible
 * with Godot, Tiled, and RPG Maker blob tilesets (47 unique tiles).
 *
 * Neighbor bit layout (clockwise from top-left):
 *
 *   0 (NW)  1 (N)  2 (NE)
 *   3 (W)   ----   4 (E)
 *   5 (SW)  6 (S)  7 (SE)
 *
 * Bits are numbered 0..7, so bitmask = sum of (1 << bit) for each
 * matching neighbor.
 */

import type { Grid } from './grid.js';
import type { AutoTileRule } from './types.js';

// ── Neighbor offsets (matches bit index) ─────────────────────────

/** dx, dy for each of the 8 neighbor bits. */
const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], // 0 NW
  [ 0, -1], // 1 N
  [ 1, -1], // 2 NE
  [-1,  0], // 3 W
  [ 1,  0], // 4 E
  [-1,  1], // 5 SW
  [ 0,  1], // 6 S
  [ 1,  1], // 7 SE
];

// ── Cardinal bits (used to mask out irrelevant corners) ──────────

const BIT_NW = 1 << 0;
const BIT_N  = 1 << 1;
const BIT_NE = 1 << 2;
const BIT_W  = 1 << 3;
const BIT_E  = 1 << 4;
const BIT_SW = 1 << 5;
const BIT_S  = 1 << 6;
const BIT_SE = 1 << 7;

/**
 * Reduce a full 8-bit bitmask to a "minimal" bitmask by clearing
 * corner bits that are irrelevant (the corner only matters when
 * both adjacent cardinals are also set).  This collapses the 256
 * raw combinations down to the 47 blob-tileset cases.
 */
function reduceCorners(raw: number): number {
  let mask = raw;
  // NW only relevant if N and W are both set
  if ((mask & BIT_N) === 0 || (mask & BIT_W) === 0) mask &= ~BIT_NW;
  // NE only relevant if N and E are both set
  if ((mask & BIT_N) === 0 || (mask & BIT_E) === 0) mask &= ~BIT_NE;
  // SW only relevant if S and W are both set
  if ((mask & BIT_S) === 0 || (mask & BIT_W) === 0) mask &= ~BIT_SW;
  // SE only relevant if S and E are both set
  if ((mask & BIT_S) === 0 || (mask & BIT_E) === 0) mask &= ~BIT_SE;
  return mask;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Calculate the 8-bit neighbor bitmask for a tile position.
 *
 * @param grid       The Grid instance holding tile data.
 * @param x          Tile X coordinate.
 * @param y          Tile Y coordinate.
 * @param layer      Layer index.
 * @param matchingTiles  Set of tile IDs that count as "same terrain".
 *                       If omitted, any non-zero tile matches.
 * @param reduceCornerBits  If true (default), clears irrelevant corner
 *                          bits to produce the 47-tile minimal mask.
 */
export function calculateBitmask(
  grid: Grid,
  x: number,
  y: number,
  layer: number,
  matchingTiles?: ReadonlySet<number>,
  reduceCornerBits: boolean = true,
): number {
  let bitmask = 0;
  for (let i = 0; i < 8; i++) {
    const [dx, dy] = NEIGHBOR_OFFSETS[i];
    const neighborId = grid.getTile(layer, x + dx, y + dy);
    const matches = matchingTiles
      ? matchingTiles.has(neighborId)
      : neighborId !== 0;
    if (matches) {
      bitmask |= (1 << i);
    }
  }
  return reduceCornerBits ? reduceCorners(bitmask) : bitmask;
}

/**
 * Resolve a bitmask to a tile ID using a sorted rule list.
 *
 * Rules are checked in order; the first rule whose bitmask matches
 * wins.  If no rule matches, returns `fallbackTileId` (default 0).
 */
export function resolveTileId(
  bitmask: number,
  rules: ReadonlyArray<AutoTileRule>,
  fallbackTileId: number = 0,
): number {
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].bitmask === bitmask) {
      return rules[i].tileId;
    }
  }
  return fallbackTileId;
}

/**
 * Build a lookup table from rule list for O(1) bitmask → tileId.
 * Use this when the rule set is stable and you want maximum speed.
 */
export function buildRuleLookup(
  rules: ReadonlyArray<AutoTileRule>,
  fallbackTileId: number = 0,
): Int32Array {
  // 256 possible raw masks (after corner reduction max is 255)
  const lut = new Int32Array(256).fill(fallbackTileId);
  for (const rule of rules) {
    if (rule.bitmask >= 0 && rule.bitmask < 256) {
      lut[rule.bitmask] = rule.tileId;
    }
  }
  return lut;
}

/**
 * Recalculate auto-tiles within a rectangular region on the grid,
 * writing the resolved tile IDs back into the specified output layer.
 *
 * @param grid          The Grid instance.
 * @param sourceLayer   Layer to read current tile IDs from.
 * @param outputLayer   Layer to write resolved auto-tile IDs to
 *                      (can be the same as sourceLayer for in-place).
 * @param rules         Auto-tile bitmask rules.
 * @param matchingTiles Tile IDs considered "same terrain".
 * @param minX          Region min X (inclusive).
 * @param minY          Region min Y (inclusive).
 * @param maxX          Region max X (inclusive).
 * @param maxY          Region max Y (inclusive).
 * @param fallbackTileId Tile ID when no rule matches.
 */
export function updateAutoTiles(
  grid: Grid,
  sourceLayer: number,
  outputLayer: number,
  rules: ReadonlyArray<AutoTileRule>,
  matchingTiles: ReadonlySet<number>,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  fallbackTileId: number = 0,
): void {
  // Pre-build LUT for fast resolution
  const lut = buildRuleLookup(rules, fallbackTileId);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const currentId = grid.getTile(sourceLayer, x, y);
      // Only auto-tile positions that have a matching tile
      if (!matchingTiles.has(currentId)) continue;

      const mask = calculateBitmask(grid, x, y, sourceLayer, matchingTiles, true);
      const resolved = lut[mask];
      grid.setTile(outputLayer, x, y, resolved);
    }
  }
}

/**
 * Convenience: recalculate auto-tiles in a 1-tile border around a
 * changed position (useful after a single setTile call).
 */
export function updateAutoTilesAround(
  grid: Grid,
  sourceLayer: number,
  outputLayer: number,
  rules: ReadonlyArray<AutoTileRule>,
  matchingTiles: ReadonlySet<number>,
  centerX: number,
  centerY: number,
  fallbackTileId: number = 0,
): void {
  updateAutoTiles(
    grid,
    sourceLayer,
    outputLayer,
    rules,
    matchingTiles,
    centerX - 1,
    centerY - 1,
    centerX + 1,
    centerY + 1,
    fallbackTileId,
  );
}
