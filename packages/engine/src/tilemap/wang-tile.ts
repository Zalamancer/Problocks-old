/**
 * Wang tile system for terrain transitions.
 *
 * Uses 4-corner vertex encoding (NE, NW, SW, SE) to select from a 16-tile
 * tileset that represents all possible two-terrain transitions.
 *
 * Layout (4x4 grid):
 *  0(u,u,l,u)  1(l,u,u,l)  2(u,l,l,l)  3(u,u,l,l)
 *  4(u,l,u,l)  5(l,u,l,l)  6(l,l,l,l)  7(l,l,l,u)
 *  8(l,u,u,u)  9(l,l,u,u) 10(l,l,u,l) 11(u,l,l,u)
 * 12(u,u,u,u) 13(u,u,u,l) 14(l,u,l,u) 15(u,l,u,u)
 *
 * Key: 6 = pure lower, 12 = pure upper
 */

// ── Types ────────────────────────────────────────────────────────────

/** Terrain type identifier. */
export type TerrainId = number;

/** A transition tileset mapping between two terrain types. */
export interface WangTransition {
  /** Tileset name (e.g. 'water-sand'). */
  name: string;
  /** Lower-priority terrain ID. */
  lower: TerrainId;
  /** Higher-priority terrain ID. */
  upper: TerrainId;
}

/** Configuration for a pure-terrain tile source. */
export interface PureTileSource {
  /** Which tileset provides the pure tile. */
  tileset: string;
  /** Grid index within that tileset (6 = all-lower, 12 = all-upper). */
  idx: number;
}

/** Result of a Wang tile lookup. */
export interface WangTileResult {
  /** Tileset name to pull the texture from. */
  tileset: string;
  /** Grid index (0–15) within that tileset. */
  idx: number;
}

// ── Constants ────────────────────────────────────────────────────────

/** Corner pattern for each grid index: [NE, NW, SW, SE] → 1=upper, 0=lower. */
const WANG_CORNERS: readonly [number, number, number, number][] = [
  [1, 1, 0, 1], [0, 1, 1, 0], [1, 0, 0, 0], [1, 1, 0, 0],
  [1, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1],
  [0, 1, 1, 1], [0, 0, 1, 1], [0, 0, 1, 0], [1, 0, 0, 1],
  [1, 1, 1, 1], [1, 1, 1, 0], [0, 1, 0, 1], [1, 0, 1, 1],
];

/** Reverse lookup: cornerKey → grid index. cornerKey = NE*8 + NW*4 + SW*2 + SE */
const WANG_LOOKUP: Int8Array = (() => {
  const lut = new Int8Array(16).fill(-1);
  for (let i = 0; i < WANG_CORNERS.length; i++) {
    const [ne, nw, sw, se] = WANG_CORNERS[i];
    lut[ne * 8 + nw * 4 + sw * 2 + se] = i;
  }
  return lut;
})();

// ── Vertex terrain helpers ───────────────────────────────────────────

/**
 * Determine the terrain at a vertex by examining the up-to-4 cells that
 * share that corner. The highest-priority terrain wins.
 */
export function getVertexTerrain(
  ground: number[][],
  vx: number,
  vy: number,
  w: number,
  h: number,
  terrainPriority: ReadonlyMap<TerrainId, number>,
  normalizeTerrain: (t: TerrainId) => TerrainId = (t) => t,
): TerrainId {
  const cells: TerrainId[] = [];
  if (vy > 0 && vx > 0) cells.push(normalizeTerrain(ground[vy - 1][vx - 1]));
  if (vy > 0 && vx < w) cells.push(normalizeTerrain(ground[vy - 1][vx]));
  if (vy < h && vx > 0) cells.push(normalizeTerrain(ground[vy][vx - 1]));
  if (vy < h && vx < w) cells.push(normalizeTerrain(ground[vy][vx]));
  if (cells.length === 0) return 0;

  return cells.reduce((a, b) =>
    (terrainPriority.get(b) ?? 0) > (terrainPriority.get(a) ?? 0) ? b : a,
  );
}

/**
 * Build a vertex grid from a ground layer. The vertex grid has dimensions
 * (h+1) x (w+1) — one vertex per tile corner.
 */
export function buildVertexGrid(
  ground: number[][],
  terrainPriority: ReadonlyMap<TerrainId, number>,
  normalizeTerrain: (t: TerrainId) => TerrainId = (t) => t,
): TerrainId[][] {
  const h = ground.length;
  const w = ground[0].length;
  const verts: TerrainId[][] = [];

  for (let vy = 0; vy <= h; vy++) {
    const row: TerrainId[] = [];
    for (let vx = 0; vx <= w; vx++) {
      row.push(getVertexTerrain(ground, vx, vy, w, h, terrainPriority, normalizeTerrain));
    }
    verts.push(row);
  }

  return verts;
}

