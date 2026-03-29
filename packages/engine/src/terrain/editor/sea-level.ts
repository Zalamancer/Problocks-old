/**
 * Section 6.4 -- Sea Level Tool
 *
 * Fill empty voxels below a given Y level with Water material,
 * or evaporate (remove) all water in a region.
 */

import { VOXEL_SIZE } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import type { VoxelGrid } from "../voxel/voxel-grid.js";
import type { TerrainSelection } from "./region-select.js";

/**
 * Fill empty voxels below `waterLevel` with Water material.
 * Voxels at the water surface get partial occupancy for a smooth water line.
 *
 * @param grid       The voxel grid to modify
 * @param selection  Region to fill with water
 * @param waterLevel World-space Y coordinate of the water surface
 */
export function createSeaLevel(
  grid: VoxelGrid,
  selection: TerrainSelection,
  waterLevel: number,
): void {
  const startX = snapValue(selection.min.x);
  const startZ = snapValue(selection.min.z);
  const endX = snapValue(selection.max.x);
  const endZ = snapValue(selection.max.z);

  const startY = snapValue(selection.min.y);
  const endY = snapValue(Math.min(selection.max.y, waterLevel));

  for (let wz = startZ; wz <= endZ; wz += VOXEL_SIZE) {
    for (let wx = startX; wx <= endX; wx += VOXEL_SIZE) {
      for (let wy = startY; wy <= endY; wy += VOXEL_SIZE) {
        const voxel = grid.getVoxel(wx, wy, wz);

        // Only fill empty (air) voxels — don't overwrite existing terrain
        if (voxel.occupancy > 0) continue;

        // Compute occupancy: full below surface, partial at surface
        const voxelTop = wy + VOXEL_SIZE;
        let occupancy: number;

        if (voxelTop <= waterLevel) {
          // Fully below water level
          occupancy = 1.0;
        } else if (wy >= waterLevel) {
          // Fully above water level — skip
          continue;
        } else {
          // Partial: fraction of voxel below the water line
          occupancy = (waterLevel - wy) / VOXEL_SIZE;
        }

        grid.setVoxel(wx, wy, wz, occupancy, TerrainMaterial.Water);
      }
    }
  }
}

/**
 * Remove all Water-material voxels in the selection (set to Air).
 *
 * @param grid      The voxel grid to modify
 * @param selection Region to evaporate
 */
export function evaporateWater(
  grid: VoxelGrid,
  selection: TerrainSelection,
): void {
  for (const { wx, wy, wz } of selection.iterateVoxels()) {
    const voxel = grid.getVoxel(wx, wy, wz);
    if (voxel.material === TerrainMaterial.Water && voxel.occupancy > 0) {
      grid.setVoxel(wx, wy, wz, 0, TerrainMaterial.Air);
    }
  }
}

// ── Snap helper ───────────────────────────────────────────────────

function snapValue(v: number): number {
  return Math.floor(v / VOXEL_SIZE) * VOXEL_SIZE;
}
