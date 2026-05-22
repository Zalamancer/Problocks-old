/**
 * Seeded world generation pipeline.
 *
 * Generates a complete 2D game world from a single seed:
 * terrain → town plaza → zones → objects → bridges → NPCs → player spawn.
 *
 * All output is deterministic — same seed always produces the same world.
 */

import { SimplexNoise, SeededRNG } from './simplex-noise.js';
import { TERRAIN } from '../tilemap/wang-tile.js';
export type { TerrainId as TerrainType } from '../tilemap/wang-tile.js';

// Re-export TERRAIN so consumers can import from either location
export { TERRAIN };

// ── Types ────────────────────────────────────────────────────────────

/** Zone type identifiers. */
export const ZONES = {
  NONE: 0,
  TOWN: 1,
  CAVE: 2,
  BEACH: 3,
  FARM: 4,
  FOREST: 5,
} as const;

export type ZoneType = (typeof ZONES)[keyof typeof ZONES];

/** NPC definition in generated world. */
export interface WorldNPC {
  id: string;
  name: string;
  sprite: string;
  x: number;
  y: number;
}

/** Player start position. */
export interface PlayerStart {
  x: number;
  y: number;
}

/** Object placement rule for a zone. */
export interface ObjectPlacementRule {
  /** Object IDs to choose from. */
  ids: number[];
  /** Percentage of zone tiles to fill (0–100). Mutually exclusive with total. */
  density?: number;
  /** Fixed number of objects to place. Mutually exclusive with density. */
  total?: number;
  /** Minimum tile spacing around placed objects. */
  spacing: number;
}

/** Object footprint in tiles [width, height]. */
export type Footprint = [number, number];

/** Complete generated world data. */
export interface WorldData {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  layers: {
    ground: number[][];
    objects: number[][];
    collision: number[][];
  };
  npcs: WorldNPC[];
  playerStart: PlayerStart;
}

/** Configuration for world generation. */
export interface WorldGenConfig {
  /** Tile size in pixels. Default: 16. */
  tileSize?: number;
  /** Base noise frequency. Default: 0.03. */
  baseFreq?: number;
  /** Detail noise frequency. Default: 0.1. */
  detailFreq?: number;
  /** Detail noise amplitude. Default: 0.2. */
  detailAmp?: number;
  /** Radial bias strength. Default: 0.3. */
  radialBias?: number;
  /** Terrain thresholds [water, sand, grass]. Default: [0.20, 0.45, 0.93]. */
  thresholds?: [number, number, number];
  /** Grass light variation chance (0–1). Default: 0.15. */
  grassLightChance?: number;
  /** Plaza size range [min, max]. Default: [6, 10]. */
  plazaSize?: [number, number];
  /** Edge band for forest zone. Default: 10. */
  forestEdgeBand?: number;
  /** Cave area size. Default: 15. */
  caveSize?: number;
  /** Object footprints by object ID. */
  objectFootprints?: ReadonlyMap<number, Footprint>;
  /** Set of object IDs that don't block movement. */
  walkableObjects?: ReadonlySet<number>;
  /** Zone object placement rules. */
  zoneObjects?: Partial<Record<ZoneType, ObjectPlacementRule[]>>;
  /** NPC definitions to place. */
  npcDefs?: Array<{ id: string; name: string; sprite: string }>;
}

// ── Default object registry ──────────────────────────────────────────

/** Default footprints (tiles) for each object ID. */
export const DEFAULT_FOOTPRINTS: ReadonlyMap<number, Footprint> = new Map([
  [1, [2, 2]], [2, [2, 2]],                         // trees
  [3, [1, 1]], [4, [1, 1]], [5, [1, 1]],             // bush, rock, fence
  [6, [4, 4]], [7, [4, 4]], [8, [4, 4]],             // shops
  [9, [4, 4]], [10, [4, 4]],                         // farmhouses
  [11, [5, 4]], [12, [5, 4]],                        // barns
  [13, [4, 3]], [14, [4, 3]],                        // caves
  [15, [4, 2]], [16, [4, 2]],                        // docks
  [17, [2, 1]], [18, [1, 2]],                        // bridges
  [19, [1, 1]], [20, [1, 1]], [21, [1, 1]],           // flowers, tall grass, sign
  [22, [1, 1]], [23, [2, 1]], [24, [1, 1]], [25, [1, 1]], [26, [1, 1]],
]);

