/**
 * Section 6.1 -- Region Selection
 *
 * Axis-aligned bounding box selection for terrain regions.
 * Stores min/max world coordinates and an optional clipboard
 * for copy/cut/paste operations.
 */

import { VOXEL_SIZE } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import type { VoxelGrid } from "../voxel/voxel-grid.js";

// ── Types ─────────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Stored voxel data for clipboard operations. */
export interface ClipboardEntry {
  /** Offset from selection min corner (in voxel steps) */
  lx: number;
  ly: number;
  lz: number;
  occupancy: number;
  material: TerrainMaterial;
}

/** Clipboard holding copied/cut voxel data. */
export interface TerrainClipboard {
  /** Size of the copied region in world units */
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  entries: ClipboardEntry[];
}

// ── TerrainSelection ──────────────────────────────────────────────

export class TerrainSelection {
  /** World-space min corner (inclusive) */
  min: Vec3;
  /** World-space max corner (inclusive) */
  max: Vec3;
  /** Stored clipboard data from copy/cut */
  clipboard: TerrainClipboard | null = null;

  constructor(min: Vec3, max: Vec3) {
    // Ensure min <= max on each axis
    this.min = {
      x: Math.min(min.x, max.x),
      y: Math.min(min.y, max.y),
      z: Math.min(min.z, max.z),
    };
    this.max = {
      x: Math.max(min.x, max.x),
      y: Math.max(min.y, max.y),
      z: Math.max(min.z, max.z),
    };
  }

  /** Snap both corners to the voxel grid. */
  snapToGrid(): void {
    this.min = snapVec3(this.min);
    this.max = snapVec3(this.max);
  }

  /** Width (X) of the selection in world units. */
  get sizeX(): number {
    return this.max.x - this.min.x + VOXEL_SIZE;
  }

  /** Height (Y) of the selection in world units. */
  get sizeY(): number {
    return this.max.y - this.min.y + VOXEL_SIZE;
  }

  /** Depth (Z) of the selection in world units. */
  get sizeZ(): number {
    return this.max.z - this.min.z + VOXEL_SIZE;
  }

  /** Center of the selection in world units. */
  get center(): Vec3 {
    return {
      x: (this.min.x + this.max.x) / 2,
      y: (this.min.y + this.max.y) / 2,
      z: (this.min.z + this.max.z) / 2,
    };
  }

  /** Check if a world position is inside the selection. */
  contains(wx: number, wy: number, wz: number): boolean {
    return (
      wx >= this.min.x && wx <= this.max.x &&
      wy >= this.min.y && wy <= this.max.y &&
      wz >= this.min.z && wz <= this.max.z
    );
  }

  /**
   * Iterate all voxel positions within the selection.
   * Yields world-space coordinates snapped to voxel grid.
   */
  *iterateVoxels(): Generator<{ wx: number; wy: number; wz: number }> {
    const startX = snapValue(this.min.x);
    const startY = snapValue(this.min.y);
    const startZ = snapValue(this.min.z);
    const endX = snapValue(this.max.x);
    const endY = snapValue(this.max.y);
    const endZ = snapValue(this.max.z);

    for (let wz = startZ; wz <= endZ; wz += VOXEL_SIZE) {
      for (let wy = startY; wy <= endY; wy += VOXEL_SIZE) {
        for (let wx = startX; wx <= endX; wx += VOXEL_SIZE) {
          yield { wx, wy, wz };
        }
      }
    }
  }

  /**
   * Copy voxels from the grid into the clipboard.
   * Only stores non-air voxels to save memory.
   */
  copy(grid: VoxelGrid): void {
    const entries: ClipboardEntry[] = [];
    const originX = snapValue(this.min.x);
    const originY = snapValue(this.min.y);
    const originZ = snapValue(this.min.z);

    for (const { wx, wy, wz } of this.iterateVoxels()) {
      const voxel = grid.getVoxel(wx, wy, wz);
      if (voxel.occupancy > 0) {
        entries.push({
          lx: wx - originX,
          ly: wy - originY,
          lz: wz - originZ,
          occupancy: voxel.occupancy,
          material: voxel.material,
        });
      }
    }

    this.clipboard = {
      sizeX: this.sizeX,
      sizeY: this.sizeY,
      sizeZ: this.sizeZ,
      entries,
    };
  }

