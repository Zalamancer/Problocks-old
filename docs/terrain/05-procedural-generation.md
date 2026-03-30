# 05 — Procedural Terrain Generation

> Biome-based generation, noise functions, cave systems, and the Generate tool.

## Overview

Roblox's terrain generation places **biomes** in a region, blends them together, and fills voxels with appropriate materials based on height, biome type, and 3D noise. Our system replicates this.

---

## Biome Definitions

Each biome defines its height profile, material layers, and noise characteristics:

```typescript
interface BiomeDefinition {
  id: string;
  name: string;
  /** Height function parameters */
  baseHeight: number;        // base terrain height (0-1 normalized)
  heightVariation: number;   // amplitude of hills/mountains
  noiseScale: number;        // frequency of height variation
  octaves: number;           // noise detail layers
  /** Material assignment by height (normalized 0-1 from bottom to top of terrain) */
  layers: BiomeLayer[];
  /** 3D noise for cave generation */
  caveThreshold: number;     // lower = more caves (0 = no caves)
  /** Weight in blending (higher = larger areas) */
  weight: number;
}

interface BiomeLayer {
  material: TerrainMaterial;
  /** Normalized height range [min, max] */
  range: [number, number];
  /** Optional: 3D noise perturbation to make boundaries organic */
  noiseStrength: number;
}
```

### 9 Biome Presets (Matching Roblox)

```typescript
const BIOMES: Record<string, BiomeDefinition> = {
  arctic: {
    id: 'arctic',
    name: 'Arctic',
    baseHeight: 0.3,
    heightVariation: 0.4,
    noiseScale: 0.02,
    octaves: 5,
    layers: [
      { material: TerrainMaterial.Rock, range: [0, 0.15], noiseStrength: 0.05 },
      { material: TerrainMaterial.Ice, range: [0.12, 0.4], noiseStrength: 0.08 },
      { material: TerrainMaterial.Glacier, range: [0.35, 0.7], noiseStrength: 0.06 },
      { material: TerrainMaterial.Snow, range: [0.65, 1.0], noiseStrength: 0.04 },
    ],
    caveThreshold: 0.0,
    weight: 1.0,
  },

  dunes: {
    id: 'dunes',
    name: 'Dunes',
    baseHeight: 0.25,
    heightVariation: 0.3,
    noiseScale: 0.015,
    octaves: 4,
    layers: [
      { material: TerrainMaterial.Sandstone, range: [0, 0.2], noiseStrength: 0.03 },
      { material: TerrainMaterial.Sand, range: [0.15, 1.0], noiseStrength: 0.02 },
    ],
    caveThreshold: 0.0,
    weight: 1.0,
  },

  canyons: {
    id: 'canyons',
    name: 'Canyons',
    baseHeight: 0.5,
    heightVariation: 0.5,
    noiseScale: 0.025,
    octaves: 6,
    layers: [
      { material: TerrainMaterial.Sand, range: [0, 0.15], noiseStrength: 0.04 },
      { material: TerrainMaterial.Sandstone, range: [0.1, 0.5], noiseStrength: 0.08 },
      { material: TerrainMaterial.Rock, range: [0.45, 0.8], noiseStrength: 0.06 },
      { material: TerrainMaterial.Slate, range: [0.75, 1.0], noiseStrength: 0.04 },
    ],
    caveThreshold: 0.3,
    weight: 1.0,
  },

  lavascape: {
    id: 'lavascape',
    name: 'Lavascape',
    baseHeight: 0.2,
    heightVariation: 0.6,
    noiseScale: 0.03,
    octaves: 5,
    layers: [
      { material: TerrainMaterial.CrackedLava, range: [0, 0.25], noiseStrength: 0.06 },
      { material: TerrainMaterial.Basalt, range: [0.2, 0.6], noiseStrength: 0.08 },
      { material: TerrainMaterial.Rock, range: [0.55, 1.0], noiseStrength: 0.05 },
    ],
    caveThreshold: 0.2,
    weight: 1.0,
  },

  water: {
    id: 'water',
    name: 'Water',
    baseHeight: 0.1,
    heightVariation: 0.05,
    noiseScale: 0.01,
    octaves: 3,
    layers: [
      { material: TerrainMaterial.Sand, range: [0, 0.3], noiseStrength: 0.02 },
      { material: TerrainMaterial.Mud, range: [0.25, 1.0], noiseStrength: 0.03 },
    ],
    caveThreshold: 0.0,
    weight: 1.0,
    // Special: fills above terrain surface with Water material up to sea level
  },

  mountains: {
    id: 'mountains',
    name: 'Mountains',
    baseHeight: 0.5,
    heightVariation: 0.5,
    noiseScale: 0.02,
    octaves: 7,
    layers: [
      { material: TerrainMaterial.Ground, range: [0, 0.15], noiseStrength: 0.04 },
      { material: TerrainMaterial.Grass, range: [0.1, 0.35], noiseStrength: 0.06 },
      { material: TerrainMaterial.Rock, range: [0.3, 0.7], noiseStrength: 0.08 },
      { material: TerrainMaterial.Snow, range: [0.65, 1.0], noiseStrength: 0.04 },
    ],
    caveThreshold: 0.15,
    weight: 1.0,
  },

  hills: {
    id: 'hills',
    name: 'Hills',
    baseHeight: 0.3,
    heightVariation: 0.25,
    noiseScale: 0.025,
    octaves: 5,
    layers: [
      { material: TerrainMaterial.Ground, range: [0, 0.2], noiseStrength: 0.04 },
      { material: TerrainMaterial.Grass, range: [0.15, 0.7], noiseStrength: 0.06 },
      { material: TerrainMaterial.Rock, range: [0.65, 1.0], noiseStrength: 0.05 },
    ],
    caveThreshold: 0.0,
    weight: 1.0,
  },

  plains: {
    id: 'plains',
    name: 'Plains',
    baseHeight: 0.2,
    heightVariation: 0.08,
    noiseScale: 0.02,
    octaves: 4,
    layers: [
      { material: TerrainMaterial.Ground, range: [0, 0.3], noiseStrength: 0.03 },
      { material: TerrainMaterial.Grass, range: [0.25, 1.0], noiseStrength: 0.04 },
    ],
    caveThreshold: 0.0,
    weight: 1.0,
  },

  marsh: {
    id: 'marsh',
    name: 'Marsh',
    baseHeight: 0.15,
    heightVariation: 0.1,
    noiseScale: 0.03,
    octaves: 4,
    layers: [
      { material: TerrainMaterial.Mud, range: [0, 0.4], noiseStrength: 0.05 },
      { material: TerrainMaterial.Ground, range: [0.35, 0.7], noiseStrength: 0.06 },
      { material: TerrainMaterial.LeafyGrass, range: [0.65, 1.0], noiseStrength: 0.04 },
    ],
    caveThreshold: 0.0,
    weight: 1.0,
    // Special: scattered water pools
  },
};
```

