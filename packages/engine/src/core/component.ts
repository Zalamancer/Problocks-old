/**
 * Base component class for the ECS architecture.
 * Components are pure data containers attached to entities.
 */
export abstract class Component {
  abstract readonly type: string;
}

/**
 * Transform component — position, rotation, scale.
 */
export class TransformComponent extends Component {
  readonly type = 'transform';
  position = { x: 0, y: 0, z: 0 };
  rotation = { x: 0, y: 0, z: 0 };
  scale = { x: 1, y: 1, z: 1 };
}

/**
 * Mesh component — visual representation.
 */
export class MeshComponent extends Component {
  readonly type = 'mesh';
  shape: 'box' | 'sphere' | 'cylinder' | 'plane' | 'custom' = 'box';
  color = '#ffffff';
  dimensions = { width: 1, height: 1, depth: 1 };
}

/**
 * RigidBody component — physics simulation.
 */
export class RigidBodyComponent extends Component {
  readonly type = 'rigidbody';
  mass = 1.0;
  isStatic = false;
  velocity = { x: 0, y: 0, z: 0 };
  angularVelocity = { x: 0, y: 0, z: 0 };
  friction = 0.5;
  restitution = 0.3;
}

/**
 * Terrain component — heightmap-based terrain with splatmap texturing.
 */
export class TerrainComponent extends Component {
  readonly type = 'terrain';
  /** World-space width (X axis) */
  width = 100;
  /** World-space depth (Z axis) */
  depth = 100;
  /** Subdivisions per axis for the mesh */
  subdivisions = 128;
  /** Maximum height of the terrain */
  maxHeight = 10;
  /** Procedural generation seed */
  seed = 42;
  /** Noise scale — smaller = broader hills */
  noiseScale = 0.03;
  /** Number of noise octaves */
  octaves = 6;
  /** Texture layers: below thresholds blend by height */
  layers: TerrainLayer[] = [
    { name: 'sand', tint: '#c2b280', heightRange: [0, 0.25] },
    { name: 'grass', tint: '#4a7c3f', heightRange: [0.2, 0.6] },
    { name: 'rock', tint: '#7a7a7a', heightRange: [0.55, 0.85] },
    { name: 'snow', tint: '#f0f0f0', heightRange: [0.8, 1.0] },
  ];
}

export interface TerrainLayer {
  name: string;
  tint: string;
  /** Normalized height range [min, max] where 0 = bottom, 1 = top */
  heightRange: [number, number];
}

/**
 * Voxel terrain component — chunk-based voxel grid with Marching Cubes meshing.
 * Replaces the heightmap-based TerrainComponent when useVoxelTerrain is enabled.
 */
export class VoxelTerrainComponent extends Component {
  readonly type = 'voxel-terrain';
  /** Whether the voxel terrain system is active */
  enabled = false;

  // ── Generation region (world units) ────────────────────────
  /** Minimum X bound of the generated region */
  minX = -128;
  /** Maximum X bound of the generated region */
  maxX = 128;
  /** Minimum Y bound (bottom of terrain) */
  minY = -32;
  /** Maximum Y bound (top of terrain) */
  maxY = 64;
  /** Minimum Z bound of the generated region */
  minZ = -128;
  /** Maximum Z bound of the generated region */
  maxZ = 128;

  // ── Generation parameters ──────────────────────────────────
  /** Biome IDs to blend (from BIOMES registry) */
  biomes: string[] = ['grassland', 'desert'];
  /** Random seed for procedural generation */
  seed = 42;
  /** World-unit spacing between biome Voronoi cells */
  biomeSize = 120;
  /** Biome transition smoothness 0–1 */
  blending = 0.3;
  /** Whether to carve procedural caves */
  caves = true;
}
