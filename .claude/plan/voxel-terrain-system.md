# Implementation Plan: Voxel Terrain System

> Roblox-quality voxel terrain for Problocks — 4x4x4 voxel grid, Marching Cubes, 23 materials, full editor tools, scripting API.

## Task Type
- [x] Frontend (React terrain editor UI)
- [x] Backend (Voxel engine, physics, scripting)
- [x] Fullstack (Parallel)

## Technical Solution

Replace the current heightmap-based terrain (`TerrainComponent` + `noise.ts` + `GroundMesh`) with a **chunk-based voxel grid** using **Marching Cubes** isosurface extraction. Each voxel is a 4x4x4 world-unit cell storing `occupancy` (0.0–1.0) and `material` (enum of 23 types). The world is divided into 16x16x16-voxel chunks; only dirty chunks re-mesh; only visible chunks render. Terrain is sculpted via brush tools (Draw, Sculpt, Smooth, Flatten, Paint) and generated procedurally using biome-blended noise.

### Key Architecture Decisions
1. **Voxel grid** over heightmap — enables caves, overhangs, 3D sculpting
2. **Marching Cubes** for smooth terrain surfaces from occupancy gradients
3. **16x16x16 chunks** — optimal trade-off: fast remesh (~3ms), manageable chunk count
4. **Sparse storage** — only chunks with terrain data are allocated
5. **Vertex colors first** — ship fast with per-vertex material colors, upgrade to triplanar textures later
6. **Per-chunk Rapier trimesh colliders** — rebuilt only when chunk voxels change
7. **Feature flag** — `useVoxelTerrain` toggle keeps existing heightmap as fallback

---

## Phase 0: Preparation

**Goal**: Set up directory structure, feature flag, and development scaffolding.

### 0.1 Directory Structure
- [ ] Create `packages/engine/src/terrain/voxel/`
- [ ] Create `packages/engine/src/terrain/meshing/`
- [ ] Create `packages/engine/src/terrain/generation/`
- [ ] Create `packages/engine/src/terrain/editor/`
- [ ] Create `packages/engine/src/terrain/rendering/`
- [ ] Create `packages/engine/src/terrain/physics/`
- [ ] Create `packages/engine/src/terrain/api/`
- [ ] Create `apps/web-studio/src/components/studio/terrain-editor/`
- [ ] Create barrel `packages/engine/src/terrain/index.ts` exporting all public APIs

### 0.2 Feature Flag
- [ ] Add `useVoxelTerrain: boolean` to `RendererOptions` or engine config
- [ ] Guard new terrain code path behind the flag in `SimulationLoop` and `BabylonRenderer`
- [ ] Keep existing `TerrainComponent` + `GroundMesh` code untouched — old path still works when flag is `false`

### 0.3 Constants File
- [ ] Create `packages/engine/src/terrain/voxel/constants.ts` with:
  - `VOXEL_SIZE = 4` (world units per voxel)
  - `CHUNK_SIZE = 16` (voxels per chunk axis)
  - `CHUNK_VOLUME = 4096`
  - `CHUNK_WORLD_SIZE = 64`
  - `MC_THRESHOLD = 0.5` (Marching Cubes isosurface level)

**Milestone**: All directories exist, feature flag wired, no runtime changes yet.

---

## Phase 1: Core Voxel Engine

**Goal**: Voxel data + Marching Cubes mesh generation rendering in Babylon.js.

### 1.1 Material Definitions
**File**: `packages/engine/src/terrain/voxel/terrain-materials.ts`

- [ ] Define `TerrainMaterial` enum (Air=0, Grass=1, Sand=2 ... WoodPlanks=22)
- [ ] Define `TerrainMaterialDef` interface: `id`, `name`, `color: [r,g,b]`, `hex`, `friction`, `restitution`, `isTransparent`, `isEmissive`, `isAnimated`, `textureScale`
- [ ] Create `MATERIAL_DEFS` lookup object with all 23 material definitions using exact Roblox RGB values
- [ ] Export `materialNameToEnum(name: string): TerrainMaterial` helper
- [ ] Export `materialEnumToName(id: TerrainMaterial): string` helper
- [ ] Write unit test: round-trip name↔enum for all 23 materials

### 1.2 Voxel & ChunkData
**File**: `packages/engine/src/terrain/voxel/voxel.ts`

- [ ] Define `Voxel` interface: `{ occupancy: number; material: TerrainMaterial }`
- [ ] Implement `ChunkData` class:
  - `occupancy: Float32Array(CHUNK_VOLUME)` — 16 KB
  - `materials: Uint8Array(CHUNK_VOLUME)` — 4 KB
- [ ] Implement `voxelIndex(x, y, z): number` (row-major indexing)
- [ ] Implement `indexToCoords(index): [x, y, z]`
- [ ] Write unit test: index ↔ coords round-trip for all corners and center

### 1.3 Chunk Class
**File**: `packages/engine/src/terrain/voxel/chunk.ts`

