# Problocks Terrain System — Implementation Guide

> A comprehensive guide to implementing a Roblox-quality voxel terrain system in Problocks, built on Babylon.js 9 + Rapier physics.

## Current State

Problocks has a **heightmap-based terrain system** using Perlin noise (FBM) with 4 vertex-color layers. This guide covers upgrading to a **full voxel terrain engine** matching Roblox's terrain feature set.

### What We Have
- `TerrainComponent` — heightmap config (width, depth, subdivisions, seed, layers)
- `noise.ts` — Perlin FBM heightmap generator
- `BabylonRenderer` — creates GroundMesh, applies vertex heights + colors
- `RapierPhysics` — trimesh collider for terrain
- `WaterComponent` — separate water plane with wave simulation

### What Roblox Has (Our Target)
- 4x4x4 stud **voxel grid** with occupancy + material per cell
- 23 built-in materials + custom materials
- **Terrain Editor** with Create (Generate, Import, Clear) and Edit (Select, Transform, Fill, Sea Level, Draw, Sculpt, Smooth, Flatten, Paint) tools
- Heightmap + colormap import
- Biome-based procedural generation (Arctic, Dunes, Canyons, Lavascape, Water, Mountains, Hills, Plains, Marsh)
- Animated grass, dynamic water with reflections
- Scripting API (FillBall, FillBlock, FillCylinder, FillRegion, FillWedge)
- Copy/paste/duplicate terrain regions

---

## Documentation Structure

| # | File | Description |
|---|------|-------------|
| 01 | [Roblox Reference](./01-roblox-reference.md) | Complete analysis of Roblox's terrain system |
| 02 | [Architecture](./02-architecture.md) | System architecture for Problocks terrain |
| 03 | [Voxel Engine](./03-voxel-engine.md) | Core voxel data structure and Marching Cubes mesh generation |
| 04 | [Materials](./04-materials.md) | Terrain material system with textures and blending |
| 05 | [Procedural Generation](./05-procedural-generation.md) | Biome-based terrain generation |
| 06 | [Terrain Editor](./06-terrain-editor.md) | Brush tools: Draw, Sculpt, Smooth, Flatten, Paint |
| 07 | [Heightmap Import](./07-heightmap-import.md) | Heightmap and colormap import system |
| 08 | [Water System](./08-water-system.md) | Voxel water, sea level, and water rendering |
| 09 | [Physics & Collision](./09-physics-collision.md) | Rapier collision for voxel terrain |
| 10 | [Scripting API](./10-scripting-api.md) | Student-facing terrain scripting API |
| 11 | [Optimization](./11-optimization.md) | LOD, chunking, greedy meshing, GPU instancing |
| 12 | [Implementation Roadmap](./12-implementation-roadmap.md) | Phase-by-phase build plan |

---

## Key Architecture Decisions

1. **Voxel grid, not heightmap** — Roblox terrain is fundamentally voxel-based (4x4x4 stud cells). This enables caves, overhangs, arches, and 3D sculpting that a heightmap cannot do.

2. **Marching Cubes for smooth terrain** — Roblox uses a variant of Marching Cubes to convert voxel occupancy into smooth triangle meshes. Each voxel stores an occupancy value (0.0–1.0) and a material ID.

3. **Chunk-based rendering** — The voxel world is divided into 16x16x16 chunks. Only dirty chunks re-mesh. Only visible chunks render.

4. **Dual-grid material blending** — Adjacent voxels with different materials blend at their boundaries, creating natural transitions (sand → grass → rock).

5. **Integrated water** — Water is a voxel material, not a separate plane. It fills cells, flows into neighbors, and interacts with terrain sculpting.

6. **Babylon.js custom mesh** — Each chunk generates a `Mesh` from raw vertex/index buffers using `VertexData`. No `GroundMesh` — we need full 3D geometry.

7. **Rapier trimesh per chunk** — Each chunk gets its own trimesh collider, rebuilt when the chunk's voxels change.
