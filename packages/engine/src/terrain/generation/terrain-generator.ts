/**
 * Section 2.3 -- Terrain Generator
 *
 * Orchestrates biome-blended terrain generation: computes per-column
 * heights from blended biome noise, fills voxels with material layers,
 * handles water biome sea-level fill, and delegates cave carving.
 */

import { VoxelGrid } from '../voxel/voxel-grid.js';
import { TerrainMaterial } from '../voxel/terrain-materials.js';
import { VOXEL_SIZE } from '../voxel/constants.js';
import { type BiomeDefinition, BIOMES } from './biome.js';
import { computeBiomeMap, type BiomeMap } from './biome-blender.js';
import { CaveGenerator, type TerrainRegion } from './cave-generator.js';
import { fbm, setNoiseSeed } from '../noise.js';

// ── Interfaces ──────────────────────────────────────────────────────

export interface GenerateOptions {
  /** Which biome IDs to include */
  biomes: string[];
  /** Random seed */
  seed: number;
  /** World-unit spacing between biome cells */
  biomeSize: number;
  /** Biome transition smoothness 0-1 */
  blending: number;
  /** Whether to generate caves */
  caves: boolean;
  /** Optional progress callback (0-1) */
  onProgress?: (progress: number) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Terrain Generator ───────────────────────────────────────────────

export class TerrainGenerator {
  generate(
    grid: VoxelGrid,
    region: TerrainRegion,
    options: GenerateOptions,
  ): void {
    // a) Seed the noise
    setNoiseSeed(options.seed);

    // b) Compute biome map
    const biomeMap: BiomeMap = computeBiomeMap(
      region,
      options.biomes,
      options.seed,
      options.biomeSize,
      options.blending,
    );

    // c) Calculate total columns for progress reporting
    const totalColumns =
      ((region.maxX - region.minX) / VOXEL_SIZE) *
      ((region.maxZ - region.minZ) / VOXEL_SIZE);

    let columnIndex = 0;

    // d) For each (wx, wz) column in the region
    for (let wx = region.minX; wx < region.maxX; wx += VOXEL_SIZE) {
      for (let wz = region.minZ; wz < region.maxZ; wz += VOXEL_SIZE) {
        // i) Get biome blend weights
        const blendWeights = biomeMap.getBlendWeights(wx, wz);

        // ii) Compute blended terrain height
        let height = 0;
        for (const { biome, weight } of blendWeights) {
          const noiseVal = fbm(
            wx * biome.noiseScale + options.seed * 1000,
            wz * biome.noiseScale + options.seed * 1000,
            biome.octaves,
          );
          const biomeHeight =
            biome.baseHeight + noiseVal * biome.heightVariation;
          height += biomeHeight * weight;
        }
        // height is now normalized 0-1

        // iii) Convert to world Y
        const surfaceY =
          region.minY + height * (region.maxY - region.minY);

        // Find dominant biome (highest weight)
        let dominantBiome: BiomeDefinition = blendWeights[0].biome;
        let maxWeight = blendWeights[0].weight;
        for (let i = 1; i < blendWeights.length; i++) {
          if (blendWeights[i].weight > maxWeight) {
            maxWeight = blendWeights[i].weight;
            dominantBiome = blendWeights[i].biome;
          }
        }

        // iv) For each wy from region.minY to region.maxY
        //     Use a wide gradient (3 voxels) so Marching Cubes produces
        //     smooth, rounded surfaces instead of flat/angular ones.
        const GRADIENT_HALF = VOXEL_SIZE * 1.5; // 1.5 voxels of smooth falloff
        for (let wy = region.minY; wy < region.maxY; wy += VOXEL_SIZE) {
          // Well above surface = air
          if (wy > surfaceY + GRADIENT_HALF) continue;

          // Compute occupancy with wide gradient
          const dist = surfaceY - wy; // positive = below surface, negative = above
          let occupancy: number;
          if (dist >= GRADIENT_HALF) {
            occupancy = 1.0; // deep underground — fully solid
          } else if (dist <= -GRADIENT_HALF) {
            occupancy = 0.0; // well above surface — air
          } else {
            // Smooth hermite interpolation across the gradient band
            const t = (dist + GRADIENT_HALF) / (GRADIENT_HALF * 2); // 0 (above) to 1 (below)
            occupancy = t * t * (3 - 2 * t); // smoothstep
          }

          if (occupancy <= 0) continue;

          // Determine material from dominant biome's layers
          const normalizedY =
            (wy - region.minY) / (region.maxY - region.minY);
          const layers = dominantBiome.layers;

          let material: TerrainMaterial = layers[0].material;

          // Iterate from last to first; last matching layer wins
          for (let li = layers.length - 1; li >= 0; li--) {
            const layer = layers[li];
            if (
              normalizedY >= layer.range[0] - layer.noiseStrength &&
              normalizedY <= layer.range[1] + layer.noiseStrength
            ) {
              material = layer.material;
              break;
            }
          }

          // Set voxel
          grid.setVoxel(wx, wy, wz, occupancy, material);
        }

        // v) Handle Water biome specially
        if (dominantBiome.id === 'water') {
          const seaLevel =
            region.minY + 0.3 * (region.maxY - region.minY);

          for (
            let wy = surfaceY;
            wy < seaLevel;
            wy += VOXEL_SIZE
          ) {
            // Only fill if current voxel is air (occupancy <= 0)
            const existing = grid.getVoxel(wx, wy, wz);
            if (existing.occupancy <= 0) {
              grid.setVoxel(wx, wy, wz, 1.0, TerrainMaterial.Water);
            }
          }
        }

        // vi) Report progress every 100 columns
        columnIndex++;
        if (options.onProgress && columnIndex % 100 === 0) {
          options.onProgress(columnIndex / totalColumns);
        }
      }
    }

    // e) After all columns: if caves enabled, carve caves
    if (options.caves) {
      new CaveGenerator().carve(grid, region, options.seed, biomeMap);
    }

    // f) Final progress report
    options.onProgress?.(1.0);
  }
}
