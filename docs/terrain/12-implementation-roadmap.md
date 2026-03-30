# 12 — Implementation Roadmap

> Phase-by-phase plan to build the Roblox-quality voxel terrain system in Problocks.

## Phase 0: Preparation (1-2 days)

### 0.1 Create File Structure
- [ ] Create `packages/engine/src/terrain/voxel/` directory
- [ ] Create `packages/engine/src/terrain/meshing/` directory
- [ ] Create `packages/engine/src/terrain/generation/` directory
- [ ] Create `packages/engine/src/terrain/editor/` directory
- [ ] Create `packages/engine/src/terrain/rendering/` directory
- [ ] Create `packages/engine/src/terrain/physics/` directory
- [ ] Create `packages/engine/src/terrain/api/` directory
- [ ] Create `apps/web-studio/src/components/studio/terrain-editor/` directory

### 0.2 Feature Flag
- [ ] Add `useVoxelTerrain: boolean` to engine config
- [ ] Keep existing heightmap terrain as fallback during development
- [ ] Switch between systems based on flag

---

## Phase 1: Core Voxel Engine (3-5 days)

> **Goal**: Voxel data structure + Marching Cubes mesh generation working with Babylon.js

### 1.1 Voxel Data Structures
- [ ] Implement `TerrainMaterial` enum with all 23 materials
- [ ] Implement `Voxel` type (occupancy + material)
- [ ] Implement `ChunkData` class (Float32Array + Uint8Array)
- [ ] Implement `Chunk` class with get/set/fill/clear methods
- [ ] Implement coordinate conversion (world ↔ chunk ↔ local)
- [ ] Write unit tests for coordinate math (especially negative coords)

### 1.2 VoxelGrid
- [ ] Implement `VoxelGrid` class with sparse chunk Map
- [ ] Implement `setVoxel()` with auto chunk creation
- [ ] Implement `getVoxel()` with air fallback
- [ ] Implement boundary dirty marking (neighbor chunks)
- [ ] Implement `getDirtyChunks()`
- [ ] Write unit tests for grid operations

### 1.3 Marching Cubes
- [ ] Add MC edge table (256 entries)
- [ ] Add MC triangle table (256 × 16 entries)
- [ ] Implement `marchingCubes()` — input: chunk occupancy + neighbors, output: vertices/indices/normals
- [ ] Implement vertex interpolation along edges using occupancy gradient
- [ ] Implement vertex deduplication via edge key hashing
- [ ] Implement per-vertex color from material blending
- [ ] Write tests: known cube configurations produce expected triangle counts

### 1.4 Chunk Renderer
- [ ] Implement `ChunkRenderer` — converts MC output to Babylon.js Mesh via VertexData
- [ ] Create `terrain_chunk` material (StandardMaterial with vertex colors)
- [ ] Handle mesh creation/update/dispose lifecycle
- [ ] Test: manually fill a VoxelGrid, see it render as a smooth surface in Babylon.js

### 1.5 Integration
- [ ] Create `VoxelTerrainComponent` extending Component
- [ ] Add VoxelGrid to the component
- [ ] Wire ChunkManager.update() into SimulationLoop.onFrame()
- [ ] Replace (behind feature flag) the existing terrain rendering path
- [ ] **Milestone**: A manually-populated voxel grid renders as smooth terrain in the viewport

---

## Phase 2: Procedural Generation (3-4 days)

> **Goal**: Generate terrain with biomes, matching the Roblox Generate tool

### 2.1 Biome Definitions
- [ ] Define all 9 biome presets (Arctic through Marsh)
- [ ] Implement height function per biome using existing `fbm()` from noise.ts
- [ ] Implement material layer assignment by height

### 2.2 Biome Blending
- [ ] Implement Voronoi cell placement (seeded random points)
- [ ] Implement distance-weighted biome blending
- [ ] Implement smooth transitions using noise perturbation

### 2.3 Terrain Generator
- [ ] Implement `TerrainGenerator.generate(region, biomes, seed, options)`
- [ ] Column-by-column filling with height + material + occupancy
- [ ] Smooth occupancy gradient at surface for Marching Cubes

