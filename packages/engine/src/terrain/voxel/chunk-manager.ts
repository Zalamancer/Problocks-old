/**
 * Section 1.9 + 10.1/10.3/10.5 -- Chunk Manager
 *
 * Orchestrates the full chunk lifecycle: dirty detection, LOD-aware meshing,
 * rendering, disposal, and memory management. Called every frame by
 * SimulationLoop to incrementally remesh dirty chunks prioritized by
 * camera distance.
 *
 * Phase 10 additions:
 * - LOD-based meshing (Full/Half/Quarter/Eighth)
 * - Memory management (load/unload distances, mesh disposal)
 * - Performance tracking with auto-budget adjustment
 * - Periodic empty chunk pruning
 */

import { VoxelGrid } from "./voxel-grid.js";
import { type Chunk } from "./chunk.js";
import { ChunkMesher } from "../meshing/chunk-mesher.js";
import { ChunkRenderer } from "../rendering/chunk-renderer.js";
import { type TerrainPhysics } from "../physics/terrain-physics.js";
import { type GrassRenderer } from "../rendering/grass-renderer.js";
import {
  LODLevel,
  getLODLevel,
  downsampleChunk,
  marchingCubesLOD,
  applyBoundarySkirts,
} from "../meshing/lod-system.js";
import { TerrainPerfTracker } from "../rendering/perf-overlay.js";
import type { MeshWorkerPool, WorkerMeshResult } from "../meshing/mesh-worker-pool.js";
import { buildPaddedGrid, serializeOverrides } from "../meshing/mesh-worker-pool.js";

// ── Memory management distances (world units) ─────────────────────────

/** Chunks within this distance get meshes loaded. */
const LOAD_DISTANCE = 320;
/** Chunks beyond this distance have meshes unloaded (voxel data kept). */
const UNLOAD_DISTANCE = 400;
const LOAD_DISTANCE_SQ = LOAD_DISTANCE * LOAD_DISTANCE;
const UNLOAD_DISTANCE_SQ = UNLOAD_DISTANCE * UNLOAD_DISTANCE;

// ── Prune interval ────────────────────────────────────────────────────

const PRUNE_INTERVAL_FRAMES = 120;

// ── ChunkManager ──────────────────────────────────────────────────────

export class ChunkManager {
  private grid: VoxelGrid;
  private mesher: ChunkMesher;
  private renderer: ChunkRenderer;
  private terrainPhysics: TerrainPhysics | null = null;
  private grassRenderer: GrassRenderer | null = null;
  private colorOverrides: Map<number, [number, number, number]> | null = null;

  /** Chunks that currently have meshes loaded in the renderer. */
  private loadedChunks = new Set<string>();

  /** Current LOD level per loaded chunk (for detecting LOD transitions). */
  private chunkLOD = new Map<string, LODLevel>();

  /** Frame counter for periodic empty-chunk pruning. */
  private pruneCounter = 0;

  /** Performance tracker (Phase 10.5). */
  readonly perfTracker = new TerrainPerfTracker();

  /** Optional Web Worker pool for off-thread meshing (Phase 10.2). */
  private workerPool: MeshWorkerPool | null = null;
  /** Chunks currently being meshed by workers. */
  private pendingWorkerChunks = new Set<string>();

  /** Max chunks to remesh per frame (auto-adjusted by perf tracker). */
  meshBudgetPerFrame = 4;

  /** Profiling: chunks meshed in the last update() call */
  lastMeshedCount = 0;
  /** Profiling: total mesh time in ms for the last update() */
  lastMeshTimeMs = 0;
  /** Profiling: colliders rebuilt in the last update() call */
  lastColliderRebuiltCount = 0;

  constructor(grid: VoxelGrid, mesher: ChunkMesher, renderer: ChunkRenderer) {
    this.grid = grid;
    this.mesher = mesher;
    this.renderer = renderer;
  }

  /** Attach terrain physics for automatic collider rebuilds after meshing. */
  setTerrainPhysics(physics: TerrainPhysics): void {
    this.terrainPhysics = physics;
  }

  /** Attach grass renderer for automatic grass updates after meshing. */
  setGrassRenderer(grass: GrassRenderer): void {
    this.grassRenderer = grass;
  }

