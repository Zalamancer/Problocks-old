# 11 — Optimization

> Chunking, LOD, greedy meshing, frustum culling, and memory management.

## Performance Targets

| Metric | Target |
|--------|--------|
| Frame rate | 60 FPS on mid-range laptop |
| Terrain size | 512x128x512 voxels (2048x512x2048 studs) |
| Mesh rebuild time | < 5ms per chunk |
| Max active chunks | ~5,000 |
| Memory per chunk | ~20 KB voxel data + ~50 KB mesh |
| Initial generation | < 3 seconds for full terrain |

---

## 1. Chunk-Based Architecture

The chunk system is the primary optimization. Benefits:
- **Sparse storage** — only chunks with terrain data are allocated
- **Incremental updates** — only dirty chunks remesh
- **Spatial locality** — operations affect a small number of chunks
- **Parallel processing** — multiple chunks can mesh independently

### Chunk Size Selection

| Chunk Size | Voxels | Memory | Mesh Time | Chunks for 512^3 |
|------------|--------|--------|-----------|-------------------|
| 8x8x8 | 512 | ~3 KB | ~0.5ms | 262,144 (too many) |
| **16x16x16** | 4,096 | ~20 KB | **~3ms** | **32,768** |
| 32x32x32 | 32,768 | ~160 KB | ~25ms | 4,096 |

**16x16x16 is the sweet spot** — fast enough to remesh in one frame, few enough chunks to manage.

---

## 2. Marching Cubes Optimization

### Lookup Table Pre-computation

The Marching Cubes algorithm uses two tables:
- **Edge table** (256 entries) — which edges have intersections for each cube configuration
- **Triangle table** (256 × 16 entries) — which triangles to generate

These are computed once at module load time and stored as `Uint16Array` for cache-friendly access.

### Skip Empty/Full Cubes

```typescript
// Fast reject: if all 8 corners are air (0) or all solid (1), skip
const cubeIndex = computeCubeIndex(corners);
if (cubeIndex === 0 || cubeIndex === 255) continue; // no surface here
```

This skips ~80% of cubes in typical terrain (large solid and air regions).

### Vertex Deduplication

Marching Cubes generates duplicate vertices at shared edges. Use a hash map to deduplicate:

```typescript
const vertexCache = new Map<string, number>();

function getOrCreateVertex(edgeKey: string, position: Vector3, normal: Vector3): number {
  const existing = vertexCache.get(edgeKey);
  if (existing !== undefined) return existing;

  const index = positions.length / 3;
  positions.push(position.x, position.y, position.z);
  normals.push(normal.x, normal.y, normal.z);
  vertexCache.set(edgeKey, index);
  return index;
}
```

This typically reduces vertex count by 50-70%.

---

## 3. Greedy Meshing (Optional)

For **flat terrain regions** (large areas at the same height with the same material), greedy meshing can merge adjacent quads into larger ones:

```
Before greedy meshing:     After greedy meshing:
┌─┬─┬─┬─┬─┬─┬─┬─┐        ┌───────────────────┐
│ │ │ │ │ │ │ │ │        │                   │
├─┼─┼─┼─┼─┼─┼─┼─┤        │    One large      │
│ │ │ │ │ │ │ │ │        │    quad instead    │
├─┼─┼─┼─┼─┼─┼─┼─┤        │    of 64 tiny     │
│ │ │ │ │ │ │ │ │        │    ones            │
├─┼─┼─┼─┼─┼─┼─┼─┤        │                   │
│ │ │ │ │ │ │ │ │        │                   │
└─┴─┴─┴─┴─┴─┴─┴─┘        └───────────────────┘
64 quads, 256 vertices     1 quad, 4 vertices
```

This is most effective for heightmap-style terrain (no caves/overhangs). Use it as a post-process on Marching Cubes output for near-flat surfaces.

---

## 4. Level of Detail (LOD)

Distant chunks use lower-resolution meshes:

```typescript
enum LODLevel {
  Full = 0,      // every voxel, ~4m resolution
  Half = 1,      // every 2nd voxel, ~8m resolution
  Quarter = 2,   // every 4th voxel, ~16m resolution
  Eighth = 3,    // every 8th voxel, ~32m resolution
}

function getLODLevel(distanceToCamera: number): LODLevel {
  if (distanceToCamera < 128) return LODLevel.Full;
  if (distanceToCamera < 256) return LODLevel.Half;
  if (distanceToCamera < 512) return LODLevel.Quarter;
  return LODLevel.Eighth;
}
```

### LOD Meshing

For lower LOD levels, sample every Nth voxel and run Marching Cubes on the downsampled grid:

