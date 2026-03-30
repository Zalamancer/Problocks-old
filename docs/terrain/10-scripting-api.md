# 10 — Scripting API

> Student-facing terrain API for QuickJS scripts, matching Roblox's Terrain class.

## Overview

Problocks runs student code in a **QuickJS sandbox**. The terrain API is exposed through the `pb.terrain` namespace, matching Roblox's `Workspace.Terrain` API patterns.

---

## API Surface

### Fill Methods

```typescript
// Fill a sphere with terrain material
pb.terrain.fillBall(center: {x, y, z}, radius: number, material: string): void

// Fill a box (axis-aligned) with terrain material
pb.terrain.fillBlock(position: {x, y, z}, size: {x, y, z}, material: string): void

// Fill a cylinder with terrain material
pb.terrain.fillCylinder(position: {x, y, z}, height: number, radius: number, material: string): void

// Fill a rectangular region with terrain material
pb.terrain.fillRegion(
  min: {x, y, z},
  max: {x, y, z},
  material: string
): void

// Fill a wedge shape with terrain material
pb.terrain.fillWedge(position: {x, y, z}, size: {x, y, z}, material: string): void
```

### Read/Write Voxels (Advanced)

```typescript
// Read voxel data in a region
pb.terrain.readVoxels(
  min: {x, y, z},
  max: {x, y, z}
): { materials: string[][][], occupancy: number[][][] }

// Write voxel data to a region
pb.terrain.writeVoxels(
  min: {x, y, z},
  max: {x, y, z},
  materials: string[][][],
  occupancy: number[][][]
): void
```

### Utility Methods

```typescript
// Clear all terrain
pb.terrain.clear(): void

// Get the height of terrain at a world X/Z position (raycast down)
pb.terrain.getHeight(x: number, z: number): number

// Get the material at a world position
pb.terrain.getMaterial(x: number, y: number, z: number): string

// Set a single voxel
pb.terrain.setVoxel(x: number, y: number, z: number, occupancy: number, material: string): void
```

### Water Properties

```typescript
pb.terrain.waterColor = {r: 12, g: 84, b: 92}
pb.terrain.waterReflectance = 0.5      // 0-1
pb.terrain.waterTransparency = 0.5     // 0-1
pb.terrain.waterWaveSize = 0.5         // 0-1
pb.terrain.waterWaveSpeed = 50         // 0-100
```

### Grass Properties

```typescript
pb.terrain.decoration = true            // enable/disable animated grass
pb.terrain.grassLength = 0.5            // 0.1-1.0
```

### Material Colors (Override Default Colors)

```typescript
pb.terrain.setMaterialColor("Grass", {r: 50, g: 200, b: 50})
pb.terrain.getMaterialColor("Grass") // → {r: 50, g: 200, b: 50}
pb.terrain.resetMaterialColor("Grass") // → restore default
```

---

## Material Names (String Constants)

Students use string names (not numeric IDs) for readability:

```typescript
// Valid material names for the scripting API
type MaterialName =
  | 'Air' | 'Grass' | 'Sand' | 'Rock' | 'Snow'
  | 'Water' | 'Mud' | 'Ground' | 'Ice' | 'Sandstone'
  | 'Slate' | 'Concrete' | 'Limestone' | 'Basalt'
  | 'Brick' | 'Cobblestone' | 'Asphalt' | 'Pavement'
  | 'Salt' | 'CrackedLava' | 'Glacier' | 'LeafyGrass'
  | 'WoodPlanks';
```

---

## Implementation: QuickJS Bindings

The terrain API is registered in the QuickJS runtime alongside the existing `pb` namespace:

