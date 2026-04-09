# Dungeon Alchemist-Style Engine for Problocks

**Goal:** Evolve Problocks from a PixiJS pixel game wrapper into an intelligent, AI-powered 2D/isometric game creation platform — like Dungeon Alchemist but open, scriptable, educational, and running on $200 Chromebooks.

**Key Insight:** Dungeon Alchemist's quality comes from high-quality 2D sprite assets + algorithmic intelligence (rule-based placement, procedural generation), NOT from 3D rendering. PixiJS can render photorealistic sprites just as cheaply as pixel art. The "magic" is all CPU-side logic.

**Hardware Constraint:** Celeron N4000, 4GB RAM, Intel UHD 600 (12 EUs). All heavy work (AI image generation, procedural gen) is either server-side or CPU-bound. GPU just renders final 2D sprites.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Studio IDE (React)                     │
├──────────┬──────────┬───────────┬───────────┬───────────┤
│ Scene    │ Tilemap  │ Asset     │ Rule      │ Script    │
│ Explorer │ Editor   │ Browser   │ Editor    │ Editor    │
├──────────┴──────────┴───────────┴───────────┴───────────┤
│                  Engine Core (ECS)                        │
├─────────┬──────────┬───────────┬───────────┬────────────┤
│ PixiJS  │ Isometric│ 2D Light  │ Sprite    │ Particle   │
│ Renderer│ Tilemap  │ System    │ Animation │ System     │
├─────────┴──────────┴───────────┴───────────┴────────────┤
│              Intelligence Layer                           │
├─────────┬──────────┬───────────┬───────────┬────────────┤
│ Asset   │ Rule     │ Procedural│ Pathfind  │ Behavior   │
│ Manager │ Placement│ Gen (WFC) │ (A*/Flow) │ Trees/FSM  │
├─────────┴──────────┴───────────┴───────────┴────────────┤
│              AI Asset Pipeline                            │
├─────────┬──────────┬───────────────────────┬────────────┤
│ Freepik │ fal.ai   │ Background Removal    │ Style      │
│ API     │ API      │ + Normalization       │ System     │
├─────────┴──────────┴───────────────────────┴────────────┤
│              Existing Foundation                          │
├─────────┬──────────┬───────────┬───────────┬────────────┤
│ Rapier  │ QuickJS  │ Hono API  │ Market    │ Probux     │
│ Physics │ Sandbox  │ Backend   │ place     │ Economy    │
└─────────┴──────────┴───────────┴───────────┴────────────┘
```

---

## Build Phases

### Phase 1: Foundation (Parallel Tracks A + B)

#### Track A — Isometric Tilemap Engine
**Location:** `packages/engine/src/tilemap/`

1. **Grid System** (`grid.ts`)
   - Support orthogonal, isometric, and hex grid types
   - World ↔ screen coordinate conversion
   - Configurable tile size, grid dimensions
   - Chunk-based storage for large maps (16x16 chunks)

2. **Tilemap Renderer** (`tilemap-renderer.ts`)
   - Multi-layer rendering (ground, objects, overlay, collision)
   - Isometric depth sorting (Y-sort + layer priority)
   - Camera culling (only render visible chunks)
   - PixiJS sprite batching for performance

3. **Auto-Tiling** (`auto-tile.ts`)
   - Bitmask-based auto-tiling (47-tile blob sets)
   - Wang tile support
   - Terrain transitions (grass → dirt → stone)
   - Rule definitions per tileset

4. **Tilemap Editor** (Studio component)
   - Tile palette panel
   - Paint/fill/erase tools
   - Layer management
   - Import tileset images (sprite sheet slicer)

5. **Isometric Projection** (`isometric.ts`)
   - Diamond (standard iso) and staggered modes
   - Height levels (multi-floor rendering)
   - Mouse picking (screen → tile coords with height)
   - Elevation shadows

#### Track B — Asset Manager + AI Pipeline
**Location:** `packages/engine/src/assets/`

1. **Asset Manager** (`asset-manager.ts`)
   - Asset registry: id, name, category, tags, collision shape, placement rules
   - Import from file, URL, or AI generation
   - Sprite sheet slicing (grid-based and JSON atlas)
   - Thumbnail generation
   - Search/filter by tags and category

2. **Asset Metadata Schema** (`asset-schema.ts`)
   ```typescript
   interface AssetMetadata {
     id: string
     name: string
     category: 'floor' | 'wall' | 'furniture' | 'decoration' | 'character' | 'item' | 'effect'
     tags: string[]
     style: string  // "medieval", "sci-fi", "modern", etc.
     perspective: 'top-down' | 'isometric' | 'side-view'
     collisionShape: CollisionShape  // rect, circle, polygon, none
     placementRules: PlacementRule[]  // against-wall, center, min-spacing, etc.
     anchor: { x: number, y: number }
     size: { width: number, height: number }
     variants?: string[]  // alternative versions
     source: 'imported' | 'ai-generated' | 'marketplace'
   }
   ```

3. **AI Generation Service** (`ai-generator.ts`)
   - Freepik API integration
   - fal.ai fallback (Stable Diffusion)
   - Style system: per-project style config appended to all prompts
   - Background removal (rembg or API-based)
   - Size normalization + anchor point detection
   - Batch generation (generate a "pack" of related assets)

4. **Style System** (`style-system.ts`)
   - Per-project art direction: color palette, perspective, lighting angle
   - Style prompt templates: "isometric, soft lighting, fantasy RPG, consistent scale"
   - Style preview (generate sample asset to confirm look)
   - Style presets: medieval, sci-fi, modern, cartoon, realistic

5. **Asset Browser** (Studio component)
   - Grid/list view with thumbnails
   - Category tabs, tag filters, search
   - Drag-to-canvas placement
   - "Generate New" button → AI prompt dialog
   - Import from file/URL
   - Marketplace browser (community assets)

---

### Phase 2: Visual Systems

6. **Sprite Animation System** (`packages/engine/src/animation/`)
   - SpriteAnimationComponent: sprite sheet ref, frame sequences, current frame
   - AnimationController: play, pause, loop, speed, events (onComplete, onFrame)
   - Named animations per entity (idle, walk, attack)
   - Tween system for smooth property interpolation (position, scale, alpha, rotation)

7. **2D Camera System** (`packages/engine/src/camera/`)
   - Camera entity: position, zoom, rotation, bounds
   - Follow target with configurable smoothing/lookahead/deadzone
   - Screen shake, zoom transitions
   - Viewport culling integration with tilemap renderer

8. **2D Lighting System** (`packages/engine/src/lighting/`)
   - Point lights, spot lights, ambient light
   - Raycast shadows against tilemap collision layer
   - Light color, intensity, radius, falloff
   - Day/night cycle (global ambient + time-based color)
   - PixiJS filter-based rendering (performant on low-end)
   - Normal map support for depth illusion (optional, higher-end)

9. **Particle System** (`packages/engine/src/particles/`)
   - Emitter component: rate, lifetime, velocity, gravity, color over life
   - Pre-built effect presets: fire, smoke, rain, snow, sparkle, dust
   - PixiJS ParticleContainer for batched rendering
   - Scriptable from QuickJS

10. **Audio Engine** (`packages/engine/src/audio/`)
    - Web Audio API wrapper
    - Spatial 2D audio (panning based on distance from camera)
    - Music channel (crossfade, loop) + SFX channel
    - Asset-linked sounds (footsteps on tile type, ambient per biome)
    - QuickJS API: `pb.playSound(id)`, `pb.playMusic(id)`

---

### Phase 3: Intelligence Layer

11. **Prefab System** (`packages/engine/src/prefabs/`)
    - Save entity hierarchy as reusable template
    - Parameterized instantiation (override properties on spawn)
    - Nested prefabs
    - Marketplace-tradeable prefab packs

12. **Rule-Based Placement** (`packages/engine/src/placement/`)
    - Object placement rules:
      - `against-wall` — snaps to wall edge
      - `center-room` — places in room center
      - `min-spacing(n)` — minimum distance from similar objects
      - `on-floor(type)` — only on specific floor tiles
      - `near(tag, distance)` — must be near another tagged object
    - Room templates:
      - `kitchen` → stove + sink + table + chairs
      - `bedroom` → bed + nightstand + wardrobe + lamp
      - `tavern` → bar + stools + tables + fireplace
    - Auto-furnish algorithm:
      1. Identify room shape from walls
      2. Classify room type (user-set or inferred)
      3. Select objects from template
      4. Place using constraint satisfaction
      5. Fill remaining space with decorations

13. **Procedural Generation Toolkit** (`packages/engine/src/procgen/`)
    - **BSP Dungeon Generator**: Binary space partition → rooms + corridors
    - **Wave Function Collapse**: Pattern-based tile generation from example inputs
    - **L-Systems**: Vegetation, rivers, road networks
    - **Poisson Disk Sampling**: Natural-looking object distribution (trees, rocks)
    - **Graph-Based Connectivity**: Ensure all rooms are reachable
    - All generators output tilemap data → directly renderable

14. **Pathfinding** (`packages/engine/src/navigation/`)
    - Grid-based A* (tilemap collision layer as navgrid)
    - Jump Point Search (optimized A* for uniform grids)
    - Flow fields for crowd movement
    - Line-of-sight queries
    - Dynamic obstacle avoidance
    - QuickJS API: `pb.findPath(from, to)`, `pb.hasLineOfSight(a, b)`

15. **Behavior Trees / State Machines** (`packages/engine/src/ai/`)
    - FSM component: states, transitions, conditions
    - Behavior tree nodes: sequence, selector, parallel, decorator
    - Pre-built behaviors: patrol, chase, flee, wander, guard, follow
    - Visual node editor in Studio (future)
    - QuickJS API for custom behaviors

---

### Phase 4: Input & Interaction

16. **Input Manager** (`packages/engine/src/input/`)
    - Keyboard, mouse, touch abstraction
    - Action mapping system (action → keys)
    - Input buffering
    - Gamepad support (USB controllers on Chromebooks)
    - QuickJS API: `pb.isKeyDown("space")`, `pb.onInput("jump", callback)`

17. **UI/HUD System** (`packages/engine/src/ui/`)
    - In-game UI components: health bar, inventory grid, dialogue box, minimap
    - Layout engine (flexbox-like)
    - Skinnable (matches project art style)
    - Scriptable from QuickJS

18. **Scene Transitions** (`packages/engine/src/scenes/`)
    - Fade, slide, dissolve transitions between scenes
    - Door/portal triggers (enter zone → load scene)
    - Persistent state across scene changes

---

## AI Asset Pipeline Detail

### Generation Flow
```
User prompt: "wooden tavern table, top-down view"
    │
    ├─ Prepend project style: "isometric, fantasy RPG, warm lighting, 64x64px"
    │
    ├─ Send to Freepik API (primary) or fal.ai (fallback)
    │
    ├─ Receive raw image
    │
    ├─ Post-processing:
    │   ├─ Background removal
    │   ├─ Resize to grid-aligned dimensions
    │   ├─ Generate collision shape (convex hull or bounding box)
    │   ├─ Detect anchor point (center-bottom for isometric)
    │   └─ Classify category + suggest tags
    │
    ├─ Save to project asset library
    │
    └─ Available in Asset Browser for drag-and-drop
