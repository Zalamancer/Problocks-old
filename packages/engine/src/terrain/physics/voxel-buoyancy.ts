/**
 * Section 7.3 -- Voxel Buoyancy
 *
 * Samples the VoxelGrid around an entity's bounding box to compute
 * submersion fraction, then applies buoyancy force and water drag.
 * Replaces fixed-plane buoyancy with voxel-accurate water detection.
 */

import { VOXEL_SIZE } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import type { VoxelGrid } from "../voxel/voxel-grid.js";

// ── Types ─────────────────────────────────────────────────────────────

export interface BuoyancyBounds {
  /** World-space min corner of entity AABB. */
  minX: number;
  minY: number;
  minZ: number;
  /** World-space max corner of entity AABB. */
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface BuoyancyResult {
  /** 0 = fully above water, 1 = fully submerged. */
  submersion: number;
  /** Number of water voxels overlapping the entity bounds. */
  waterVoxelCount: number;
  /** Total voxels sampled within the bounds. */
  totalSampled: number;
}

export interface BuoyancyForce {
  /** Upward force (positive Y). */
  forceY: number;
  /** Drag force components opposing velocity. */
  dragX: number;
  dragY: number;
  dragZ: number;
}

// ── Configuration ─────────────────────────────────────────────────────

export interface BuoyancyConfig {
  /** Gravity magnitude (positive, typically 9.81). */
  gravity: number;
  /** Drag coefficient applied when submerged. */
  waterDrag: number;
}

export const DEFAULT_BUOYANCY_CONFIG: BuoyancyConfig = {
  gravity: 9.81,
  waterDrag: 3.0,
};

// ── Submersion Sampling ───────────────────────────────────────────────

/**
 * Sample the VoxelGrid within an AABB to determine what fraction of the
 * volume is occupied by water voxels.
 *
 * Samples at VOXEL_SIZE intervals (one sample per voxel cell) for accuracy
 * without over-sampling.
 */
export function sampleSubmersion(
  grid: VoxelGrid,
  bounds: BuoyancyBounds,
): BuoyancyResult {
  const step = VOXEL_SIZE;
  let waterCount = 0;
  let totalCount = 0;

  for (let y = bounds.minY; y < bounds.maxY; y += step) {
    for (let x = bounds.minX; x < bounds.maxX; x += step) {
      for (let z = bounds.minZ; z < bounds.maxZ; z += step) {
        totalCount++;
        const voxel = grid.getVoxel(x, y, z);
        if (voxel.material === TerrainMaterial.Water && voxel.occupancy > 0.5) {
          waterCount++;
        }
      }
    }
  }

  // Avoid division by zero for degenerate bounds
  const submersion = totalCount > 0 ? waterCount / totalCount : 0;

  return {
    submersion,
    waterVoxelCount: waterCount,
    totalSampled: totalCount,
  };
}

// ── Force Computation ─────────────────────────────────────────────────

/**
 * Compute buoyancy upward force and drag from submersion fraction.
 *
 * Buoyancy = submersion * gravity * mass  (Archimedes' principle approximation)
 * Drag     = submersion * waterDrag * velocity  (linear drag)
 */
export function computeBuoyancyForce(
  submersion: number,
  mass: number,
  velocity: { x: number; y: number; z: number },
  config: BuoyancyConfig = DEFAULT_BUOYANCY_CONFIG,
): BuoyancyForce {
  const { gravity, waterDrag } = config;

  // Buoyancy pushes upward proportional to how submerged the entity is
  const forceY = submersion * gravity * mass;

  // Drag opposes velocity proportional to submersion
  const dragFactor = submersion * waterDrag;
  const dragX = -velocity.x * dragFactor;
  const dragY = -velocity.y * dragFactor;
  const dragZ = -velocity.z * dragFactor;

  return { forceY, dragX, dragY, dragZ };
}
