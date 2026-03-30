# 07 — Heightmap & Colormap Import

> Importing terrain from images — heightmaps for elevation, colormaps for materials.

## Overview

Like Roblox, Problocks supports importing terrain from image files:
- **Heightmap**: grayscale image where pixel brightness = terrain height
- **Colormap**: colored image where pixel color = terrain material

---

## Heightmap Specification

| Property | Value |
|----------|-------|
| Format | PNG or JPG |
| Max resolution | 4096 x 4096 pixels |
| Color space | Grayscale (0 = lowest, 255 = highest) |
| Scale | 1 pixel = 1 voxel = 4 world units |
| Height range | Mapped to selection region Y size |

### Height Calculation

```
For a selection region with Y size = H, centered at Y = cy:
  minY = cy - H/2
  maxY = cy + H/2

For pixel brightness b (0-255):
  normalizedHeight = b / 255
  worldY = minY + normalizedHeight * H
```

Black pixels (0) = lowest point in the region.
White pixels (255) = highest point in the region.
Gray (128) = middle of the region.

---

## Colormap Specification

Each pixel's color maps to a terrain material using the color key table. The colormap must have the **same dimensions** as the heightmap.

### Color Key Table

| Material | RGB | Hex |
|----------|-----|-----|
| Air | 255, 255, 255 | #FFFFFF |
| Asphalt | 115, 123, 107 | #737B6B |
| Basalt | 30, 30, 37 | #1E1E25 |
| Brick | 138, 86, 62 | #8A563E |
| Cobblestone | 132, 123, 90 | #847B5A |
| Concrete | 127, 102, 63 | #7F663F |
| Cracked Lava | 232, 156, 74 | #E89C4A |
| Glacier | 101, 176, 234 | #65B0EA |
| Grass | 106, 127, 63 | #6A7F3F |
| Ground | 102, 92, 59 | #665C3B |
| Ice | 129, 194, 224 | #81C2E0 |
| Leafy Grass | 115, 132, 74 | #73844A |
| Limestone | 206, 173, 148 | #CEAD94 |
| Mud | 58, 46, 36 | #3A2E24 |
| Pavement | 148, 148, 140 | #94948C |
| Rock | 102, 108, 111 | #666C6F |
| Salt | 198, 189, 181 | #C6BDB5 |
| Sand | 143, 126, 95 | #8F7E5F |
| Sandstone | 137, 90, 71 | #895A47 |
| Slate | 63, 127, 107 | #3F7F6B |
| Snow | 195, 199, 218 | #C3C7DA |
| Water | 12, 84, 92 | #0C545C |
| Wood Planks | 139, 109, 79 | #8B6D4F |

**Important**: Colormaps should use **hard edges** (no anti-aliasing). Smooth color transitions between regions produce invalid intermediate colors that match the wrong material.

---

## Implementation

### Step 1: Load Image to Canvas

```typescript
async function loadImage(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}
```

### Step 2: Parse Heightmap

```typescript
function parseHeightmap(
  imageData: ImageData,
  region: { minX: number; minY: number; minZ: number; sizeX: number; sizeY: number; sizeZ: number },
): Float32Array {
  const { width, height, data } = imageData;
  const heightmap = new Float32Array(width * height);

  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (z * width + x) * 4;
      // Use luminance (grayscale) — average of RGB
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      const brightness = (r + g + b) / 3 / 255; // 0-1

      heightmap[z * width + x] = region.minY + brightness * region.sizeY;
    }
  }

  return heightmap;
}
```

### Step 3: Parse Colormap (Nearest Material Match)

```typescript
function parseColormap(imageData: ImageData): Uint8Array {
  const { width, height, data } = imageData;
  const materialMap = new Uint8Array(width * height);

  // Build lookup from material defs
  const materialColors = Object.values(MATERIAL_DEFS).map(m => ({
    id: m.id,
    r: m.color[0], g: m.color[1], b: m.color[2],
  }));

  for (let i = 0; i < width * height; i++) {
    const pr = data[i * 4];
    const pg = data[i * 4 + 1];
    const pb = data[i * 4 + 2];

    // Find nearest material by Euclidean distance in RGB space
    let bestDist = Infinity;
    let bestMaterial = TerrainMaterial.Grass;

    for (const mc of materialColors) {
      const dr = pr - mc.r;
      const dg = pg - mc.g;
      const db = pb - mc.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestMaterial = mc.id;
      }
    }

    materialMap[i] = bestMaterial;
  }

  return materialMap;
}
```

### Step 4: Fill Voxel Grid

```typescript
function importTerrain(
  grid: VoxelGrid,
  heightmap: Float32Array,
  materialMap: Uint8Array | null,
  imageWidth: number,
  imageHeight: number,
  region: { minX: number; minY: number; minZ: number; sizeX: number; sizeY: number; sizeZ: number },
  defaultMaterial: TerrainMaterial,
): void {
  for (let iz = 0; iz < imageHeight; iz++) {
    for (let ix = 0; ix < imageWidth; ix++) {
      // Map pixel to world coords
      const wx = region.minX + (ix / imageWidth) * region.sizeX;
      const wz = region.minZ + (iz / imageHeight) * region.sizeZ;
      const surfaceY = heightmap[iz * imageWidth + ix];

      // Material from colormap or default
      const material = materialMap
        ? materialMap[iz * imageWidth + ix]
        : defaultMaterial;

      // Fill voxels from bottom of region up to surface height
      for (let wy = region.minY; wy <= surfaceY; wy += VOXEL_SIZE) {
        // Smooth surface at the top
        let occupancy: number;
        if (wy < surfaceY - VOXEL_SIZE) {
          occupancy = 1.0;
        } else {
          occupancy = Math.max(0, Math.min(1, (surfaceY - wy) / VOXEL_SIZE + 0.5));
        }
        grid.setVoxel(wx, wy, wz, occupancy, material);
      }
    }
  }
}
```

---

## Import Tool UI

```
┌──────────────────────────────────┐
│        Import Terrain            │
├──────────────────────────────────┤
│ Heightmap                        │
│   ┌────────────────────────┐     │
│   │   Drop image here      │     │
│   │   or click to browse   │     │
│   └────────────────────────┘     │
│   mountain-heightmap.png ✓       │
├──────────────────────────────────┤
│ Material Source                   │
│   (•) Single Material            │
│       [ Grass        ▼ ]        │
│   ( ) Colormap                   │
│       [Drop colormap...]        │
├──────────────────────────────────┤
│ Selection Region                 │
│   Position: X[0] Y[0] Z[0]      │
│   Size:     X[512] Y[128] Z[512]│
├──────────────────────────────────┤
│ Preview                          │
│   ┌────────────────────────┐     │
│   │ [heightmap thumbnail]  │     │
│   │  1024x1024 → 4096x4096│     │
│   └────────────────────────┘     │
├──────────────────────────────────┤
│         [ Generate ]             │
└──────────────────────────────────┘
```

---

## Downloadable Color Index

Provide a `ProBlocksColorMapIndex.png` file that users can download — a reference image showing all material colors as labeled swatches, ready to sample in their image editor. This matches Roblox's `RobloxColorMapIndex` file.