```

### Cost Model
| Tier | Access | Who Pays |
|------|--------|----------|
| Free | Community asset library (thousands of pre-generated packs) | Platform (one-time generation cost, amortized) |
| Student | Generate custom assets with own API key | Student |
| Creator | Generate + sell asset packs on marketplace | Creator (earns Probux) |

### Style Presets
- **Medieval Fantasy** — stone walls, wooden furniture, torchlight
- **Sci-Fi Station** — metal panels, holographic displays, neon accent lights
- **Modern Interior** — clean lines, neutral colors, contemporary furniture
- **Cartoon/Toon** — thick outlines, bright colors, exaggerated proportions
- **Pixel Art HD** — pixel art aesthetic at higher resolution
- **Nature/Outdoor** — trees, rocks, water, terrain features

---

## Chromebook Performance Budget

| System | CPU Cost | GPU Cost | Memory |
|--------|----------|----------|--------|
| PixiJS sprite rendering (500 sprites) | Low | Low | ~50MB |
| Isometric tilemap (100x100 visible) | Low | Low | ~20MB textures |
| 2D lighting (8 lights, raycast) | Medium | Low (filters) | Negligible |
| Procedural generation (BSP/WFC) | High (one-time) | None | ~10MB working |
| Pathfinding (A* on 200x200 grid) | Medium (per-query) | None | ~5MB |
| AI asset generation | None (server-side) | None | ~download size |
| Particle system (200 particles) | Low | Low (batched) | Negligible |
| Audio (4 simultaneous sounds) | Low | None | ~10MB loaded |
| **Total estimated** | **~40% Celeron** | **~30% UHD 600** | **~100MB** |

---

## QuickJS API Extensions (Student-Facing)

```typescript
// Tilemap
pb.tilemap.setTile(layer, x, y, tileId)
pb.tilemap.getTile(layer, x, y) → tileId
pb.tilemap.screenToTile(screenX, screenY) → { x, y }

