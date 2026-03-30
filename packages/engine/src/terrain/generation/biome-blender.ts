/**
 * Section 2.2 -- Biome Blender
 *
 * Assigns biomes to terrain via Voronoi-based spatial partitioning with
 * inverse-distance-weighted blending. A seeded pseudo-random generator
 * distributes Voronoi seed points on a jittered grid so biomes tile
 * deterministically from the world seed.
 */

import { BiomeDefinition, BIOMES } from './biome.js';
import { TerrainRegion, CaveBiomeAccessor } from './cave-generator.js';
import { VOXEL_SIZE } from '../voxel/constants.js';

// ── Interfaces ──────────────────────────────────────────────────────

export interface BiomeBlendWeight {
  biome: BiomeDefinition;
  weight: number; // 0-1, all weights sum to 1.0
}

// ── Seeded RNG ──────────────────────────────────────────────────────

/**
 * Create a seeded pseudo-random number generator using the Park-Miller LCG.
 * Returns values in [0, 1).
 */
function createRng(seed: number): () => number {
  let s = ((seed % 2147483647) + 2147483647) % 2147483647;
  if (s === 0) s = 1;
  return (): number => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── BiomeMap ────────────────────────────────────────────────────────

export class BiomeMap implements CaveBiomeAccessor {
  constructor(
    private points: { x: number; z: number; biome: BiomeDefinition }[],
    private blending: number, // 0-1, higher = smoother transitions
  ) {}

  /**
   * Get blended biome weights at a world X/Z position.
   * Returns the N closest biome points weighted by inverse distance.
   */
  getBlendWeights(wx: number, wz: number): BiomeBlendWeight[] {
    const pts = this.points;
    const len = pts.length;

    // Compute squared distances to all points
    const dists: { index: number; distSq: number }[] = new Array(len);
    for (let i = 0; i < len; i++) {
      const dx = wx - pts[i].x;
      const dz = wz - pts[i].z;
      dists[i] = { index: i, distSq: dx * dx + dz * dz };
    }

    // Find the 3 nearest points (partial sort)
    const k = Math.min(3, len);
    for (let i = 0; i < k; i++) {
      let minIdx = i;
      for (let j = i + 1; j < len; j++) {
        if (dists[j].distSq < dists[minIdx].distSq) {
          minIdx = j;
        }
      }
      if (minIdx !== i) {
        const tmp = dists[i];
        dists[i] = dists[minIdx];
        dists[minIdx] = tmp;
      }
    }

    const nearest = dists.slice(0, k);

    // Hard boundaries: blending disabled or very low
    if (this.blending < 0.01) {
      return [{ biome: pts[nearest[0].index].biome, weight: 1.0 }];
    }

    // Handle the degenerate case where a point is exactly at a Voronoi site
    for (const n of nearest) {
      if (n.distSq < 1e-10) {
        return [{ biome: pts[n.index].biome, weight: 1.0 }];
      }
    }

    // Inverse distance weighting: rawWeight = 1 / (distance ^ (2 / blending))
    const exponent = 2 / this.blending;
    let totalWeight = 0;
    const rawWeights: { biome: BiomeDefinition; weight: number }[] = [];

    for (const n of nearest) {
      const dist = Math.sqrt(n.distSq);
      const w = 1 / Math.pow(dist, exponent);
      rawWeights.push({ biome: pts[n.index].biome, weight: w });
      totalWeight += w;
    }

    // Normalize so weights sum to 1.0
    for (const rw of rawWeights) {
      rw.weight /= totalWeight;
    }

    // Filter out negligible contributions (< 0.01)
    const filtered = rawWeights.filter((rw) => rw.weight >= 0.01);

    // Always return at least one entry
    if (filtered.length === 0) {
      return [{ biome: pts[nearest[0].index].biome, weight: 1.0 }];
    }

    // Re-normalize after filtering
    if (filtered.length < rawWeights.length) {
      let sum = 0;
      for (const f of filtered) sum += f.weight;
      for (const f of filtered) f.weight /= sum;
    }

    return filtered;
  }

  /**
   * Get the cave threshold at a world X/Z position.
   * Returns the weighted average of each biome's caveThreshold.
   */
  getCaveThreshold(wx: number, wz: number): number {
    const weights = this.getBlendWeights(wx, wz);
    let threshold = 0;
    for (const w of weights) {
      threshold += w.biome.caveThreshold * w.weight;
    }
    return threshold;
  }
}

// ── computeBiomeMap ─────────────────────────────────────────────────

export function computeBiomeMap(
  region: TerrainRegion,
  enabledBiomeIds: string[],
  seed: number,
  biomeSize: number, // world units — spacing between Voronoi points
  blending: number, // 0-1
): BiomeMap {
  const rng = createRng(seed);

  // Resolve enabled biome definitions
  const enabledBiomes: BiomeDefinition[] = [];
  for (const id of enabledBiomeIds) {
    const biome = BIOMES[id];
    if (biome) enabledBiomes.push(biome);
  }

  // Fallback: if no valid biomes, use all
  if (enabledBiomes.length === 0) {
    for (const key of Object.keys(BIOMES)) {
      enabledBiomes.push(BIOMES[key]);
    }
  }

  // Determine grid bounds — extend one cell beyond region in each direction
  const cellMinX = Math.floor(region.minX / biomeSize) - 1;
  const cellMaxX = Math.floor(region.maxX / biomeSize) + 1;
  const cellMinZ = Math.floor(region.minZ / biomeSize) - 1;
  const cellMaxZ = Math.floor(region.maxZ / biomeSize) + 1;

  // Generate Voronoi seed points on a jittered grid
  const points: { x: number; z: number; biome: BiomeDefinition }[] = [];
  const jitterRange = 0.4; // ±40% of biomeSize

  for (let cx = cellMinX; cx <= cellMaxX; cx++) {
    for (let cz = cellMinZ; cz <= cellMaxZ; cz++) {
      // Cell center
      const centerX = (cx + 0.5) * biomeSize;
      const centerZ = (cz + 0.5) * biomeSize;

      // Random jitter: ±40% of biomeSize
      const jx = (rng() * 2 - 1) * jitterRange * biomeSize;
      const jz = (rng() * 2 - 1) * jitterRange * biomeSize;

      // Random biome from enabled set
      const biomeIndex = Math.floor(rng() * enabledBiomes.length);
      const biome = enabledBiomes[biomeIndex];

      points.push({
        x: centerX + jx,
        z: centerZ + jz,
        biome,
      });
    }
  }

  return new BiomeMap(points, blending);
}
