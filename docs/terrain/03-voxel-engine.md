# 03 — Voxel Engine

> Core data structures: Voxel, Chunk, VoxelGrid, ChunkManager. The foundation everything else builds on.

## Voxel Data

Each voxel stores two values:

```typescript
interface Voxel {
  /** 0.0 = air (empty), 1.0 = fully solid. Values between create smooth surfaces. */
  occupancy: number;
  /** Material ID from TerrainMaterial enum. 0 = Air. */
  material: TerrainMaterial;
}
```

**Occupancy** is the key to smooth terrain. Marching Cubes uses the occupancy gradient between adjacent voxels to place the isosurface. A threshold of 0.5 is the "surface" — below 0.5 is air, above is solid.

**Material** determines appearance. When two adjacent voxels have different materials, the renderer blends them at the boundary.

### Memory Layout

For performance, store occupancy and material in separate typed arrays rather than objects:

```typescript
// Per-chunk storage (16x16x16 = 4096 voxels)
const CHUNK_SIZE = 16;
const CHUNK_VOLUME = CHUNK_SIZE ** 3;

class ChunkData {
  /** Occupancy values [0.0, 1.0] for each voxel */
  occupancy = new Float32Array(CHUNK_VOLUME);    // 16 KB
  /** Material IDs (0-255) for each voxel */
  materials = new Uint8Array(CHUNK_VOLUME);       // 4 KB
  // Total: ~20 KB per chunk
}
```

### Coordinate → Index

Voxels within a chunk are addressed by local coordinates (0–15 per axis):

```typescript
function voxelIndex(x: number, y: number, z: number): number {
  return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
}

function indexToCoords(index: number): [number, number, number] {
  const x = index % CHUNK_SIZE;
  const y = Math.floor(index / CHUNK_SIZE) % CHUNK_SIZE;
  const z = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
  return [x, y, z];
}
```

---

## Chunk

A chunk is a 16x16x16 block of voxels. In world space, each voxel is 4 units (matching Roblox's 4-stud voxel), so one chunk covers 64x64x64 world units.

```typescript
const VOXEL_SIZE = 4;          // world units per voxel (Roblox: 4 studs)
const CHUNK_SIZE = 16;         // voxels per chunk axis
const CHUNK_WORLD_SIZE = CHUNK_SIZE * VOXEL_SIZE;  // 64 world units

class Chunk {
  /** Chunk coordinates (not world coords) */
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;

  /** Voxel data */
  readonly data: ChunkData;

  /** Dirty flag — set when voxels change, cleared after remeshing */
  dirty = true;

  /** Whether this chunk has any non-air voxels */
  isEmpty = true;

  /** Generated Babylon.js mesh (null if empty or not yet meshed) */
  mesh: BABYLON.Mesh | null = null;

  /** Rapier collider handle */
  colliderHandle: number | null = null;

  constructor(cx: number, cy: number, cz: number) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.data = new ChunkData();
  }

  /** World-space origin of this chunk */
  get worldOrigin(): { x: number; y: number; z: number } {
    return {
      x: this.cx * CHUNK_WORLD_SIZE,
      y: this.cy * CHUNK_WORLD_SIZE,
      z: this.cz * CHUNK_WORLD_SIZE,
    };
  }

  /** Get voxel at local coordinates */
  getVoxel(lx: number, ly: number, lz: number): Voxel {
    const i = voxelIndex(lx, ly, lz);
    return {
      occupancy: this.data.occupancy[i],
      material: this.data.materials[i],
    };
  }

  /** Set voxel at local coordinates */
  setVoxel(lx: number, ly: number, lz: number, occupancy: number, material: TerrainMaterial): void {
    const i = voxelIndex(lx, ly, lz);
    this.data.occupancy[i] = occupancy;
    this.data.materials[i] = material;
    this.dirty = true;
    this.isEmpty = false; // conservative — recalculated on remesh
  }

  /** Fill entire chunk with a material */
  fill(occupancy: number, material: TerrainMaterial): void {
    this.data.occupancy.fill(occupancy);
    this.data.materials.fill(material);
    this.dirty = true;
    this.isEmpty = occupancy === 0;
  }

  /** Clear chunk to air */
  clear(): void {
    this.data.occupancy.fill(0);
    this.data.materials.fill(TerrainMaterial.Air);
    this.dirty = true;
    this.isEmpty = true;
  }
}
```

---

## VoxelGrid

The VoxelGrid is the top-level container. It manages a sparse collection of chunks.

```typescript
class VoxelGrid {
  /** Sparse chunk storage: key = "cx,cy,cz" */
  private chunks = new Map<string, Chunk>();

  /** Convert world position to chunk coordinates */
  worldToChunk(wx: number, wy: number, wz: number): { cx: number; cy: number; cz: number } {
    return {
      cx: Math.floor(wx / CHUNK_WORLD_SIZE),
      cy: Math.floor(wy / CHUNK_WORLD_SIZE),
      cz: Math.floor(wz / CHUNK_WORLD_SIZE),
    };
  }

  /** Convert world position to local voxel coordinates within a chunk */
  worldToLocal(wx: number, wy: number, wz: number): { lx: number; ly: number; lz: number } {
    return {
      lx: Math.floor((wx % CHUNK_WORLD_SIZE) / VOXEL_SIZE) & (CHUNK_SIZE - 1),
      ly: Math.floor((wy % CHUNK_WORLD_SIZE) / VOXEL_SIZE) & (CHUNK_SIZE - 1),
      lz: Math.floor((wz % CHUNK_WORLD_SIZE) / VOXEL_SIZE) & (CHUNK_SIZE - 1),
    };
  }

  /** Get or create chunk at chunk coordinates */
  getOrCreateChunk(cx: number, cy: number, cz: number): Chunk {
    const key = `${cx},${cy},${cz}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cy, cz);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  /** Get chunk (returns undefined if doesn't exist) */
  getChunk(cx: number, cy: number, cz: number): Chunk | undefined {
    return this.chunks.get(`${cx},${cy},${cz}`);
  }

  /** Set a voxel at world coordinates */
  setVoxel(wx: number, wy: number, wz: number, occupancy: number, material: TerrainMaterial): void {
    const { cx, cy, cz } = this.worldToChunk(wx, wy, wz);
    const { lx, ly, lz } = this.worldToLocal(wx, wy, wz);
    const chunk = this.getOrCreateChunk(cx, cy, cz);
    chunk.setVoxel(lx, ly, lz, occupancy, material);

    // If the voxel is on a chunk boundary, also mark the neighbor chunk dirty
    // (Marching Cubes needs neighbor data for boundary cells)
    if (lx === 0) this.markNeighborDirty(cx - 1, cy, cz);
    if (lx === CHUNK_SIZE - 1) this.markNeighborDirty(cx + 1, cy, cz);
    if (ly === 0) this.markNeighborDirty(cx, cy - 1, cz);
    if (ly === CHUNK_SIZE - 1) this.markNeighborDirty(cx, cy + 1, cz);
    if (lz === 0) this.markNeighborDirty(cx, cy, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markNeighborDirty(cx, cy, cz + 1);
  }

  /** Get voxel at world coordinates */
  getVoxel(wx: number, wy: number, wz: number): Voxel {
    const { cx, cy, cz } = this.worldToChunk(wx, wy, wz);
    const chunk = this.getChunk(cx, cy, cz);
    if (!chunk) return { occupancy: 0, material: TerrainMaterial.Air };
    const { lx, ly, lz } = this.worldToLocal(wx, wy, wz);
    return chunk.getVoxel(lx, ly, lz);
  }

  /** Get all dirty chunks */
  getDirtyChunks(): Chunk[] {
    const dirty: Chunk[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.dirty) dirty.push(chunk);
    }
    return dirty;
  }

  /** Remove empty chunks to free memory */
  pruneEmpty(): void {
    for (const [key, chunk] of this.chunks) {
      if (chunk.isEmpty && !chunk.mesh) {
        this.chunks.delete(key);
      }
    }
  }

  private markNeighborDirty(cx: number, cy: number, cz: number): void {
    const chunk = this.getChunk(cx, cy, cz);
    if (chunk) chunk.dirty = true;
  }
}
```

---

## ChunkManager

Orchestrates the lifecycle of chunks: creation, meshing schedule, LOD, disposal.

```typescript
class ChunkManager {
  private grid: VoxelGrid;
  private meshBudgetPerFrame = 4;  // max chunks to remesh per frame

