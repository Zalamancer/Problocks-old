/**
 * Section 10.4 -- Terrain Serialization
 *
 * Run-length encoding (RLE) for chunk data + a save/load format for the
 * entire voxel grid. Typical compression: 20 KB raw chunk → 1–5 KB RLE.
 *
 * Save format:
 *   { version, voxelSize, chunkSize, chunks: SerializedChunk[] }
 *
 * Each chunk stores RLE-compressed occupancy (quantized to uint8) and
 * material arrays, achieving high compression on homogeneous regions.
 */

import { VOXEL_SIZE, CHUNK_SIZE, CHUNK_VOLUME } from "./constants.js";
import { TerrainMaterial } from "./terrain-materials.js";
import { type Chunk } from "./chunk.js";
import { type VoxelGrid } from "./voxel-grid.js";

// ── Save format ───────────────────────────────────────────────────────

export const TERRAIN_SAVE_VERSION = 1;

export interface SerializedChunk {
  /** Chunk coordinates. */
  cx: number;
  cy: number;
  cz: number;
  /** RLE-encoded occupancy (quantized to 0–255). */
  rleOccupancy: number[];
  /** RLE-encoded material IDs. */
  rleMaterials: number[];
}

export interface SerializedTerrain {
  version: number;
  voxelSize: number;
  chunkSize: number;
  chunks: SerializedChunk[];
}

// ── RLE encoding ──────────────────────────────────────────────────────

/**
 * Run-length encode a Uint8Array.
 * Output: [value, count, value, count, …]
 * Runs are capped at 255 to fit in a single byte.
 */
export function rleEncode(data: Uint8Array): number[] {
  if (data.length === 0) return [];

  const result: number[] = [];
  let current = data[0];
  let count = 1;

  for (let i = 1; i < data.length; i++) {
    if (data[i] === current && count < 255) {
      count++;
    } else {
      result.push(current, count);
      current = data[i];
      count = 1;
    }
  }

  // Flush last run
  result.push(current, count);
  return result;
}

/**
 * Decode an RLE-encoded array back to a Uint8Array.
 * Input: [value, count, value, count, …]
 */
export function rleDecode(rle: number[], length: number): Uint8Array {
  const result = new Uint8Array(length);
  let offset = 0;

  for (let i = 0; i < rle.length; i += 2) {
    const value = rle[i];
    const count = rle[i + 1];
    for (let j = 0; j < count; j++) {
      result[offset++] = value;
    }
  }

  return result;
}

// ── Occupancy quantization ────────────────────────────────────────────

/**
 * Quantize float occupancy (0.0–1.0) to uint8 (0–255) for RLE.
 * Round-trip error < 0.004 — imperceptible for Marching Cubes.
 */
function quantizeOccupancy(occupancy: Float32Array): Uint8Array {
  const q = new Uint8Array(occupancy.length);
  for (let i = 0; i < occupancy.length; i++) {
    q[i] = Math.round(occupancy[i] * 255);
  }
  return q;
}

/**
 * Dequantize uint8 occupancy back to float.
 */
function dequantizeOccupancy(quantized: Uint8Array): Float32Array {
  const f = new Float32Array(quantized.length);
  for (let i = 0; i < quantized.length; i++) {
    f[i] = quantized[i] / 255;
  }
  return f;
}

// ── Serialize ─────────────────────────────────────────────────────────

/**
 * Serialize a single chunk to the save format.
 * Skips empty chunks (all-air) — returns null.
 */
export function serializeChunk(chunk: Chunk): SerializedChunk | null {
  // Skip empty chunks
  if (chunk.isEmpty) return null;

  // Check if chunk is all-air (occupancy all zero)
  let hasContent = false;
  for (let i = 0; i < CHUNK_VOLUME; i++) {
    if (chunk.data.occupancy[i] > 0) {
      hasContent = true;
      break;
    }
  }
  if (!hasContent) return null;

  const quantizedOcc = quantizeOccupancy(chunk.data.occupancy);

  return {
    cx: chunk.cx,
    cy: chunk.cy,
    cz: chunk.cz,
    rleOccupancy: rleEncode(quantizedOcc),
    rleMaterials: rleEncode(chunk.data.materials),
  };
}

/**
 * Serialize the entire voxel grid to a save object.
 * Only non-empty chunks are included.
 */
export function saveTerrain(grid: VoxelGrid): SerializedTerrain {
  const chunks: SerializedChunk[] = [];

  for (const chunk of grid.getAllChunks()) {
    const serialized = serializeChunk(chunk);
    if (serialized) {
      chunks.push(serialized);
    }
  }

  return {
    version: TERRAIN_SAVE_VERSION,
    voxelSize: VOXEL_SIZE,
    chunkSize: CHUNK_SIZE,
    chunks,
  };
}

/**
 * Serialize the terrain to a JSON string.
 */
export function saveTerrainJSON(grid: VoxelGrid): string {
  return JSON.stringify(saveTerrain(grid));
}

// ── Deserialize ───────────────────────────────────────────────────────

/**
 * Load a serialized chunk into the VoxelGrid.
 * Creates the chunk if it doesn't exist.
 */
