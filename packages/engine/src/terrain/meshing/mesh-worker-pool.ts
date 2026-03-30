/**
 * Section 10.2 -- Mesh Worker Pool
 *
 * Main-thread pool manager for off-thread Marching Cubes meshing.
 * Dispatches mesh requests to 2–4 Web Workers, collects results via
 * Transferable ArrayBuffers (zero-copy), and returns completed meshes
 * for the ChunkManager to upload to the GPU.
 *
 * Usage:
 *   const pool = new MeshWorkerPool(
 *     () => new Worker(new URL('./mesh-worker.js', import.meta.url), { type: 'module' }),
 *     4,
 *   );
 *   chunkManager.setWorkerPool(pool);
 */

import { CHUNK_SIZE, CHUNK_VOLUME } from "../voxel/constants.js";
import { voxelIndex } from "../voxel/voxel.js";
import type { Chunk } from "../voxel/chunk.js";
import type { VoxelGrid } from "../voxel/voxel-grid.js";
import type { ChunkMeshData } from "./marching-cubes.js";
import type { WorkerMeshRequest, WorkerMeshResponse, TransferableMesh } from "./mesh-worker.js";

// ── Padded grid size ──────────────────────────────────────────────────

const PS = CHUNK_SIZE + 1; // 17
const PV = PS * PS * PS;   // 4913

// ── Public types ──────────────────────────────────────────────────────

export interface WorkerMeshResult {
  chunkKey: string;
  solid: ChunkMeshData;
  water: ChunkMeshData;
  meshTimeMs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Build a (CHUNK_SIZE+1)³ padded occupancy/material grid for a chunk.
 * The padding bakes neighbor border voxels into the grid so the worker
 * can run MC without cross-chunk callbacks.
 */
export function buildPaddedGrid(
  chunk: Chunk,
  grid: VoxelGrid,
): { paddedOcc: Float32Array; paddedMat: Uint8Array } {
  const paddedOcc = new Float32Array(PV);
  const paddedMat = new Uint8Array(PV);

  for (let pz = 0; pz < PS; pz++) {
    for (let py = 0; py < PS; py++) {
      for (let px = 0; px < PS; px++) {
        const pidx = px + py * PS + pz * PS * PS;

        if (px < CHUNK_SIZE && py < CHUNK_SIZE && pz < CHUNK_SIZE) {
          // Within chunk — read directly
          const cidx = voxelIndex(px, py, pz);
          paddedOcc[pidx] = chunk.data.occupancy[cidx];
          paddedMat[pidx] = chunk.data.materials[cidx];
        } else {
          // Border — read from neighbor chunk(s)
          let ncx = chunk.cx;
          let ncy = chunk.cy;
          let ncz = chunk.cz;
          let nlx = px;
          let nly = py;
          let nlz = pz;

          if (px >= CHUNK_SIZE) { ncx++; nlx = 0; }
          if (py >= CHUNK_SIZE) { ncy++; nly = 0; }
          if (pz >= CHUNK_SIZE) { ncz++; nlz = 0; }

          const neighbor = grid.getChunk(ncx, ncy, ncz);
          if (neighbor) {
            const nidx = voxelIndex(nlx, nly, nlz);
            paddedOcc[pidx] = neighbor.data.occupancy[nidx];
            paddedMat[pidx] = neighbor.data.materials[nidx];
          }
          // else: defaults to 0 (air) — Float32Array/Uint8Array zero-initialized
        }
      }
    }
  }

  return { paddedOcc, paddedMat };
}

/**
 * Serialize a color override Map into a flat array for worker transfer.
 * Format: [matId, r, g, b, matId, r, g, b, …]
 */
export function serializeOverrides(
  map: Map<number, [number, number, number]> | null,
): number[] | null {
  if (!map || map.size === 0) return null;
  const result: number[] = [];
  for (const [id, [r, g, b]] of map) {
    result.push(id, r, g, b);
  }
  return result;
}

// ── Internal types ────────────────────────────────────────────────────

interface PendingRequest {
  chunkKey: string;
  workerIdx: number;
}

interface QueuedRequest {
  chunkKey: string;
  message: WorkerMeshRequest;
  paddedOcc: Float32Array;
  paddedMat: Uint8Array;
}

// ── Mesh Worker Pool ──────────────────────────────────────────────────

export class MeshWorkerPool {
  private workers: Worker[] = [];
  private idle: number[] = [];
  private pending = new Map<number, PendingRequest>();
  private queue: QueuedRequest[] = [];
  private completed: WorkerMeshResult[] = [];
  private nextId = 0;