```typescript
// In terrain-script-bindings.ts
function registerTerrainBindings(runtime: QuickJSRuntime, grid: VoxelGrid): void {
  const terrainObj = runtime.newObject();

  // fillBall(center, radius, material)
  runtime.setProp(terrainObj, 'fillBall', runtime.newFunction('fillBall', (centerHandle, radiusHandle, materialHandle) => {
    const center = runtime.dump(centerHandle);
    const radius = runtime.getNumber(radiusHandle);
    const materialName = runtime.getString(materialHandle);
    const material = materialNameToEnum(materialName);

    // Iterate voxels within sphere
    for (let wx = center.x - radius; wx <= center.x + radius; wx += VOXEL_SIZE) {
      for (let wy = center.y - radius; wy <= center.y + radius; wy += VOXEL_SIZE) {
        for (let wz = center.z - radius; wz <= center.z + radius; wz += VOXEL_SIZE) {
          const dx = wx - center.x;
          const dy = wy - center.y;
          const dz = wz - center.z;
          if (dx*dx + dy*dy + dz*dz <= radius * radius) {
            grid.setVoxel(wx, wy, wz, 1.0, material);
          }
        }
      }
    }
  }));

  // fillBlock(position, size, material)
  runtime.setProp(terrainObj, 'fillBlock', runtime.newFunction('fillBlock', (posHandle, sizeHandle, matHandle) => {
    const pos = runtime.dump(posHandle);
    const size = runtime.dump(sizeHandle);
    const material = materialNameToEnum(runtime.getString(matHandle));

    const halfX = size.x / 2, halfY = size.y / 2, halfZ = size.z / 2;
    for (let wx = pos.x - halfX; wx <= pos.x + halfX; wx += VOXEL_SIZE) {
      for (let wy = pos.y - halfY; wy <= pos.y + halfY; wy += VOXEL_SIZE) {
        for (let wz = pos.z - halfZ; wz <= pos.z + halfZ; wz += VOXEL_SIZE) {
          grid.setVoxel(wx, wy, wz, 1.0, material);
        }
      }
    }
  }));

  // clear()
  runtime.setProp(terrainObj, 'clear', runtime.newFunction('clear', () => {
    grid.clearAll();
  }));

  // getHeight(x, z) — raycast down from max height
  runtime.setProp(terrainObj, 'getHeight', runtime.newFunction('getHeight', (xHandle, zHandle) => {
    const x = runtime.getNumber(xHandle);
    const z = runtime.getNumber(zHandle);
    // Scan down from max Y to find first solid voxel
    for (let y = 1000; y >= -1000; y -= VOXEL_SIZE) {
      if (grid.getVoxel(x, y, z).occupancy > 0.5) {
        return runtime.newNumber(y);
      }
    }
    return runtime.newNumber(0);
  }));

  // Register on pb namespace
  runtime.setProp(pbObj, 'terrain', terrainObj);
}
```

---

## Example Student Scripts

### Create a Mountain

```javascript
// Procedural mountain using stacked spheres
for (let y = 0; y < 100; y += 8) {
  const radius = 60 - y * 0.5; // gets narrower at top
  if (radius > 0) {
    pb.terrain.fillBall({x: 0, y: y, z: 0}, radius, 'Rock');
  }
}
// Snow cap
pb.terrain.fillBall({x: 0, y: 80, z: 0}, 25, 'Snow');
```

### Create a Lake

```javascript
// Dig a hole
pb.terrain.fillBall({x: 50, y: -5, z: 50}, 30, 'Air');
// Fill with water
pb.terrain.fillBall({x: 50, y: -10, z: 50}, 28, 'Water');
// Sand beach
pb.terrain.fillBall({x: 50, y: -2, z: 50}, 35, 'Sand');
```

### Terrain Deformation on Impact

```javascript
// When a ball hits the ground, crater the terrain
pb.onCollision('ball1', (event) => {
  if (event.otherType === 'terrain') {
    const pos = event.position;
    const speed = Math.abs(event.velocity.y);
    const craterRadius = Math.min(speed * 0.5, 20);
    pb.terrain.fillBall(pos, craterRadius, 'Air');
  }
});
```

### Maze Generator

```javascript
// Generate a simple maze from terrain walls
const mazeSize = 10;
const wallHeight = 12;
const cellSize = 16;

for (let row = 0; row < mazeSize; row++) {
  for (let col = 0; col < mazeSize; col++) {
    // Random walls on right and bottom edges
    if (Math.random() > 0.5 && col < mazeSize - 1) {
      // Right wall
      pb.terrain.fillBlock(
        {x: col * cellSize + cellSize, y: wallHeight/2, z: row * cellSize + cellSize/2},
        {x: 4, y: wallHeight, z: cellSize},
        'Brick'
      );
    }
    if (Math.random() > 0.5 && row < mazeSize - 1) {
      // Bottom wall
      pb.terrain.fillBlock(
        {x: col * cellSize + cellSize/2, y: wallHeight/2, z: row * cellSize + cellSize},
        {x: cellSize, y: wallHeight, z: 4},
        'Brick'
      );
    }
  }
}
```

---

## Safety Limits

To prevent scripts from freezing the browser:

```typescript
const SCRIPTING_LIMITS = {
  /** Max voxels a single fill operation can modify */
  maxVoxelsPerOperation: 100_000,
  /** Max total voxel writes per frame */
  maxVoxelsPerFrame: 500_000,
  /** Timeout for script execution (ms) */
  scriptTimeout: 5000,
};
```

If a `fillBall` call would affect more than 100,000 voxels, it throws an error with a helpful message suggesting smaller operations or breaking the work across multiple frames.
