# 08 — Water System

> Voxel water, sea level tool, water rendering, and buoyancy integration.

## Water as a Voxel Material

In Roblox, water is a terrain material — it fills voxel cells just like Rock or Grass. This is fundamentally different from our current separate `WaterComponent` plane.

### Key Differences from Current System

| Current System | Voxel Water System |
|---|---|
| Single water plane at fixed Y | Water fills individual voxels at any position |
| Separate `WaterComponent` | Water is `TerrainMaterial.Water` in the voxel grid |
| Uniform wave simulation | Per-cell water with varied surface levels |
| One water level for entire world | Different water levels in different regions |
| Can't have water in caves | Water can fill any enclosed space |

### Migration Strategy

Keep the existing `WaterComponent` and water simulation as an **optional visual enhancement** layer. The voxel water defines where water exists; the wave shader makes it look good.

---

## Voxel Water Behavior

### Storage
Water voxels use `TerrainMaterial.Water` with `occupancy` controlling the water level within each cell:
- `occupancy = 1.0` → cell fully filled with water
- `occupancy = 0.5` → water surface passes through the middle of the cell
- `occupancy = 0.0` → no water

### Water Rendering

Water voxels are extracted separately from solid terrain during Marching Cubes. They get their own mesh with a transparent water material:

```typescript
function meshChunk(chunk: Chunk): { solidMesh: MeshData; waterMesh: MeshData } {
  const solidVertices: number[] = [];
  const waterVertices: number[] = [];

  for each voxel in chunk:
    if voxel.material === TerrainMaterial.Water:
      // Add to water mesh (Marching Cubes with water occupancy)
      marchingCubesForWater(waterVertices, ...);
    else if voxel.occupancy > 0:
      // Add to solid mesh
      marchingCubes(solidVertices, ...);

  return { solidMesh, waterMesh };
}
```

### Water Material Properties

```typescript
interface WaterProperties {
  /** Overall water tint */
  color: Color3;        // default: (0.047, 0.329, 0.361) — #0C545C
  /** How much water reflects the environment (0–1) */
  reflectance: number;  // default: 0.5
  /** How transparent the water is (0–1) */
  transparency: number; // default: 0.5
  /** Size of surface waves (0–1) */
  waveSize: number;     // default: 0.5
  /** Speed of wave animation (0–100) */
  waveSpeed: number;    // default: 50
}
```

---

## Sea Level Tool

The Sea Level tool creates or removes water within a selected region.

### Create Sea Level

```typescript
function createSeaLevel(
  grid: VoxelGrid,
  region: { min: Vector3; max: Vector3 },
  waterLevel: number, // Y coordinate of the water surface
): void {
  for (let wx = region.min.x; wx <= region.max.x; wx += VOXEL_SIZE) {
    for (let wz = region.min.z; wz <= region.max.z; wz += VOXEL_SIZE) {
      for (let wy = region.min.y; wy <= Math.min(waterLevel, region.max.y); wy += VOXEL_SIZE) {
        const currentVoxel = grid.getVoxel(wx, wy, wz);

        // Only fill empty cells with water (don't overwrite solid terrain)
        if (currentVoxel.occupancy === 0 || currentVoxel.material === TerrainMaterial.Air) {
          // Calculate water occupancy at surface level
          let occupancy: number;
          if (wy + VOXEL_SIZE <= waterLevel) {
            occupancy = 1.0; // fully submerged
          } else if (wy >= waterLevel) {
            continue; // above water level
          } else {
            // Partial fill at surface
            occupancy = (waterLevel - wy) / VOXEL_SIZE;
          }

          grid.setVoxel(wx, wy, wz, occupancy, TerrainMaterial.Water);
        }
      }
    }
  }
}
```

### Evaporate (Remove Water)

```typescript
function evaporateWater(
  grid: VoxelGrid,
  region: { min: Vector3; max: Vector3 },
): void {
  for (let wx = region.min.x; wx <= region.max.x; wx += VOXEL_SIZE) {
    for (let wy = region.min.y; wy <= region.max.y; wy += VOXEL_SIZE) {
      for (let wz = region.min.z; wz <= region.max.z; wz += VOXEL_SIZE) {
        const voxel = grid.getVoxel(wx, wy, wz);
        if (voxel.material === TerrainMaterial.Water) {
          grid.setVoxel(wx, wy, wz, 0, TerrainMaterial.Air);
        }
      }
    }
  }
}
```

---

## Water Shader

The water mesh uses a custom `ShaderMaterial` with:

```glsl
// Vertex Shader
uniform float uTime;
uniform float uWaveSize;
uniform float uWaveSpeed;

void main() {
  vec3 pos = position;

  // Animated wave displacement
  float wave1 = sin(pos.x * 0.5 + uTime * uWaveSpeed * 0.01) * uWaveSize * 0.5;
  float wave2 = cos(pos.z * 0.3 + uTime * uWaveSpeed * 0.015) * uWaveSize * 0.3;
  pos.y += wave1 + wave2;

  gl_Position = viewProjection * world * vec4(pos, 1.0);
  vWorldPos = (world * vec4(pos, 1.0)).xyz;
  vNormal = normalize(normalMatrix * normal);
}

// Fragment Shader
uniform vec3 uWaterColor;
uniform float uReflectance;
uniform float uTransparency;
uniform samplerCube uEnvironmentMap;

void main() {
  // Fresnel effect — more reflective at glancing angles
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

  // Environment reflection
  vec3 reflectDir = reflect(-viewDir, vNormal);
  vec3 envColor = textureCube(uEnvironmentMap, reflectDir).rgb;

  // Blend water color with reflection
  vec3 color = mix(uWaterColor, envColor, fresnel * uReflectance);

  gl_FragColor = vec4(color, 1.0 - uTransparency * (1.0 - fresnel));
}
```

---

## Buoyancy Integration

Objects interacting with voxel water use the grid to determine submersion:

```typescript
function computeBuoyancy(
  grid: VoxelGrid,
  entityPosition: Vector3,
  entityBounds: { min: Vector3; max: Vector3 },
): { force: Vector3; submergedFraction: number } {
  let totalSamples = 0;
  let submergedSamples = 0;

  // Sample voxels around the entity's bounding box
  for (let x = entityBounds.min.x; x <= entityBounds.max.x; x += VOXEL_SIZE) {
    for (let y = entityBounds.min.y; y <= entityBounds.max.y; y += VOXEL_SIZE) {
      for (let z = entityBounds.min.z; z <= entityBounds.max.z; z += VOXEL_SIZE) {
        totalSamples++;
        const voxel = grid.getVoxel(x, y, z);
        if (voxel.material === TerrainMaterial.Water && voxel.occupancy > 0.3) {
          submergedSamples++;
        }
      }
    }
  }

  const submergedFraction = submergedSamples / Math.max(1, totalSamples);

  return {
    force: new Vector3(0, submergedFraction * 9.81 * entityMass, 0), // buoyancy = pgV
    submergedFraction,
  };
}
```

---

## Sea Level Tool UI

```
┌──────────────────────────────────┐
│        Sea Level Tool            │
├──────────────────────────────────┤
│ Region                           │
│   Position: X[0] Y[0] Z[0]      │
│   Size:     X[200] Y[50] Z[200] │
├──────────────────────────────────┤
│ Water Level                      │
│   Y: [10.0] (studs)             │
├──────────────────────────────────┤
│  [ Create ]    [ Evaporate ]     │
└──────────────────────────────────┘
```
