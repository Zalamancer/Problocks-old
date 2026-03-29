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
  // Editor (Phase 4)
  iterateBrushVoxels, defaultBrushConfig,
  applyDraw, applySculpt, applySmooth, applyFlatten, applyPaint,
  TerrainUndoStack, TerrainBrushController, BrushCursor,
} from './terrain/index.js';
export type {
  Voxel, ChunkMeshData, ChunkMeshResult, TerrainRaycastHit,
  // Editor types (Phase 4)
  BrushShape, BrushPivot, BrushConfig, BrushVoxel,
  FlattenMode, TerrainUndoEntry, BrushToolType, BrushControllerConfig, CursorMode,
} from './terrain/index.js';
