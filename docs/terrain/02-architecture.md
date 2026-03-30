# 02 — Terrain System Architecture

> How the voxel terrain system fits into Problocks' existing ECS + Babylon.js + Rapier stack.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Studio UI (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Terrain   │  │ Material │  │ Brush    │  │ Properties   │   │
│  │ Editor    │  │ Picker   │  │ Preview  │  │ Panel        │   │
│  │ Panel     │  │          │  │          │  │ (terrain cfg)│   │
│  └─────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│        │             │             │               │            │
│        └─────────────┴─────────────┴───────────────┘            │
│                              │                                  │
│                     studio-store (Zustand)                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Engine (ECS Core)  │
                    │                     │
                    │  World → Scene →    │
                    │  TerrainEntity       │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
┌─────────▼─────────┐ ┌───────▼────────┐ ┌────────▼────────┐
│   VoxelEngine     │ │  BabylonRenderer│ │  RapierPhysics  │
│                   │ │                 │ │                 │
│ VoxelGrid         │ │ ChunkMeshPool   │ │ ChunkColliders  │
│ ChunkManager      │ │ MaterialManager │ │ TrimeshCache    │
│ MarchingCubes     │ │ GrassRenderer   │ │ RegenQueue      │
│ BiomeGenerator    │ │ WaterRenderer   │ │                 │
│ BrushOperations   │ │ LODManager      │ │                 │
│ HeightmapImporter │ │                 │ │                 │
└───────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## File Structure (New Files)

```
packages/engine/src/
├── terrain/
│   ├── index.ts                    # barrel exports
│   ├── noise.ts                    # existing — Perlin FBM (keep as-is)
│   │
│   ├── voxel/
│   │   ├── voxel-grid.ts           # VoxelGrid class — sparse 3D grid
│   │   ├── voxel.ts                # Voxel type (occupancy + material)
│   │   ├── chunk.ts                # Chunk class — 16x16x16 voxel block
│   │   ├── chunk-manager.ts        # Manages chunk lifecycle, dirty tracking
│   │   └── terrain-materials.ts    # Material enum + color/texture definitions
│   │
│   ├── meshing/
│   │   ├── marching-cubes.ts       # Marching Cubes isosurface extraction
│   │   ├── mc-tables.ts            # Edge/tri tables for 256 MC cases
│   │   ├── greedy-mesh.ts          # Optional greedy meshing for flat regions
│   │   └── chunk-mesher.ts         # Coordinates meshing per chunk
│   │
│   ├── generation/
│   │   ├── biome.ts                # Biome definitions (Arctic, Dunes, etc.)
│   │   ├── biome-blender.ts        # Multi-biome blending with Voronoi
│   │   ├── terrain-generator.ts    # Main generation orchestrator
│   │   ├── cave-generator.ts       # 3D Perlin worm caves
│   │   └── heightmap-importer.ts   # Image → voxel grid conversion
│   │
│   ├── editor/
│   │   ├── brush.ts                # Brush shapes (sphere, box, cylinder)
│   │   ├── brush-operations.ts     # Draw, Sculpt, Smooth, Flatten, Paint
│   │   ├── region-select.ts        # Rectangular region selection
│   │   ├── region-transform.ts     # Move/rotate/scale regions
│   │   ├── fill-replace.ts         # Fill and Replace operations
│   │   ├── sea-level.ts            # Water level creation/evaporation
│   │   └── undo-stack.ts           # Undo/redo for terrain edits
│   │
│   ├── rendering/
│   │   ├── chunk-renderer.ts       # Babylon.js mesh creation per chunk
│   │   ├── terrain-material.ts     # ShaderMaterial for splatmap blending
│   │   ├── grass-renderer.ts       # Instanced grass blades on Grass material
│   │   ├── water-voxel-renderer.ts # Water rendering for voxel water cells
│   │   └── lod-manager.ts          # Level-of-detail for distant chunks
│   │
│   ├── physics/
│   │   ├── chunk-collider.ts       # Rapier trimesh per chunk
│   │   └── terrain-physics.ts      # Coordinates collider rebuild
│   │
│   └── api/
│       ├── terrain-api.ts          # Public API: fillBall, fillBlock, etc.
│       └── terrain-script-bindings.ts  # QuickJS bindings for student scripts
│
apps/web-studio/src/
├── components/studio/
│   ├── terrain-editor/
│   │   ├── TerrainEditorPanel.tsx   # Main terrain editor UI
│   │   ├── CreateTab.tsx            # Generate, Import, Clear
│   │   ├── EditTab.tsx              # Brush tools, region tools
│   │   ├── MaterialPicker.tsx       # Grid of material swatches
│   │   ├── BrushPreview.tsx         # 3D brush cursor overlay
│   │   ├── BiomeSettings.tsx        # Biome toggles for generation
│   │   └── HeightmapUploader.tsx    # Drag-drop heightmap/colormap
```