  constructor(
    createWorker: () => Worker,
    poolSize = 4,
  ) {
    for (let i = 0; i < poolSize; i++) {
      const w = createWorker();
      const idx = i;
      w.onmessage = (e: MessageEvent) => this.handleResponse(idx, e.data);
      w.onerror = (err) => {
        console.error(`[MeshWorkerPool] Worker ${idx} error:`, err);
        // Return worker to idle so it can process the next request
        this.idle.push(idx);
        this.dispatchNext(idx);
      };
      this.workers.push(w);
      this.idle.push(i);
    }
  }

  /**
   * Queue a chunk for off-thread meshing.
   * Immediately dispatches to an idle worker if available,
   * otherwise enqueues for later dispatch.
   */
  queueMesh(
    chunkKey: string,
    paddedOcc: Float32Array,
    paddedMat: Uint8Array,
    lodLevel: number,
    overrides: number[] | null,
  ): void {
    const id = this.nextId++;
    const message: WorkerMeshRequest = {
      type: "mesh",
      id,
      paddedOccupancy: paddedOcc,
      paddedMaterials: paddedMat,
      lodLevel,
      overrides,
    };

    if (this.idle.length > 0) {
      const workerIdx = this.idle.pop()!;
      this.dispatch(workerIdx, id, chunkKey, message, paddedOcc, paddedMat);
    } else {
      this.queue.push({ chunkKey, message, paddedOcc, paddedMat });
    }
  }

  /**
   * Drain all completed mesh results since the last call.
   * ChunkManager calls this each frame to process finished meshes.
   */
  drainResults(): WorkerMeshResult[] {
    if (this.completed.length === 0) return [];
    const results = this.completed;
    this.completed = [];
    return results;
  }

  /** Whether a chunk is currently being meshed by a worker. */
  hasPending(chunkKey: string): boolean {
    for (const p of this.pending.values()) {
      if (p.chunkKey === chunkKey) return true;
    }
    for (const q of this.queue) {
      if (q.chunkKey === chunkKey) return true;
    }
    return false;
  }

  /** Number of requests in-flight + queued. */
  get pendingCount(): number {
    return this.pending.size + this.queue.length;
  }

  /** Terminate all workers and clear state. */
  dispose(): void {
    for (const w of this.workers) {
      w.terminate();
    }
    this.workers.length = 0;
    this.idle.length = 0;
    this.pending.clear();
    this.queue.length = 0;
    this.completed.length = 0;
  }

  // ── Private ─────────────────────────────────────────────────────────

  private dispatch(
    workerIdx: number,
    id: number,
    chunkKey: string,
    message: WorkerMeshRequest,
    paddedOcc: Float32Array,
    paddedMat: Uint8Array,
  ): void {
    this.pending.set(id, { chunkKey, workerIdx });

    // Transfer ArrayBuffers (zero-copy)
    const transfers: Transferable[] = [];
    if (paddedOcc.byteLength > 0) transfers.push(paddedOcc.buffer);
    if (paddedMat.byteLength > 0) transfers.push(paddedMat.buffer);

    this.workers[workerIdx].postMessage(message, transfers);
  }

  private handleResponse(workerIdx: number, data: WorkerMeshResponse): void {
    if (data.type !== "result") return;

    const entry = this.pending.get(data.id);
    if (entry) {
      this.completed.push({
        chunkKey: entry.chunkKey,
        solid: toChunkMeshData(data.solid),
        water: toChunkMeshData(data.water),
        meshTimeMs: data.meshTimeMs,
      });
      this.pending.delete(data.id);
    }

    // Dispatch next queued request to this now-idle worker
    this.dispatchNext(workerIdx);
  }

  private dispatchNext(workerIdx: number): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      const id = next.message.id;
      this.dispatch(workerIdx, id, next.chunkKey, next.message, next.paddedOcc, next.paddedMat);
    } else {
      this.idle.push(workerIdx);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function toChunkMeshData(mesh: TransferableMesh): ChunkMeshData {
  return {
    positions: mesh.positions,
    normals: mesh.normals,
    indices: mesh.indices,
    colors: mesh.colors,
    materialIds: mesh.materialIds,
    vertexCount: mesh.vertexCount,
    triangleCount: mesh.triangleCount,
  };
}
