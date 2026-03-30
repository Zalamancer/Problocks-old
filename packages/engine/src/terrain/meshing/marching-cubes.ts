/**
 * Section 1.6 -- Marching Cubes Mesh Generation
 *
 * Extracts an isosurface mesh from a 16x16x16 voxel chunk using the
 * classic Marching Cubes algorithm with vertex deduplication and
 * smooth normals.
 */

import { MC_THRESHOLD, CHUNK_SIZE, VOXEL_SIZE } from "../voxel/constants.js";
import { EDGE_TABLE, TRI_TABLE } from "./mc-tables.js";
import { type TerrainMaterial, MATERIAL_DEFS } from "../voxel/terrain-materials.js";
import { voxelIndex } from "../voxel/voxel.js";

// ── Output type ─────────────────────────────────────────────────────

export interface ChunkMeshData {
  positions: Float32Array;   // x,y,z triples
  normals: Float32Array;     // x,y,z triples per vertex
  indices: Uint32Array;      // triangle indices
  colors: Float32Array;      // r,g,b triples per vertex (0-1 range)
  materialIds: Uint8Array;   // per-vertex dominant material id
  vertexCount: number;
  triangleCount: number;
}

// ── Lookup constants ────────────────────────────────────────────────

/**
 * Maps each of the 12 MC edges to the pair of corner indices it connects.
 * Must match the edge numbering convention in mc-tables.ts:
 *   Edge  0: 0-1   Edge  1: 1-2   Edge  2: 2-3   Edge  3: 3-0
 *   Edge  4: 4-5   Edge  5: 5-6   Edge  6: 6-7   Edge  7: 7-4
 *   Edge  8: 0-4   Edge  9: 1-5   Edge 10: 2-6   Edge 11: 3-7
 */
const EDGE_CORNERS: readonly [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],  // bottom edges
  [4, 5], [5, 6], [6, 7], [7, 4],  // top edges
  [0, 4], [1, 5], [2, 6], [3, 7],  // vertical edges
];

/**
 * Local offsets for the 8 cube corners relative to the cube origin.
 * Must match the corner numbering in mc-tables.ts:
 *   0:(0,0,0) 1:(1,0,0) 2:(1,0,1) 3:(0,0,1)
 *   4:(0,1,0) 5:(1,1,0) 6:(1,1,1) 7:(0,1,1)
 */
const CORNER_OFFSETS: readonly [number, number, number][] = [
  [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1],
  [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1],
];

// ── Empty mesh singleton ────────────────────────────────────────────

const EMPTY_MESH: ChunkMeshData = {
  positions: new Float32Array(0),
  normals: new Float32Array(0),
  indices: new Uint32Array(0),
  colors: new Float32Array(0),
  materialIds: new Uint8Array(0),
  vertexCount: 0,
  triangleCount: 0,
};

// ── Helpers ─────────────────────────────────────────────────────────

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

// ── Main algorithm ──────────────────────────────────────────────────

/**
 * Run Marching Cubes on a single 16x16x16 chunk.
 *
 * @param occupancy  Float32Array of length 4096 — per-voxel occupancy (0 = air, 1 = solid)
 * @param materials  Uint8Array of length 4096 — per-voxel material id
 * @param getNeighborOccupancy  Returns occupancy for coordinates that may be outside 0..15
 * @param getNeighborMaterial   Returns material id for coordinates that may be outside 0..15
 */
