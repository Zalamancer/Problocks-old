/**
 * Section 2.1 -- Biome Definitions
 *
 * Defines biome presets with terrain height parameters, material layers,
 * cave thresholds, and blending weights. Layer ranges overlap slightly
 * so the terrain generator can produce smooth, organic transitions.
 */

import { TerrainMaterial } from '../voxel/terrain-materials.js';

// ── Interfaces ──────────────────────────────────────────────────────

export interface BiomeLayer {
  material: TerrainMaterial;
  /** Normalized height range [min, max] where 0 = bottom, 1 = top */
  range: [number, number];
  /** 3D noise perturbation strength for organic layer boundaries */
  noiseStrength: number;
}

export interface BiomeDefinition {
  id: string;
  name: string;
  /** Base terrain height (0-1 normalized, relative to region height) */
  baseHeight: number;
  /** Amplitude of height variation (0-1) */
  heightVariation: number;
  /** Noise frequency for height function */
  noiseScale: number;
  /** FBM octave count */
  octaves: number;
  /** Material layers from bottom to top */
  layers: BiomeLayer[];
  /** Cave density threshold -- lower = more caves, 0 = no caves */
  caveThreshold: number;
  /** Weight for biome blending */
  weight: number;
}

// ── Biome presets ───────────────────────────────────────────────────

export const BIOMES: Record<string, BiomeDefinition> = {
  arctic: {
    id: 'arctic',
    name: 'Arctic',
    baseHeight: 0.3,
    heightVariation: 0.4,
    noiseScale: 0.02,
    octaves: 5,
    layers: [
      { material: TerrainMaterial.Rock,    range: [0, 0.15],    noiseStrength: 0.03 },
      { material: TerrainMaterial.Ice,     range: [0.12, 0.4],  noiseStrength: 0.05 },
      { material: TerrainMaterial.Glacier, range: [0.35, 0.7],  noiseStrength: 0.06 },
      { material: TerrainMaterial.Snow,    range: [0.65, 1.0],  noiseStrength: 0.04 },
    ],
    caveThreshold: 0,
    weight: 1.0,
  },

  dunes: {
    id: 'dunes',
    name: 'Dunes',
    baseHeight: 0.25,
    heightVariation: 0.3,
    noiseScale: 0.015,
    octaves: 4,
    layers: [
      { material: TerrainMaterial.Sandstone, range: [0, 0.2],   noiseStrength: 0.04 },
      { material: TerrainMaterial.Sand,      range: [0.15, 1.0], noiseStrength: 0.06 },
    ],
    caveThreshold: 0,
    weight: 1.0,
  },

  canyons: {
    id: 'canyons',
    name: 'Canyons',
    baseHeight: 0.5,
    heightVariation: 0.5,
    noiseScale: 0.025,
    octaves: 6,
    layers: [
      { material: TerrainMaterial.Sand,      range: [0, 0.15],   noiseStrength: 0.03 },
      { material: TerrainMaterial.Sandstone, range: [0.1, 0.5],  noiseStrength: 0.05 },
      { material: TerrainMaterial.Rock,      range: [0.45, 0.8], noiseStrength: 0.06 },
      { material: TerrainMaterial.Slate,     range: [0.75, 1.0], noiseStrength: 0.04 },
    ],
    caveThreshold: 0.3,
    weight: 1.0,
  },

  lavascape: {
    id: 'lavascape',
    name: 'Lavascape',
    baseHeight: 0.2,
    heightVariation: 0.6,
    noiseScale: 0.03,
    octaves: 5,
    layers: [
      { material: TerrainMaterial.CrackedLava, range: [0, 0.25],   noiseStrength: 0.08 },
      { material: TerrainMaterial.Basalt,      range: [0.2, 0.6],  noiseStrength: 0.05 },
      { material: TerrainMaterial.Rock,        range: [0.55, 1.0], noiseStrength: 0.04 },
    ],
    caveThreshold: 0.2,
    weight: 1.0,
  },

  water: {
    id: 'water',
    name: 'Water',
    baseHeight: 0.1,
    heightVariation: 0.05,
    noiseScale: 0.01,
    octaves: 3,
    layers: [
      { material: TerrainMaterial.Sand, range: [0, 0.3],   noiseStrength: 0.02 },
      { material: TerrainMaterial.Mud,  range: [0.25, 1.0], noiseStrength: 0.03 },
    ],
    caveThreshold: 0,
    weight: 1.0,
  },

  mountains: {
    id: 'mountains',
    name: 'Mountains',
    baseHeight: 0.5,
    heightVariation: 0.5,
    noiseScale: 0.02,
    octaves: 7,
    layers: [
      { material: TerrainMaterial.Ground, range: [0, 0.15],   noiseStrength: 0.03 },
      { material: TerrainMaterial.Grass,  range: [0.1, 0.35],  noiseStrength: 0.05 },
      { material: TerrainMaterial.Rock,   range: [0.3, 0.7],   noiseStrength: 0.06 },
      { material: TerrainMaterial.Snow,   range: [0.65, 1.0],  noiseStrength: 0.04 },
    ],
    caveThreshold: 0.15,
    weight: 1.0,
  },

  hills: {
    id: 'hills',
    name: 'Hills',
    baseHeight: 0.3,
    heightVariation: 0.25,
    noiseScale: 0.025,
    octaves: 5,
    layers: [
      { material: TerrainMaterial.Ground, range: [0, 0.2],    noiseStrength: 0.04 },
      { material: TerrainMaterial.Grass,  range: [0.15, 0.7],  noiseStrength: 0.05 },
      { material: TerrainMaterial.Rock,   range: [0.65, 1.0],  noiseStrength: 0.03 },
    ],
    caveThreshold: 0,
    weight: 1.0,
  },

  plains: {
    id: 'plains',
    name: 'Plains',
    baseHeight: 0.2,
    heightVariation: 0.08,
    noiseScale: 0.02,
    octaves: 4,
    layers: [
      { material: TerrainMaterial.Ground, range: [0, 0.3],    noiseStrength: 0.03 },
      { material: TerrainMaterial.Grass,  range: [0.25, 1.0],  noiseStrength: 0.04 },
    ],
    caveThreshold: 0,
    weight: 1.0,
  },

  marsh: {
    id: 'marsh',
    name: 'Marsh',
    baseHeight: 0.15,
    heightVariation: 0.1,
    noiseScale: 0.03,
    octaves: 4,
    layers: [
      { material: TerrainMaterial.Mud,        range: [0, 0.4],    noiseStrength: 0.05 },
      { material: TerrainMaterial.Ground,     range: [0.35, 0.7],  noiseStrength: 0.04 },
      { material: TerrainMaterial.LeafyGrass, range: [0.65, 1.0],  noiseStrength: 0.06 },
    ],
    caveThreshold: 0,
    weight: 1.0,
  },
};

// ── Helpers ─────────────────────────────────────────────────────────

/** Return all biome IDs. */
export function getBiomeIds(): string[] {
  return Object.keys(BIOMES);
}

/** Look up a biome definition by ID. */
export function getBiome(id: string): BiomeDefinition | undefined {
  return BIOMES[id];
}