---

## Generation Algorithm

### Step 1: Biome Placement (Voronoi + Noise)

Place biomes using Voronoi cells with noise perturbation:

```typescript
function computeBiomeMap(
  region: { minX: number; minZ: number; maxX: number; maxZ: number },
  enabledBiomes: string[],
  seed: number,
  biomeSize: number,
  blending: number,
): BiomeMap {
  // 1. Generate Voronoi seed points within the region
  const rng = createSeededRng(seed);
  const cellSize = biomeSize * VOXEL_SIZE;
  const points: { x: number; z: number; biome: BiomeDefinition }[] = [];

  for (let x = region.minX - cellSize; x <= region.maxX + cellSize; x += cellSize) {
    for (let z = region.minZ - cellSize; z <= region.maxZ + cellSize; z += cellSize) {
      // Jitter the point within its cell
      const jx = x + (rng() - 0.5) * cellSize * 0.8;
      const jz = z + (rng() - 0.5) * cellSize * 0.8;
      // Assign a random biome from the enabled list
      const biome = BIOMES[enabledBiomes[Math.floor(rng() * enabledBiomes.length)]];
      points.push({ x: jx, z: jz, biome });
    }
  }

  // 2. For each position, find nearest Voronoi point
  // Use distance-weighted blending between the N closest points
  return new BiomeMap(points, blending);
}
```

### Step 2: Height Computation

For each (x, z) column in the region:

```typescript
function computeHeight(wx: number, wz: number, biomeMap: BiomeMap, seed: number): number {
  // Get biome blend weights at this position
  const blends = biomeMap.getBlendWeights(wx, wz); // [{biome, weight}, ...]

  let height = 0;
  for (const { biome, weight } of blends) {
    // Each biome has its own noise function
    const biomeNoise = fbm(
      wx * biome.noiseScale + seed * 1000,
      wz * biome.noiseScale + seed * 1000,
      biome.octaves
    );
    const biomeHeight = biome.baseHeight + biomeNoise * biome.heightVariation;
    height += biomeHeight * weight;
  }

  return height; // normalized 0-1
}
```

### Step 3: Voxel Fill

Convert height + biome into voxel data:

```typescript
function fillColumn(
  grid: VoxelGrid,
  wx: number, wz: number,
  regionMinY: number, regionMaxY: number,
  height: number, // normalized 0-1
  biomeMap: BiomeMap,
  seed: number,
): void {
  const regionHeight = regionMaxY - regionMinY;
  const surfaceY = regionMinY + height * regionHeight;

  for (let wy = regionMinY; wy <= regionMaxY; wy += VOXEL_SIZE) {
    const normalizedY = (wy - regionMinY) / regionHeight;

    if (wy > surfaceY + VOXEL_SIZE) {
      // Above surface — air (or water if water biome and below sea level)
      continue;
    }

    // Compute occupancy (smooth surface transition)
    let occupancy: number;
    if (wy < surfaceY - VOXEL_SIZE) {
      occupancy = 1.0; // fully solid
    } else {
      // Gradient at surface for smooth Marching Cubes
      occupancy = Math.max(0, Math.min(1, (surfaceY - wy) / VOXEL_SIZE + 0.5));
    }

    if (occupancy <= 0) continue;

    // Determine material from biome layers
    const blends = biomeMap.getBlendWeights(wx, wz);
    let material = TerrainMaterial.Rock; // fallback
    let bestWeight = 0;

    for (const { biome, weight } of blends) {
      if (weight > bestWeight) {
        bestWeight = weight;
        // Find layer matching this height
        for (const layer of biome.layers) {
          const noise3d = fbm(wx * 0.05, wy * 0.05, 2) * layer.noiseStrength;
          if (normalizedY >= layer.range[0] + noise3d && normalizedY <= layer.range[1] + noise3d) {
            material = layer.material;
          }
        }
      }
    }

    grid.setVoxel(wx, wy, wz, occupancy, material);
  }
}
```

---

## Cave Generation

Caves use **3D Perlin noise worms** — connected tunnels carved through solid terrain:

```typescript
function generateCaves(
  grid: VoxelGrid,
  region: Region3,
  seed: number,
  biomeMap: BiomeMap,
): void {
  const caveNoise1 = createNoise3D(seed + 100);
  const caveNoise2 = createNoise3D(seed + 200);

  for (let wx = region.minX; wx <= region.maxX; wx += VOXEL_SIZE) {
    for (let wy = region.minY; wy <= region.maxY; wy += VOXEL_SIZE) {
      for (let wz = region.minZ; wz <= region.maxZ; wz += VOXEL_SIZE) {
        // Get cave threshold from dominant biome
        const blends = biomeMap.getBlendWeights(wx, wz);
        let caveThreshold = 0;
        for (const { biome, weight } of blends) {
          caveThreshold += biome.caveThreshold * weight;
        }

        if (caveThreshold <= 0) continue;

        // Two noise channels create "swiss cheese" caves
        const scale = 0.02;
        const n1 = caveNoise1(wx * scale, wy * scale, wz * scale);
        const n2 = caveNoise2(wx * scale * 1.5, wy * scale * 1.5, wz * scale * 1.5);

        // Cave exists where both noises are near zero (intersection of two 3D surfaces)
        const caveDensity = Math.abs(n1) + Math.abs(n2);
        if (caveDensity < caveThreshold) {
          // Carve out cave
          grid.setVoxel(wx, wy, wz, 0, TerrainMaterial.Air);
        }
      }
    }
  }
}
```

---

## Generate Tool UI

```
┌──────────────────────────────────┐
│       Terrain Generator          │
├──────────────────────────────────┤
│ Selection Region                 │
│   X: [___] Y: [___] Z: [___]    │
│   Size: [___] x [___] x [___]   │
├──────────────────────────────────┤
│ Biomes                           │
│   [x] Arctic  [x] Mountains     │
│   [ ] Dunes   [x] Hills         │
│   [ ] Canyons [x] Plains        │
│   [ ] Lava    [ ] Marsh         │
│   [ ] Water                      │
├──────────────────────────────────┤
│ Settings                         │
│   Blending:  [====|====] 0.5     │
│   Caves:     [x] Enabled         │
│   Biome Size:[====|====] 100     │
│   Seed:      [42_______] [Rand]  │
├──────────────────────────────────┤
│         [ Generate ]             │
└──────────────────────────────────┘
```

---

## Performance: Web Worker Generation

Generation is CPU-intensive. Run it in a Web Worker to avoid blocking the UI:

```typescript
// Main thread
const worker = new Worker('./terrain-gen-worker.ts');
worker.postMessage({
  type: 'generate',
  region, biomes, seed, options,
});
worker.onmessage = (e) => {
  // Receive serialized chunk data
  const { chunks } = e.data;
  for (const chunkData of chunks) {
    grid.loadChunk(chunkData);
  }
};
```

For very large regions, generate in batches (column-by-column) and stream chunks back to the main thread for progressive display.