---

## Data Flow

### Voxel Edit → Screen

```
User clicks with brush tool
        │
        ▼
BrushOperations.apply(position, radius, material, mode)
        │
        ▼
VoxelGrid.setVoxel(x, y, z, occupancy, material)  ← modifies voxel data
        │
        ▼
ChunkManager.markDirty(chunkX, chunkY, chunkZ)     ← flags chunk for rebuild
        │
        ▼
SimulationLoop.onFrame()
        │
        ├──▶ ChunkMesher.remesh(dirtyChunks)        ← Marching Cubes → vertices
        │           │
        │           ▼
        │    ChunkRenderer.updateMesh(chunk, vertices, indices, normals, uvs)
        │           │
        │           ▼
        │    Babylon VertexData → Mesh                ← GPU upload
        │
        ├──▶ TerrainPhysics.rebuildColliders(dirtyChunks)
        │           │
        │           ▼
        │    Rapier trimesh collider rebuild           ← physics update
        │
        └──▶ Babylon.js render()                      ← frame displayed
```

### Terrain Generation Flow

```
User clicks Generate (with biome settings)
        │
        ▼
TerrainGenerator.generate(region, biomes, seed, options)
        │
        ├──▶ BiomeBlender.computeBiomeMap(region, biomes)
        │       Uses Voronoi cells + noise for biome placement
        │
        ├──▶ For each (x, y, z) in region:
        │       biome = biomeMap.getBiome(x, z)
        │       height = biome.heightFunction(x, z, seed)
        │       if y < height:
        │         material = biome.getMaterial(x, y, z, height)
        │         occupancy = computeOccupancy(y, height)
        │         VoxelGrid.setVoxel(x, y, z, occupancy, material)
        │
        ├──▶ CaveGenerator.carve(region, seed)  (if caves enabled)
        │       3D Perlin worms set occupancy to 0 along paths
        │
        └──▶ ChunkManager.markAllDirty()
                All affected chunks rebuild meshes + colliders
```

---

## Integration Points with Existing Code

### Replace Current Terrain System
The existing `TerrainComponent` + heightmap pipeline gets replaced:

| Current | New |
|---------|-----|
| `TerrainComponent` (heightmap config) | `VoxelTerrainComponent` (references VoxelGrid) |
| `noise.ts` generateHeightmap() | Still used inside `TerrainGenerator` for height functions |
| `BabylonRenderer.createTerrain()` GroundMesh | `ChunkRenderer` with custom Mesh per chunk |
| Vertex color blending | ShaderMaterial with texture splatmap |
| Single trimesh collider | Per-chunk trimesh colliders |

### Keep Existing Systems
- `WaterComponent` + water simulation → enhanced with voxel water integration
- `SimulationLoop` → add chunk meshing + collider rebuild to frame loop
- `Entity/Component/Scene` ECS → terrain is still an Entity with components
- `noise.ts` → still the noise source, called by generators

### New Dependencies
- None required. Marching Cubes tables and voxel engine are pure TypeScript.
- Optional: texture atlas for material rendering (can start with vertex colors like current system)