```typescript
function meshChunkLOD(chunk: Chunk, lodLevel: LODLevel): MeshData {
  const step = 1 << lodLevel; // 1, 2, 4, or 8
  const gridSize = CHUNK_SIZE / step;

  // Downsample: average occupancy values
  for (let z = 0; z < gridSize; z++) {
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        let sum = 0;
        let count = 0;
        for (let dz = 0; dz < step; dz++) {
          for (let dy = 0; dy < step; dy++) {
            for (let dx = 0; dx < step; dx++) {
              sum += chunk.data.occupancy[voxelIndex(x*step+dx, y*step+dy, z*step+dz)];
              count++;
            }
          }
        }
        downsampledGrid[z * gridSize * gridSize + y * gridSize + x] = sum / count;
      }
    }
  }

  return marchingCubes(downsampledGrid, gridSize, VOXEL_SIZE * step);
}
```

### LOD Transition

To avoid visible seams between LOD levels, use **skirts** — extend the mesh edges slightly downward at LOD boundaries.

---

## 5. Frustum Culling

Only render chunks visible to the camera:

```typescript
function isChunkVisible(chunk: Chunk, frustum: BABYLON.Frustum): boolean {
  const origin = chunk.worldOrigin;
  const boundingBox = new BABYLON.BoundingBox(
    new BABYLON.Vector3(origin.x, origin.y, origin.z),
    new BABYLON.Vector3(
      origin.x + CHUNK_WORLD_SIZE,
      origin.y + CHUNK_WORLD_SIZE,
      origin.z + CHUNK_WORLD_SIZE
    )
  );
  return frustum.isInFrustum(boundingBox);
}
```

Babylon.js handles this automatically for mesh objects, but we can skip meshing entirely for chunks outside the view frustum.

---

## 6. Web Worker Meshing

Move Marching Cubes computation to a Web Worker to avoid blocking the main thread:

```
Main Thread                    Worker Thread
     │                              │
     │  postMessage({               │
     │    type: 'mesh',             │
     │    chunkData,                │
     │    neighborData              │
     │  })                          │
     │─────────────────────────────▶│
     │                              │  Run Marching Cubes
     │                              │  Compute normals
     │                              │  Deduplicate vertices
     │                              │
     │◀─────────────────────────────│
     │  postMessage({               │
     │    positions: Float32Array,  │
     │    normals: Float32Array,    │
     │    indices: Uint32Array,     │
     │    colors: Float32Array      │
     │  })                          │
     │                              │
     │  Upload to GPU               │
     │  (VertexData → Mesh)         │
```

Use **Transferable objects** (ArrayBuffer transfer, not copy) for zero-copy messaging between threads.

---

## 7. Memory Management

### Chunk Disposal

Chunks far from the camera can be **unloaded** (mesh disposed, collider removed) while keeping voxel data:

```typescript
const LOAD_DISTANCE = 320;   // world units — chunks within this distance are fully loaded
const UNLOAD_DISTANCE = 400; // chunks beyond this are unloaded

function updateChunkLoading(cameraPos: Vector3): void {
  for (const [key, chunk] of grid.chunks) {
    const dist = distance(chunk.worldOrigin, cameraPos);

    if (dist < LOAD_DISTANCE && !chunk.mesh) {
      // Load: mesh + collider
      remeshChunk(chunk);
    } else if (dist > UNLOAD_DISTANCE && chunk.mesh) {
      // Unload: dispose mesh + collider, keep voxel data
      chunk.mesh.dispose();
      chunk.mesh = null;
      terrainPhysics.removeCollider(key);
    }
  }
}
```

### Object Pooling

Reuse Babylon.js `Mesh` objects and `VertexData` buffers instead of creating/disposing each frame:

```typescript
class MeshPool {
  private available: BABYLON.Mesh[] = [];

  acquire(): BABYLON.Mesh {
    return this.available.pop() || new BABYLON.Mesh('terrain_chunk', scene);
  }

  release(mesh: BABYLON.Mesh): void {
    mesh.setEnabled(false);
    this.available.push(mesh);
  }
}
```

---

## 8. Batched Dirty Processing

Don't remesh all dirty chunks at once. Spread the work:

```typescript
const MESH_BUDGET_PER_FRAME = 4;
const COLLIDER_BUDGET_PER_FRAME = 2;

function processFrame(): void {
  const dirty = grid.getDirtyChunks()
    .sort(byDistanceToCamera);

  // Mesh up to 4 chunks
  for (let i = 0; i < Math.min(MESH_BUDGET_PER_FRAME, dirty.length); i++) {
    remeshChunk(dirty[i]);
  }

  // Rebuild up to 2 colliders
  for (let i = 0; i < Math.min(COLLIDER_BUDGET_PER_FRAME, dirty.length); i++) {
    rebuildCollider(dirty[i]);
  }
}
```

---

## 9. Estimated Memory Budget

For a 512x128x512 voxel world (128x32x128 chunks = up to 524K chunks, but ~5K with terrain):

| Component | Per Chunk | 5,000 Chunks |
|-----------|-----------|--------------|
| Voxel data | 20 KB | 100 MB |
| Mesh vertices | ~50 KB | 250 MB |
| Physics collider | ~20 KB | 100 MB |
| **Total** | ~90 KB | **~450 MB** |

With LOD and unloading, active memory is ~150 MB for a large world — well within browser limits.
