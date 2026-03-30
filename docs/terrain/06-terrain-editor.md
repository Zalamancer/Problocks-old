# 06 — Terrain Editor

> Brush tools, region tools, keyboard shortcuts, and the editor UI.

## Editor Architecture

The terrain editor is a React panel in the Studio UI that controls brush/region operations on the VoxelGrid. It communicates with the engine through the studio store.

```
TerrainEditorPanel
├── CreateTab
│   ├── GenerateSection (biome settings + generate button)
│   ├── ImportSection (heightmap/colormap upload)
│   └── ClearButton (clear all terrain)
│
└── EditTab
    ├── RegionTools
    │   ├── SelectTool (rect selection with handles)
    │   ├── TransformTool (move/rotate/scale region)
    │   ├── FillTool (fill/replace materials)
    │   └── SeaLevelTool (create/evaporate water)
    │
    └── BrushTools
        ├── DrawTool (add/subtract terrain)
        ├── SculptTool (gentle add/subtract with strength)
        ├── SmoothTool (average neighbors)
        ├── FlattenTool (level to plane)
        └── PaintTool (change material)
```

---

## Brush System

### Brush Shape

All brush tools share a configurable shape:

```typescript
type BrushShape = 'sphere' | 'box' | 'cylinder';

interface BrushConfig {
  shape: BrushShape;
  /** Base size in studs (4–256, maps to 1–64 voxels) */
  size: number;
  /** Height for box/cylinder shapes (defaults to size) */
  height: number;
  /** Strength for sculpt/smooth/flatten (0.1–1.0) */
  strength: number;
  /** Currently selected material */
  material: TerrainMaterial;
  /** Pivot: 'bottom' | 'center' | 'top' */
  pivot: 'bottom' | 'center' | 'top';
  /** Snap to voxel grid */
  snapToVoxel: boolean;
}
```

### Brush Cursor (3D Preview)

The brush renders as a translucent wireframe in the 3D viewport showing where the operation will apply:

```typescript
function updateBrushCursor(
  scene: BABYLON.Scene,
  hit: PickingInfo,      // raycast hit on terrain
  config: BrushConfig,
): void {
  // Position brush at hit point, adjusted for pivot
  const pos = hit.pickedPoint.clone();
  if (config.pivot === 'bottom') pos.y += config.size / 2;
  else if (config.pivot === 'top') pos.y -= config.size / 2;

  // Update cursor mesh
  switch (config.shape) {
    case 'sphere':
      cursorMesh = BABYLON.MeshBuilder.CreateSphere('brushCursor', {
        diameter: config.size,
        segments: 16,
      }, scene);
      break;
    case 'box':
      cursorMesh = BABYLON.MeshBuilder.CreateBox('brushCursor', {
        width: config.size,
        height: config.height,
        depth: config.size,
      }, scene);
      break;
    case 'cylinder':
      cursorMesh = BABYLON.MeshBuilder.CreateCylinder('brushCursor', {
        diameter: config.size,
        height: config.height,
      }, scene);
      break;
  }

  cursorMesh.position = pos;
  cursorMesh.material = brushPreviewMaterial; // translucent blue wireframe
}
```

### Brush Voxel Iteration

When applying a brush, iterate over all voxels within the shape:

```typescript
function* iterateBrushVoxels(
  center: Vector3,
  config: BrushConfig,
): Generator<{ wx: number; wy: number; wz: number; falloff: number }> {
  const halfSize = config.size / 2;
  const halfHeight = config.height / 2;
  const radiusSq = halfSize * halfSize;

  // Bounding box of brush in voxel space
  const minX = Math.floor((center.x - halfSize) / VOXEL_SIZE) * VOXEL_SIZE;
  const maxX = Math.ceil((center.x + halfSize) / VOXEL_SIZE) * VOXEL_SIZE;
  const minY = Math.floor((center.y - halfHeight) / VOXEL_SIZE) * VOXEL_SIZE;
  const maxY = Math.ceil((center.y + halfHeight) / VOXEL_SIZE) * VOXEL_SIZE;
  const minZ = Math.floor((center.z - halfSize) / VOXEL_SIZE) * VOXEL_SIZE;
  const maxZ = Math.ceil((center.z + halfSize) / VOXEL_SIZE) * VOXEL_SIZE;

  for (let wx = minX; wx <= maxX; wx += VOXEL_SIZE) {
    for (let wy = minY; wy <= maxY; wy += VOXEL_SIZE) {
      for (let wz = minZ; wz <= maxZ; wz += VOXEL_SIZE) {
        const dx = wx - center.x;
        const dy = wy - center.y;
        const dz = wz - center.z;

        let inside: boolean;
        let falloff: number; // 1.0 at center, 0.0 at edge

        switch (config.shape) {
          case 'sphere': {
            const distSq = dx*dx + dy*dy + dz*dz;
            inside = distSq <= radiusSq;
            falloff = inside ? 1.0 - Math.sqrt(distSq) / halfSize : 0;
            break;
          }
          case 'box': {
            inside = Math.abs(dx) <= halfSize && Math.abs(dy) <= halfHeight && Math.abs(dz) <= halfSize;
            falloff = inside ? 1.0 : 0;
            break;
          }
          case 'cylinder': {
            const distXZ = Math.sqrt(dx*dx + dz*dz);
            inside = distXZ <= halfSize && Math.abs(dy) <= halfHeight;
            falloff = inside ? 1.0 - distXZ / halfSize : 0;
            break;
          }
        }

        if (inside) {
          yield { wx, wy, wz, falloff: Math.max(0, falloff) };
        }
      }
    }
  }
}
```