  /** Queue of chunks needing remesh, sorted by priority (distance to camera) */
  private remeshQueue: Chunk[] = [];

  constructor(grid: VoxelGrid) {
    this.grid = grid;
  }

  /** Called each frame by SimulationLoop */
  update(cameraPosition: { x: number; y: number; z: number }): void {
    // 1. Collect dirty chunks
    const dirty = this.grid.getDirtyChunks();

    // 2. Sort by distance to camera (closest first)
    dirty.sort((a, b) => {
      const da = this.distSq(a.worldOrigin, cameraPosition);
      const db = this.distSq(b.worldOrigin, cameraPosition);
      return da - db;
    });

    // 3. Process up to budget
    const toProcess = dirty.slice(0, this.meshBudgetPerFrame);
    for (const chunk of toProcess) {
      this.remeshChunk(chunk);
      chunk.dirty = false;
    }
  }

  private remeshChunk(chunk: Chunk): void {
    // Marching Cubes → vertex data
    // ChunkRenderer.updateMesh()
    // TerrainPhysics.rebuildCollider()
    // (implementation in meshing and rendering docs)
  }

  private distSq(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }
}
```

---

## World Coordinate System

```
World Space:
  Each voxel = 4x4x4 world units
  Chunk = 16 voxels = 64 world units per axis

Example: world position (100, 20, 200)
  Chunk: (1, 0, 3)     → floor(100/64) = 1, floor(20/64) = 0, floor(200/64) = 3
  Local: (9, 5, 2)     → floor((100 % 64) / 4) = 9

Boundary handling:
  Negative coordinates work via bitwise AND masking:
  worldToLocal uses `& (CHUNK_SIZE - 1)` which handles negatives correctly
  worldToChunk uses Math.floor which correctly rounds negative numbers down
```

---

## Serialization

For save/load, chunks serialize to a compact binary format:

```typescript
interface SerializedTerrain {
  version: 1;
  voxelSize: number;
  chunkSize: number;
  chunks: SerializedChunk[];
}

interface SerializedChunk {
  cx: number;
  cy: number;
  cz: number;
  /** Run-length encoded occupancy + material pairs */
  data: ArrayBuffer;
}
```

Run-length encoding (RLE) compresses chunks efficiently since terrain has large homogeneous regions (all-air, all-grass, etc.). A typical chunk compresses from 20KB to 1-5KB.
