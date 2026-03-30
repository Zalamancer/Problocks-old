/**
 * Section 10.2 -- Mesh Worker
 *
 * Web Worker entry point for off-thread Marching Cubes mesh generation.
 * Receives padded voxel grids, runs MC (full or LOD), and returns mesh
 * data as Transferable ArrayBuffers for zero-copy back to the main thread.
 *
 * Usage (consuming app):
 *   new Worker(new URL('./mesh-worker.js', import.meta.url), { type: 'module' })
 */

import { MC_THRESHOLD, CHUNK_SIZE, CHUNK_VOLUME, VOXEL_SIZE } from "../voxel/constants.js";
import { EDGE_TABLE, TRI_TABLE } from "./mc-tables.js";
import { TerrainMaterial, MATERIAL_DEFS } from "../voxel/terrain-materials.js";
import { voxelIndex } from "../voxel/voxel.js";
import {
  LODLevel,
  downsampleChunk,
  marchingCubesLOD,
  applyBoundarySkirts,
} from "./lod-system.js";

// ── Message types ─────────────────────────────────────────────────────

export interface WorkerMeshRequest {
  type: "mesh";
  id: number;
  /** (CHUNK_SIZE+1)³ padded occupancy — Transferred. */
  paddedOccupancy: Float32Array;
  /** (CHUNK_SIZE+1)³ padded materials — Transferred. */
  paddedMaterials: Uint8Array;
  lodLevel: number;
  /** Flat [matId, r, g, b, …] or null. */
  overrides: number[] | null;
}

export interface WorkerMeshResponse {
  type: "result";
  id: number;
  solid: TransferableMesh;
  water: TransferableMesh;
  meshTimeMs: number;
}

export interface TransferableMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  colors: Float32Array;
  materialIds: Uint8Array;
  vertexCount: number;
  triangleCount: number;
}

// ── MC constants ──────────────────────────────────────────────────────

const CORNER_OFFSETS: readonly [number, number, number][] = [
  [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1],
  [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1],
];

const EDGE_CORNERS: readonly [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

const PS = CHUNK_SIZE + 1; // padded grid size per axis (17)
const PV = PS * PS * PS;   // padded volume (4913)

function padIdx(x: number, y: number, z: number): number {
  return x + y * PS + z * PS * PS;
}

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

// ── Empty mesh ────────────────────────────────────────────────────────

const EMPTY: TransferableMesh = {
  positions: new Float32Array(0),
  normals: new Float32Array(0),
  indices: new Uint32Array(0),
  colors: new Float32Array(0),
  materialIds: new Uint8Array(0),
  vertexCount: 0,
  triangleCount: 0,
};

// ── Padded Marching Cubes ─────────────────────────────────────────────

/**
 * Run MC on a (CHUNK_SIZE+1)³ padded grid. Padding removes the need for
 * neighbor callbacks — border voxels are pre-baked into the grid.
 */
function marchingCubesPadded(
  paddedOcc: Float32Array,
  paddedMat: Uint8Array,
  colorOverrides?: Map<number, [number, number, number]>,
): TransferableMesh {
  const posArr: number[] = [];
  const colArr: number[] = [];
  const idxArr: number[] = [];
  const matArr: number[] = [];

  const vertexCache = new Map<string, number>();
  let nextVertex = 0;

  const cornerOcc = new Float64Array(8);
  const cornerMat = new Uint8Array(8);
  const edgeVerts = new Int32Array(12);

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

    posArr.push(
      (cubeX + oAx + (oBx - oAx) * t) * VOXEL_SIZE,
      (cubeY + oAy + (oBy - oAy) * t) * VOXEL_SIZE,
      (cubeZ + oAz + (oBz - oAz) * t) * VOXEL_SIZE,
    );

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

  // ── March every cube in [0, CHUNK_SIZE) ─────────────────────────

  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        // Sample corners from padded grid (no boundary checks needed)
        for (let c = 0; c < 8; c++) {
          const [ox, oy, oz] = CORNER_OFFSETS[c];
          const pi = padIdx(x + ox, y + oy, z + oz);
          cornerOcc[c] = paddedOcc[pi];
          cornerMat[c] = paddedMat[pi];
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

  // ── Pack + normals ──────────────────────────────────────────────

  const vertexCount = nextVertex;
  const triangleCount = idxArr.length / 3;
  if (triangleCount === 0) return EMPTY;

  const positions = new Float32Array(posArr);
  const colors = new Float32Array(colArr);
  const indices = new Uint32Array(idxArr);
  const materialIds = new Uint8Array(matArr);
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
      normals[off] *= inv; normals[off + 1] *= inv; normals[off + 2] *= inv;
    }
  }

  return { positions, normals, indices, colors, materialIds, vertexCount, triangleCount };
}