---

## Tool Implementations

### Draw Tool

Adds or subtracts terrain. Hold Ctrl/Cmd to toggle subtract mode.

```typescript
function applyDraw(
  grid: VoxelGrid,
  center: Vector3,
  config: BrushConfig,
  mode: 'add' | 'subtract',
): void {
  for (const { wx, wy, wz, falloff } of iterateBrushVoxels(center, config)) {
    const current = grid.getVoxel(wx, wy, wz);

    if (mode === 'add') {
      // Set occupancy to 1.0 (fully solid) with falloff near edges
      const newOccupancy = Math.max(current.occupancy, falloff);
      grid.setVoxel(wx, wy, wz, newOccupancy, config.material);
    } else {
      // Subtract: reduce occupancy
      const newOccupancy = Math.max(0, current.occupancy - falloff);
      const mat = newOccupancy > 0 ? current.material : TerrainMaterial.Air;
      grid.setVoxel(wx, wy, wz, newOccupancy, mat);
    }
  }
}
```

### Sculpt Tool

Like Draw but with adjustable strength for gentle editing:

```typescript
function applySculpt(
  grid: VoxelGrid,
  center: Vector3,
  config: BrushConfig,
  mode: 'add' | 'subtract',
): void {
  for (const { wx, wy, wz, falloff } of iterateBrushVoxels(center, config)) {
    const current = grid.getVoxel(wx, wy, wz);
    const delta = falloff * config.strength * 0.1; // strength scales the effect

    if (mode === 'add') {
      const newOccupancy = Math.min(1.0, current.occupancy + delta);
      grid.setVoxel(wx, wy, wz, newOccupancy,
        current.occupancy > 0 ? current.material : config.material);
    } else {
      const newOccupancy = Math.max(0, current.occupancy - delta);
      const mat = newOccupancy > 0 ? current.material : TerrainMaterial.Air;
      grid.setVoxel(wx, wy, wz, newOccupancy, mat);
    }
  }
}
```

### Smooth Tool

Averages neighbor occupancy values to smooth out sharp edges:

```typescript
function applySmooth(
  grid: VoxelGrid,
  center: Vector3,
  config: BrushConfig,
): void {
  // First pass: compute new values (don't modify grid during read)
  const updates: { wx: number; wy: number; wz: number; occ: number }[] = [];

  for (const { wx, wy, wz, falloff } of iterateBrushVoxels(center, config)) {
    const current = grid.getVoxel(wx, wy, wz);
    if (current.occupancy === 0 && current.material === TerrainMaterial.Air) continue;

    // Average of 6 cardinal neighbors
    let sum = 0;
    let count = 0;
    for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
      sum += grid.getVoxel(wx + dx * VOXEL_SIZE, wy + dy * VOXEL_SIZE, wz + dz * VOXEL_SIZE).occupancy;
      count++;
    }
    const avg = sum / count;

    // Blend toward average based on strength and falloff
    const blendFactor = config.strength * falloff;
    const newOcc = current.occupancy * (1 - blendFactor) + avg * blendFactor;
    updates.push({ wx, wy, wz, occ: newOcc });
  }

  // Second pass: apply updates
  for (const { wx, wy, wz, occ } of updates) {
    const current = grid.getVoxel(wx, wy, wz);
    grid.setVoxel(wx, wy, wz, occ, occ > 0 ? current.material : TerrainMaterial.Air);
  }
}
```

### Flatten Tool

Levels terrain to a horizontal plane:

```typescript
type FlattenMode = 'both' | 'erode' | 'grow';

function applyFlatten(
  grid: VoxelGrid,
  center: Vector3,
  config: BrushConfig,
  mode: FlattenMode,
  planeY: number,  // Y level of the flatten plane (from first click or fixed)
): void {
  for (const { wx, wy, wz, falloff } of iterateBrushVoxels(center, config)) {
    const current = grid.getVoxel(wx, wy, wz);
    const delta = falloff * config.strength;

    if (wy > planeY) {
      // Above plane — erode (reduce occupancy)
      if (mode === 'grow') continue; // skip if only growing
      const newOcc = Math.max(0, current.occupancy - delta);
      grid.setVoxel(wx, wy, wz, newOcc, newOcc > 0 ? current.material : TerrainMaterial.Air);
    } else {
      // Below or at plane — grow (increase occupancy)
      if (mode === 'erode') continue; // skip if only eroding
      const newOcc = Math.min(1.0, current.occupancy + delta);
      grid.setVoxel(wx, wy, wz, newOcc,
        current.occupancy > 0 ? current.material : config.material);
    }
  }
}
```