// ── Wang tile resolver ───────────────────────────────────────────────

/**
 * Resolve the Wang tile for a cell given its four corner terrains.
 *
 * Returns the tileset name and index, or null if no transition applies
 * (e.g. 3+ terrains at corners — falls back to dominant pure tile).
 */
export function resolveWangTile(
  nw: TerrainId,
  ne: TerrainId,
  sw: TerrainId,
  se: TerrainId,
  transitions: readonly WangTransition[],
  pureTileSources: ReadonlyMap<TerrainId, PureTileSource>,
  normalizeTerrain: (t: TerrainId) => TerrainId = (t) => t,
): WangTileResult | null {
  const corners = [nw, ne, sw, se].map(normalizeTerrain);
  const unique = [...new Set(corners)];

  if (unique.length === 1) {
    // Pure terrain — all corners same
    const src = pureTileSources.get(unique[0]);
    return src ? { tileset: src.tileset, idx: src.idx } : null;
  }

  if (unique.length === 2) {
    // Two-terrain transition — find the matching tileset
    const [a, b] = unique;
    const transition = findTransition(a, b, transitions);
    if (!transition) return null;

    const lo = transition.lower;
    const cornerKey =
      (corners[1] !== lo ? 8 : 0) | // NE
      (corners[0] !== lo ? 4 : 0) | // NW
      (corners[2] !== lo ? 2 : 0) | // SW
      (corners[3] !== lo ? 1 : 0);  // SE
    const idx = WANG_LOOKUP[cornerKey];
    if (idx < 0) return null;
    return { tileset: transition.name, idx };
  }

  // 3+ terrains — fall back to pure tile of most common corner
  const counts = new Map<TerrainId, number>();
  for (const c of corners) counts.set(c, (counts.get(c) ?? 0) + 1);
  let dominant = corners[0];
  let maxCount = 0;
  for (const [terrain, count] of counts) {
    if (count > maxCount) { maxCount = count; dominant = terrain; }
  }
  const src = pureTileSources.get(dominant);
  return src ? { tileset: src.tileset, idx: src.idx } : null;
}

/** Find the transition tileset that handles a pair of terrain types. */
function findTransition(
  a: TerrainId,
  b: TerrainId,
  transitions: readonly WangTransition[],
): WangTransition | null {
  for (const t of transitions) {
    if ((a === t.lower && b === t.upper) || (a === t.upper && b === t.lower)) {
      return t;
    }
  }
  return null;
}

// ── Default terrain config (matches Problocks Light) ─────────────────

/** Standard terrain IDs. */
export const TERRAIN = {
  GRASS: 0,
  GRASS_LIGHT: 1,
  DIRT: 2,
  COBBLE: 3,
  WATER: 4,
  SAND: 5,
} as const;

/** Normalize grass variants to base grass. */
export function normGrassTerrain(t: TerrainId): TerrainId {
  return t === TERRAIN.GRASS_LIGHT ? TERRAIN.GRASS : t;
}

/** Default terrain priority (higher = wins at shared vertex). */
export const DEFAULT_TERRAIN_PRIORITY: ReadonlyMap<TerrainId, number> = new Map([
  [TERRAIN.WATER, 0],
  [TERRAIN.SAND, 1],
  [TERRAIN.GRASS, 2],
  [TERRAIN.DIRT, 3],
  [TERRAIN.COBBLE, 4],
]);

/** Default terrain transitions (Problocks Light tilesets). */
export const DEFAULT_TRANSITIONS: readonly WangTransition[] = [
  { name: 'water-sand', lower: TERRAIN.WATER, upper: TERRAIN.SAND },
  { name: 'sand-grass', lower: TERRAIN.SAND, upper: TERRAIN.GRASS },
  { name: 'grass-dirt', lower: TERRAIN.GRASS, upper: TERRAIN.DIRT },
  { name: 'grass-cobblestone', lower: TERRAIN.GRASS, upper: TERRAIN.COBBLE },
];

/** Default pure tile sources. */
export const DEFAULT_PURE_TILE_SOURCES: ReadonlyMap<TerrainId, PureTileSource> = new Map([
  [TERRAIN.WATER, { tileset: 'water-sand', idx: 6 }],
  [TERRAIN.SAND, { tileset: 'water-sand', idx: 12 }],
  [TERRAIN.GRASS, { tileset: 'sand-grass', idx: 12 }],
  [TERRAIN.DIRT, { tileset: 'grass-dirt', idx: 12 }],
  [TERRAIN.COBBLE, { tileset: 'grass-cobblestone', idx: 12 }],
]);
