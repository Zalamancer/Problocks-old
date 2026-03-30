/**
 * @problocks/engine
 *
 * Problocks simulation engine — 2D/3D rendering, physics, scripting sandbox.
 * Runs in two modes:
 *   - Studio mode: full rendering + editing tools + live preview
 *   - Player mode: rendering + sandbox execution (client or server)
 */

// Core ECS
export { World } from './core/world.js';
export { Scene } from './core/scene.js';
export { Entity } from './core/entity.js';
export { Component } from './core/component.js';

// Renderer abstraction (2D + 3D)
export { Renderer } from './renderer/renderer.js';
export { BabylonRenderer } from './renderer/babylon-renderer.js';

// Physics abstraction (2D + 3D)
export { PhysicsEngine } from './physics/physics-engine.js';
export { RapierPhysics } from './physics/rapier-physics.js';

// Simulation loop (ties renderer + physics + sandbox together)
export { SimulationLoop } from './core/simulation-loop.js';

// Scripting sandbox
export { ScriptRuntime } from './scripting/script-runtime.js';
export { QuickJSRuntime } from './scripting/quickjs-runtime.js';

// Components
export { TransformComponent, MeshComponent, RigidBodyComponent } from './core/component.js';
export { TerrainComponent, WaterComponent, VoxelTerrainComponent } from './core/component.js';
export type { TerrainLayer } from './core/component.js';

// Water simulation
export { WaterSimulation } from './renderer/water-simulation.js';

// Terrain generation (legacy heightmap)
export { generateHeightmap, fbm, setNoiseSeed } from './terrain/noise.js';

// Voxel terrain system
export {
  VoxelGrid, Chunk, ChunkManager, ChunkMesher, ChunkRenderer,
  TerrainMaterial, MATERIAL_DEFS, materialNameToEnum, materialEnumToName,
  VOXEL_SIZE, CHUNK_SIZE, CHUNK_WORLD_SIZE,
  TerrainPhysics, ColliderRebuildQueue,
  // Generation
  TerrainGenerator, BIOMES, getBiomeIds, getBiome,
  // Buoyancy (voxel-accurate)
  sampleSubmersion, computeBuoyancyForce, DEFAULT_BUOYANCY_CONFIG,
  // Editor (Phase 4)
  iterateBrushVoxels, defaultBrushConfig,
  applyDraw, applySculpt, applySmooth, applyFlatten, applyPaint,
  TerrainUndoStack, TerrainBrushController, BrushCursor,
  // Heightmap Import (Phase 5)
  loadImage, parseHeightmap, parseColormap, importTerrain,
} from './terrain/index.js';
export type {
  Voxel, ChunkMeshData, ChunkMeshResult, TerrainRaycastHit,
  // Generation types
  GenerateOptions, TerrainRegion, BiomeDefinition,
  // Buoyancy types
  BuoyancyBounds, BuoyancyResult, BuoyancyForce, BuoyancyConfig,
  // Editor types (Phase 4)
  BrushShape, BrushPivot, BrushConfig, BrushVoxel,
  FlattenMode, TerrainUndoEntry, BrushToolType, BrushControllerConfig, CursorMode,
  // Heightmap Import types (Phase 5)
  ImportRegion,
  // Region editor types (Phase 6)
  Vec3, RegionTransform,
  // Water rendering types (Phase 7)
  WaterProperties,
  // Material color types (Phase 9)
  ColorOverrideMap, TerrainColorPreset,
} from './terrain/index.js';

// Region editor operations (Phase 6)
export {
  TerrainSelection,
  fillRegion, replaceInRegion,
  transformRegion, defaultRegionTransform,
  createSeaLevel, evaporateWater,
} from './terrain/index.js';

// Renderers (Phase 7/9)
export { WaterVoxelRenderer, defaultWaterProperties, GrassRenderer } from './terrain/index.js';

// Material color presets (Phase 9)
export { TERRAIN_COLOR_PRESETS } from './terrain/index.js';