- [ ] Implement `Chunk` class with properties: `cx`, `cy`, `cz`, `data: ChunkData`, `dirty: boolean`, `isEmpty: boolean`
- [ ] `getVoxel(lx, ly, lz): Voxel`
- [ ] `setVoxel(lx, ly, lz, occupancy, material): void` — sets dirty flag
- [ ] `fill(occupancy, material): void` — bulk fill
- [ ] `clear(): void` — set all to Air with occupancy 0
- [ ] `get worldOrigin(): {x, y, z}` — chunk coords × CHUNK_WORLD_SIZE
- [ ] Write test: set/get voxels, fill, clear, dirty flag behavior

### 1.4 VoxelGrid
**File**: `packages/engine/src/terrain/voxel/voxel-grid.ts`

- [ ] Implement `VoxelGrid` class with `chunks: Map<string, Chunk>`
- [ ] `worldToChunk(wx, wy, wz): {cx, cy, cz}` — `Math.floor(w / CHUNK_WORLD_SIZE)`
- [ ] `worldToLocal(wx, wy, wz): {lx, ly, lz}` — modular within chunk, bitwise AND for negatives
- [ ] `getOrCreateChunk(cx, cy, cz): Chunk` — auto-create on first write
- [ ] `getChunk(cx, cy, cz): Chunk | undefined` — lookup only
- [ ] `setVoxel(wx, wy, wz, occupancy, material): void` — delegates to chunk, marks neighbor chunks dirty on boundaries
- [ ] `getVoxel(wx, wy, wz): Voxel` — returns Air for missing chunks
- [ ] `getDirtyChunks(): Chunk[]` — iterate all chunks
- [ ] `clearAll(): void` — remove all chunks
- [ ] `pruneEmpty(): void` — delete chunks with no solid voxels
- [ ] Write tests:
  - [ ] Positive and negative world coordinates map correctly
  - [ ] Boundary voxels mark neighbor chunks dirty
  - [ ] Missing chunks return Air
  - [ ] clearAll/pruneEmpty work

### 1.5 Marching Cubes Tables
**File**: `packages/engine/src/terrain/meshing/mc-tables.ts`