### 2.4 Cave Generator
- [ ] Implement 3D noise-based cave carving
- [ ] Dual-noise "swiss cheese" technique
- [ ] Per-biome cave threshold (some biomes have caves, others don't)

### 2.5 UI
- [ ] Build `BiomeSettings.tsx` — checkboxes for 9 biomes
- [ ] Build generator settings (blending, caves, biome size, seed)
- [ ] Add "Generate" button that calls TerrainGenerator
- [ ] Add progress indication during generation
- [ ] **Milestone**: Click Generate → terrain with multiple biomes appears in viewport

---

## Phase 3: Physics Integration (2-3 days)

> **Goal**: Objects collide with voxel terrain, including dynamic updates

### 3.1 Per-Chunk Colliders
- [ ] Implement `TerrainPhysics` class managing Rapier trimesh colliders
- [ ] Create static terrain body
- [ ] Implement `rebuildCollider()` from chunk mesh data
- [ ] Implement `removeCollider()` for empty chunks

### 3.2 Collider Lifecycle
- [ ] Wire collider rebuild into ChunkManager's dirty processing
- [ ] Budget collider rebuilds (2-4 per frame)
- [ ] Priority queue by distance to camera

### 3.3 Raycasting
- [ ] Implement terrain raycast for editor (brush placement)
- [ ] Implement material lookup at raycast hit point
- [ ] **Milestone**: Drop an entity onto generated terrain — it collides and rests on the surface

---

## Phase 4: Terrain Editor Tools (5-7 days)

> **Goal**: Full brush-based editing matching Roblox's Edit tab

### 4.1 Brush System
- [ ] Implement brush shapes (sphere, box, cylinder)
- [ ] Implement brush voxel iteration with falloff
- [ ] Implement 3D brush cursor (translucent wireframe in viewport)
- [ ] Mouse interaction: click and drag to apply brush

### 4.2 Draw Tool
- [ ] Add mode (set occupancy to falloff)
- [ ] Subtract mode (reduce occupancy by falloff)
- [ ] Ctrl/Cmd toggle between add/subtract
- [ ] Material selection

### 4.3 Sculpt Tool
- [ ] Strength-scaled add/subtract
- [ ] Smoother than Draw for gentle edits

### 4.4 Smooth Tool
- [ ] 6-neighbor averaging
- [ ] Two-pass (read then write)
- [ ] Shift shortcut from Draw/Sculpt

### 4.5 Flatten Tool
- [ ] Erode to flat (remove above plane)
- [ ] Grow to flat (fill below plane)
- [ ] Flatten all (both)
- [ ] Fixed plane option
- [ ] Visual plane indicator

### 4.6 Paint Tool
- [ ] Paint mode (overwrite material)
- [ ] Replace mode (swap one material for another)
- [ ] Material picker UI

### 4.7 Material Picker
- [ ] Build `MaterialPicker.tsx` — 4-column grid of swatches
- [ ] Color preview for each material
- [ ] Selection highlight
- [ ] Alt+click eyedropper shortcut

### 4.8 Keyboard Shortcuts
- [ ] B + drag/scroll = brush size
- [ ] Ctrl+B = brush height
- [ ] Shift+B = brush strength
- [ ] Alt+click = material picker

### 4.9 Undo/Redo
- [ ] Implement chunk-level snapshots
- [ ] Undo stack (50 entries max)
- [ ] Ctrl+Z / Ctrl+Shift+Z

### 4.10 UI Panel
- [ ] Build `TerrainEditorPanel.tsx` with Create/Edit tabs
- [ ] Wire all tools to the panel
- [ ] **Milestone**: Draw mountains, sculpt valleys, paint materials, smooth edges — all in the browser

---

## Phase 5: Heightmap Import (2-3 days)

> **Goal**: Import heightmap + colormap images to create terrain

### 5.1 Image Loading
- [ ] Implement image → ImageData via OffscreenCanvas
- [ ] Support PNG and JPG up to 4096x4096

### 5.2 Heightmap Parser
- [ ] Grayscale → height array
- [ ] Map to selection region Y range

### 5.3 Colormap Parser
- [ ] RGB → nearest material using Euclidean distance
- [ ] Full color key table with all 23 materials

### 5.4 Grid Fill
- [ ] Column-by-column fill from heightmap + material map
- [ ] Smooth surface gradient for Marching Cubes

### 5.5 UI
- [ ] Build `HeightmapUploader.tsx` — drag-drop zone
- [ ] Preview thumbnails
- [ ] Selection region controls
- [ ] **Milestone**: Drop a heightmap image → terrain appears matching the image

---

## Phase 6: Region Tools (3-4 days)

> **Goal**: Select, Transform, Fill, and Sea Level tools

### 6.1 Select Tool
- [ ] Rect selection with 3D handles (move draggers + scale handles)
- [ ] Babylon.js gizmo-based interaction
- [ ] Copy/Paste/Cut/Duplicate/Delete with keyboard shortcuts

### 6.2 Transform Tool
- [ ] Move, rotate, scale selected region
- [ ] Live edit mode (constant update) and wireframe preview mode
- [ ] Merge empty toggle

### 6.3 Fill Tool
- [ ] Fill entire region with material
- [ ] Replace one material with another within region

### 6.4 Sea Level Tool
- [ ] Create water at specified Y level within region
- [ ] Evaporate water within region
- [ ] **Milestone**: Select a region, fill it, transform it, add a sea level

---

## Phase 7: Water System (3-4 days)

> **Goal**: Voxel-based water with rendering and buoyancy

### 7.1 Water as Voxel Material
- [ ] Water voxels in the grid with their own occupancy
- [ ] Separate water mesh extraction in chunk meshing

### 7.2 Water Shader
- [ ] Custom ShaderMaterial for water chunks
- [ ] Wave displacement animation
- [ ] Fresnel reflection/refraction
- [ ] Configurable color, reflectance, transparency, wave size/speed

### 7.3 Buoyancy Integration
- [ ] Sample voxel water around entity bounds
- [ ] Compute submersion fraction
- [ ] Apply buoyancy + drag forces
- [ ] **Milestone**: Water fills terrain, entities float, waves animate

---

## Phase 8: Scripting API (2-3 days)

> **Goal**: Students can create/modify terrain from QuickJS scripts

### 8.1 Fill Methods
- [ ] `pb.terrain.fillBall()`, `fillBlock()`, `fillCylinder()`, `fillRegion()`, `fillWedge()`
- [ ] Material name → enum mapping
- [ ] Safety limits (max voxels per operation)

### 8.2 Read/Write Methods
- [ ] `pb.terrain.readVoxels()` — returns 3D arrays
- [ ] `pb.terrain.writeVoxels()` — sets 3D arrays
- [ ] `pb.terrain.getHeight()`, `getMaterial()`, `setVoxel()`

### 8.3 Property Setters
- [ ] Water properties (color, reflectance, etc.)
- [ ] Grass properties (decoration toggle, length)
- [ ] Material color overrides

### 8.4 Testing
- [ ] Test all API methods from student scripts
- [ ] Verify safety limits trigger correctly
- [ ] **Milestone**: Student script creates procedural terrain programmatically

---

## Phase 9: Visual Polish (3-5 days)

> **Goal**: Animated grass, Cracked Lava glow, custom material colors

### 9.1 Animated Grass
- [ ] Instanced grass blade geometry on Grass/LeafyGrass surfaces
- [ ] Wind animation (sin wave + global wind direction)
- [ ] GrassLength property (0.1–1.0)
- [ ] Decoration toggle
- [ ] Only render on visible, upward-facing surfaces

### 9.2 Emissive Materials
- [ ] Cracked Lava glow effect (emissive color in shader)

### 9.3 Custom Terrain Colors
- [ ] Per-material color override UI in properties panel
- [ ] Apply overrides to vertex colors/textures
- [ ] Presets: Default, Fantasy, Tundra

### 9.4 Triplanar Texturing (Optional Enhancement)
- [ ] Texture atlas for all materials
- [ ] Triplanar projection shader
- [ ] Material blend at voxel boundaries

---

## Phase 10: Optimization (2-3 days)

> **Goal**: 60 FPS with large terrains

### 10.1 LOD System
- [ ] 4 LOD levels based on camera distance
- [ ] Downsampled Marching Cubes for distant chunks
- [ ] LOD transition skirts

### 10.2 Web Worker Meshing
- [ ] Move Marching Cubes to a Web Worker
- [ ] Transferable ArrayBuffer messaging
- [ ] Queue management

### 10.3 Memory Management
- [ ] Chunk unloading (dispose mesh/collider, keep data) for distant chunks
- [ ] Mesh object pooling
- [ ] Empty chunk pruning

### 10.4 Serialization
- [ ] RLE compression for chunk data
- [ ] Save/load terrain to project file
- [ ] **Milestone**: Large terrain (512x128x512) runs at 60 FPS

---

## Phase Summary

| Phase | Description | Est. Days | Dependencies |
|-------|-------------|-----------|--------------|
| 0 | Preparation | 1-2 | None |
| 1 | Core Voxel Engine | 3-5 | Phase 0 |
| 2 | Procedural Generation | 3-4 | Phase 1 |
| 3 | Physics Integration | 2-3 | Phase 1 |
| 4 | Terrain Editor Tools | 5-7 | Phase 1, 3 |
| 5 | Heightmap Import | 2-3 | Phase 1 |
| 6 | Region Tools | 3-4 | Phase 1, 4 |
| 7 | Water System | 3-4 | Phase 1, 3 |
| 8 | Scripting API | 2-3 | Phase 1 |
| 9 | Visual Polish | 3-5 | Phase 1, 4 |
| 10 | Optimization | 2-3 | All above |
| **Total** | | **~30-43 days** | |

Phases 2, 3, 5, and 8 can be worked on in **parallel** after Phase 1 completes.

---

## Priority Order (If Building Incrementally)

1. **Phase 1** (Core) — nothing works without this
2. **Phase 2** (Generation) — users need to see terrain quickly
3. **Phase 3** (Physics) — entities must collide with terrain
4. **Phase 4** (Editor) — the main user-facing feature
5. **Phase 7** (Water) — water is a core Roblox terrain feature
6. **Phase 8** (Scripting) — educational value requires programmability
7. **Phase 5** (Heightmap) — nice-to-have for importing real-world terrain
8. **Phase 6** (Regions) — power-user feature
9. **Phase 9** (Polish) — visual quality
10. **Phase 10** (Optimization) — scale and performance