// Assets
pb.assets.spawn(assetId, x, y, options?) → entityId
pb.assets.list(category?) → AssetInfo[]

// Pathfinding
pb.nav.findPath(fromX, fromY, toX, toY) → Point[]
pb.nav.hasLineOfSight(ax, ay, bx, by) → boolean

// Camera
pb.camera.follow(entityId, smoothing?)
pb.camera.setZoom(level)
pb.camera.shake(intensity, duration)

// Animation
pb.anim.play(entityId, animationName)
pb.anim.stop(entityId)

// Audio
pb.audio.playSound(soundId, options?)
pb.audio.playMusic(musicId, options?)

// Lighting
pb.light.create(type, x, y, options) → lightId
pb.light.setAmbient(color, intensity)

// Input
pb.input.isDown(key) → boolean
pb.input.onAction(actionName, callback)

// Procedural Generation
pb.procgen.generateDungeon(width, height, options) → TilemapData
pb.procgen.wfc(exampleInput, outputSize) → TilemapData

// AI (if student has API key configured)
pb.ai.generateAsset(prompt) → assetId
```

---

## Success Metrics

- [ ] Can render 100x100 isometric tilemap at 30+ FPS on Celeron N4000
- [ ] Can generate a furnished room from prompt in < 30 seconds
- [ ] Can auto-furnish a 5-room dungeon layout in < 2 seconds
- [ ] Can pathfind across 200x200 grid in < 16ms (one frame)
- [ ] Community asset library reaches 1000+ categorized assets
- [ ] Student can build a Dungeon Alchemist-like map maker using only the scripting API

---

## Status

| Component | Status | Location |
|-----------|--------|----------|
| Isometric Grid System | NOT STARTED | `packages/engine/src/tilemap/` |
| Tilemap Renderer | NOT STARTED | `packages/engine/src/tilemap/` |
| Auto-Tiling | NOT STARTED | `packages/engine/src/tilemap/` |
| Asset Manager | NOT STARTED | `packages/engine/src/assets/` |
| AI Generator Service | NOT STARTED | `packages/engine/src/assets/` |
| Style System | NOT STARTED | `packages/engine/src/assets/` |
| Asset Browser UI | NOT STARTED | `apps/web-studio/src/components/studio/` |
| Sprite Animation | NOT STARTED | `packages/engine/src/animation/` |
| 2D Camera | NOT STARTED | `packages/engine/src/camera/` |
| 2D Lighting | NOT STARTED | `packages/engine/src/lighting/` |
| Particle System | NOT STARTED | `packages/engine/src/particles/` |
| Audio Engine | NOT STARTED | `packages/engine/src/audio/` |
| Input Manager | NOT STARTED | `packages/engine/src/input/` |
| Prefab System | NOT STARTED | `packages/engine/src/prefabs/` |
| Rule-Based Placement | NOT STARTED | `packages/engine/src/placement/` |
| Procedural Gen (BSP) | NOT STARTED | `packages/engine/src/procgen/` |
| Procedural Gen (WFC) | NOT STARTED | `packages/engine/src/procgen/` |
| Pathfinding (A*) | NOT STARTED | `packages/engine/src/navigation/` |
| Behavior Trees / FSM | NOT STARTED | `packages/engine/src/ai/` |