- [ ] Add `EDGE_TABLE: Uint16Array[256]` — 12-bit bitmask per cube configuration
- [ ] Add `TRI_TABLE: Int8Array[256][16]` — triangle vertex indices per configuration (-1 terminated)
- [ ] Source from standard MC reference (Paul Bourke's tables)
- [ ] Write test: validate table dimensions (256 entries, correct termination)

### 1.6 Marching Cubes Algorithm
**File**: `packages/engine/src/terrain/meshing/marching-cubes.ts`

- [ ] Implement `marchingCubes(chunk, getNeighborVoxel): ChunkMeshData`
  - Input: chunk occupancy data + neighbor accessor for boundary voxels
  - Output: `{ positions: Float32Array, normals: Float32Array, indices: Uint32Array, colors: Float32Array }`
- [ ] For each 2x2x2 cube of voxels:
  - [ ] Compute cube index from 8 corner occupancy values vs MC_THRESHOLD
  - [ ] Skip index 0 (all air) and 255 (all solid)
  - [ ] Look up edge intersections from EDGE_TABLE
  - [ ] Interpolate vertex positions along edges using occupancy gradient
  - [ ] Look up triangles from TRI_TABLE
- [ ] Implement vertex deduplication via edge-key hash map
- [ ] Implement per-vertex color from material blending (lerp between adjacent material colors)
- [ ] Compute face normals, then smooth by averaging shared-vertex normals
- [ ] Write tests:
  - [ ] Single solid voxel in air → known triangle count
  - [ ] Full chunk → 0 triangles (no surface)
  - [ ] Half-filled slab → flat surface

### 1.7 ChunkMesher
**File**: `packages/engine/src/terrain/meshing/chunk-mesher.ts`

- [ ] Implement `ChunkMesher` class
- [ ] `meshChunk(chunk, grid): ChunkMeshData` — calls marchingCubes with neighbor accessor from grid
- [ ] Separate solid mesh from water mesh (water material gets its own mesh data)
- [ ] Track mesh generation time for profiling

### 1.8 Chunk Renderer
**File**: `packages/engine/src/terrain/rendering/chunk-renderer.ts`

- [ ] Implement `ChunkRenderer` class
- [ ] `createOrUpdateMesh(chunk, meshData, scene): BABYLON.Mesh`
  - Create `VertexData` from positions/normals/indices/colors
  - Apply to Babylon `Mesh` (reuse existing mesh if updating)
  - Use `StandardMaterial` with `vertexColorsEnabled = true`
- [ ] `disposeMesh(chunk): void` — remove mesh from scene
- [ ] Mesh naming: `terrain_chunk_${cx}_${cy}_${cz}`
- [ ] Test: manually create VoxelGrid → fill some voxels → render → verify mesh appears in scene

### 1.9 ChunkManager
**File**: `packages/engine/src/terrain/voxel/chunk-manager.ts`

- [ ] Implement `ChunkManager` class
- [ ] `update(cameraPosition): void` — called each frame by SimulationLoop
  - Collect dirty chunks
  - Sort by distance to camera (closest first)
  - Remesh up to `meshBudgetPerFrame` (default: 4) chunks
  - Clear dirty flag after processing
- [ ] Configurable `meshBudgetPerFrame` property
- [ ] Track metrics: chunks meshed this frame, total active chunks

### 1.10 VoxelTerrainComponent
**File**: `packages/engine/src/core/component.ts` (extend existing)

- [ ] Add `VoxelTerrainComponent extends Component` with `type = 'voxel-terrain'`
- [ ] Properties: `grid: VoxelGrid`, `chunkManager: ChunkManager`, `chunkRenderer: ChunkRenderer`
- [ ] Export from `packages/engine/src/index.ts`

### 1.11 SimulationLoop Integration
**File**: `packages/engine/src/core/simulation-loop.ts` (modify)

- [ ] Add `private voxelGrid: VoxelGrid | null = null`
- [ ] Add `private chunkManager: ChunkManager | null = null`
- [ ] When `useVoxelTerrain` is true:
  - Initialize VoxelGrid + ChunkManager + ChunkRenderer
  - Call `chunkManager.update(cameraPos)` each frame before physics step
- [ ] Skip existing heightmap terrain path when voxel terrain is active

**MILESTONE**: Manually populate a VoxelGrid in code → smooth Marching Cubes terrain renders in the Babylon.js viewport. No editor yet, just data → visual.

---

## Phase 2: Procedural Generation

**Goal**: Biome-based terrain generation matching Roblox's Generate tool.

### 2.1 Biome Definitions
**File**: `packages/engine/src/terrain/generation/biome.ts`

- [ ] Define `BiomeDefinition` interface: `id`, `name`, `baseHeight`, `heightVariation`, `noiseScale`, `octaves`, `layers: BiomeLayer[]`, `caveThreshold`, `weight`
- [ ] Define `BiomeLayer` interface: `material: TerrainMaterial`, `range: [min, max]`, `noiseStrength`
- [ ] Create all 9 biome presets:
  - [ ] Arctic — Snow, Ice, Glacier, Rock
  - [ ] Dunes — Sand, Sandstone
  - [ ] Canyons — Sand, Sandstone, Rock, Slate with high heightVariation
  - [ ] Lavascape — CrackedLava, Basalt, Rock
  - [ ] Water — Sand, Mud (low height, water fill above)
  - [ ] Mountains — Ground, Grass, Rock, Snow with max heightVariation
  - [ ] Hills — Ground, Grass, Rock with moderate variation
  - [ ] Plains — Ground, Grass with minimal variation
  - [ ] Marsh — Mud, Ground, LeafyGrass with low height + water pools

### 2.2 Biome Blending
**File**: `packages/engine/src/terrain/generation/biome-blender.ts`

- [ ] Implement `BiomeBlender` class
- [ ] `computeBiomeMap(region, enabledBiomes, seed, biomeSize, blending): BiomeMap`
  - [ ] Generate seeded Voronoi points within + around the region
  - [ ] Assign random biome from enabled list to each point
- [ ] `BiomeMap.getBlendWeights(wx, wz): {biome, weight}[]`
  - [ ] Find N nearest Voronoi points
  - [ ] Compute distance-weighted blend (closer = higher weight)
  - [ ] `blending` parameter controls transition sharpness
- [ ] Write test: blending weights sum to 1.0 at any point

### 2.3 Terrain Generator
**File**: `packages/engine/src/terrain/generation/terrain-generator.ts`

- [ ] Implement `TerrainGenerator` class
- [ ] `generate(grid, region, options): void`
  - `options`: `{ biomes: string[], seed: number, biomeSize: number, blending: number, caves: boolean }`
- [ ] For each (x, z) column in region:
  - [ ] Get biome blend weights
  - [ ] Compute blended height using `fbm()` from existing `noise.ts`
  - [ ] For each y from bottom to surface:
    - [ ] Compute occupancy (1.0 below surface, gradient at surface, 0 above)
    - [ ] Determine material from biome layers based on normalized height
    - [ ] Call `grid.setVoxel()`
- [ ] Handle Water biome: fill above terrain surface with Water material up to sea level
- [ ] Write test: generate with single biome → verify terrain exists in expected height range

### 2.4 Cave Generator
**File**: `packages/engine/src/terrain/generation/cave-generator.ts`

- [ ] Implement `CaveGenerator` class
- [ ] `carve(grid, region, seed, biomeMap): void`
- [ ] Dual 3D noise channels — caves where both noises are near zero
- [ ] Per-biome cave threshold from biomeMap
- [ ] Carve by setting occupancy to 0 where cave density < threshold
- [ ] Write test: carve caves → verify some solid voxels become air

### 2.5 Generate Tool UI
**File**: `apps/web-studio/src/components/studio/terrain-editor/CreateTab.tsx`

- [ ] Biome checkboxes (9 biomes, each toggleable)
- [ ] Blending slider (0–1)
- [ ] Caves checkbox
- [ ] Biome Size slider (50–500)
- [ ] Seed input with "Randomize" button
- [ ] Selection Region inputs (X/Y/Z position and size)
- [ ] "Generate" button → calls `TerrainGenerator.generate()`
- [ ] Progress indicator (percentage or spinner during generation)

**MILESTONE**: Click Generate with biome settings → multi-biome terrain with caves appears in the viewport.

---

## Phase 3: Physics Integration

**Goal**: Entities collide with voxel terrain. Dynamic collider updates on edits.

### 3.1 Static Terrain Body
**File**: `packages/engine/src/terrain/physics/terrain-physics.ts`

- [x] Create single `RAPIER.RigidBodyDesc.fixed()` for all terrain
- [x] All chunk colliders attach to this body

### 3.2 Per-Chunk Colliders
- [x] Implement `TerrainPhysics` class with `colliders: Map<string, RAPIER.Collider>`
- [x] `rebuildCollider(chunkKey, positions: Float32Array, indices: Uint32Array): void`
  - Remove existing collider for this chunk (if any)
  - Create `RAPIER.ColliderDesc.trimesh(positions, indices)`
  - Set friction/restitution from chunk's dominant material
- [x] `removeCollider(chunkKey): void`
- [x] `clearAll(): void` — remove all terrain colliders

### 3.3 Collider Budget
- [x] Max 2–4 collider rebuilds per frame
- [x] Priority queue sorted by distance to camera
- [x] Wire into `ChunkManager.update()` — after mesh rebuild, queue collider rebuild

### 3.4 Raycasting
- [x] `terrainRaycast(rapierWorld, origin, direction, maxDist): {point, normal, material} | null`
- [x] Use `rapierWorld.castRayAndGetNormal()` against terrain colliders
- [x] Look up material at hit point from VoxelGrid
- [x] Expose for brush placement and entity placement

### 3.5 Integration
- [x] Wire `TerrainPhysics` into `ChunkManager` via `setTerrainPhysics()`
- [x] After chunk mesh rebuild → queue collider rebuild, process with budget
- [ ] Write test: generate terrain → drop dynamic body → verify it collides and rests

**MILESTONE**: Drop an entity onto generated terrain — it collides and rests on the surface.

---

## Phase 4: Terrain Editor — Brush Tools

**Goal**: Full brush-based editing: Draw, Sculpt, Smooth, Flatten, Paint.

### 4.1 Brush Core
**File**: `packages/engine/src/terrain/editor/brush.ts`

- [x] Define `BrushShape`: `'sphere' | 'box' | 'cylinder'`
- [x] Define `BrushConfig`: `shape`, `size` (4–256 world units), `height`, `strength` (0.1–1.0), `material`, `pivot` ('bottom'|'center'|'top'), `snapToVoxel`
- [x] Implement `iterateBrushVoxels(center, config): Generator<{wx, wy, wz, falloff}>`
  - [x] Sphere: distance-based with smooth falloff
  - [x] Box: axis-aligned bounds, uniform falloff
  - [x] Cylinder: XZ distance for radius, Y for height
- [ ] Write test: sphere brush at origin with radius 8 → yields expected voxel count

### 4.2 Brush Operations
**File**: `packages/engine/src/terrain/editor/brush-operations.ts`

- [x] `applyDraw(grid, center, config, mode: 'add'|'subtract'): void`
  - Add: `max(current.occupancy, falloff)` with selected material
  - Subtract: `max(0, current.occupancy - falloff)`, material→Air when occupancy=0
- [x] `applySculpt(grid, center, config, mode): void`
  - Like Draw but `delta = falloff * strength * 0.1` for gentler edits
- [x] `applySmooth(grid, center, config): void`
  - Two-pass: read 6-neighbor averages → write blended values
  - `blendFactor = strength * falloff`
- [x] `applyFlatten(grid, center, config, mode: 'both'|'erode'|'grow', planeY): void`
  - Above plane: reduce occupancy (if not 'grow' mode)
  - Below plane: increase occupancy (if not 'erode' mode)
- [x] `applyPaint(grid, center, config, mode: 'paint'|'replace', source?, target?): void`
  - Paint: overwrite material, keep occupancy
  - Replace: only change if material matches source

### 4.3 Brush Cursor (3D Preview)
**File**: `packages/engine/src/terrain/rendering/brush-cursor.ts`

- [x] Create translucent wireframe mesh matching brush shape/size
- [x] Update position each frame to follow terrain raycast hit point
- [x] Adjust for pivot setting (bottom/center/top)
- [x] Change color: blue for add, red for subtract, green for smooth

### 4.4 Mouse Interaction
**File**: `packages/engine/src/terrain/editor/terrain-brush-controller.ts` + `apps/web-studio/src/hooks/useTerrainBrush.ts`

- [x] When terrain editor is active:
  - [x] onPointerMove: raycast → update brush cursor position
  - [x] onPointerDown + drag: apply brush operation each frame while dragging
  - [x] Ctrl held: toggle subtract mode
  - [x] Shift held: temporarily switch to Smooth
- [x] Debounce brush application to once per 50ms during drag

### 4.5 Material Picker
**File**: `apps/web-studio/src/components/studio/terrain-editor/MaterialPicker.tsx`

- [x] 4-column grid of all 23 material swatches
- [x] Each swatch shows material color + name
- [x] Selection highlight (border)
- [x] Alt+click on terrain = eyedropper (pick material under cursor)
- [x] Expose selected material to brush config

### 4.6 Undo/Redo
**File**: `packages/engine/src/terrain/editor/undo-stack.ts`

- [x] `TerrainUndoEntry`: maps chunk keys → `{ before: ChunkData, after: ChunkData }`
- [x] `beginEdit(label, affectedChunkKeys)`: snapshot "before" state
- [x] `endEdit()`: snapshot "after" state, push to undo stack
- [x] `undo(grid)`: restore "before" data, push to redo stack
- [x] `redo(grid)`: restore "after" data, push to undo stack
- [x] Max 50 entries, oldest discarded when full
- [x] Wire Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts

### 4.7 Keyboard Shortcuts
- [x] `B` + drag/scroll → adjust brush base size
- [x] `Ctrl+B` + drag/scroll → adjust brush height (box/cylinder)
- [x] `Shift+B` + drag/scroll → adjust brush strength
- [x] `Alt` + click → material eyedropper

### 4.8 Editor Panel UI
**File**: `apps/web-studio/src/components/studio/terrain-editor/TerrainEditorPanel.tsx`

- [x] Tab switching: Create | Edit
- [x] Edit tab sections:
  - Tool selector (Draw, Sculpt, Smooth, Flatten, Paint icons)
  - Brush Settings: shape toggle (sphere/box/cylinder), size slider, height slider, strength slider
  - Material Settings: material picker, auto-material toggle
  - Mode toggles: add/subtract, flatten mode, paint/replace
  - Pivot selector, snap to voxels toggle

**File**: `apps/web-studio/src/components/studio/terrain-editor/EditTab.tsx`

- [x] Draw tool section with add/subtract toggle
- [x] Sculpt tool section with strength slider
- [x] Smooth tool section
- [x] Flatten tool section with mode dropdown (Erode/Grow/Both) and plane lock
- [x] Paint tool section with paint/replace toggle and source/target material pickers

**MILESTONE**: Draw mountains, sculpt valleys, paint materials, smooth edges — all interactively in the browser viewport.

---

## Phase 5: Heightmap & Colormap Import

**Goal**: Import terrain from grayscale heightmap + colored colormap images.

### 5.1 Image Loading
**File**: `packages/engine/src/terrain/generation/heightmap-importer.ts`

- [x] `loadImage(file: File): Promise<ImageData>` — via OffscreenCanvas
- [x] Validate: PNG or JPG, max 4096x4096
- [x] Error message for invalid formats/sizes

### 5.2 Heightmap Parser
- [x] `parseHeightmap(imageData, region): Float32Array`
- [x] Grayscale luminance: `(r + g + b) / 3 / 255` → normalized 0–1
- [x] Map to region Y range: `minY + normalized * sizeY`

### 5.3 Colormap Parser
- [x] `parseColormap(imageData): Uint8Array` — material ID per pixel
- [x] Nearest-match by Euclidean RGB distance to `MATERIAL_DEFS` colors
- [x] Full color key table with exact RGB values for all 23 materials

### 5.4 Grid Fill
- [x] `importTerrain(grid, heightmap, materialMap, imageWidth, imageHeight, region, defaultMaterial): void`
- [x] For each pixel: fill voxels from region bottom to heightmap Y
- [x] Smooth occupancy gradient at surface (last voxel before air)
- [x] Use colormap material or default material

### 5.5 Import UI
**File**: `apps/web-studio/src/components/studio/terrain-editor/HeightmapUploader.tsx`

- [x] Drag-and-drop zone for heightmap image
- [x] Material source toggle: "Single Material" (picker) vs "Colormap" (second drop zone)
- [x] Region controls (position X/Y/Z, size X/Y/Z)
- [x] Heightmap thumbnail preview with pixel count → world size display
- [x] "Import Heightmap" button
- [x] Wire into CreateTab alongside Generate tool (Generate/Import sub-toggle)

**MILESTONE**: Drop a heightmap PNG → terrain matching the image appears in the viewport.

---

## Phase 6: Region Tools

**Goal**: Select, Transform, Fill, Sea Level — large-scale editing.

### 6.1 Region Selection
**File**: `packages/engine/src/terrain/editor/region-select.ts`

- [ ] `TerrainSelection` class: `min: Vector3`, `max: Vector3`, `clipboard?`
- [ ] Click-drag in viewport to create selection box
- [ ] 3D handles: move draggers (per-axis arrows) + scale handles (corner cubes)
- [ ] Gizmo-based interaction via Babylon.js `BoundingBoxGizmo` or custom gizmos
- [ ] Keyboard: Ctrl+C (copy), Ctrl+V (paste), Ctrl+X (cut), Ctrl+D (duplicate), Delete
- [ ] Shift+scale = proportional, Ctrl+scale = symmetric

### 6.2 Transform Tool
**File**: `packages/engine/src/terrain/editor/region-transform.ts`

- [ ] `transformRegion(grid, selection, {position, rotation, scale}, mergeEmpty): void`
- [ ] Copy voxels from selection → apply transform → write to new location
- [ ] Merge Empty toggle: when false, air voxels don't overwrite destination
- [ ] Live Edit mode: update terrain in real-time during drag
- [ ] Wireframe preview mode: show outline only, apply on Enter/button

### 6.3 Fill & Replace Tool
**File**: `packages/engine/src/terrain/editor/fill-replace.ts`

- [ ] `fillRegion(grid, selection, material): void` — all voxels in region → occupancy 1.0, selected material
- [ ] `replaceInRegion(grid, selection, source, target): void` — swap material where it matches source

### 6.4 Sea Level Tool
**File**: `packages/engine/src/terrain/editor/sea-level.ts`

- [ ] `createSeaLevel(grid, region, waterLevel): void`
  - Fill empty voxels below `waterLevel` with Water material
  - Partial occupancy at surface level for smooth water line
- [ ] `evaporateWater(grid, region): void`
  - Set all Water material voxels in region to Air

### 6.5 Region Tools UI
**File**: `apps/web-studio/src/components/studio/terrain-editor/EditTab.tsx` (extend)

- [ ] Select tool button → enables selection mode
- [ ] Transform tool button → shows move/rotate/scale inputs + Merge Empty + Live Edit toggles
- [ ] Fill tool: Fill vs Replace toggle, material picker(s), Apply button
- [ ] Sea Level tool: region controls, water level Y input, Create/Evaporate buttons

**MILESTONE**: Select a terrain region, transform it, fill it with a different material, add a sea level.

---

## Phase 7: Water System

**Goal**: Voxel-based water with shader rendering and buoyancy.

### 7.1 Water as Voxel Material
- [ ] Water voxels stored in VoxelGrid with `TerrainMaterial.Water`
- [ ] `ChunkMesher` separates water voxels into a second mesh (`waterMesh`)
- [ ] Water Marching Cubes runs independently from solid terrain

### 7.2 Water Shader
**File**: `packages/engine/src/terrain/rendering/water-voxel-renderer.ts`

- [ ] Custom `BABYLON.ShaderMaterial` for water chunk meshes
- [ ] Vertex shader: wave displacement using `sin/cos(worldPos + time * waveSpeed) * waveSize`
- [ ] Fragment shader:
  - [ ] Fresnel effect (more reflective at glancing angles)
  - [ ] Environment/skybox reflection via cube map
  - [ ] Configurable color, reflectance, transparency
- [ ] Water properties object: `color`, `reflectance` (0–1), `transparency` (0–1), `waveSize` (0–1), `waveSpeed` (0–100)
- [ ] Use `alpha = 1 - transparency * (1 - fresnel)` for depth-dependent transparency

### 7.3 Buoyancy Integration
- [ ] Modify `SimulationLoop` buoyancy logic:
  - Sample voxel grid around entity bounds (not just a fixed plane Y)
  - Count Water voxels overlapping entity → submersion fraction
  - Apply buoyancy force = `submersion * gravity * mass`
  - Apply drag = `submersion * waterDrag * velocity`
- [ ] Keep existing `WaterComponent` plane as optional visual-only enhancement

### 7.4 Water Properties UI
- [ ] Add water properties to Terrain section of Properties panel
- [ ] Color picker for water tint
- [ ] Sliders for reflectance, transparency, wave size, wave speed

**MILESTONE**: Water fills terrain basins, entities float with buoyancy, waves animate.

---

## Phase 8: Scripting API

**Goal**: Students modify terrain programmatically via QuickJS.

### 8.1 Terrain API Bindings
**File**: `packages/engine/src/terrain/api/terrain-script-bindings.ts`

- [ ] Register `pb.terrain` namespace in QuickJS runtime
- [ ] `pb.terrain.fillBall(center, radius, material)` — sphere fill
- [ ] `pb.terrain.fillBlock(position, size, material)` — box fill
- [ ] `pb.terrain.fillCylinder(position, height, radius, material)` — cylinder fill
- [ ] `pb.terrain.fillRegion(min, max, material)` — rectangular fill
- [ ] `pb.terrain.fillWedge(position, size, material)` — wedge fill
- [ ] Material parameter accepts string names ('Grass', 'Rock', etc.)

### 8.2 Read/Write Methods
- [ ] `pb.terrain.readVoxels(min, max): { materials, occupancy }` — 3D arrays
- [ ] `pb.terrain.writeVoxels(min, max, materials, occupancy)` — 3D arrays
- [ ] `pb.terrain.getHeight(x, z): number` — scan down to find first solid voxel
- [ ] `pb.terrain.getMaterial(x, y, z): string` — material name at position
- [ ] `pb.terrain.setVoxel(x, y, z, occupancy, material)` — single voxel
- [ ] `pb.terrain.clear()` — clear all terrain

### 8.3 Properties
- [ ] `pb.terrain.waterColor`, `waterReflectance`, `waterTransparency`, `waterWaveSize`, `waterWaveSpeed`
- [ ] `pb.terrain.decoration` (boolean), `pb.terrain.grassLength` (0.1–1.0)
- [ ] `pb.terrain.setMaterialColor(name, {r,g,b})`, `getMaterialColor()`, `resetMaterialColor()`

### 8.4 Safety Limits
- [ ] Max 100,000 voxels per single fill operation
- [ ] Max 500,000 total voxel writes per frame
- [ ] Script timeout: 5000ms
- [ ] Throw descriptive error when limits exceeded

### 8.5 SDK Integration
**File**: `packages/sdk/` (extend student-facing API)

- [ ] Add `terrain` to SDK type definitions
- [ ] Add autocomplete/documentation for all terrain methods
- [ ] Example scripts in SDK docs

**MILESTONE**: Student scripts create procedural terrain, deform terrain on impact, build mazes.

---

## Phase 9: Visual Polish

**Goal**: Animated grass, emissive lava, custom colors, optional triplanar textures.

### 9.1 Animated Grass
**File**: `packages/engine/src/terrain/rendering/grass-renderer.ts`

- [ ] Scan chunk mesh for upward-facing surfaces with Grass/LeafyGrass material
- [ ] Generate instanced grass blade geometry (thin triangles)
- [ ] Vertex shader: bend blades using `sin(worldPos.x + time * windSpeed)` for wind
- [ ] `decoration: boolean` toggle — enable/disable grass rendering
- [ ] `grassLength: number` (0.1–1.0) — scales blade height
- [ ] Only render on visible chunks (frustum cull)

### 9.2 Emissive Materials
- [ ] Cracked Lava: add emissive color `(232, 156, 74)` to material shader
- [ ] Emissive intensity modulation for pulsing glow effect

### 9.3 Custom Terrain Colors
- [ ] `materialColorOverrides: Map<TerrainMaterial, [r,g,b]>` on terrain config
- [ ] UI: color picker per material in Properties panel
- [ ] Presets: Default, Fantasy (purple grass, orange rock), Tundra (blue-gray everything)
- [ ] Apply overrides during chunk meshing (override vertex colors)

### 9.4 Triplanar Texturing (Optional)
- [ ] Create texture atlas (512x512 per material, packed into Texture2DArray)
- [ ] Custom `ShaderMaterial` with triplanar projection
- [ ] Per-vertex material ID attributes for texture array lookup
- [ ] Blend between materials at voxel boundaries

**MILESTONE**: Grass sways in wind, lava glows, custom color themes work.

---

## Phase 10: Optimization

**Goal**: 60 FPS on mid-range hardware with large (512x128x512 voxel) terrains.

### 10.1 LOD System
- [ ] 4 LOD levels: Full (every voxel), Half (every 2nd), Quarter (every 4th), Eighth (every 8th)
- [ ] `getLODLevel(distance)`: Full <128, Half <256, Quarter <512, Eighth beyond
- [ ] Downsample occupancy grid for lower LODs → run MC on smaller grid
- [ ] LOD transition skirts to prevent seams

### 10.2 Web Worker Meshing
- [ ] Move `marchingCubes()` to a dedicated Web Worker
- [ ] `postMessage()` with Transferable ArrayBuffers (zero-copy)
- [ ] Main thread: queue dirty chunks → Worker: mesh them → Main thread: upload to GPU
- [ ] Worker pool (2–4 workers) for parallel chunk meshing

### 10.3 Memory Management
- [ ] `LOAD_DISTANCE = 320`, `UNLOAD_DISTANCE = 400` (world units)
- [ ] Unload distant chunks: dispose mesh + collider, keep voxel data
- [ ] Mesh object pool: reuse `BABYLON.Mesh` instances
- [ ] Empty chunk pruning after edits

### 10.4 Serialization
- [ ] Run-length encoding (RLE) for chunk data: compress homogeneous regions
- [ ] Save format: `{ version, voxelSize, chunkSize, chunks: SerializedChunk[] }`
- [ ] Save/load terrain to project file (JSON or binary)
- [ ] Typical compression: 20KB chunk → 1–5KB RLE

### 10.5 Profiling & Budgets
- [ ] Frame budget tracking: mesh time, collider time, render time
- [ ] Auto-reduce mesh budget if frame time exceeds 12ms
- [ ] Performance overlay (dev mode): chunks loaded, triangles, frame times

**MILESTONE**: 512x128x512 terrain at 60 FPS, save/load in <2 seconds.

---

## Key Files Summary

| File | Operation | Description |
|------|-----------|-------------|
| `packages/engine/src/terrain/voxel/constants.ts` | Create | VOXEL_SIZE, CHUNK_SIZE, etc. |
| `packages/engine/src/terrain/voxel/terrain-materials.ts` | Create | 23 material enum + defs |
| `packages/engine/src/terrain/voxel/voxel.ts` | Create | Voxel, ChunkData types |
| `packages/engine/src/terrain/voxel/chunk.ts` | Create | Chunk class |
| `packages/engine/src/terrain/voxel/voxel-grid.ts` | Create | VoxelGrid sparse container |
| `packages/engine/src/terrain/voxel/chunk-manager.ts` | Create | Dirty tracking, mesh budget |
| `packages/engine/src/terrain/meshing/mc-tables.ts` | Create | Marching Cubes lookup tables |
| `packages/engine/src/terrain/meshing/marching-cubes.ts` | Create | MC algorithm |
| `packages/engine/src/terrain/meshing/chunk-mesher.ts` | Create | Per-chunk meshing orchestrator |
| `packages/engine/src/terrain/generation/biome.ts` | Create | 9 biome presets |
| `packages/engine/src/terrain/generation/biome-blender.ts` | Create | Voronoi blending |
| `packages/engine/src/terrain/generation/terrain-generator.ts` | Create | Main generation entry |
| `packages/engine/src/terrain/generation/cave-generator.ts` | Create | 3D noise caves |
| `packages/engine/src/terrain/generation/heightmap-importer.ts` | Create | Image → voxels |
| `packages/engine/src/terrain/editor/brush.ts` | Create | Brush shapes + iteration |
| `packages/engine/src/terrain/editor/brush-operations.ts` | Create | Draw/Sculpt/Smooth/Flatten/Paint |
| `packages/engine/src/terrain/editor/region-select.ts` | Create | Selection + clipboard |
| `packages/engine/src/terrain/editor/region-transform.ts` | Create | Move/rotate/scale regions |
| `packages/engine/src/terrain/editor/fill-replace.ts` | Create | Fill + Replace operations |
| `packages/engine/src/terrain/editor/sea-level.ts` | Create | Water level management |
| `packages/engine/src/terrain/editor/undo-stack.ts` | Create | Undo/redo for terrain |
| `packages/engine/src/terrain/rendering/chunk-renderer.ts` | Create | Babylon.js mesh per chunk |
| `packages/engine/src/terrain/rendering/brush-cursor.ts` | Create | 3D brush preview |
| `packages/engine/src/terrain/rendering/grass-renderer.ts` | Create | Instanced grass blades |
| `packages/engine/src/terrain/rendering/water-voxel-renderer.ts` | Create | Water shader material |
| `packages/engine/src/terrain/physics/terrain-physics.ts` | Create | Per-chunk Rapier colliders |
| `packages/engine/src/terrain/api/terrain-script-bindings.ts` | Create | QuickJS pb.terrain API |
| `packages/engine/src/terrain/api/terrain-api.ts` | Create | Public API surface |
| `packages/engine/src/terrain/index.ts` | Create | Barrel exports |
| `packages/engine/src/core/component.ts:L45-L76` | Modify | Add VoxelTerrainComponent |
| `packages/engine/src/core/simulation-loop.ts:L1-L37` | Modify | Add voxel terrain frame hook |
| `packages/engine/src/index.ts:L1-L41` | Modify | Export new terrain types |
| `apps/web-studio/src/components/studio/terrain-editor/TerrainEditorPanel.tsx` | Create | Main editor UI |
| `apps/web-studio/src/components/studio/terrain-editor/CreateTab.tsx` | Create | Generate + Import |
| `apps/web-studio/src/components/studio/terrain-editor/EditTab.tsx` | Create | Brush + Region tools |
| `apps/web-studio/src/components/studio/terrain-editor/MaterialPicker.tsx` | Create | Material swatch grid |
| `apps/web-studio/src/components/studio/terrain-editor/BiomeSettings.tsx` | Create | Biome checkboxes |
| `apps/web-studio/src/components/studio/terrain-editor/HeightmapUploader.tsx` | Create | Drag-drop import |
| `apps/web-studio/src/components/studio/terrain-editor/BrushPreview.tsx` | Create | Brush cursor overlay |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Marching Cubes performance on large edits | Budget remeshing to 4 chunks/frame; Web Worker in Phase 10 |
| Memory usage with many chunks | Sparse storage + unloading distant chunks + RLE serialization |
| Collider rebuild lag during sculpting | Budget 2-4 colliders/frame; prioritize near-camera chunks |
| Brush interaction latency (raycast + apply + remesh) | Debounce brush application; preview before commit |
| Water rendering complexity | Start with simple transparent mesh; upgrade to shader in Phase 7 |
| Breaking existing heightmap terrain | Feature flag ensures old system remains functional |
| MC edge cases (thin surfaces, degenerate triangles) | Vertex deduplication + normal smoothing; known issue in MC, not blocking |
| Large terrain generation freezes UI | Web Worker generation with progress streaming |

---

## Dependency Graph

```
Phase 0 (Preparation)
    │
    ▼
Phase 1 (Core Voxel Engine) ──────────────────────────
    │           │           │           │              │
    ▼           ▼           ▼           ▼              ▼
Phase 2     Phase 3     Phase 5     Phase 8        (parallel)
(Generate)  (Physics)   (Import)    (Scripting)
    │           │
    │           ▼
    │       Phase 4 (Editor Tools)
    │           │
    │           ▼
    │       Phase 6 (Region Tools)
    │       Phase 9 (Visual Polish)
    │
    ▼
Phase 7 (Water) ← needs Phase 3 too
    │
    ▼
Phase 10 (Optimization) ← needs all above
```

---

## SESSION_ID
- CODEX_SESSION: N/A (external models not available)
- GEMINI_SESSION: N/A (external models not available)