/** Objects that don't block movement. */
export const DEFAULT_WALKABLE_OBJECTS: ReadonlySet<number> = new Set([19, 20, 26]);

/** Default zone→object rules. */
export const DEFAULT_ZONE_OBJECTS: Record<number, ObjectPlacementRule[]> = {
  [ZONES.FOREST]: [
    { ids: [1, 2], density: 8, spacing: 1 },
    { ids: [3], density: 3, spacing: 0 },
    { ids: [20], density: 5, spacing: 0 },
    { ids: [26], density: 2, spacing: 0 },
    { ids: [4], density: 2, spacing: 0 },
  ],
  [ZONES.TOWN]: [
    { ids: [6, 7, 8], total: 3, spacing: 6 },
    { ids: [22], density: 3, spacing: 0 },
    { ids: [23], density: 2, spacing: 0 },
    { ids: [21], total: 2, spacing: 0 },
    { ids: [24], density: 2, spacing: 0 },
  ],
  [ZONES.FARM]: [
    { ids: [9, 10], total: 2, spacing: 6 },
    { ids: [11, 12], total: 2, spacing: 6 },
    { ids: [5], density: 8, spacing: 0 },
    { ids: [25], total: 1, spacing: 0 },
  ],
  [ZONES.BEACH]: [
    { ids: [15, 16], total: 1, spacing: 0 },
    { ids: [4], density: 3, spacing: 0 },
  ],
  [ZONES.CAVE]: [
    { ids: [13, 14], total: 1, spacing: 0 },
    { ids: [4], density: 6, spacing: 0 },
  ],
};

/** Default NPC definitions. */
const DEFAULT_NPCS = [
  { id: 'teacher', name: 'Prof. Stellar', sprite: 'npc_teacher' },
  { id: 'shopkeeper', name: 'Merchant Rosa', sprite: 'npc_shop' },
  { id: 'librarian', name: 'Sage Lumen', sprite: 'npc_library' },
];

// ── Terrain generation ───────────────────────────────────────────────

function normTerrain(t: number): number {
  return t === TERRAIN.GRASS_LIGHT ? TERRAIN.GRASS : t;
}

/** Generate terrain layer from seed. */
export function generateTerrain(
  seed: number,
  w: number,
  h: number,
  config?: Partial<WorldGenConfig>,
): number[][] {
  const noise = new SimplexNoise(seed);
  const rng = new SeededRNG(seed + 1);
  const baseFreq = config?.baseFreq ?? 0.03;
  const detailFreq = config?.detailFreq ?? 0.1;
  const detailAmp = config?.detailAmp ?? 0.2;
  const radialStr = config?.radialBias ?? 0.3;
  const thresholds = config?.thresholds ?? [0.20, 0.45, 0.93];
  const grassChance = config?.grassLightChance ?? 0.15;

  const cx = w / 2;
  const cy = h / 2;
  const ground: number[][] = [];

  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) {
      const base = noise.noise2D(x * baseFreq, y * baseFreq);
      const detail = noise.noise2D(x * detailFreq, y * detailFreq) * detailAmp;
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radialBias = (1 - dist) * radialStr;

      let val = (base + detail + radialBias + 1) / 2;
      val = Math.max(0, Math.min(1, val));

      let terrain: number;
      if (val < thresholds[0]) terrain = TERRAIN.WATER;
      else if (val < thresholds[1]) terrain = TERRAIN.SAND;
      else if (val < thresholds[2]) terrain = TERRAIN.GRASS;
      else terrain = TERRAIN.DIRT;

      if (terrain === TERRAIN.GRASS && rng.next() < grassChance) {
        terrain = TERRAIN.GRASS_LIGHT;
      }

      row.push(terrain);
    }
    ground.push(row);
  }

  enforceTerrainBands(ground, w, h);
  return ground;
}

/**
 * Enforce that terrain transitions always have at least 1 tile of
 * intermediate terrain. Runs up to 4 passes until stable.
 */