export function deserializeChunk(
  grid: VoxelGrid,
  serialized: SerializedChunk,
): Chunk {
  const chunk = grid.getOrCreateChunk(serialized.cx, serialized.cy, serialized.cz);

  // Decode RLE occupancy → quantized uint8 → float32
  const quantizedOcc = rleDecode(serialized.rleOccupancy, CHUNK_VOLUME);
  const occupancy = dequantizeOccupancy(quantizedOcc);
  chunk.data.occupancy.set(occupancy);

  // Decode RLE materials
  const materials = rleDecode(serialized.rleMaterials, CHUNK_VOLUME);
  chunk.data.materials.set(materials);

  // Mark dirty so it gets re-meshed
  chunk.dirty = true;
  chunk.isEmpty = false;

  return chunk;
}

/**
 * Load a full serialized terrain into the VoxelGrid.
 * Clears the existing grid first.
 *
 * @returns Number of chunks loaded.
 */
export function loadTerrain(grid: VoxelGrid, data: SerializedTerrain): number {
  // Version check
  if (data.version !== TERRAIN_SAVE_VERSION) {
    throw new Error(
      `Unsupported terrain save version: ${data.version} (expected ${TERRAIN_SAVE_VERSION})`,
    );
  }

  // Validate save parameters match current constants
  if (data.voxelSize !== VOXEL_SIZE) {
    throw new Error(
      `Voxel size mismatch: save=${data.voxelSize}, current=${VOXEL_SIZE}`,
    );
  }
  if (data.chunkSize !== CHUNK_SIZE) {
    throw new Error(
      `Chunk size mismatch: save=${data.chunkSize}, current=${CHUNK_SIZE}`,
    );
  }

  // Clear existing terrain
  grid.clearAll();

  // Load chunks
  for (const serialized of data.chunks) {
    deserializeChunk(grid, serialized);
  }

  return data.chunks.length;
}

/**
 * Load terrain from a JSON string.
 */
export function loadTerrainJSON(grid: VoxelGrid, json: string): number {
  const data = JSON.parse(json) as SerializedTerrain;
  return loadTerrain(grid, data);
}

// ── Binary format (compact) ───────────────────────────────────────────

/**
 * Serialize terrain to a compact binary ArrayBuffer.
 *
 * Layout:
 *   [4 bytes] version (uint32)
 *   [4 bytes] voxelSize (float32)
 *   [4 bytes] chunkSize (uint32)
 *   [4 bytes] chunkCount (uint32)
 *   For each chunk:
 *     [4 bytes] cx (int32)
 *     [4 bytes] cy (int32)
 *     [4 bytes] cz (int32)
 *     [4 bytes] rleOccLen (uint32)
 *     [rleOccLen bytes] RLE occupancy
 *     [4 bytes] rleMatLen (uint32)
 *     [rleMatLen bytes] RLE materials
 */
export function saveTerrainBinary(grid: VoxelGrid): ArrayBuffer {
  const saved = saveTerrain(grid);

  // Calculate total size
  let totalSize = 16; // header: version + voxelSize + chunkSize + chunkCount
  for (const chunk of saved.chunks) {
    totalSize += 12; // cx + cy + cz
    totalSize += 4 + chunk.rleOccupancy.length; // rleOccLen + data
    totalSize += 4 + chunk.rleMaterials.length;  // rleMatLen + data
  }

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;

  // Header
  view.setUint32(offset, saved.version, true); offset += 4;
  view.setFloat32(offset, saved.voxelSize, true); offset += 4;
  view.setUint32(offset, saved.chunkSize, true); offset += 4;
  view.setUint32(offset, saved.chunks.length, true); offset += 4;

  // Chunks
  for (const chunk of saved.chunks) {
    view.setInt32(offset, chunk.cx, true); offset += 4;
    view.setInt32(offset, chunk.cy, true); offset += 4;
    view.setInt32(offset, chunk.cz, true); offset += 4;

    // RLE occupancy
    view.setUint32(offset, chunk.rleOccupancy.length, true); offset += 4;
    for (let i = 0; i < chunk.rleOccupancy.length; i++) {
      view.setUint8(offset++, chunk.rleOccupancy[i]);
    }

    // RLE materials
    view.setUint32(offset, chunk.rleMaterials.length, true); offset += 4;
    for (let i = 0; i < chunk.rleMaterials.length; i++) {
      view.setUint8(offset++, chunk.rleMaterials[i]);
    }
  }

  return buffer;
}

/**
 * Load terrain from a binary ArrayBuffer.
 */
export function loadTerrainBinary(grid: VoxelGrid, buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  let offset = 0;

  // Header
  const version = view.getUint32(offset, true); offset += 4;
  const voxelSize = view.getFloat32(offset, true); offset += 4;
  const chunkSize = view.getUint32(offset, true); offset += 4;
  const chunkCount = view.getUint32(offset, true); offset += 4;

  // Build SerializedTerrain and use loadTerrain for validation + loading
  const chunks: SerializedChunk[] = [];

  for (let c = 0; c < chunkCount; c++) {
    const cx = view.getInt32(offset, true); offset += 4;
    const cy = view.getInt32(offset, true); offset += 4;
    const cz = view.getInt32(offset, true); offset += 4;

    const rleOccLen = view.getUint32(offset, true); offset += 4;
    const rleOccupancy: number[] = [];
    for (let i = 0; i < rleOccLen; i++) {
      rleOccupancy.push(view.getUint8(offset++));
    }

    const rleMatLen = view.getUint32(offset, true); offset += 4;
    const rleMaterials: number[] = [];
    for (let i = 0; i < rleMatLen; i++) {
      rleMaterials.push(view.getUint8(offset++));
    }

    chunks.push({ cx, cy, cz, rleOccupancy, rleMaterials });
  }

  return loadTerrain(grid, { version, voxelSize, chunkSize, chunks });
}
