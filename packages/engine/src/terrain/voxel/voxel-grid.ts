/**
 * Section 1.4 -- VoxelGrid
 *
 * Top-level container managing a sparse collection of chunks.
 * Handles world-to-chunk coordinate conversion, voxel read/write,
 * and cross-chunk boundary dirtying for seamless mesh updates.
 */

import { CHUNK_SIZE, CHUNK_WORLD_SIZE, VOXEL_SIZE } from "./constants.js";
import { TerrainMaterial } from "./terrain-materials.js";
import { type Voxel } from "./voxel.js";
import { Chunk } from "./chunk.js";

// ── Key helper ──────────────────────────────────────────────────────

function chunkKey(cx: number, cy: number, cz: number): string {
  return `${cx},${cy},${cz}`;
}

// ── VoxelGrid ───────────────────────────────────────────────────────

export class VoxelGrid {
  private chunks: Map<string, Chunk> = new Map();

  // ── Coordinate conversion ────────────────────────────────────────

  /**
   * Convert world position to chunk coordinates.
   * Math.floor handles negative coordinates correctly:
   *   floor(-1 / 64) = -1, floor(100 / 64) = 1, etc.
   */
  worldToChunk(
    wx: number,
    wy: number,
    wz: number,
  ): { cx: number; cy: number; cz: number } {
    return {
      cx: Math.floor(wx / CHUNK_WORLD_SIZE),
      cy: Math.floor(wy / CHUNK_WORLD_SIZE),
      cz: Math.floor(wz / CHUNK_WORLD_SIZE),
    };
  }

  /**
   * Convert world position to local voxel index within its chunk.
   * Bitwise AND with (CHUNK_SIZE - 1) masks to 0..15.
   *
   * Handles negatives correctly:
   *   floor(-4 / 4) = -1, then -1 & 15 = 15 (wraps around)
   */
  worldToLocal(
    wx: number,
    wy: number,
    wz: number,
  ): { lx: number; ly: number; lz: number } {
    const mask = CHUNK_SIZE - 1;
    return {
      lx: Math.floor(wx / VOXEL_SIZE) & mask,
      ly: Math.floor(wy / VOXEL_SIZE) & mask,
      lz: Math.floor(wz / VOXEL_SIZE) & mask,
    };
  }

  // ── Chunk access ─────────────────────────────────────────────────

  /** Look up a chunk by its chunk coordinates. Returns undefined if absent. */
  getChunk(cx: number, cy: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cy, cz));
  }

  /** Get existing chunk or create a new one at the given chunk coordinates. */
  getOrCreateChunk(cx: number, cy: number, cz: number): Chunk {
    const key = chunkKey(cx, cy, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cy, cz);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  // ── Voxel access ─────────────────────────────────────────────────

  /**
   * Write a voxel at world coordinates.
   *
   * Converts to chunk + local, writes the voxel, then marks any
   * neighboring chunks dirty when the local coordinate sits on a
   * chunk boundary (so their meshes update at the seam).
   */
  setVoxel(
    wx: number,
    wy: number,
    wz: number,
    occupancy: number,
    material: TerrainMaterial,
  ): void {
    const { cx, cy, cz } = this.worldToChunk(wx, wy, wz);
    const { lx, ly, lz } = this.worldToLocal(wx, wy, wz);

    const chunk = this.getOrCreateChunk(cx, cy, cz);
    chunk.setVoxel(lx, ly, lz, occupancy, material);

    // Mark neighboring chunks dirty at all 6 boundary faces
    const last = CHUNK_SIZE - 1;

    if (lx === 0) this.markNeighborDirty(cx - 1, cy, cz);
    if (lx === last) this.markNeighborDirty(cx + 1, cy, cz);

    if (ly === 0) this.markNeighborDirty(cx, cy - 1, cz);
    if (ly === last) this.markNeighborDirty(cx, cy + 1, cz);

    if (lz === 0) this.markNeighborDirty(cx, cy, cz - 1);
    if (lz === last) this.markNeighborDirty(cx, cy, cz + 1);
  }

  /**
   * Read a voxel at world coordinates.
   * Returns Air (occupancy 0) for missing chunks.
   */
  getVoxel(wx: number, wy: number, wz: number): Voxel {
    const { cx, cy, cz } = this.worldToChunk(wx, wy, wz);
    const chunk = this.getChunk(cx, cy, cz);
    if (!chunk) {
      return { occupancy: 0, material: TerrainMaterial.Air };
    }
    const { lx, ly, lz } = this.worldToLocal(wx, wy, wz);
    return chunk.getVoxel(lx, ly, lz);
  }

  // ── Query methods ────────────────────────────────────────────────

  /** Collect all chunks whose dirty flag is true. */
  getDirtyChunks(): Chunk[] {
    const result: Chunk[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.dirty) {
        result.push(chunk);
      }
    }
    return result;
  }

  /** Remove all chunks from the grid. */
  clearAll(): void {
    this.chunks.clear();
  }

  /** Delete chunks that are empty and have no mesh geometry to display. */
  pruneEmpty(): void {
    for (const [key, chunk] of this.chunks) {
      if (chunk.isEmpty) {
        this.chunks.delete(key);
      }
    }
  }

  // ── Utility ──────────────────────────────────────────────────────

  /** Number of chunks currently tracked. */
  get chunkCount(): number {
    return this.chunks.size;
  }

  /** Iterator over all chunks. */
  getAllChunks(): IterableIterator<Chunk> {
    return this.chunks.values();
  }

  // ── Private helpers ──────────────────────────────────────────────

  /** If a chunk exists at the given chunk coords, mark it dirty. */
  private markNeighborDirty(cx: number, cy: number, cz: number): void {
    const neighbor = this.chunks.get(chunkKey(cx, cy, cz));
    if (neighbor) {
      neighbor.dirty = true;
    }
  }
}