  /** Set per-material color overrides and trigger full remesh. */
  setColorOverrides(overrides: Map<number, [number, number, number]> | null): void {
    this.colorOverrides = overrides;
    this.forceRemeshAll();
  }

  /** Replace the water material used by the chunk renderer. */
  setWaterMaterial(mat: import("@babylonjs/core").Material): void {
    this.renderer.setWaterMaterial(mat);
  }

  /** Attach a Web Worker pool for off-thread meshing (Phase 10.2). */
  setWorkerPool(pool: MeshWorkerPool): void {
    this.workerPool = pool;
  }

  // ── Main loop entry point ───────────────────────────────────────────

  /**
   * Process dirty chunks closest to the camera, up to the per-frame budget.
   * Called every frame by the simulation loop.
   */
  update(cameraPosition: { x: number; y: number; z: number }): void {
    // (–1) Process completed worker results from previous frames
    this.processWorkerResults(cameraPosition);

    // (0) Unload distant chunk meshes (keep voxel data)
    this.unloadDistantChunks(cameraPosition);

    // (a) Collect chunks that need meshing:
    //     - dirty chunks within load distance
    //     - chunks within load distance that aren't loaded yet
    //     - chunks whose LOD level changed
    const candidates: Chunk[] = [];

    for (const chunk of this.grid.getAllChunks()) {
      const key = `${chunk.cx},${chunk.cy},${chunk.cz}`;
      const dist = this.distanceSq(cameraPosition, chunk.worldOrigin);

      if (dist > LOAD_DISTANCE_SQ) continue;

      const newLOD = getLODLevel(dist);
      const currentLOD = this.chunkLOD.get(key);

      // Skip chunks already being meshed by a worker
      if (this.pendingWorkerChunks.has(key)) continue;

      if (chunk.dirty || !this.loadedChunks.has(key) || currentLOD !== newLOD) {
        candidates.push(chunk);
      }
    }

    // (b) Sort by squared distance from camera (closest first)
    candidates.sort((a, b) => {
      const da = this.distanceSq(cameraPosition, a.worldOrigin);
      const db = this.distanceSq(cameraPosition, b.worldOrigin);
      return da - db;
    });

    // (c) Process up to meshBudgetPerFrame chunks
    const count = Math.min(candidates.length, this.meshBudgetPerFrame);
    let totalTimeMs = 0;

    const meshCache = new Map<string, { positions: Float32Array; indices: Uint32Array; chunk: Chunk }>();

    for (let i = 0; i < count; i++) {
      const chunk = candidates[i];
      const key = `${chunk.cx},${chunk.cy},${chunk.cz}`;
      const dist = this.distanceSq(cameraPosition, chunk.worldOrigin);
      const lod = getLODLevel(dist);

      // (c.1) Worker path — dispatch to off-thread pool
      if (this.workerPool) {
        const { paddedOcc, paddedMat } = buildPaddedGrid(chunk, this.grid);
        this.workerPool.queueMesh(
          key,
          paddedOcc,
          paddedMat,
          lod,
          serializeOverrides(this.colorOverrides),
        );
        this.pendingWorkerChunks.add(key);
        chunk.dirty = false;
        continue;
      }

      // (c.2) Synchronous fallback — mesh on main thread
      const t0 = performance.now();

      if (lod === LODLevel.Full) {
        // Full-resolution meshing with neighbor lookups
        const result = this.mesher.meshChunk(chunk, this.grid, this.colorOverrides ?? undefined);

        this.renderer.createOrUpdateMesh(key, chunk, result.solid);
        this.renderer.createOrUpdateWaterMesh(key, chunk, result.water);

        if (result.solid.vertexCount === 0 && result.water.vertexCount === 0) {
          chunk.isEmpty = true;
        }

        // Queue collider rebuild (solid mesh only)
        if (this.terrainPhysics) {
          this.terrainPhysics.rebuildQueue.add(key, dist);
          meshCache.set(key, {
            positions: result.solid.positions,
            indices: result.solid.indices,
            chunk,
          });
        }

        // Update grass
        if (this.grassRenderer) {
          this.grassRenderer.updateChunk(key, chunk);
        }

        totalTimeMs += result.meshTimeMs;
      } else {
        // LOD meshing: downsample + compact MC
        const lodData = downsampleChunk(
          chunk.data.occupancy, chunk.data.materials, lod,
        );
        const lodMesh = marchingCubesLOD(lodData, this.colorOverrides ?? undefined);

        // Apply boundary skirts for LOD > Full
        if (lodMesh.vertexCount > 0) {
          applyBoundarySkirts(lodMesh, lodData.voxelScale);
        }

        this.renderer.createOrUpdateMesh(key, chunk, lodMesh);
        // No water mesh for distant LOD chunks
        this.renderer.createOrUpdateWaterMesh(key, chunk, {
          positions: new Float32Array(0),
          normals: new Float32Array(0),
          indices: new Uint32Array(0),
          colors: new Float32Array(0),
          materialIds: new Uint8Array(0),
          vertexCount: 0,
          triangleCount: 0,
        });

        if (lodMesh.vertexCount === 0) {
          chunk.isEmpty = true;
        }

        // Collider only for Half LOD (Quarter/Eighth too far for collision)
        if (this.terrainPhysics && lod === LODLevel.Half) {
          this.terrainPhysics.rebuildQueue.add(key, dist);
          meshCache.set(key, {
            positions: lodMesh.positions,
            indices: lodMesh.indices,
            chunk,
          });
        } else if (this.terrainPhysics && lod > LODLevel.Half) {
          // Remove collider for very distant chunks
          this.terrainPhysics.removeCollider(key);
        }

        // No grass for LOD chunks (too distant)
        if (this.grassRenderer) {
          this.grassRenderer.disposeChunk(key);
        }

        totalTimeMs += performance.now() - t0;
      }

      // Track loaded state
      this.loadedChunks.add(key);
      this.chunkLOD.set(key, lod);

      // Clear dirty flag
      chunk.dirty = false;
    }

    // (d) Process collider rebuild queue (budget-limited)
    let collidersRebuilt = 0;
    if (this.terrainPhysics) {
      const colliderT0 = performance.now();
      collidersRebuilt = this.terrainPhysics.processRebuildQueue(meshCache);
      this.perfTracker.recordColliderFrame(performance.now() - colliderT0);
    }

    // (e) Update profiling counters
    this.lastMeshedCount = count;
    this.lastMeshTimeMs = totalTimeMs;
    this.lastColliderRebuiltCount = collidersRebuilt;

    // (f) Performance tracking + auto-budget adjustment
    this.perfTracker.recordMeshFrame(totalTimeMs, this.meshBudgetPerFrame);
    this.perfTracker.chunksLoaded = this.loadedChunks.size;

    // Update LOD counts
    this.perfTracker.lodCounts = [0, 0, 0, 0];
    for (const lod of this.chunkLOD.values()) {
      this.perfTracker.lodCounts[lod]++;
    }

    // Auto-adjust mesh budget based on frame time
    this.meshBudgetPerFrame = this.perfTracker.meshBudgetRecommendation;

    // (g) Periodic empty chunk pruning
    this.pruneCounter++;
    if (this.pruneCounter >= PRUNE_INTERVAL_FRAMES) {
      this.pruneEmptyChunks();
      this.pruneCounter = 0;
    }
  }

