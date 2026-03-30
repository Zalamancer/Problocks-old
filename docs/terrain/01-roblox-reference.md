# 01 — Roblox Terrain Reference

> Complete breakdown of how Roblox's terrain system works, extracted from official creator documentation.

## Core Concept: Voxel Grid

Roblox terrain is a grid of **voxels** — each voxel is a **4x4x4 stud** region in the 3D world. Each voxel has:
- **Occupancy** (0.0–1.0) — how "full" the cell is. Controls the smooth surface position.
- **Material** — one of 23 built-in materials (or custom). Determines appearance and behavior.

The grid is infinite in theory but practically bounded by the world limits. Terrain is a single instance (`Workspace.Terrain`) that manages the entire grid.

---

## Materials (23 Total)

### Solid Materials
| Material | RGB | Hex | Notes |
|----------|-----|-----|-------|
| Asphalt | 115, 123, 107 | #737B6B | Roads, paths |
| Basalt | 30, 30, 37 | #1E1E25 | Dark volcanic rock |
| Brick | 138, 86, 62 | #8A563E | Man-made surfaces |
| Cobblestone | 132, 123, 90 | #847B5A | Old roads, paths |
| Concrete | 127, 102, 63 | #7F663F | Foundations, walls |
| Cracked Lava | 232, 156, 74 | #E89C4A | Volcanic, emissive |
| Glacier | 101, 176, 234 | #65B0EA | Transparent ice |
| Grass | 106, 127, 63 | #6A7F3F | Animated grass blades |
| Ground | 102, 92, 59 | #665C3B | Dirt, soil |
| Ice | 129, 194, 224 | #81C2E0 | Slippery surface |
| Leafy Grass | 115, 132, 74 | #73844A | Dense vegetation |
| Limestone | 206, 173, 148 | #CEAD94 | Sedimentary rock |
| Mud | 58, 46, 36 | #3A2E24 | Wet soil |
| Pavement | 148, 148, 140 | #94948C | Smooth roads |
| Rock | 102, 108, 111 | #666C6F | Generic stone |
| Salt | 198, 189, 181 | #C6BDB5 | White mineral |
| Sand | 143, 126, 95 | #8F7E5F | Beaches, deserts |
| Sandstone | 137, 90, 71 | #895A47 | Layered rock |
| Slate | 63, 127, 107 | #3F7F6B | Dark stone |
| Snow | 195, 199, 218 | #C3C7DA | Deformable snow |
| Wood Planks | 139, 109, 79 | #8B6D4F | Man-made boards |

### Special Materials
| Material | RGB | Hex | Notes |
|----------|-----|-----|-------|
| Water | 12, 84, 92 | #0C545C | Ripples, reflections, buoyancy |
| Air | 255, 255, 255 | #FFFFFF | Empty space — no voxel |

### Special Material Behaviors

**Water**
- Ripples, oscillates, shimmers with subtle motion
- Properties: `WaterColor`, `WaterReflectance` (0–1), `WaterTransparency` (0–1), `WaterWaveSize` (0–1), `WaterWaveSpeed` (0–100)
- Objects submerged in water experience buoyancy

**Grass**
- Animated blades grow on grass-material terrain surfaces
- Controlled by `Decoration` (bool toggle) and `GrassLength` (0.1–1.0)
- Direction/strength via Global Wind system
- Respects "Reduce Motion" accessibility setting

**Cracked Lava**
- Emissive glow effect

---

## Terrain Generation

### Procedural Generate Tool
Generates terrain within a selection region with biome settings:

**Biomes Available:**
1. **Arctic** — Snow, ice, glaciers
2. **Dunes** — Sand hills, desert
3. **Canyons** — Deep cuts, layered rock
4. **Lavascape** — Cracked lava, basalt
5. **Water** — Ocean, lakes
6. **Mountains** — High peaks, rock, snow caps
7. **Hills** — Rolling grass hills
8. **Plains** — Flat grassland
9. **Marsh** — Muddy, watery lowlands

**Settings:**
- **Selection Region** — X/Y/Z position and size
- **Biome Selection** — toggle each biome on/off
- **Blending** — how smoothly biomes transition (higher = smoother)
- **Caves** — include underground cave systems
- **Biome Size** — scale of each biome within the region
- **Seed** — deterministic randomness seed