export function marchingCubes(
  occupancy: Float32Array,
  materials: Uint8Array,
  getNeighborOccupancy: (lx: number, ly: number, lz: number) => number,
  getNeighborMaterial: (lx: number, ly: number, lz: number) => number,
  colorOverrides?: Map<number, [number, number, number]>,
): ChunkMeshData {
  // Accumulator arrays — we don't know the final size ahead of time,
  // so collect into plain arrays and pack into typed arrays at the end.
  const posArr: number[] = [];
  const colArr: number[] = [];
  const idxArr: number[] = [];
  const matArr: number[] = [];

  // Vertex deduplication: key = edge identity string -> vertex index
  const vertexCache = new Map<string, number>();
  let nextVertex = 0;

  // ── Per-corner scratch buffers (avoid allocating per-cube) ──────
  const cornerOcc = new Float64Array(8);
  const cornerMat = new Uint8Array(8);

  // ── Helper: sample a corner ─────────────────────────────────────
  function sampleCorner(
    cx: number, cy: number, cz: number,
    outIdx: number,
  ): void {
    if (cx >= 0 && cx < CHUNK_SIZE &&
        cy >= 0 && cy < CHUNK_SIZE &&
        cz >= 0 && cz < CHUNK_SIZE) {
      const idx = voxelIndex(cx, cy, cz);
      cornerOcc[outIdx] = occupancy[idx];
      cornerMat[outIdx] = materials[idx];
    } else {
      cornerOcc[outIdx] = getNeighborOccupancy(cx, cy, cz);
      cornerMat[outIdx] = getNeighborMaterial(cx, cy, cz);
    }
  }

  // ── Helper: create or reuse a vertex on an edge ─────────────────
  function getEdgeVertex(
    cubeX: number, cubeY: number, cubeZ: number,
    edgeIdx: number,
  ): number {
    // Build a canonical key for this edge so adjacent cubes sharing it
    // will produce the same key. An edge is uniquely identified by the
    // minimum-coordinate endpoint and the edge direction.
    //
    // Each edge connects two corners. We compute the global voxel coords
    // of both corners, then use the lower corner + edge axis as the key.
    const [cA, cB] = EDGE_CORNERS[edgeIdx];
    const [oAx, oAy, oAz] = CORNER_OFFSETS[cA];
    const [oBx, oBy, oBz] = CORNER_OFFSETS[cB];

    const ax = cubeX + oAx;
    const ay = cubeY + oAy;
    const az = cubeZ + oAz;
    const bx = cubeX + oBx;
    const by = cubeY + oBy;
    const bz = cubeZ + oBz;

    // Canonical key: sort corners so the same edge is always keyed
    // the same way regardless of which cube we reached it from.
    let kx: number, ky: number, kz: number, dir: number;
    if (ax < bx || (ax === bx && ay < by) || (ax === bx && ay === by && az < bz)) {
      kx = ax; ky = ay; kz = az;
      // direction: 0 = +X, 1 = +Y, 2 = +Z
      dir = bx !== ax ? 0 : by !== ay ? 1 : 2;
    } else {
      kx = bx; ky = by; kz = bz;
      dir = ax !== bx ? 0 : ay !== by ? 1 : 2;
    }
    const key = `${kx},${ky},${kz},${dir}`;

    const cached = vertexCache.get(key);
    if (cached !== undefined) return cached;

    // Interpolate position
    const occA = cornerOcc[cA];
    const occB = cornerOcc[cB];
    const denom = occB - occA;
    const t = clamp01(denom === 0 ? 0.5 : (MC_THRESHOLD - occA) / denom);

    const wx = (cubeX + oAx + (oBx - oAx) * t) * VOXEL_SIZE;
    const wy = (cubeY + oAy + (oBy - oAy) * t) * VOXEL_SIZE;
    const wz = (cubeZ + oAz + (oBz - oAz) * t) * VOXEL_SIZE;

    posArr.push(wx, wy, wz);

    // Interpolate color
    const colA = getMaterialColor(cornerMat[cA], colorOverrides);
    const colB = getMaterialColor(cornerMat[cB], colorOverrides);
    const oneMinusT = 1 - t;
    colArr.push(
      (colA[0] * oneMinusT + colB[0] * t) / 255,
      (colA[1] * oneMinusT + colB[1] * t) / 255,
      (colA[2] * oneMinusT + colB[2] * t) / 255,
    );

    // Dominant material: corner with occupancy closer to/above threshold
    matArr.push(t < 0.5 ? cornerMat[cA] : cornerMat[cB]);

    const vi = nextVertex++;
    vertexCache.set(key, vi);
    return vi;
  }

  // ── March every cube in the chunk ───────────────────────────────

  // Edge vertex indices for the current cube (up to 12 edges)
  const edgeVerts = new Int32Array(12);

  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        // (a) Sample the 8 corners
        for (let c = 0; c < 8; c++) {
          const [ox, oy, oz] = CORNER_OFFSETS[c];
          sampleCorner(x + ox, y + oy, z + oz, c);
        }

        // (b) Compute cube index
        let cubeIndex = 0;
        for (let c = 0; c < 8; c++) {
          if (cornerOcc[c] >= MC_THRESHOLD) {
            cubeIndex |= (1 << c);
          }
        }

        // (c) Skip fully inside or fully outside
        if (cubeIndex === 0 || cubeIndex === 255) continue;

        // (d) Which edges are intersected?
        const edgeBits = EDGE_TABLE[cubeIndex];

        // (e) Compute / reuse vertices on intersected edges
        for (let e = 0; e < 12; e++) {
          if (edgeBits & (1 << e)) {
            edgeVerts[e] = getEdgeVertex(x, y, z, e);
          }
        }

        // (g) Emit triangles
        const triRow = TRI_TABLE[cubeIndex];
        for (let t = 0; triRow[t] !== -1; t += 3) {
          idxArr.push(
            edgeVerts[triRow[t]],
            edgeVerts[triRow[t + 1]],
            edgeVerts[triRow[t + 2]],
          );
        }
      }
    }
  }

  // ── Pack results ────────────────────────────────────────────────

  const vertexCount = nextVertex;
  const triangleCount = idxArr.length / 3;

  if (triangleCount === 0) return EMPTY_MESH;

  const positions   = new Float32Array(posArr);
  const colors      = new Float32Array(colArr);
  const indices     = new Uint32Array(idxArr);
  const materialIds = new Uint8Array(matArr);

  // ── Compute smooth normals ──────────────────────────────────────
  // Accumulate face normals at each vertex, then normalize.

  const normals = new Float32Array(vertexCount * 3); // initialized to 0

  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];

    // Triangle vertex positions
    const p0x = positions[i0 * 3],     p0y = positions[i0 * 3 + 1], p0z = positions[i0 * 3 + 2];
    const p1x = positions[i1 * 3],     p1y = positions[i1 * 3 + 1], p1z = positions[i1 * 3 + 2];
    const p2x = positions[i2 * 3],     p2y = positions[i2 * 3 + 1], p2z = positions[i2 * 3 + 2];

    // Edge vectors
    const e1x = p1x - p0x, e1y = p1y - p0y, e1z = p1z - p0z;
    const e2x = p2x - p0x, e2y = p2y - p0y, e2z = p2z - p0z;

    // Cross product (face normal, magnitude = 2 * triangle area)
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    // Accumulate at each vertex (area-weighted since we don't normalize the cross product)
    normals[i0 * 3]     += nx; normals[i0 * 3 + 1] += ny; normals[i0 * 3 + 2] += nz;
    normals[i1 * 3]     += nx; normals[i1 * 3 + 1] += ny; normals[i1 * 3 + 2] += nz;
    normals[i2 * 3]     += nx; normals[i2 * 3 + 1] += ny; normals[i2 * 3 + 2] += nz;
  }

  // Normalize accumulated normals
  for (let v = 0; v < vertexCount; v++) {
    const off = v * 3;
    const nx = normals[off], ny = normals[off + 1], nz = normals[off + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-10) {
      const inv = 1 / len;
      normals[off]     = nx * inv;
      normals[off + 1] = ny * inv;
      normals[off + 2] = nz * inv;
    }
  }

  return {
    positions,
    normals,
    indices,
    colors,
    materialIds,
    vertexCount,
    triangleCount,
  };
}