function enforceTerrainBands(ground: number[][], w: number, h: number): void {
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = normTerrain(ground[y][x]);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const n = normTerrain(ground[ny][nx]);
            if (t === n) continue;

            if (t === TERRAIN.WATER && (n === TERRAIN.GRASS || n === TERRAIN.DIRT)) {
              ground[ny][nx] = TERRAIN.SAND;
              changed = true;
            }
            if ((t === TERRAIN.GRASS || t === TERRAIN.DIRT) && n === TERRAIN.WATER) {
              ground[y][x] = TERRAIN.SAND;
              changed = true;
            }
            if (t === TERRAIN.SAND && n === TERRAIN.DIRT) {
              ground[y][x] = TERRAIN.GRASS;
              changed = true;
            }
            if (t === TERRAIN.DIRT && n === TERRAIN.SAND) {
              ground[ny][nx] = TERRAIN.GRASS;
              changed = true;
            }
          }
        }
      }
    }
    if (!changed) break;
  }
}

// ── Town plaza ───────────────────────────────────────────────────────

/** Stamp a cobblestone plaza with grass buffer at the map center. */
export function stampTownPlaza(
  seed: number,
  ground: number[][],
  w: number,
  h: number,
  config?: Partial<WorldGenConfig>,
): void {
  const rng = new SeededRNG(seed + 100);
  const [minSize, maxSize] = config?.plazaSize ?? [6, 10];
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const pw = minSize + rng.nextInt(maxSize - minSize + 1);
  const ph = minSize + rng.nextInt(maxSize - minSize + 1);
  const px = cx - Math.floor(pw / 2);
  const py = cy - Math.floor(ph / 2);

  for (let dy = -1; dy <= ph; dy++) {
    for (let dx = -1; dx <= pw; dx++) {
      const tx = px + dx;
      const ty = py + dy;
      if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;
      if (dx === -1 || dx === pw || dy === -1 || dy === ph) {
        if (ground[ty][tx] === TERRAIN.DIRT) ground[ty][tx] = TERRAIN.GRASS;
      } else {
        ground[ty][tx] = TERRAIN.COBBLE;
      }
    }
  }
}

// ── Zone detection ───────────────────────────────────────────────────

/** Detect zones from terrain and assign each tile a zone type. */
export function detectZones(
  seed: number,
  ground: number[][],
  w: number,
  h: number,
  config?: Partial<WorldGenConfig>,
): number[][] {
  const edgeBand = config?.forestEdgeBand ?? 10;
  const caveSize = config?.caveSize ?? 15;
  const zones: number[][] = [];
  for (let y = 0; y < h; y++) zones.push(new Array(w).fill(ZONES.NONE));

  // Pass 1: Town — cobblestone and dirt tiles
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ground[y][x] === TERRAIN.COBBLE || ground[y][x] === TERRAIN.DIRT) {
        zones[y][x] = ZONES.TOWN;
      }
    }
  }

  // Pass 2: Cave — highest dirt-scoring quadrant corner
  const halfW = Math.floor(w / 2);
  const halfH = Math.floor(h / 2);
  const quadrants = [
    { sx: 0, sy: 0 },
    { sx: halfW, sy: 0 },
    { sx: 0, sy: halfH },
    { sx: halfW, sy: halfH },
  ];
  let bestQ = 0;
  let bestScore = -1;
  for (let q = 0; q < 4; q++) {
    let score = 0;
    const { sx, sy } = quadrants[q];
    for (let y = sy; y < sy + halfH && y < h; y++) {
      for (let x = sx; x < sx + halfW && x < w; x++) {
        if (ground[y][x] === TERRAIN.DIRT) score++;
      }
    }
    if (score > bestScore) { bestScore = score; bestQ = q; }
  }
  const caveQ = quadrants[bestQ];
  const caveX = bestQ % 2 === 0 ? caveQ.sx : caveQ.sx + halfW - caveSize;
  const caveY = bestQ < 2 ? caveQ.sy : caveQ.sy + halfH - caveSize;
  for (let y = Math.max(0, caveY); y < Math.min(h, caveY + caveSize); y++) {
    for (let x = Math.max(0, caveX); x < Math.min(w, caveX + caveSize); x++) {
      if (zones[y][x] === ZONES.NONE) zones[y][x] = ZONES.CAVE;
    }
  }

  // Pass 3: Beach — sand adjacent to water
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (normTerrain(ground[y][x]) !== TERRAIN.SAND) continue;
      const hasWater =
        (y > 0 && ground[y - 1][x] === TERRAIN.WATER) ||
        (y < h - 1 && ground[y + 1][x] === TERRAIN.WATER) ||
        (x > 0 && ground[y][x - 1] === TERRAIN.WATER) ||
        (x < w - 1 && ground[y][x + 1] === TERRAIN.WATER);
      if (hasWater && zones[y][x] === ZONES.NONE) zones[y][x] = ZONES.BEACH;
    }
  }

  // Pass 4: Forest — grass within edge band
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (normTerrain(ground[y][x]) === TERRAIN.GRASS &&
          (x < edgeBand || x >= w - edgeBand || y < edgeBand || y >= h - edgeBand)) {
        if (zones[y][x] === ZONES.NONE) zones[y][x] = ZONES.FOREST;
      }
    }
  }

  // Pass 5: Farm — grass within 3 tiles of town
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (normTerrain(ground[y][x]) !== TERRAIN.GRASS || zones[y][x] !== ZONES.NONE) continue;
      let nearTown = false;
      outer: for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w && zones[ny][nx] === ZONES.TOWN) {
            nearTown = true;
            break outer;
          }
        }
      }
      if (nearTown) zones[y][x] = ZONES.FARM;
    }
  }

  return zones;
}