### Heightmap + Colormap Import
- **Heightmap**: grayscale image where brightness = height
  - 1 pixel = 4 studs
  - Max resolution: 4096x4096 pixels
  - Supports .jpg and .png
  - Black = lowest point, White = highest point
  - Height range depends on selection region Y size
- **Colormap**: colored image mapped to materials via RGB color key
  - Each material has a specific RGB value (see Materials table above)
  - Hard edges required — anti-aliasing creates wrong materials
  - Studio picks closest matching material for unrecognized colors

---

## Editor Tools

### Create Tab
1. **Import** — load heightmap + optional colormap into selection region
2. **Generate** — procedural biome generation with seed
3. **Clear** — remove all terrain in the place

### Edit Tab — Large Scale
4. **Select** — rectangular region selection with move/scale handles
   - Copy (Ctrl+C), Paste (Ctrl+V), Cut (Ctrl+X), Duplicate (Ctrl+D), Delete
   - Shift+scale = proportional, Ctrl+scale = symmetric
5. **Transform** — move/rotate/scale selected regions
   - Merge Empty toggle, Live Edit toggle, Snap to Voxels
6. **Fill** — fill region with material OR replace one material with another
7. **Sea Level** — create/evaporate water within a region

### Edit Tab — Brush Tools
All brush tools share:
- **Shape**: sphere, box, or cylinder
- **Size**: 1–64 studs base, plus adjustable height for box/cylinder
- **Shortcuts**: B = adjust size, Ctrl+B = adjust height, Shift+B = adjust strength

8. **Draw** — add or subtract terrain (Ctrl = toggle subtract)
   - Pivot position (bottom/center/top)
   - Plane lock (auto/manual)
   - Ignore water, ignore parts options
   - Auto material (matches nearby terrain)
   - Shift = temporarily smooth
9. **Sculpt** — like draw but with **strength** slider (0.1–1.0) for gentle edits
10. **Smooth** — average neighbor voxels to remove sharp edges
11. **Flatten** — level terrain to a plane
    - Modes: Erode to Flat, Grow to Flat, Flatten All
    - Fixed plane option (locked Y)
12. **Paint** — change material of existing terrain
    - Paint mode (overwrite) or Replace mode (swap one material for another)

---

## Scripting API

Roblox provides Lua methods on `Workspace.Terrain`:

```lua
-- Fill shapes with a material
Terrain:FillBall(center, radius, material)
Terrain:FillBlock(cframe, size, material)
Terrain:FillCylinder(cframe, height, radius, material)
Terrain:FillRegion(region3, resolution, material)
Terrain:FillWedge(cframe, size, material)

-- Read/write voxel data directly
Terrain:ReadVoxels(region3, resolution)  -- returns materials[], occupancy[]
Terrain:WriteVoxels(region3, resolution, materials[], occupancy[])

-- Clear terrain
Terrain:Clear()

-- Properties
Terrain.WaterColor = Color3.new(...)
Terrain.WaterReflectance = 0.5
Terrain.WaterTransparency = 0.5
Terrain.WaterWaveSize = 0.5
Terrain.WaterWaveSpeed = 50
Terrain.Decoration = true
Terrain.GrassLength = 0.5
Terrain.MaterialColors  -- per-material color overrides
```

### Key Detail: ReadVoxels/WriteVoxels
These are the low-level primitives. `ReadVoxels` returns two 3D arrays (materials and occupancies) for a Region3 at a given resolution (must be 4). `WriteVoxels` sets them. All higher-level operations (FillBall, etc.) use these internally.

---

## Performance Characteristics

- Voxels are stored in a **sparse octree** — empty regions consume no memory
- The mesh is generated via **Marching Cubes** variant for smooth surfaces
- Only **visible chunks** are rendered (frustum culling)
- **LOD** reduces mesh detail at distance
- Water uses a separate rendering pass with reflections
- Grass is instanced geometry on GPU — only on visible Grass-material surfaces
- Physics colliders are per-chunk trimeshes, regenerated only when voxels change
