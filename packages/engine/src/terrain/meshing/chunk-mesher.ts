/**
 * Section 1.7 -- Chunk Mesher
 *
 * Orchestrates Marching Cubes mesh generation for a single chunk,
 * splitting voxel data into separate solid and water passes and
 * providing neighbor-sampling callbacks for seamless cross-chunk seams.
 */

import { CHUNK_SIZE, CHUNK_VOLUME } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import { voxelIndex } from "../voxel/voxel.js";
import { type Chunk } from "../voxel/chunk.js";
import { type VoxelGrid } from "../voxel/voxel-grid.js";
import { marchingCubes, type ChunkMeshData } from "./marching-cubes.js";

// ── Result type ────────────────────────────────────────────────────────

export interface ChunkMeshResult {
  /** Non-water terrain mesh */
  solid: ChunkMeshData;
  /** Water-only mesh (separate for transparency) */
  water: ChunkMeshData;
  /** Wall-clock time taken to generate both meshes (ms) */
  meshTimeMs: number;
}

// ── ChunkMesher ────────────────────────────────────────────────────────

export class ChunkMesher {
  /**
   * Generate mesh data for a chunk using Marching Cubes.
   *
   * Produces two separate meshes: one for solid (non-water) terrain and
   * one for water, so the renderer can apply transparency to water
   * independently.
   *
   * @param chunk - The chunk to mesh
   * @param grid  - The VoxelGrid (needed for reading neighbor chunks at boundaries)
   * @returns Separate solid and water mesh data with profiling info
   */
  meshChunk(
    chunk: Chunk,
    grid: VoxelGrid,
    colorOverrides?: Map<number, [number, number, number]>,
  ): ChunkMeshResult {
    const t0 = performance.now();

    // ── (a) Split chunk data into solid and water layers ──────────

    const solidOccupancy = new Float32Array(CHUNK_VOLUME);
    const solidMaterials = new Uint8Array(CHUNK_VOLUME);
    const waterOccupancy = new Float32Array(CHUNK_VOLUME);
    const waterMaterials = new Uint8Array(CHUNK_VOLUME);

    const srcOcc = chunk.data.occupancy;
    const srcMat = chunk.data.materials;

    for (let i = 0; i < CHUNK_VOLUME; i++) {
      if (srcMat[i] === TerrainMaterial.Water) {
        // Water voxel: goes into water arrays only
        waterOccupancy[i] = srcOcc[i];
        waterMaterials[i] = srcMat[i];
        // solidOccupancy[i] remains 0 (air)
        // solidMaterials[i] remains 0 (Air)
      } else {
        // Non-water voxel: goes into solid arrays only
        solidOccupancy[i] = srcOcc[i];
        solidMaterials[i] = srcMat[i];
        // waterOccupancy[i] remains 0 (air)
        // waterMaterials[i] remains 0 (Air)
      }
    }

    // ── (b) Build neighbor callbacks ─────────────────────────────

    const cx = chunk.cx;
    const cy = chunk.cy;
    const cz = chunk.cz;

    /**
     * Resolve a local coordinate that may lie outside [0, CHUNK_SIZE)
     * into the correct neighbor chunk and local index within it.
     * Returns the chunk (or undefined if it doesn't exist) and the
     * corrected local coords.
     */
    function resolveNeighbor(
      lx: number, ly: number, lz: number,
    ): { neighbor: Chunk | undefined; nlx: number; nly: number; nlz: number } {
      let offsetX = 0;
      let offsetY = 0;
      let offsetZ = 0;
      let nlx = lx;
      let nly = ly;
      let nlz = lz;

      if (lx < 0) {
        offsetX = -1;
        nlx = lx + CHUNK_SIZE; // -1 -> 15
      } else if (lx >= CHUNK_SIZE) {
        offsetX = 1;
        nlx = lx - CHUNK_SIZE; // 16 -> 0
      }

      if (ly < 0) {
        offsetY = -1;
        nly = ly + CHUNK_SIZE;
      } else if (ly >= CHUNK_SIZE) {
        offsetY = 1;
        nly = ly - CHUNK_SIZE;
      }

      if (lz < 0) {
        offsetZ = -1;
        nlz = lz + CHUNK_SIZE;
      } else if (lz >= CHUNK_SIZE) {
        offsetZ = 1;
        nlz = lz - CHUNK_SIZE;
      }

      const neighbor = grid.getChunk(cx + offsetX, cy + offsetY, cz + offsetZ);
      return { neighbor, nlx, nly, nlz };
    }

    // -- Solid neighbor callbacks (water treated as air) --

    function solidGetNeighborOccupancy(lx: number, ly: number, lz: number): number {
      // Fast path: local coord is within this chunk
      if (lx >= 0 && lx < CHUNK_SIZE &&
          ly >= 0 && ly < CHUNK_SIZE &&
          lz >= 0 && lz < CHUNK_SIZE) {
        return solidOccupancy[voxelIndex(lx, ly, lz)];
      }
      // Cross-chunk boundary
      const { neighbor, nlx, nly, nlz } = resolveNeighbor(lx, ly, lz);
      if (!neighbor) return 0;
      const idx = voxelIndex(nlx, nly, nlz);
      // If the neighbor voxel is water, treat as air for the solid mesh
      if (neighbor.data.materials[idx] === TerrainMaterial.Water) return 0;
      return neighbor.data.occupancy[idx];
    }

    function solidGetNeighborMaterial(lx: number, ly: number, lz: number): number {
      if (lx >= 0 && lx < CHUNK_SIZE &&
          ly >= 0 && ly < CHUNK_SIZE &&
          lz >= 0 && lz < CHUNK_SIZE) {
        return solidMaterials[voxelIndex(lx, ly, lz)];
      }
      const { neighbor, nlx, nly, nlz } = resolveNeighbor(lx, ly, lz);
      if (!neighbor) return TerrainMaterial.Air;
      const idx = voxelIndex(nlx, nly, nlz);
      if (neighbor.data.materials[idx] === TerrainMaterial.Water) return TerrainMaterial.Air;
      return neighbor.data.materials[idx];
    }

    // -- Water neighbor callbacks (non-water treated as air) --

    function waterGetNeighborOccupancy(lx: number, ly: number, lz: number): number {
      if (lx >= 0 && lx < CHUNK_SIZE &&
          ly >= 0 && ly < CHUNK_SIZE &&
          lz >= 0 && lz < CHUNK_SIZE) {
        return waterOccupancy[voxelIndex(lx, ly, lz)];
      }
      const { neighbor, nlx, nly, nlz } = resolveNeighbor(lx, ly, lz);
      if (!neighbor) return 0;
      const idx = voxelIndex(nlx, nly, nlz);
      // Only water voxels contribute to the water mesh
      if (neighbor.data.materials[idx] !== TerrainMaterial.Water) return 0;
      return neighbor.data.occupancy[idx];
    }

    function waterGetNeighborMaterial(lx: number, ly: number, lz: number): number {
      if (lx >= 0 && lx < CHUNK_SIZE &&
          ly >= 0 && ly < CHUNK_SIZE &&
          lz >= 0 && lz < CHUNK_SIZE) {
        return waterMaterials[voxelIndex(lx, ly, lz)];
      }
      const { neighbor, nlx, nly, nlz } = resolveNeighbor(lx, ly, lz);
      if (!neighbor) return TerrainMaterial.Air;
      const idx = voxelIndex(nlx, nly, nlz);
      if (neighbor.data.materials[idx] !== TerrainMaterial.Water) return TerrainMaterial.Air;
      return neighbor.data.materials[idx];
    }

    // ── (c) Run Marching Cubes twice ─────────────────────────────

    const solid = marchingCubes(
      solidOccupancy, solidMaterials,
      solidGetNeighborOccupancy, solidGetNeighborMaterial,
      colorOverrides,
    );

    const water = marchingCubes(
      waterOccupancy, waterMaterials,
      waterGetNeighborOccupancy, waterGetNeighborMaterial,
      colorOverrides,
    );

    // ── (d) Measure time ─────────────────────────────────────────

    const meshTimeMs = performance.now() - t0;

    return { solid, water, meshTimeMs };
  }
}