// ── Object placement ─────────────────────────────────────────────────

/** Check whether an object can be placed at (x, y) with given footprint. */
export function canPlace(
  objects: number[][],
  collision: number[][],
  x: number,
  y: number,
  fw: number,
  fh: number,
  w: number,
  h: number,
  spacing: number,
): boolean {
  if (x < 0 || y < 0 || x + fw > w || y + fh > h) return false;
  for (let dy = -spacing; dy < fh + spacing; dy++) {
    for (let dx = -spacing; dx < fw + spacing; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      if (objects[ty][tx] !== 0 || collision[ty][tx] !== 0) return false;
    }
  }
  return true;
}

/** Stamp an object and its collision footprint. */
export function stampObject(
  objects: number[][],
  collision: number[][],
  x: number,
  y: number,
  objId: number,
  fw: number,
  fh: number,
  walkable: ReadonlySet<number>,
): void {
  objects[y][x] = objId;
  if (!walkable.has(objId)) {
    for (let dy = 0; dy < fh; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        collision[y + dy][x + dx] = 1;
      }
    }
  }
}

/** Place objects in zones based on density/total rules. */
export function placeObjects(
  seed: number,
  ground: number[][],
  zones: number[][],
  w: number,
  h: number,
  config?: Partial<WorldGenConfig>,
): { objects: number[][]; collision: number[][] } {
  const rng = new SeededRNG(seed + 200);
  const footprints = config?.objectFootprints ?? DEFAULT_FOOTPRINTS;
  const walkable = config?.walkableObjects ?? DEFAULT_WALKABLE_OBJECTS;
  const zoneObjectRules = config?.zoneObjects ?? DEFAULT_ZONE_OBJECTS;

  const objects: number[][] = [];
  const collision: number[][] = [];
  for (let y = 0; y < h; y++) {
    objects.push(new Array(w).fill(0));
    collision.push(new Array(w).fill(0));
  }

  // Block water and map border
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ground[y][x] === TERRAIN.WATER) collision[y][x] = 1;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) collision[y][x] = 1;
    }
  }

  // Collect tiles per zone
  const zoneTiles: Record<number, [number, number][]> = {};
  for (const z of Object.values(ZONES)) zoneTiles[z] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      zoneTiles[zones[y][x]].push([x, y]);
    }
  }

  // Place objects per zone
  for (const [zone, rules] of Object.entries(zoneObjectRules)) {
    const tiles = zoneTiles[Number(zone)];
    if (!tiles || tiles.length === 0) continue;

    for (const rule of rules) {
      const count = rule.total ?? Math.floor(tiles.length * (rule.density ?? 0) / 100);
      let placed = 0;
      const shuffled = [...tiles];
      rng.shuffle(shuffled);

      for (const [tx, ty] of shuffled) {
        if (placed >= count) break;
        const objId = rule.ids[rng.nextInt(rule.ids.length)];
        const [fw, fh] = footprints.get(objId) ?? [1, 1];
        if (canPlace(objects, collision, tx, ty, fw, fh, w, h, rule.spacing)) {
          stampObject(objects, collision, tx, ty, objId, fw, fh, walkable);
          placed++;
        }
      }
    }
  }

  return { objects, collision };
}