### Paint Tool

Changes material without affecting occupancy:

```typescript
function applyPaint(
  grid: VoxelGrid,
  center: Vector3,
  config: BrushConfig,
  mode: 'paint' | 'replace',
  sourceMaterial?: TerrainMaterial,  // for replace mode
  targetMaterial?: TerrainMaterial,  // for replace mode
): void {
  for (const { wx, wy, wz } of iterateBrushVoxels(center, config)) {
    const current = grid.getVoxel(wx, wy, wz);
    if (current.occupancy === 0) continue; // don't paint air

    if (mode === 'paint') {
      grid.setVoxel(wx, wy, wz, current.occupancy, config.material);
    } else if (mode === 'replace') {
      if (current.material === sourceMaterial) {
        grid.setVoxel(wx, wy, wz, current.occupancy, targetMaterial!);
      }
    }
  }
}
```

---

## Region Tools

### Select Tool

Selects a rectangular region with 3D handles:

```typescript
interface TerrainSelection {
  /** Region bounds in world space */
  min: Vector3;
  max: Vector3;
  /** Stored voxel data (for copy/paste) */
  clipboard?: { grid: VoxelGrid; offset: Vector3 };
}

// Operations on selection
function copyRegion(grid: VoxelGrid, selection: TerrainSelection): void {
  // Read all voxels within bounds into a temporary grid
}

function pasteRegion(grid: VoxelGrid, clipboard: VoxelGrid, position: Vector3): void {
  // Write clipboard voxels at new position
}

function deleteRegion(grid: VoxelGrid, selection: TerrainSelection): void {
  // Set all voxels in region to air
}
```

### Transform Tool

Move/rotate/scale selected terrain regions:

```typescript
function transformRegion(
  grid: VoxelGrid,
  selection: TerrainSelection,
  transform: {
    position: Vector3;
    rotation: Vector3;  // Euler angles
    scale: Vector3;
  },
  mergeEmpty: boolean,
): void {
  // 1. Copy voxels from current selection
  // 2. Clear original region (unless live-edit)
  // 3. For each voxel in the copy:
  //    - Apply inverse transform to find source position
  //    - Sample source voxel
  //    - Write to destination (skip air if mergeEmpty is false)
}
```

### Fill Tool

```typescript
function fillRegion(
  grid: VoxelGrid,
  selection: TerrainSelection,
  mode: 'fill' | 'replace',
  material: TerrainMaterial,
  replaceMaterial?: TerrainMaterial,
): void {
  // Iterate all voxels in region
  for each voxel in selection:
    if mode === 'fill':
      setVoxel(occupancy: 1.0, material)
    if mode === 'replace':
      if current.material === replaceMaterial:
        setVoxel(current.occupancy, material)
}
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Ctrl/Cmd** (held) | Toggle subtract mode (Draw/Sculpt) |
| **Shift** (held) | Temporarily switch to Smooth tool |
| **B** + drag/scroll | Adjust brush base size |
| **Ctrl+B** + drag/scroll | Adjust brush height (box/cylinder) |
| **Shift+B** + drag/scroll | Adjust brush strength |
| **Alt/Option** + click | Material eyedropper (pick material under cursor) |
| **Ctrl+C** | Copy selected region |
| **Ctrl+V** | Paste clipboard |
| **Ctrl+X** | Cut selected region |
| **Ctrl+D** | Duplicate selected region |
| **Delete** | Delete terrain in selected region |
| **Ctrl+Z** | Undo |
| **Ctrl+Shift+Z** | Redo |

---

## Undo/Redo System

Terrain edits are recorded as snapshots of affected chunks:

```typescript
interface TerrainUndoEntry {
  /** Chunks that were modified */
  chunks: Map<string, { before: ChunkData; after: ChunkData }>;
  /** Description for UI */
  label: string;
}

class TerrainUndoStack {
  private undoStack: TerrainUndoEntry[] = [];
  private redoStack: TerrainUndoEntry[] = [];
  private maxEntries = 50;

  /** Call before any edit — snapshots current state of affected chunks */
  beginEdit(label: string, affectedChunkKeys: string[]): void { ... }

  /** Call after edit — snapshots new state, pushes to stack */
  endEdit(): void { ... }

  undo(grid: VoxelGrid): void {
    const entry = this.undoStack.pop();
    if (!entry) return;
    // Restore 'before' state for each chunk
    for (const [key, { before }] of entry.chunks) {
      grid.loadChunkData(key, before);
    }
    this.redoStack.push(entry);
  }

  redo(grid: VoxelGrid): void { /* inverse of undo */ }
}
```

---

## Plane Lock

Brush tools can lock to a visual plane for consistent height editing:

- **Auto mode** — plane tilts with camera angle
- **Manual mode** — fixed plane at specific Y with adjustable normal
- **Off** — brush follows terrain surface

The plane renders as a translucent grid overlay in the viewport.