  // ── Public helpers ──────────────────────────────────────────────────

  /**
   * Mark every chunk in the grid as dirty so it will be re-meshed.
   * Typically called after bulk terrain generation.
   */
  forceRemeshAll(): void {
    for (const chunk of this.grid.getAllChunks()) {
      chunk.dirty = true;
    }
  }

  /**
   * Dispose all renderer meshes and clear the voxel grid.
   */
  disposeAll(): void {
    this.renderer.disposeAll();
    if (this.terrainPhysics) {
      this.terrainPhysics.clearAll();
    }
    if (this.grassRenderer) {
      this.grassRenderer.disposeAll();
    }
    this.grid.clearAll();
    this.loadedChunks.clear();
    this.chunkLOD.clear();
    this.pendingWorkerChunks.clear();
    this.perfTracker.reset();
  }

  /** Number of chunks currently tracked in the grid. */
  get activeChunkCount(): number {
    return this.grid.chunkCount;
  }

  /** Number of chunks with loaded meshes. */
  get loadedChunkCount(): number {
    return this.loadedChunks.size;
  }

  // ── Worker result processing (10.2) ──────────────────────────────────

  /**
   * Drain completed results from the worker pool and apply them to the
   * renderer, physics, and grass systems.
   */
  private processWorkerResults(cameraPosition: { x: number; y: number; z: number }): void {
    if (!this.workerPool) return;

    const results = this.workerPool.drainResults();
    if (results.length === 0) return;

    const meshCache = new Map<string, { positions: Float32Array; indices: Uint32Array; chunk: Chunk }>();

    for (const result of results) {
      const key = result.chunkKey;
      this.pendingWorkerChunks.delete(key);

      // Look up chunk (may have been pruned/removed while worker was running)
      const parts = key.split(",");
      const chunk = this.grid.getChunk(
        Number(parts[0]), Number(parts[1]), Number(parts[2]),
      );
      if (!chunk) continue;

      const dist = this.distanceSq(cameraPosition, chunk.worldOrigin);
      const lod = getLODLevel(dist);

      // Apply solid + water meshes to renderer
      this.renderer.createOrUpdateMesh(key, chunk, result.solid);
      this.renderer.createOrUpdateWaterMesh(key, chunk, result.water);

      if (result.solid.vertexCount === 0 && result.water.vertexCount === 0) {
        chunk.isEmpty = true;
      }

      // Queue collider rebuild
      if (this.terrainPhysics && lod <= LODLevel.Half) {
        this.terrainPhysics.rebuildQueue.add(key, dist);
        meshCache.set(key, {
          positions: result.solid.positions,
          indices: result.solid.indices,
          chunk,
        });
      }

      // Update grass (only for full LOD)
      if (this.grassRenderer) {
        if (lod === LODLevel.Full) {
          this.grassRenderer.updateChunk(key, chunk);
        } else {
          this.grassRenderer.disposeChunk(key);
        }
      }

      this.loadedChunks.add(key);
      this.chunkLOD.set(key, lod);
    }

    // Process collider rebuilds from worker results
    if (this.terrainPhysics && meshCache.size > 0) {
      this.terrainPhysics.processRebuildQueue(meshCache);
    }
  }

