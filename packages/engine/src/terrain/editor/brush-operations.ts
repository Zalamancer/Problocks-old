/**
 * Section 4.2 -- Brush Operations
 *
 * Each operation iterates the brush volume and modifies voxels
 * in the VoxelGrid. Operations: Draw, Sculpt, Smooth, Flatten, Paint.
 */

import { VOXEL_SIZE } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import { type VoxelGrid } from "../voxel/voxel-grid.js";
import { type BrushConfig, iterateBrushVoxels } from "./brush.js";

// ── Draw ───────────────────────────────────────────────────────────

/**
 * Draw (add or subtract) terrain.
 * - Add: max(current, falloff) — builds material up
 * - Subtract: current - falloff — carves away
 */
export function applyDraw(
  grid: VoxelGrid,
  center: { x: number; y: number; z: number },
  config: BrushConfig,
  mode: "add" | "subtract",
): void {
  for (const v of iterateBrushVoxels(center, config)) {
    const current = grid.getVoxel(v.wx, v.wy, v.wz);
    if (mode === "add") {
      const occ = Math.max(current.occupancy, v.falloff * config.strength);
      grid.setVoxel(v.wx, v.wy, v.wz, occ, config.material);
    } else {
      const occ = Math.max(0, current.occupancy - v.falloff * config.strength);
      const mat = occ === 0 ? TerrainMaterial.Air : current.material;
      grid.setVoxel(v.wx, v.wy, v.wz, occ, mat);
    }
  }
}

// ── Sculpt ─────────────────────────────────────────────────────────

/**
 * Sculpt — like Draw but gentler (delta scaled by 0.1).
 */
export function applySculpt(
  grid: VoxelGrid,
  center: { x: number; y: number; z: number },
  config: BrushConfig,
  mode: "add" | "subtract",
): void {
  for (const v of iterateBrushVoxels(center, config)) {
    const current = grid.getVoxel(v.wx, v.wy, v.wz);
    const delta = v.falloff * config.strength * 0.1;
    if (mode === "add") {
      const occ = Math.min(1, current.occupancy + delta);
      const mat = current.occupancy > 0 ? current.material : config.material;
      grid.setVoxel(v.wx, v.wy, v.wz, occ, mat);
    } else {
      const occ = Math.max(0, current.occupancy - delta);
      const mat = occ === 0 ? TerrainMaterial.Air : current.material;
      grid.setVoxel(v.wx, v.wy, v.wz, occ, mat);
    }
  }
}

// ── Smooth ─────────────────────────────────────────────────────────

/**
 * Smooth — two-pass: read 6-neighbor averages, then write blended values.
 */
export function applySmooth(
  grid: VoxelGrid,
  center: { x: number; y: number; z: number },
  config: BrushConfig,
): void {
  // Pass 1: collect current + neighbor averages
  const entries: { wx: number; wy: number; wz: number; newOcc: number; falloff: number }[] = [];

  for (const v of iterateBrushVoxels(center, config)) {
    const current = grid.getVoxel(v.wx, v.wy, v.wz);
    const avg = neighborAverage(grid, v.wx, v.wy, v.wz);
    const blendFactor = config.strength * v.falloff;
    const newOcc = current.occupancy + (avg - current.occupancy) * blendFactor;
    entries.push({ wx: v.wx, wy: v.wy, wz: v.wz, newOcc, falloff: v.falloff });
  }

  // Pass 2: write blended values
  for (const e of entries) {
    const current = grid.getVoxel(e.wx, e.wy, e.wz);
    const mat = e.newOcc === 0 ? TerrainMaterial.Air : current.material;
    grid.setVoxel(e.wx, e.wy, e.wz, Math.max(0, Math.min(1, e.newOcc)), mat);
  }
}

/** Average occupancy of the 6 axis-aligned neighbors. */
function neighborAverage(grid: VoxelGrid, wx: number, wy: number, wz: number): number {
  let sum = 0;
  sum += grid.getVoxel(wx - VOXEL_SIZE, wy, wz).occupancy;
  sum += grid.getVoxel(wx + VOXEL_SIZE, wy, wz).occupancy;
  sum += grid.getVoxel(wx, wy - VOXEL_SIZE, wz).occupancy;
  sum += grid.getVoxel(wx, wy + VOXEL_SIZE, wz).occupancy;
  sum += grid.getVoxel(wx, wy, wz - VOXEL_SIZE).occupancy;
  sum += grid.getVoxel(wx, wy, wz + VOXEL_SIZE).occupancy;
  return sum / 6;
}

// ── Flatten ────────────────────────────────────────────────────────

export type FlattenMode = "both" | "erode" | "grow";

/**
 * Flatten — push terrain toward a target Y plane.
 * - erode: only remove above planeY
 * - grow: only fill below planeY
 * - both: do both
 */
export function applyFlatten(
  grid: VoxelGrid,
  center: { x: number; y: number; z: number },
  config: BrushConfig,
  mode: FlattenMode,
  planeY: number,
): void {
  for (const v of iterateBrushVoxels(center, config)) {
    const current = grid.getVoxel(v.wx, v.wy, v.wz);
    const voxelCenterY = v.wy + VOXEL_SIZE / 2;
    const delta = v.falloff * config.strength;

    if (voxelCenterY > planeY && mode !== "grow") {
      // Above plane — reduce occupancy
      const occ = Math.max(0, current.occupancy - delta);
      const mat = occ === 0 ? TerrainMaterial.Air : current.material;
      grid.setVoxel(v.wx, v.wy, v.wz, occ, mat);
    } else if (voxelCenterY <= planeY && mode !== "erode") {
      // Below/at plane — increase occupancy
      const occ = Math.min(1, current.occupancy + delta);
      const mat = current.occupancy > 0 ? current.material : config.material;
      grid.setVoxel(v.wx, v.wy, v.wz, occ, mat);
    }
  }
}

// ── Paint ──────────────────────────────────────────────────────────

/**
 * Paint — change material without altering occupancy.
 * - paint: overwrite material on any solid voxel
 * - replace: only change if material matches `source`
 */
export function applyPaint(
  grid: VoxelGrid,
  center: { x: number; y: number; z: number },
  config: BrushConfig,
  mode: "paint" | "replace",
  source?: TerrainMaterial,
  target?: TerrainMaterial,
): void {
  const paintMat = target ?? config.material;

  for (const v of iterateBrushVoxels(center, config)) {
    const current = grid.getVoxel(v.wx, v.wy, v.wz);
    // Skip air voxels — nothing to paint
    if (current.occupancy <= 0) continue;

    if (mode === "paint") {
      grid.setVoxel(v.wx, v.wy, v.wz, current.occupancy, paintMat);
    } else {
      // Replace: only when material matches source
      if (source !== undefined && current.material === source) {
        grid.setVoxel(v.wx, v.wy, v.wz, current.occupancy, paintMat);
      }
    }
  }
}
