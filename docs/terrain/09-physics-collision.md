# 09 — Physics & Collision

> Rapier trimesh colliders per chunk, collision rebuild, and physics interaction.

## Current Physics System

Problocks already uses **Rapier 3D** (WASM) for physics. The current terrain has a single trimesh collider built from the entire ground mesh. This needs to become **per-chunk trimesh colliders** for the voxel system.

---

## Per-Chunk Colliders

Each chunk that has solid voxels gets its own Rapier trimesh collider. When a chunk's mesh is rebuilt (after voxel edits), its collider is also rebuilt.

```typescript
class TerrainPhysics {
  private rapier: RapierPhysics;
  private colliders = new Map<string, RAPIER.Collider>();

  /**
   * Rebuild collider for a specific chunk.
   * Called by ChunkManager after Marching Cubes generates new mesh.
   */
  rebuildCollider(chunkKey: string, vertices: Float32Array, indices: Uint32Array): void {
    // Remove old collider
    const existing = this.colliders.get(chunkKey);
    if (existing) {
      this.rapier.world.removeCollider(existing, false);
    }

    // Skip if mesh is empty
    if (vertices.length === 0 || indices.length === 0) {
      this.colliders.delete(chunkKey);
      return;
    }

    // Create trimesh collider desc
    const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices)
      .setFriction(0.6)
      .setRestitution(0.1);

    // Attach to the static terrain rigid body
    const collider = this.rapier.world.createCollider(colliderDesc, this.terrainBody);
    this.colliders.set(chunkKey, collider);
  }

  /**
   * Remove collider for a chunk (when chunk becomes empty).
   */
  removeCollider(chunkKey: string): void {
    const collider = this.colliders.get(chunkKey);
    if (collider) {
      this.rapier.world.removeCollider(collider, false);
      this.colliders.delete(chunkKey);
    }
  }

  /**
   * Remove all terrain colliders.
   */
  clearAll(): void {
    for (const [key, collider] of this.colliders) {
      this.rapier.world.removeCollider(collider, false);
    }
    this.colliders.clear();
  }
}
```

---

## Static Terrain Body

All terrain colliders attach to a single static rigid body. This is efficient — Rapier only needs one body for the entire terrain, but each chunk gets its own collider shape.

```typescript
// During initialization
const terrainBodyDesc = RAPIER.RigidBodyDesc.fixed(); // static body
this.terrainBody = world.createRigidBody(terrainBodyDesc);
```

---

## Mesh-to-Collider Pipeline

After Marching Cubes generates a chunk's mesh, extract the vertex/index data for Rapier:

```typescript
function createColliderFromMesh(meshData: ChunkMeshData): { vertices: Float32Array; indices: Uint32Array } {
  // Rapier expects vertices as [x1,y1,z1, x2,y2,z2, ...]
  // and indices as [i0,i1,i2, i3,i4,i5, ...]

  // The Marching Cubes output is already in this format
  return {
    vertices: meshData.positions,  // Float32Array of x,y,z triples
    indices: meshData.indices,     // Uint32Array of triangle index triples
  };
}
```

---

## Collision Priority

When a chunk is dirty, collider rebuild should be prioritized for chunks near the player/camera:

```typescript
class ColliderRebuildQueue {
  private queue: { chunkKey: string; priority: number }[] = [];

  add(chunkKey: string, distToCamera: number): void {
    this.queue.push({ chunkKey, priority: distToCamera });
  }

  /** Process up to N colliders per frame */
  process(budget: number): string[] {
    // Sort by priority (closest first)
    this.queue.sort((a, b) => a.priority - b.priority);
    const batch = this.queue.splice(0, budget);
    return batch.map(b => b.chunkKey);
  }
}
```

---

## Material-Based Friction

Different terrain materials have different physics properties. When creating a collider, use the dominant material's friction/restitution:

```typescript
function getChunkPhysicsProperties(chunk: Chunk): { friction: number; restitution: number } {
  // Count material occurrences in the chunk
  const counts = new Map<TerrainMaterial, number>();
  for (let i = 0; i < CHUNK_VOLUME; i++) {
    if (chunk.data.occupancy[i] > 0.5) {
      const mat = chunk.data.materials[i];
      counts.set(mat, (counts.get(mat) || 0) + 1);
    }
  }

  // Find dominant material
  let dominantMat = TerrainMaterial.Rock;
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
```

**Advanced (Phase 2)**: For per-triangle material friction, use Rapier's contact modification API to dynamically set friction based on which triangle was hit, looking up the voxel material at the contact point.

---

## Raycasting for Brush Placement

The terrain editor needs raycasts to determine where the brush should be placed:

```typescript
function terrainRaycast(
  rapierWorld: RAPIER.World,
  origin: Vector3,
  direction: Vector3,
  maxDistance: number,
): { point: Vector3; normal: Vector3; material: TerrainMaterial } | null {
  const ray = new RAPIER.Ray(
    { x: origin.x, y: origin.y, z: origin.z },
    { x: direction.x, y: direction.y, z: direction.z }
  );

  const hit = rapierWorld.castRay(ray, maxDistance, true);
  if (!hit) return null;

  const point = ray.pointAt(hit.timeOfImpact);
  const normal = hit.normal;

  // Look up the voxel material at the hit point
  const material = grid.getVoxel(point.x, point.y, point.z).material;

  return {
    point: new Vector3(point.x, point.y, point.z),
    normal: new Vector3(normal.x, normal.y, normal.z),
    material,
  };
}
```

This is used for:
- **Brush placement** — position the brush cursor where the ray hits terrain
- **Material eyedropper** — Alt+click to pick the material under the cursor
- **Entity placement** — clicking on terrain to place new entities

---

## Performance Considerations

### Collider Count
With 16x16x16 chunks, a 1024x128x1024 world has ~32,768 potential chunks. In practice, most are empty (air above terrain). Typical terrain might have 2,000–5,000 active chunk colliders.

Rapier handles this well — trimesh colliders are static and have minimal per-frame cost after creation.

### Rebuild Budget
Limit collider rebuilds to **2-4 per frame** to avoid physics pipeline stalls. Prioritize chunks near the player. During large edits (generation, fill), batch all collider rebuilds and process over multiple frames.

### Mesh Simplification for Colliders
The visual mesh may have more detail than needed for physics. Consider using a simplified version:
- Skip voxels that are fully enclosed (no adjacent air)
- Use a lower-resolution Marching Cubes pass (every other voxel)
- Merge coplanar triangles