  // ── Memory management (10.3) ────────────────────────────────────────

  /**
   * Dispose meshes and colliders for chunks beyond UNLOAD_DISTANCE.
   * Voxel data is preserved so the chunk can be re-meshed when it
   * re-enters load range.
   */
  private unloadDistantChunks(cameraPosition: { x: number; y: number; z: number }): void {
    for (const chunk of this.grid.getAllChunks()) {
      const key = `${chunk.cx},${chunk.cy},${chunk.cz}`;
      if (!this.loadedChunks.has(key)) continue;

      const dist = this.distanceSq(cameraPosition, chunk.worldOrigin);
      if (dist > UNLOAD_DISTANCE_SQ) {
        this.renderer.disposeMesh(key);
        if (this.terrainPhysics) {
          this.terrainPhysics.removeCollider(key);
        }
        if (this.grassRenderer) {
          this.grassRenderer.disposeChunk(key);
        }
        this.loadedChunks.delete(key);
        this.chunkLOD.delete(key);
      }
    }
  }

  /**
   * Remove empty chunks from the grid and clean up their renderer state.
   * Called periodically to reclaim memory after terrain edits.
   */
  private pruneEmptyChunks(): void {
    for (const chunk of this.grid.getAllChunks()) {
      if (!chunk.isEmpty) continue;
      const key = `${chunk.cx},${chunk.cy},${chunk.cz}`;
      this.renderer.disposeMesh(key);
      if (this.terrainPhysics) {
        this.terrainPhysics.removeCollider(key);
      }
      if (this.grassRenderer) {
        this.grassRenderer.disposeChunk(key);
      }
      this.loadedChunks.delete(key);
      this.chunkLOD.delete(key);
    }
    this.grid.pruneEmpty();
  }

  // ── Private helpers ─────────────────────────────────────────────────

  /** Squared Euclidean distance between two 3D points (no sqrt for sorting). */
  private distanceSq(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
  ): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }
}