// ── Solid / Water split for padded data ───────────────────────────────

function splitPaddedGrid(
  paddedOcc: Float32Array,
  paddedMat: Uint8Array,
): { solidOcc: Float32Array; solidMat: Uint8Array; waterOcc: Float32Array; waterMat: Uint8Array } {
  const solidOcc = new Float32Array(PV);
  const solidMat = new Uint8Array(PV);
  const waterOcc = new Float32Array(PV);
  const waterMat = new Uint8Array(PV);

  for (let i = 0; i < PV; i++) {
    if (paddedMat[i] === TerrainMaterial.Water) {
      waterOcc[i] = paddedOcc[i];
      waterMat[i] = paddedMat[i];
    } else {
      solidOcc[i] = paddedOcc[i];
      solidMat[i] = paddedMat[i];
    }
  }

  return { solidOcc, solidMat, waterOcc, waterMat };
}

// ── Deserialize color overrides ───────────────────────────────────────

function deserializeOverrides(flat: number[] | null): Map<number, [number, number, number]> | undefined {
  if (!flat || flat.length === 0) return undefined;
  const map = new Map<number, [number, number, number]>();
  for (let i = 0; i < flat.length; i += 4) {
    map.set(flat[i], [flat[i + 1], flat[i + 2], flat[i + 3]]);
  }
  return map;
}

// ── Extract inner chunk data from padded grid ─────────────────────────

function extractInnerChunkData(
  paddedOcc: Float32Array,
  paddedMat: Uint8Array,
): { occupancy: Float32Array; materials: Uint8Array } {
  const occupancy = new Float32Array(CHUNK_VOLUME);
  const materials = new Uint8Array(CHUNK_VOLUME);

  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const ci = voxelIndex(x, y, z);
        const pi = padIdx(x, y, z);
        occupancy[ci] = paddedOcc[pi];
        materials[ci] = paddedMat[pi];
      }
    }
  }

  return { occupancy, materials };
}

// ── Collect Transferable buffers from a mesh ──────────────────────────

function collectTransferables(mesh: TransferableMesh): Transferable[] {
  const t: Transferable[] = [];
  if (mesh.positions.byteLength > 0) t.push(mesh.positions.buffer);
  if (mesh.normals.byteLength > 0) t.push(mesh.normals.buffer);
  if (mesh.indices.byteLength > 0) t.push(mesh.indices.buffer);
  if (mesh.colors.byteLength > 0) t.push(mesh.colors.buffer);
  if (mesh.materialIds.byteLength > 0) t.push(mesh.materialIds.buffer);
  return t;
}

// ── Worker message handler ────────────────────────────────────────────

(globalThis as any).addEventListener("message", (e: MessageEvent) => {
  const req = e.data as WorkerMeshRequest;
  if (req.type !== "mesh") return;

  const t0 = performance.now();
  const overrides = deserializeOverrides(req.overrides);

  let solid: TransferableMesh;
  let water: TransferableMesh;

  if (req.lodLevel === LODLevel.Full) {
    // Full resolution — split into solid/water, run padded MC twice
    const { solidOcc, solidMat, waterOcc, waterMat } = splitPaddedGrid(
      req.paddedOccupancy, req.paddedMaterials,
    );
    solid = marchingCubesPadded(solidOcc, solidMat, overrides);
    water = marchingCubesPadded(waterOcc, waterMat, overrides);
  } else {
    // LOD — extract inner data, downsample, run LOD MC
    const { occupancy, materials } = extractInnerChunkData(
      req.paddedOccupancy, req.paddedMaterials,
    );
    const lodData = downsampleChunk(occupancy, materials, req.lodLevel as LODLevel);
    const lodMesh = marchingCubesLOD(lodData, overrides);

    if (lodMesh.vertexCount > 0) {
      applyBoundarySkirts(lodMesh, lodData.voxelScale);
    }

    solid = {
      positions: lodMesh.positions,
      normals: lodMesh.normals,
      indices: lodMesh.indices,
      colors: lodMesh.colors,
      materialIds: lodMesh.materialIds,
      vertexCount: lodMesh.vertexCount,
      triangleCount: lodMesh.triangleCount,
    };
    water = EMPTY;
  }

  const meshTimeMs = performance.now() - t0;

  const response: WorkerMeshResponse = { type: "result", id: req.id, solid, water, meshTimeMs };
  const transfers = [...collectTransferables(solid), ...collectTransferables(water)];

  (globalThis as any).postMessage(response, transfers);
});
