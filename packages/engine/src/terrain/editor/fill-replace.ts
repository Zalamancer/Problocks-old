/**
 * Section 6.3 -- Fill & Replace Tool
 *
 * Bulk operations on terrain regions: fill all voxels with a material,
 * or selectively replace one material with another.
 */

import { VOXEL_SIZE } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import type { VoxelGrid } from "../voxel/voxel-grid.js";
import type { TerrainSelection } from "./region-select.js";

/**
 * Fill every voxel in the selection with a single material at full occupancy.
 *
 * @param grid      The voxel grid to modify
 * @param selection Region to fill
 * @param material  Material to write
 */
export function fillRegion(
  grid: VoxelGrid,
  selection: TerrainSelection,
  material: TerrainMaterial,
): void {
  for (const { wx, wy, wz } of selection.iterateVoxels()) {
    grid.setVoxel(wx, wy, wz, 1.0, material);
  }
}

/**
 * Replace all voxels of `source` material with `target` material
 * within the selection. Only occupancy > 0 voxels are checked.
 *
 * @param grid      The voxel grid to modify
 * @param selection Region to process
 * @param source    Material to find
 * @param target    Material to replace with
 */
export function replaceInRegion(
  grid: VoxelGrid,
  selection: TerrainSelection,
  source: TerrainMaterial,
  target: TerrainMaterial,
): void {
  for (const { wx, wy, wz } of selection.iterateVoxels()) {
    const voxel = grid.getVoxel(wx, wy, wz);
    if (voxel.occupancy > 0 && voxel.material === source) {
      grid.setVoxel(wx, wy, wz, voxel.occupancy, target);
    }
  }
}
