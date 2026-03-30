# 04 — Terrain Materials

> Material definitions, texture rendering, and blending system.

## Material Enum

```typescript
enum TerrainMaterial {
  Air = 0,
  Grass = 1,
  Sand = 2,
  Rock = 3,
  Snow = 4,
  Water = 5,
  Mud = 6,
  Ground = 7,
  Ice = 8,
  Sandstone = 9,
  Slate = 10,
  Concrete = 11,
  Limestone = 12,
  Basalt = 13,
  Brick = 14,
  Cobblestone = 15,
  Asphalt = 16,
  Pavement = 17,
  Salt = 18,
  CrackedLava = 19,
  Glacier = 20,
  LeafyGrass = 21,
  WoodPlanks = 22,
}
```

---

## Material Definitions

Each material has visual and physical properties:

```typescript
interface TerrainMaterialDef {
  id: TerrainMaterial;
  name: string;
  /** Default RGB color (used for vertex coloring and colormap matching) */
  color: [number, number, number];
  /** Hex string for UI */
  hex: string;
  /** Physical properties */
  friction: number;
  restitution: number;
  /** Visual flags */
  isTransparent: boolean;
  isEmissive: boolean;
  isAnimated: boolean;
  /** Triplanar texture scale (world units per texture repeat) */
  textureScale: number;
}

const MATERIAL_DEFS: Record<TerrainMaterial, TerrainMaterialDef> = {
  [TerrainMaterial.Air]: {
    id: TerrainMaterial.Air,
    name: 'Air',
    color: [255, 255, 255],
    hex: '#FFFFFF',
    friction: 0, restitution: 0,
    isTransparent: true, isEmissive: false, isAnimated: false,
    textureScale: 1,
  },
  [TerrainMaterial.Grass]: {
    id: TerrainMaterial.Grass,
    name: 'Grass',
    color: [106, 127, 63],
    hex: '#6A7F3F',
    friction: 0.6, restitution: 0.1,
    isTransparent: false, isEmissive: false, isAnimated: true,
    textureScale: 4,
  },
  [TerrainMaterial.Sand]: {
    id: TerrainMaterial.Sand,
    name: 'Sand',
    color: [143, 126, 95],
    hex: '#8F7E5F',
    friction: 0.4, restitution: 0.05,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 4,
  },
  [TerrainMaterial.Rock]: {
    id: TerrainMaterial.Rock,
    name: 'Rock',
    color: [102, 108, 111],
    hex: '#666C6F',
    friction: 0.7, restitution: 0.2,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 8,
  },
  [TerrainMaterial.Snow]: {
    id: TerrainMaterial.Snow,
    name: 'Snow',
    color: [195, 199, 218],
    hex: '#C3C7DA',
    friction: 0.3, restitution: 0.05,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 4,
  },
  [TerrainMaterial.Water]: {
    id: TerrainMaterial.Water,
    name: 'Water',
    color: [12, 84, 92],
    hex: '#0C545C',
    friction: 0.0, restitution: 0.0,
    isTransparent: true, isEmissive: false, isAnimated: true,
    textureScale: 8,
  },
  [TerrainMaterial.Mud]: {
    id: TerrainMaterial.Mud,
    name: 'Mud',
    color: [58, 46, 36],
    hex: '#3A2E24',
    friction: 0.3, restitution: 0.0,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 4,
  },
  [TerrainMaterial.Ground]: {
    id: TerrainMaterial.Ground,
    name: 'Ground',
    color: [102, 92, 59],
    hex: '#665C3B',
    friction: 0.5, restitution: 0.1,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 4,
  },
  [TerrainMaterial.Ice]: {
    id: TerrainMaterial.Ice,
    name: 'Ice',
    color: [129, 194, 224],
    hex: '#81C2E0',
    friction: 0.05, restitution: 0.3,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 4,
  },
  [TerrainMaterial.Sandstone]: {
    id: TerrainMaterial.Sandstone,
    name: 'Sandstone',
    color: [137, 90, 71],
    hex: '#895A47',
    friction: 0.6, restitution: 0.15,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 8,
  },
  [TerrainMaterial.Slate]: {
    id: TerrainMaterial.Slate,
    name: 'Slate',
    color: [63, 127, 107],
    hex: '#3F7F6B',
    friction: 0.6, restitution: 0.2,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 8,
  },
  [TerrainMaterial.Concrete]: {
    id: TerrainMaterial.Concrete,
    name: 'Concrete',
    color: [127, 102, 63],
    hex: '#7F663F',
    friction: 0.7, restitution: 0.15,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 4,
  },
  [TerrainMaterial.Limestone]: {
    id: TerrainMaterial.Limestone,
    name: 'Limestone',
    color: [206, 173, 148],
    hex: '#CEAD94',
    friction: 0.6, restitution: 0.15,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 8,
  },
  [TerrainMaterial.Basalt]: {
    id: TerrainMaterial.Basalt,
    name: 'Basalt',
    color: [30, 30, 37],
    hex: '#1E1E25',
    friction: 0.7, restitution: 0.2,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 8,
  },
  [TerrainMaterial.Brick]: {
    id: TerrainMaterial.Brick,
    name: 'Brick',
    color: [138, 86, 62],
    hex: '#8A563E',
    friction: 0.6, restitution: 0.15,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 4,
  },
  [TerrainMaterial.Cobblestone]: {
    id: TerrainMaterial.Cobblestone,
    name: 'Cobblestone',
    color: [132, 123, 90],
    hex: '#847B5A',
    friction: 0.7, restitution: 0.2,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 4,
  },
  [TerrainMaterial.Asphalt]: {
    id: TerrainMaterial.Asphalt,
    name: 'Asphalt',
    color: [115, 123, 107],
    hex: '#737B6B',
    friction: 0.8, restitution: 0.1,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 4,
  },
  [TerrainMaterial.Pavement]: {
    id: TerrainMaterial.Pavement,
    name: 'Pavement',
    color: [148, 148, 140],
    hex: '#94948C',
    friction: 0.7, restitution: 0.1,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 4,
  },
  [TerrainMaterial.Salt]: {
    id: TerrainMaterial.Salt,
    name: 'Salt',
    color: [198, 189, 181],
    hex: '#C6BDB5',
    friction: 0.5, restitution: 0.1,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 4,
  },
  [TerrainMaterial.CrackedLava]: {
    id: TerrainMaterial.CrackedLava,
    name: 'Cracked Lava',
    color: [232, 156, 74],
    hex: '#E89C4A',
    friction: 0.8, restitution: 0.05,
    isTransparent: false, isEmissive: true, isAnimated: false,
    textureScale: 4,
  },
  [TerrainMaterial.Glacier]: {
    id: TerrainMaterial.Glacier,
    name: 'Glacier',
    color: [101, 176, 234],
    hex: '#65B0EA',
    friction: 0.1, restitution: 0.3,
    isTransparent: true, isEmissive: false, isAnimated: false,
    textureScale: 8,
  },
  [TerrainMaterial.LeafyGrass]: {
    id: TerrainMaterial.LeafyGrass,
    name: 'Leafy Grass',
    color: [115, 132, 74],
    hex: '#73844A',
    friction: 0.5, restitution: 0.1,
    isTransparent: false, isEmissive: false, isAnimated: true,
    textureScale: 4,
  },
  [TerrainMaterial.WoodPlanks]: {
    id: TerrainMaterial.WoodPlanks,
    name: 'Wood Planks',
    color: [139, 109, 79],
    hex: '#8B6D4F',
    friction: 0.5, restitution: 0.15,
    isTransparent: false, isEmissive: false, isAnimated: false,
    textureScale: 4,
  },
};
```

