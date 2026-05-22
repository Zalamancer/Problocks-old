/**
 * Procedural generation toolkit — barrel exports.
 */

// Types
export type {
  Room,
  Corridor,
  DungeonResult,
  WFCTile,
  WFCResult,
  PoissonPoint,
  NoiseConfig,
  LSystemRule,
  LSystemConfig,
  LSystemResult,
} from './types.js';

// Noise & PRNG
export {
  noise2D,
  fbm2D,
  createRNG,
  randomInt,
  randomFloat,
  shuffle,
} from './noise.js';

// BSP dungeon generator
export { generateDungeon } from './bsp-dungeon.js';
export type { DungeonOptions } from './bsp-dungeon.js';

// Wave Function Collapse
export { solveWFC } from './wfc.js';
export type { WFCOptions } from './wfc.js';

// Poisson disk sampling
export { poissonDisk } from './poisson.js';
export type { PoissonOptions } from './poisson.js';

// L-Systems
export { generateLSystem } from './lsystem.js';

// Seeded Simplex noise & PRNG
export { SimplexNoise, SeededRNG } from './simplex-noise.js';

// World generation pipeline
export type {
  TerrainType,
  ZoneType,
  WorldNPC,
  PlayerStart,
  ObjectPlacementRule,
  Footprint,
  WorldData,
  WorldGenConfig,
} from './world-gen.js';
export {
  ZONES,
  generateTerrain,
  stampTownPlaza,
  detectZones,
  canPlace,
  stampObject,
  placeObjects,
  placeBridges,
  placeNPCs,
  findPlayerStart,
  generateWorld,
  DEFAULT_FOOTPRINTS,
  DEFAULT_WALKABLE_OBJECTS,
  DEFAULT_ZONE_OBJECTS,
} from './world-gen.js';
