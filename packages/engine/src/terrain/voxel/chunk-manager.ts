/**
 * Section 1.9 -- Chunk Manager
 *
 * Orchestrates the full chunk lifecycle: dirty detection, meshing,
 * rendering, and disposal. Called every frame by SimulationLoop to
 * incrementally remesh dirty chunks prioritized by camera distance.
 */

import { VoxelGrid } from "./voxel-grid.js";
import { type Chunk } from "./chunk.js";
import { ChunkMesher } from "../meshing/chunk-mesher.js";
import { ChunkRenderer } from "../rendering/chunk-renderer.js";
import { type TerrainPhysics } from "../physics/terrain-physics.js";
import { type GrassRenderer } from "../rendering/grass-renderer.js";

export class ChunkManager {
  private grid: VoxelGrid;
  private mesher: ChunkMesher;
  private renderer: ChunkRenderer;
  private terrainPhysics: TerrainPhysics | null = null;
  private grassRenderer: GrassRenderer | null = null;
  private colorOverrides: Map<number, [number, number, number]> | null = null;

  /** Max chunks to remesh per frame (avoids frame drops) */
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

  // ── Main loop entry point ───────────────────────────────────────────

  /**
   * Process dirty chunks closest to the camera, up to the per-frame budget.
   * Called every frame by the simulation loop.
   */
  update(cameraPosition: { x: number; y: number; z: number }): void {
    // (a) Collect dirty chunks
    const dirty = this.grid.getDirtyChunks();

    // (b) Sort by squared distance from camera to chunk worldOrigin (closest first)
    dirty.sort((a, b) => {
      const da = this.distanceSq(cameraPosition, a.worldOrigin);
      const db = this.distanceSq(cameraPosition, b.worldOrigin);
      return da - db;
    });

    // (c) Process up to meshBudgetPerFrame chunks
    const count = Math.min(dirty.length, this.meshBudgetPerFrame);
    let totalTimeMs = 0;

    // Cache mesh data for physics collider rebuilds
    const meshCache = new Map<string, { positions: Float32Array; indices: Uint32Array; chunk: Chunk }>();

    for (let i = 0; i < count; i++) {
      const chunk = dirty[i];

      // Mesh the chunk (solid + water passes)
      const result = this.mesher.meshChunk(chunk, this.grid, this.colorOverrides ?? undefined);

      // Build chunk key
      const key = `${chunk.cx},${chunk.cy},${chunk.cz}`;

      // Update solid and water meshes in the renderer
      this.renderer.createOrUpdateMesh(key, chunk, result.solid);
      this.renderer.createOrUpdateWaterMesh(key, chunk, result.water);

      // Mark empty if both passes produced zero vertices
      if (result.solid.vertexCount === 0 && result.water.vertexCount === 0) {
        chunk.isEmpty = true;
      }

      // Queue collider rebuild for this chunk (solid mesh only — water has no collision)
      if (this.terrainPhysics) {
        const dist = this.distanceSq(cameraPosition, chunk.worldOrigin);
        this.terrainPhysics.rebuildQueue.add(key, dist);
        meshCache.set(key, {
          positions: result.solid.positions,
          indices: result.solid.indices,
          chunk,
        });
      }

      // Update grass blades for this chunk
      if (this.grassRenderer) {
        this.grassRenderer.updateChunk(key, chunk);
      }

      // Clear dirty flag — this chunk is now up to date
      chunk.dirty = false;

      // Accumulate profiling time
      totalTimeMs += result.meshTimeMs;
    }

    // (d) Process collider rebuild queue (budget-limited)
    let collidersRebuilt = 0;
    if (this.terrainPhysics) {
      collidersRebuilt = this.terrainPhysics.processRebuildQueue(meshCache);
    }

    // (e) Update profiling counters
    this.lastMeshedCount = count;
    this.lastMeshTimeMs = totalTimeMs;
    this.lastColliderRebuiltCount = collidersRebuilt;
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
  }

  /** Number of chunks currently tracked in the grid. */
  get activeChunkCount(): number {
    return this.grid.chunkCount;
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