---

## Rendering Approach

### Phase 1: Vertex Colors (Quick Start)
Start with vertex colors like the current system — each vertex gets the RGB of its dominant material. No textures needed.

```typescript
// During Marching Cubes mesh generation, assign vertex colors
function getVertexColor(voxelA: Voxel, voxelB: Voxel, t: number): Color3 {
  const matA = MATERIAL_DEFS[voxelA.material];
  const matB = MATERIAL_DEFS[voxelB.material];
  // Lerp between material colors based on interpolation factor
  return Color3.Lerp(
    new Color3(matA.color[0]/255, matA.color[1]/255, matA.color[2]/255),
    new Color3(matB.color[0]/255, matB.color[1]/255, matB.color[2]/255),
    t
  );
}
```

### Phase 2: Triplanar Texturing (Production Quality)
For production quality, use **triplanar projection** — project textures from X, Y, Z axes and blend based on surface normal. This avoids UV stretching on steep surfaces.

```glsl
// Fragment shader — triplanar projection
vec3 triplanarSample(sampler2D tex, vec3 worldPos, vec3 normal, float scale) {
  vec3 blending = abs(normal);
  blending = normalize(max(blending, 0.00001));
  float b = blending.x + blending.y + blending.z;
  blending /= b;

  vec3 xaxis = texture(tex, worldPos.yz / scale).rgb;
  vec3 yaxis = texture(tex, worldPos.xz / scale).rgb;
  vec3 zaxis = texture(tex, worldPos.xy / scale).rgb;

  return xaxis * blending.x + yaxis * blending.y + zaxis * blending.z;
}
```

### Phase 3: Texture Array + Splatmap
Pack all material textures into a `Texture2DArray` and use material IDs stored per-vertex to index into the array. This allows a single draw call per chunk with unlimited material variety.

```glsl
// Per-vertex attributes
attribute float aMaterialA;
attribute float aMaterialB;
attribute float aBlendFactor;

// In fragment shader
vec3 colorA = triplanarSample(materialArray, worldPos, normal, aMaterialA);
vec3 colorB = triplanarSample(materialArray, worldPos, normal, aMaterialB);
vec3 finalColor = mix(colorA, colorB, aBlendFactor);
```

---

## Custom Material Colors

Like Roblox, allow users to override any material's default color:

```typescript
interface TerrainConfig {
  materialColorOverrides: Partial<Record<TerrainMaterial, [number, number, number]>>;
}

// Usage: terrain.setMaterialColor(TerrainMaterial.Grass, [50, 200, 50]);
// This changes ALL grass in the world to the new color
```

---

## Material Picker UI

The material picker shows a 4-column grid of material swatches, matching Roblox's layout:

```
┌──────────────────────────────────┐
│         Material Picker          │
├────────┬────────┬────────┬───────┤
│Asphalt │Basalt  │Brick   │Cobble │
│        │        │        │stone  │
├────────┼────────┼────────┼───────┤
│Concrete│Cracked │Glacier │Grass  │
│        │Lava    │        │       │
├────────┼────────┼────────┼───────┤
│Ground  │Ice     │Leafy   │Lime-  │
│        │        │Grass   │stone  │
├────────┼────────┼────────┼───────┤
│Mud     │Pavement│Rock    │Salt   │
├────────┼────────┼────────┼───────┤
│Sand    │Sand-   │Slate   │Snow   │
│        │stone   │        │       │
├────────┼────────┼────────┼───────┤
│Water   │Wood    │Air     │       │
│        │Planks  │        │       │
└────────┴────────┴────────┴───────┘
```

Each swatch shows a small preview (solid color for Phase 1, texture thumbnail for Phase 2+). The currently selected material is highlighted with a border.
