/**
 * Section 10.1 -- LOD System
 *
 * 4-level LOD for distant chunks: Full (16³), Half (8³), Quarter (4³),
 * Eighth (2³). Downsamples voxel data and runs Marching Cubes at reduced
 * resolution, with boundary skirts to hide LOD transition seams.
 */

import { CHUNK_SIZE, CHUNK_WORLD_SIZE, VOXEL_SIZE, MC_THRESHOLD } from "../voxel/constants.js";
import { EDGE_TABLE, TRI_TABLE } from "./mc-tables.js";
import { MATERIAL_DEFS, type TerrainMaterial } from "../voxel/terrain-materials.js";
import { voxelIndex } from "../voxel/voxel.js";
import type { ChunkMeshData } from "./marching-cubes.js";

// ── LOD levels ────────────────────────────────────────────────────────

export enum LODLevel {
  Full = 0,
  Half = 1,
  Quarter = 2,
  Eighth = 3,
}

/** Downsample step per LOD level (1 = every voxel, 2 = every 2nd, …). */
export const LOD_STEP = [1, 2, 4, 8] as const;

/** Grid dimensions per LOD level. */
export const LOD_GRID_SIZE = [16, 8, 4, 2] as const;

/** Squared distance thresholds (world units²) for LOD selection. */
export const LOD_DISTANCE_SQ = [
  128 * 128,   // Full  < 128
  256 * 256,   // Half  < 256
  512 * 512,   // Quarter < 512
  Infinity,    // Eighth  beyond
] as const;

/** Select LOD level from squared distance to camera. */
export function getLODLevel(distanceSq: number): LODLevel {
  if (distanceSq < LOD_DISTANCE_SQ[0]) return LODLevel.Full;
  if (distanceSq < LOD_DISTANCE_SQ[1]) return LODLevel.Half;
  if (distanceSq < LOD_DISTANCE_SQ[2]) return LODLevel.Quarter;
  return LODLevel.Eighth;
}

// ── Downsampled data ──────────────────────────────────────────────────

export interface LODChunkData {
  occupancy: Float32Array;
  materials: Uint8Array;
  gridSize: number;
  voxelScale: number;
}

/**
 * Downsample a full-resolution chunk to a lower LOD grid.
 * Averages occupancy over step³ blocks and picks the dominant material.
 */
export function downsampleChunk(
  occupancy: Float32Array,
  materials: Uint8Array,
  lodLevel: LODLevel,
): LODChunkData {
  if (lodLevel === LODLevel.Full) {
    return { occupancy, materials, gridSize: CHUNK_SIZE, voxelScale: VOXEL_SIZE };
  }

  const step = LOD_STEP[lodLevel];
  const gridSize = LOD_GRID_SIZE[lodLevel];
  const voxelScale = VOXEL_SIZE * step;
  const volume = gridSize * gridSize * gridSize;
  const blockVol = step * step * step;

  const outOcc = new Float32Array(volume);
  const outMat = new Uint8Array(volume);

  for (let gz = 0; gz < gridSize; gz++) {
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        let totalOcc = 0;
        let bestMat = 0;
        let bestCount = 0;
        const matCounts = new Map<number, number>();

        for (let dz = 0; dz < step; dz++) {
          for (let dy = 0; dy < step; dy++) {
            for (let dx = 0; dx < step; dx++) {
              const idx = voxelIndex(gx * step + dx, gy * step + dy, gz * step + dz);
              totalOcc += occupancy[idx];
              const m = materials[idx];
              if (m !== 0) {
                const c = (matCounts.get(m) || 0) + 1;
                matCounts.set(m, c);
                if (c > bestCount) {
                  bestCount = c;
                  bestMat = m;
                }
              }
            }
          }
        }

        const outIdx = gx + gy * gridSize + gz * gridSize * gridSize;
        outOcc[outIdx] = totalOcc / blockVol;
        outMat[outIdx] = bestMat;
      }
    }
  }

  return { occupancy: outOcc, materials: outMat, gridSize, voxelScale };
}

// ── MC helpers (shared with marching-cubes.ts, duplicated to keep LOD
//    self-contained and avoid modifying the stable full-resolution MC) ──

const CORNER_OFFSETS: readonly [number, number, number][] = [
  [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1],
  [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1],
];

