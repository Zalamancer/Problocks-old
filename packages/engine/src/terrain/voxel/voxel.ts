/**
 * Section 1.2 -- Voxel Data Structures
 *
 * Core voxel representation, chunk data buffers, and index utilities
 * for the 16x16x16 voxel terrain system.
 */

import { type TerrainMaterial } from "./terrain-materials.js";
import { CHUNK_SIZE, CHUNK_VOLUME } from "./constants.js";

// ── Voxel interface ─────────────────────────────────────────────────

export interface Voxel {
  /** 0.0 = air, 1.0 = fully solid */
  occupancy: number;
  material: TerrainMaterial;
}

// ── Chunk data buffers ──────────────────────────────────────────────

/**
 * Raw data buffers for one 16x16x16 chunk.
 *
 * Stores occupancy as float32 (smooth terrain blending via Marching Cubes)
 * and material ids as uint8 (max 256 material types).
 */
export class ChunkData {
  /** Per-voxel occupancy: 0.0 = air, 1.0 = fully solid */
  readonly occupancy: Float32Array = new Float32Array(CHUNK_VOLUME);

  /** Per-voxel material id (see TerrainMaterial enum) */
  readonly materials: Uint8Array = new Uint8Array(CHUNK_VOLUME);
}

// ── Index utilities ─────────────────────────────────────────────────

/**
 * Convert local chunk coordinates to a flat buffer index.
 * Row-major order: x + y * CHUNK_SIZE + z * CHUNK_SIZE^2
 *
 * @param x Local x coordinate (0-15)
 * @param y Local y coordinate (0-15)
 * @param z Local z coordinate (0-15)
 */
export function voxelIndex(x: number, y: number, z: number): number {
  return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
}

/**
 * Convert a flat buffer index back to local chunk coordinates.
 * Inverse of {@link voxelIndex}.
 *
 * @returns [x, y, z] local coordinates (each 0-15)
 */
export function indexToCoords(index: number): [number, number, number] {
  const x = index % CHUNK_SIZE;
  const y = Math.floor(index / CHUNK_SIZE) % CHUNK_SIZE;
  const z = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
  return [x, y, z];
}