  /**
   * Cut voxels — copy then clear the region.
   */
  cut(grid: VoxelGrid): void {
    this.copy(grid);
    this.clearRegion(grid);
  }

  /**
   * Paste clipboard contents at a target world position.
   * @param mergeEmpty If false, air voxels in clipboard don't overwrite destination.
   */
  paste(grid: VoxelGrid, target: Vec3, mergeEmpty: boolean = false): void {
    if (!this.clipboard) return;

    const tx = snapValue(target.x);
    const ty = snapValue(target.y);
    const tz = snapValue(target.z);

    if (!mergeEmpty) {
      // Only write non-air entries (already filtered in copy)
      for (const entry of this.clipboard.entries) {
        grid.setVoxel(
          tx + entry.lx,
          ty + entry.ly,
          tz + entry.lz,
          entry.occupancy,
          entry.material,
        );
      }
    } else {
      // First clear the destination region, then write
      const endX = tx + this.clipboard.sizeX - VOXEL_SIZE;
      const endY = ty + this.clipboard.sizeY - VOXEL_SIZE;
      const endZ = tz + this.clipboard.sizeZ - VOXEL_SIZE;
      for (let wz = tz; wz <= endZ; wz += VOXEL_SIZE) {
        for (let wy = ty; wy <= endY; wy += VOXEL_SIZE) {
          for (let wx = tx; wx <= endX; wx += VOXEL_SIZE) {
            grid.setVoxel(wx, wy, wz, 0, TerrainMaterial.Air);
          }
        }
      }
      for (const entry of this.clipboard.entries) {
        grid.setVoxel(
          tx + entry.lx,
          ty + entry.ly,
          tz + entry.lz,
          entry.occupancy,
          entry.material,
        );
      }
    }
  }

  /**
   * Duplicate — copy and paste at an offset.
   */
  duplicate(grid: VoxelGrid, offset: Vec3): void {
    this.copy(grid);
    this.paste(grid, {
      x: this.min.x + offset.x,
      y: this.min.y + offset.y,
      z: this.min.z + offset.z,
    });
  }

  /**
   * Delete all voxels in the selection.
   */
  clearRegion(grid: VoxelGrid): void {
    for (const { wx, wy, wz } of this.iterateVoxels()) {
      grid.setVoxel(wx, wy, wz, 0, TerrainMaterial.Air);
    }
  }

  /** Move the selection box by a delta. */
  translate(dx: number, dy: number, dz: number): void {
    this.min.x += dx;
    this.min.y += dy;
    this.min.z += dz;
    this.max.x += dx;
    this.max.y += dy;
    this.max.z += dz;
  }

  /** Scale the selection from its center. */
  scaleFromCenter(sx: number, sy: number, sz: number): void {
    const c = this.center;
    const halfX = this.sizeX / 2;
    const halfY = this.sizeY / 2;
    const halfZ = this.sizeZ / 2;

    this.min = {
      x: c.x - halfX * sx,
      y: c.y - halfY * sy,
      z: c.z - halfZ * sz,
    };
    this.max = {
      x: c.x + halfX * sx,
      y: c.y + halfY * sy,
      z: c.z + halfZ * sz,
    };
  }
}

// ── Snap helpers ──────────────────────────────────────────────────

function snapValue(v: number): number {
  return Math.floor(v / VOXEL_SIZE) * VOXEL_SIZE;
}

function snapVec3(v: Vec3): Vec3 {
  return {
    x: snapValue(v.x),
    y: snapValue(v.y),
    z: snapValue(v.z),
  };
}