const EDGE_CORNERS: readonly [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function getMaterialColor(
  matId: number,
  overrides?: Map<number, [number, number, number]>,
): [number, number, number] {
  if (overrides) {
    const ovr = overrides.get(matId);
    if (ovr) return ovr;
  }
  const def = MATERIAL_DEFS[matId as TerrainMaterial];
  if (def) return def.color;
  return [255, 0, 255];
}

// ── LOD Marching Cubes ────────────────────────────────────────────────

const EMPTY_LOD_MESH: ChunkMeshData = {
  positions: new Float32Array(0),
  normals: new Float32Array(0),
  indices: new Uint32Array(0),
  colors: new Float32Array(0),
  materialIds: new Uint8Array(0),
  vertexCount: 0,
  triangleCount: 0,
};

/**
 * Run Marching Cubes on a variable-size grid (LOD-downsampled data).
 *
 * Identical algorithm to the full-resolution `marchingCubes()` but with
 * configurable grid size and voxel scale. Boundary voxels default to air
 * (no cross-chunk neighbor lookups for LOD — skirts hide the gaps).
 */
export function marchingCubesLOD(
  data: LODChunkData,
  colorOverrides?: Map<number, [number, number, number]>,
): ChunkMeshData {
  const { occupancy, materials, gridSize, voxelScale } = data;

  const posArr: number[] = [];
  const colArr: number[] = [];
  const idxArr: number[] = [];
  const matArr: number[] = [];

  const vertexCache = new Map<string, number>();
  let nextVertex = 0;

  const cornerOcc = new Float64Array(8);
  const cornerMat = new Uint8Array(8);

  function lodIndex(x: number, y: number, z: number): number {
    return x + y * gridSize + z * gridSize * gridSize;
  }

  function sampleCorner(cx: number, cy: number, cz: number, out: number): void {
    if (cx >= 0 && cx < gridSize && cy >= 0 && cy < gridSize && cz >= 0 && cz < gridSize) {
      const idx = lodIndex(cx, cy, cz);
      cornerOcc[out] = occupancy[idx];
      cornerMat[out] = materials[idx];
    } else {
      cornerOcc[out] = 0;
      cornerMat[out] = 0;
    }
  }

  function getEdgeVertex(cubeX: number, cubeY: number, cubeZ: number, edgeIdx: number): number {
    const [cA, cB] = EDGE_CORNERS[edgeIdx];
    const [oAx, oAy, oAz] = CORNER_OFFSETS[cA];
    const [oBx, oBy, oBz] = CORNER_OFFSETS[cB];

    const ax = cubeX + oAx, ay = cubeY + oAy, az = cubeZ + oAz;
    const bx = cubeX + oBx, by = cubeY + oBy, bz = cubeZ + oBz;

    let kx: number, ky: number, kz: number, dir: number;
    if (ax < bx || (ax === bx && ay < by) || (ax === bx && ay === by && az < bz)) {
      kx = ax; ky = ay; kz = az;
      dir = bx !== ax ? 0 : by !== ay ? 1 : 2;
    } else {
      kx = bx; ky = by; kz = bz;
      dir = ax !== bx ? 0 : ay !== by ? 1 : 2;
    }
    const key = `${kx},${ky},${kz},${dir}`;

    const cached = vertexCache.get(key);
    if (cached !== undefined) return cached;

    const occA = cornerOcc[cA];
    const occB = cornerOcc[cB];
    const denom = occB - occA;
    const t = clamp01(denom === 0 ? 0.5 : (MC_THRESHOLD - occA) / denom);

    const wx = (cubeX + oAx + (oBx - oAx) * t) * voxelScale;
    const wy = (cubeY + oAy + (oBy - oAy) * t) * voxelScale;
    const wz = (cubeZ + oAz + (oBz - oAz) * t) * voxelScale;

    posArr.push(wx, wy, wz);

    const colA = getMaterialColor(cornerMat[cA], colorOverrides);
    const colB = getMaterialColor(cornerMat[cB], colorOverrides);
    const oneMinusT = 1 - t;
    colArr.push(
      (colA[0] * oneMinusT + colB[0] * t) / 255,
      (colA[1] * oneMinusT + colB[1] * t) / 255,
      (colA[2] * oneMinusT + colB[2] * t) / 255,
    );

    matArr.push(t < 0.5 ? cornerMat[cA] : cornerMat[cB]);

    const vi = nextVertex++;
    vertexCache.set(key, vi);
    return vi;
  }

  // ── March every cube ───────────────────────────────────────────────

  const edgeVerts = new Int32Array(12);

  for (let z = 0; z < gridSize; z++) {
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        for (let c = 0; c < 8; c++) {
          const [ox, oy, oz] = CORNER_OFFSETS[c];
          sampleCorner(x + ox, y + oy, z + oz, c);
        }

        let cubeIndex = 0;
        for (let c = 0; c < 8; c++) {
          if (cornerOcc[c] >= MC_THRESHOLD) cubeIndex |= (1 << c);
        }

        if (cubeIndex === 0 || cubeIndex === 255) continue;

        const edgeBits = EDGE_TABLE[cubeIndex];

        for (let e = 0; e < 12; e++) {
          if (edgeBits & (1 << e)) {
            edgeVerts[e] = getEdgeVertex(x, y, z, e);
          }
        }

        const triRow = TRI_TABLE[cubeIndex];
        for (let t = 0; triRow[t] !== -1; t += 3) {
          idxArr.push(edgeVerts[triRow[t]], edgeVerts[triRow[t + 1]], edgeVerts[triRow[t + 2]]);
        }
      }
    }
  }

  // ── Pack results ────────────────────────────────────────────────────

  const vertexCount = nextVertex;
  const triangleCount = idxArr.length / 3;
  if (triangleCount === 0) return EMPTY_LOD_MESH;

  const positions = new Float32Array(posArr);
  const colors = new Float32Array(colArr);
  const indices = new Uint32Array(idxArr);
  const materialIds = new Uint8Array(matArr);

  // ── Smooth normals ──────────────────────────────────────────────────

  const normals = new Float32Array(vertexCount * 3);

  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3], i1 = indices[t * 3 + 1], i2 = indices[t * 3 + 2];

    const p0x = positions[i0 * 3], p0y = positions[i0 * 3 + 1], p0z = positions[i0 * 3 + 2];
    const p1x = positions[i1 * 3], p1y = positions[i1 * 3 + 1], p1z = positions[i1 * 3 + 2];
    const p2x = positions[i2 * 3], p2y = positions[i2 * 3 + 1], p2z = positions[i2 * 3 + 2];

    const e1x = p1x - p0x, e1y = p1y - p0y, e1z = p1z - p0z;
    const e2x = p2x - p0x, e2y = p2y - p0y, e2z = p2z - p0z;

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    normals[i0 * 3] += nx; normals[i0 * 3 + 1] += ny; normals[i0 * 3 + 2] += nz;
    normals[i1 * 3] += nx; normals[i1 * 3 + 1] += ny; normals[i1 * 3 + 2] += nz;
    normals[i2 * 3] += nx; normals[i2 * 3 + 1] += ny; normals[i2 * 3 + 2] += nz;
  }

  for (let v = 0; v < vertexCount; v++) {
    const off = v * 3;
    const nx = normals[off], ny = normals[off + 1], nz = normals[off + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-10) {
      const inv = 1 / len;
      normals[off] *= inv;
      normals[off + 1] *= inv;
      normals[off + 2] *= inv;
    }
  }

  return { positions, normals, indices, colors, materialIds, vertexCount, triangleCount };
}

// ── LOD transition skirts ─────────────────────────────────────────────

/**
 * Shift boundary vertices downward to hide gaps between LOD transitions.
 * Applied in-place on the positions array. Only affects vertices at chunk
 * edges (x ≈ 0, x ≈ CHUNK_WORLD_SIZE, z ≈ 0, z ≈ CHUNK_WORLD_SIZE).
 */
export function applyBoundarySkirts(meshData: ChunkMeshData, voxelScale: number): void {
  const epsilon = voxelScale * 0.1;
  const skirtDrop = voxelScale * 0.5;

  for (let i = 0; i < meshData.vertexCount; i++) {
    const px = meshData.positions[i * 3];
    const pz = meshData.positions[i * 3 + 2];

    if (px < epsilon || px > CHUNK_WORLD_SIZE - epsilon ||
        pz < epsilon || pz > CHUNK_WORLD_SIZE - epsilon) {
      meshData.positions[i * 3 + 1] -= skirtDrop;
    }
  }
}
