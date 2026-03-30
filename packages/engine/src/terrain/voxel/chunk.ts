/**
 * Section 1.3 -- Chunk
 *
 * A 16x16x16 block of voxels. Tracks its own dirty state for remeshing
 * and provides read/write access to individual voxels by local coords.
 */

import { CHUNK_WORLD_SIZE } from "./constants.js";
import { TerrainMaterial } from "./terrain-materials.js";
import { type Voxel, ChunkData, voxelIndex } from "./voxel.js";

export class Chunk {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;

  readonly data: ChunkData;

  dirty: boolean = true;
  isEmpty: boolean = true;

  constructor(cx: number, cy: number, cz: number) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.data = new ChunkData();
  }

  // ── Derived position ────────────────────────────────────────────────

  /** World-space origin of this chunk (lower corner). */
  get worldOrigin(): { x: number; y: number; z: number } {
    return {
      x: this.cx * CHUNK_WORLD_SIZE,
      y: this.cy * CHUNK_WORLD_SIZE,
      z: this.cz * CHUNK_WORLD_SIZE,
    };
  }

  // ── Single-voxel access ─────────────────────────────────────────────

  /**
   * Read voxel at local coordinates (each 0-15).
   */
  getVoxel(lx: number, ly: number, lz: number): Voxel {
    const i = voxelIndex(lx, ly, lz);
    return {
      occupancy: this.data.occupancy[i],
      material: this.data.materials[i] as TerrainMaterial,
    };
  }

  /**
   * Write occupancy and material at local coordinates (each 0-15).
   * Marks the chunk dirty for remeshing.
   */
  setVoxel(
    lx: number,
    ly: number,
    lz: number,
    occupancy: number,
    material: TerrainMaterial,
  ): void {
    const i = voxelIndex(lx, ly, lz);
    this.data.occupancy[i] = occupancy;
    this.data.materials[i] = material;
    this.dirty = true;
    this.isEmpty = false; // conservative — actual emptiness recalculated on remesh
  }

  // ── Bulk operations ─────────────────────────────────────────────────

  /**
   * Fill every voxel in the chunk with the given occupancy and material.
   * Uses typed-array `.fill()` for speed.
   */
  fill(occupancy: number, material: TerrainMaterial): void {
    this.data.occupancy.fill(occupancy);
    this.data.materials.fill(material);
    this.dirty = true;
    this.isEmpty = occupancy === 0 && material === TerrainMaterial.Air;
  }

  /**
   * Reset every voxel to Air with zero occupancy.
   */
  clear(): void {
    this.data.occupancy.fill(0);
    this.data.materials.fill(TerrainMaterial.Air);
    this.dirty = true;
    this.isEmpty = true;
  }
}
