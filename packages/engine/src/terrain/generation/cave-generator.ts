/**
 * Section 2.4 -- Cave Generator
 *
 * Carves cave networks into existing terrain using a dual 3D Perlin noise
 * technique. Caves form where two independent noise fields both approach
 * zero -- the intersection of two implicit 3D surfaces produces natural
 * worm-like tunnels.
 *
 * Includes a self-contained seeded 3D Perlin noise implementation to avoid
 * modifying the existing 2D-only noise module.
 */

import { VoxelGrid } from "../voxel/voxel-grid.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import { VOXEL_SIZE } from "../voxel/constants.js";

// ── Interfaces ──────────────────────────────────────────────────────

export interface TerrainRegion {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface CaveBiomeAccessor {
  /** Get the cave threshold at a world X/Z position. 0 = no caves. */
  getCaveThreshold(wx: number, wz: number): number;
}

// ── 3D Perlin Noise (seeded, self-contained) ────────────────────────

/**
 * 12 gradient vectors for 3D Perlin noise.
 * These point from the center of a cube to its edges,
 * giving good distribution across all directions.
 */
const GRAD3: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 1],
  [0, -1, 1],
  [0, 1, -1],
  [0, -1, -1],
];

/** Quintic fade curve: 6t^5 - 15t^4 + 10t^3 */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Linear interpolation. */
function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/** Dot product of a gradient vector with the distance vector (dx, dy, dz). */
function grad(hash: number, x: number, y: number, z: number): number {
  const g = GRAD3[hash % 12];
  return g[0] * x + g[1] * y + g[2] * z;
}

/**
 * Create a seeded 3D Perlin noise function.
 *
 * Builds a 256-entry permutation table shuffled via Fisher-Yates with a
 * simple LCG seeded by `seed`. Returns a closure that evaluates 3D Perlin
 * noise at any point, producing values in roughly [-1, 1].
 */
function createNoise3D(seed: number): (x: number, y: number, z: number) => number {
  // Build permutation table
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;

  // Fisher-Yates shuffle with LCG (Lehmer / Park-Miller)
  let s = ((seed % 2147483647) + 2147483647) % 2147483647; // ensure positive
  if (s === 0) s = 1;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }

  // Double the table to avoid index wrapping
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  return (x: number, y: number, z: number): number => {
    // Unit cube containing the point
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    // Fractional position within the cube
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    // Fade curves
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    // Hash the 8 cube corners through the permutation table
    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;

    // Gradient dot products at each corner, then trilinear interpolation
    return lerp(
      lerp(
        lerp(grad(perm[AA], xf, yf, zf), grad(perm[BA], xf - 1, yf, zf), u),
        lerp(grad(perm[AB], xf, yf - 1, zf), grad(perm[BB], xf - 1, yf - 1, zf), u),
        v,
      ),
      lerp(
        lerp(grad(perm[AA + 1], xf, yf, zf - 1), grad(perm[BA + 1], xf - 1, yf, zf - 1), u),
        lerp(grad(perm[AB + 1], xf, yf - 1, zf - 1), grad(perm[BB + 1], xf - 1, yf - 1, zf - 1), u),
        v,
      ),
      w,
    );
  };
}

// ── Cave Generator ──────────────────────────────────────────────────

export class CaveGenerator {
  /**
   * Carve caves into existing terrain by setting voxels to air.
   *
   * Uses dual 3D noise channels -- caves form where both noises are
   * near zero (intersection of two 3D surfaces = worm-like tunnels).
   *
   * @param grid           The voxel grid to carve into.
   * @param region         Axis-aligned bounding box to process.
   * @param seed           World seed for deterministic generation.
   * @param biomeAccessor  Provides per-position cave threshold.
   */
  carve(
    grid: VoxelGrid,
    region: TerrainRegion,
    seed: number,
    biomeAccessor: CaveBiomeAccessor,
  ): void {
    // Two noise channels with distinct seeds
    const noise1 = createNoise3D(seed + 100);
    const noise2 = createNoise3D(seed + 200);

    // Iterate every voxel position in the region (step by VOXEL_SIZE).
    // Skip the very bottom layer to preserve a floor.
    const yStart = region.minY + VOXEL_SIZE;

    for (let wx = region.minX; wx < region.maxX; wx += VOXEL_SIZE) {
      for (let wz = region.minZ; wz < region.maxZ; wz += VOXEL_SIZE) {
        // Early-out: biome has no caves at this column
        const threshold = biomeAccessor.getCaveThreshold(wx, wz);
        if (threshold === 0) continue;

        for (let wy = yStart; wy < region.maxY; wy += VOXEL_SIZE) {
          // Only carve voxels that are currently solid
          const voxel = grid.getVoxel(wx, wy, wz);
          if (voxel.occupancy <= 0) continue;

          // Evaluate both noise fields at slightly different scales
          const n1 = noise1(wx * 0.02, wy * 0.02, wz * 0.02);
          const n2 = noise2(wx * 0.015, wy * 0.015, wz * 0.015);

          // Cave density: sum of absolute values.
          // Both noises near zero => small density => cave.
          const density = Math.abs(n1) + Math.abs(n2);

          if (density < threshold) {
            grid.setVoxel(wx, wy, wz, 0, TerrainMaterial.Air);
          }
        }
      }
    }
  }
}
