/**
 * Section 3.1 + 3.2 — Terrain Physics
 *
 * Manages a single static Rapier rigid body for the entire voxel terrain,
 * with per-chunk trimesh colliders. Colliders are rebuilt when chunks
 * remesh after voxel edits.
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { CHUNK_VOLUME } from '../voxel/constants.js';
import { TerrainMaterial, MATERIAL_DEFS } from '../voxel/terrain-materials.js';
import type { Chunk } from '../voxel/chunk.js';
import type { VoxelGrid } from '../voxel/voxel-grid.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface TerrainRaycastHit {
  point: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  material: TerrainMaterial;
}

// ── ColliderRebuildQueue (Section 3.3) ─────────────────────────────────

export class ColliderRebuildQueue {
  private queue: { chunkKey: string; priority: number }[] = [];

  /** Add a chunk to the rebuild queue with distance-based priority. */
  add(chunkKey: string, distToCamera: number): void {
    // Avoid duplicates
    const existing = this.queue.findIndex(e => e.chunkKey === chunkKey);
    if (existing !== -1) {
      this.queue[existing].priority = Math.min(this.queue[existing].priority, distToCamera);
      return;
    }
    this.queue.push({ chunkKey, priority: distToCamera });
  }

  /** Process up to `budget` colliders per frame (closest first). */
  process(budget: number): string[] {
    this.queue.sort((a, b) => a.priority - b.priority);
    const batch = this.queue.splice(0, budget);
    return batch.map(b => b.chunkKey);
  }

  get length(): number {
    return this.queue.length;
  }
}

// ── TerrainPhysics ─────────────────────────────────────────────────────

export class TerrainPhysics {
  private world: RAPIER.World;
  private grid: VoxelGrid;

  /** Single static rigid body — all chunk colliders attach to it. */
  private terrainBody: RAPIER.RigidBody;

  /** Per-chunk colliders keyed by "cx,cy,cz". */
  private colliders = new Map<string, RAPIER.Collider>();

  /** Priority queue for collider rebuilds. */
  readonly rebuildQueue = new ColliderRebuildQueue();

  /** Max collider rebuilds processed per frame. */
  colliderBudgetPerFrame = 4;

  constructor(world: RAPIER.World, grid: VoxelGrid) {
    this.world = world;
    this.grid = grid;

    // 3.1 — Single fixed body for all terrain colliders
    const bodyDesc = RAPIER.RigidBodyDesc.fixed();
    this.terrainBody = world.createRigidBody(bodyDesc);
  }

  // ── 3.2 Per-Chunk Colliders ────────────────────────────────────────

  /**
   * Rebuild the trimesh collider for a chunk after its mesh was regenerated.
   * Positions must be in world-space (chunk-offset already applied).
   */
  rebuildCollider(
    chunkKey: string,
    positions: Float32Array,
    indices: Uint32Array,
    chunk: Chunk,
  ): void {
    // Remove old collider
    this.removeCollider(chunkKey);

    // Skip if mesh is empty
    if (positions.length === 0 || indices.length === 0) return;

    // Get material-based physics properties
    const { friction, restitution } = this.getChunkPhysicsProperties(chunk);

    // Create trimesh collider attached to the static terrain body
    const colliderDesc = RAPIER.ColliderDesc.trimesh(positions, indices)
      .setFriction(friction)
      .setRestitution(restitution);

    const collider = this.world.createCollider(colliderDesc, this.terrainBody);
    this.colliders.set(chunkKey, collider);
  }

  /** Remove the collider for a single chunk. */
  removeCollider(chunkKey: string): void {
    const collider = this.colliders.get(chunkKey);
    if (collider) {
      this.world.removeCollider(collider, false);
      this.colliders.delete(chunkKey);
    }
  }

  /** Remove all terrain colliders and the static body. */
  clearAll(): void {
    for (const [, collider] of this.colliders) {
      this.world.removeCollider(collider, false);
    }
    this.colliders.clear();
  }

  /** Number of active chunk colliders. */
  get colliderCount(): number {
    return this.colliders.size;
  }

  // ── 3.3 Collider Budget ────────────────────────────────────────────

  /**
   * Process queued collider rebuilds up to the per-frame budget.
   * Called by ChunkManager after mesh updates.
   *
   * @param meshCache Map of chunkKey → { positions, indices, chunk } from the
   *   most recent mesh pass. Only chunks present in the cache are rebuilt.
   */
  processRebuildQueue(
    meshCache: Map<string, { positions: Float32Array; indices: Uint32Array; chunk: Chunk }>,
  ): number {
    const keys = this.rebuildQueue.process(this.colliderBudgetPerFrame);
    let rebuilt = 0;

    for (const key of keys) {
      const cached = meshCache.get(key);
      if (cached) {
        this.rebuildCollider(key, cached.positions, cached.indices, cached.chunk);
        rebuilt++;
      }
    }

    return rebuilt;
  }

  // ── 3.4 Raycasting ────────────────────────────────────────────────

  /**
   * Cast a ray against terrain colliders.
   * Returns the hit point, surface normal, and voxel material at the hit.
   */
  raycast(
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    maxDistance: number,
  ): TerrainRaycastHit | null {
    const ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z },
    );

    const hit = this.world.castRayAndGetNormal(ray, maxDistance, true);
    if (!hit) return null;

    const toi = hit.timeOfImpact;
    const point = {
      x: origin.x + direction.x * toi,
      y: origin.y + direction.y * toi,
      z: origin.z + direction.z * toi,
    };

    const normal = hit.normal;

    // Look up the voxel material at the hit point from the grid
    const voxel = this.grid.getVoxel(point.x, point.y, point.z);

    return {
      point,
      normal: { x: normal.x, y: normal.y, z: normal.z },
      material: voxel.material,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────

  /**
   * Determine physics properties from the chunk's dominant (most common) material.
   */
  private getChunkPhysicsProperties(chunk: Chunk): { friction: number; restitution: number } {
    const counts = new Map<TerrainMaterial, number>();

    for (let i = 0; i < CHUNK_VOLUME; i++) {
      if (chunk.data.occupancy[i] > 0.5) {
        const mat = chunk.data.materials[i] as TerrainMaterial;
        counts.set(mat, (counts.get(mat) || 0) + 1);
      }
    }

    // Find dominant material (default to Rock if chunk is empty)
    let dominantMat: TerrainMaterial = TerrainMaterial.Rock;
    let maxCount = 0;
    for (const [mat, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        dominantMat = mat;
      }
    }

    const def = MATERIAL_DEFS[dominantMat];
    return { friction: def.friction, restitution: def.restitution };
  }

  /** Dispose the terrain body and all colliders. */
  dispose(): void {
    this.clearAll();
    this.world.removeRigidBody(this.terrainBody);
  }
}
