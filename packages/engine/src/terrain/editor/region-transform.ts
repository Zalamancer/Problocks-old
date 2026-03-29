/**
 * Section 6.2 -- Region Transform Tool
 *
 * Copy voxels from a selection, apply position/rotation/scale transform,
 * and write to a new location in the grid.
 */

import { VOXEL_SIZE } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import type { VoxelGrid } from "../voxel/voxel-grid.js";
import type { TerrainSelection, Vec3 } from "./region-select.js";

// ── Snap helper ───────────────────────────────────────────────────

function snapValue(v: number): number {
  return Math.floor(v / VOXEL_SIZE) * VOXEL_SIZE;
}

// ── Types ─────────────────────────────────────────────────────────

export interface RegionTransform {
  /** World-space translation offset */
  position: Vec3;
  /**
   * Rotation in degrees around Y axis (yaw only for voxel grids —
   * X/Z rotations cause heavy resampling and are rarely useful).
   * Supports 0, 90, 180, 270 for lossless rotation.
   */
  rotationY: number;
  /** Scale factors per axis (1 = no change) */
  scale: Vec3;
}

// ── Default transform ─────────────────────────────────────────────

export function defaultRegionTransform(): RegionTransform {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotationY: 0,
    scale: { x: 1, y: 1, z: 1 },
  };
}

// ── Transform ─────────────────────────────────────────────────────

/**
 * Copy voxels from the selection, apply transform, write to new location.
 *
 * @param grid        The voxel grid to modify
 * @param selection   Source region
 * @param transform   Position/rotation/scale to apply
 * @param mergeEmpty  When false, air voxels in source don't overwrite destination
 * @param clearSource When true, clear the original region after writing (move)
 */
export function transformRegion(
  grid: VoxelGrid,
  selection: TerrainSelection,
  transform: RegionTransform,
  mergeEmpty: boolean = false,
  clearSource: boolean = false,
): void {
  // 1. Read source voxels
  const sourceVoxels: {
    lx: number;
    ly: number;
    lz: number;
    occupancy: number;
    material: TerrainMaterial;
  }[] = [];

  const originX = snapValue(selection.min.x);
  const originY = snapValue(selection.min.y);
  const originZ = snapValue(selection.min.z);

  for (const { wx, wy, wz } of selection.iterateVoxels()) {
    const voxel = grid.getVoxel(wx, wy, wz);
    // Store all voxels if mergeEmpty, otherwise only non-air
    if (mergeEmpty || voxel.occupancy > 0) {
      sourceVoxels.push({
        lx: wx - originX,
        ly: wy - originY,
        lz: wz - originZ,
        occupancy: voxel.occupancy,
        material: voxel.material,
      });
    }
  }

  // 2. Clear source if this is a move
  if (clearSource) {
    for (const { wx, wy, wz } of selection.iterateVoxels()) {
      grid.setVoxel(wx, wy, wz, 0, TerrainMaterial.Air);
    }
  }

  // 3. Compute rotation (snap to nearest 90 degrees)
  const rotSteps = Math.round(((transform.rotationY % 360) + 360) % 360 / 90) % 4;
  const cos = [1, 0, -1, 0][rotSteps];
  const sin = [0, 1, 0, -1][rotSteps];

  // Center of source region for rotation pivot
  const halfX = (selection.sizeX - VOXEL_SIZE) / 2;
  const halfZ = (selection.sizeZ - VOXEL_SIZE) / 2;

  // 4. Apply transform and write
  const { position, scale } = transform;

  for (const sv of sourceVoxels) {
    // Center-relative coordinates for rotation
    const cx = sv.lx - halfX;
    const cz = sv.lz - halfZ;

    // Rotate around Y
    const rx = cx * cos - cz * sin;
    const rz = cx * sin + cz * cos;

    // Scale from center
    const sx = rx * scale.x;
    const sy = sv.ly * scale.y;
    const sz = rz * scale.z;

    // Translate: restore from center + add position offset
    const wx = snapValue(sx + halfX + originX + position.x);
    const wy = snapValue(sy + originY + position.y);
    const wz = snapValue(sz + halfZ + originZ + position.z);

    grid.setVoxel(wx, wy, wz, sv.occupancy, sv.material);
  }
}