// ── Bridge placement ─────────────────────────────────────────────────

/** Detect 1-tile water gaps between paths and place bridges. */
export function placeBridges(
  seed: number,
  ground: number[][],
  objects: number[][],
  collision: number[][],
  w: number,
  h: number,
  footprints?: ReadonlyMap<number, Footprint>,
  walkable?: ReadonlySet<number>,
): void {
  const fp = footprints ?? DEFAULT_FOOTPRINTS;
  const walk = walkable ?? DEFAULT_WALKABLE_OBJECTS;

  const isPath = (t: number) => t === TERRAIN.DIRT || t === TERRAIN.COBBLE;

  // Horizontal bridges
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 2; x++) {
      if (isPath(ground[y][x]) &&
          ground[y][x + 1] === TERRAIN.WATER &&
          x + 2 < w && isPath(ground[y][x + 2])) {
        const [fw, fh] = fp.get(17) ?? [2, 1];
        if (canPlace(objects, collision, x + 1, y, fw, fh, w, h, 0)) {
          stampObject(objects, collision, x + 1, y, 17, fw, fh, walk);
        }
      }
    }
  }

  // Vertical bridges
  for (let y = 1; y < h - 2; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (isPath(ground[y][x]) &&
          ground[y + 1][x] === TERRAIN.WATER &&
          y + 2 < h && isPath(ground[y + 2][x])) {
        const [fw, fh] = fp.get(18) ?? [1, 2];
        if (canPlace(objects, collision, x, y + 1, fw, fh, w, h, 0)) {
          stampObject(objects, collision, x, y + 1, 18, fw, fh, walk);
        }
      }
    }
  }
}

// ── NPC placement ────────────────────────────────────────────────────

/** Place NPCs on walkable town tiles. */
export function placeNPCs(
  seed: number,
  zones: number[][],
  objects: number[][],
  collision: number[][],
  w: number,
  h: number,
  npcDefs?: Array<{ id: string; name: string; sprite: string }>,
): WorldNPC[] {
  const rng = new SeededRNG(seed + 300);
  const defs = npcDefs ?? DEFAULT_NPCS;
  const npcs: WorldNPC[] = defs.map((d) => ({ ...d, x: 0, y: 0 }));

  const townTiles: [number, number][] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (zones[y][x] === ZONES.TOWN && objects[y][x] === 0 && collision[y][x] === 0) {
        townTiles.push([x, y]);
      }
    }
  }

  rng.shuffle(townTiles);

  for (let i = 0; i < npcs.length; i++) {
    if (i < townTiles.length) {
      npcs[i].x = townTiles[i][0];
      npcs[i].y = townTiles[i][1];
    } else {
      npcs[i].x = Math.floor(w / 2) + i;
      npcs[i].y = Math.floor(h / 2);
    }
  }

  return npcs;
}

// ── Player spawn ─────────────────────────────────────────────────────

/** Find a walkable non-water tile near the center. */
export function findPlayerStart(
  ground: number[][],
  collision: number[][],
  w: number,
  h: number,
): PlayerStart {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  for (let r = 0; r < Math.max(w, h); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < w && y >= 0 && y < h &&
            collision[y][x] === 0 &&
            ground[y][x] !== TERRAIN.WATER) {
          return { x, y };
        }
      }
    }
  }
  return { x: cx, y: cy };
}

// ── Main generator ───────────────────────────────────────────────────

/** Generate a complete world from a seed. */
export function generateWorld(
  seed: number,
  width: number,
  height: number,
  config?: Partial<WorldGenConfig>,
): WorldData {
  const ground = generateTerrain(seed, width, height, config);
  stampTownPlaza(seed, ground, width, height, config);
  const zones = detectZones(seed, ground, width, height, config);
  const { objects, collision } = placeObjects(seed, ground, zones, width, height, config);
  placeBridges(seed, ground, objects, collision, width, height,
    config?.objectFootprints, config?.walkableObjects);
  const npcs = placeNPCs(seed, zones, objects, collision, width, height, config?.npcDefs);
  const playerStart = findPlayerStart(ground, collision, width, height);

  return {
    name: 'generated',
    width,
    height,
    tileSize: config?.tileSize ?? 16,
    layers: { ground, objects, collision },
    npcs,
    playerStart,
  };
}
