/**
 * Voxel Terrain System — barrel exports.
 */

// Constants
export { VOXEL_SIZE, CHUNK_SIZE, CHUNK_VOLUME, CHUNK_WORLD_SIZE, MC_THRESHOLD } from './voxel/constants.js';

// Core data types
export { TerrainMaterial, MATERIAL_DEFS, MATERIAL_COUNT, materialNameToEnum, materialEnumToName, TERRAIN_COLOR_PRESETS } from './voxel/terrain-materials.js';
export type { TerrainMaterialDef, ColorOverrideMap, TerrainColorPreset } from './voxel/terrain-materials.js';
export { ChunkData, voxelIndex, indexToCoords } from './voxel/voxel.js';
export type { Voxel } from './voxel/voxel.js';
export { Chunk } from './voxel/chunk.js';
export { VoxelGrid } from './voxel/voxel-grid.js';
export { ChunkManager } from './voxel/chunk-manager.js';

// Meshing
export { marchingCubes } from './meshing/marching-cubes.js';
export type { ChunkMeshData } from './meshing/marching-cubes.js';
export { ChunkMesher } from './meshing/chunk-mesher.js';
export type { ChunkMeshResult } from './meshing/chunk-mesher.js';

// Rendering
export { ChunkRenderer } from './rendering/chunk-renderer.js';
export { GrassRenderer } from './rendering/grass-renderer.js';
export { createTriplanarMaterial } from './rendering/triplanar-material.js';
export { WaterVoxelRenderer, defaultWaterProperties } from './rendering/water-voxel-renderer.js';
export type { WaterProperties } from './rendering/water-voxel-renderer.js';

// Generation
export { BIOMES, getBiomeIds, getBiome } from './generation/biome.js';
export type { BiomeDefinition, BiomeLayer } from './generation/biome.js';
export { computeBiomeMap, BiomeMap } from './generation/biome-blender.js';
export type { BiomeBlendWeight } from './generation/biome-blender.js';
export { CaveGenerator } from './generation/cave-generator.js';
export type { TerrainRegion, CaveBiomeAccessor } from './generation/cave-generator.js';
export { TerrainGenerator } from './generation/terrain-generator.js';
export type { GenerateOptions } from './generation/terrain-generator.js';

// Physics
export { TerrainPhysics, ColliderRebuildQueue } from './physics/terrain-physics.js';
export type { TerrainRaycastHit } from './physics/terrain-physics.js';
export { sampleSubmersion, computeBuoyancyForce, DEFAULT_BUOYANCY_CONFIG } from './physics/voxel-buoyancy.js';
export type { BuoyancyBounds, BuoyancyResult, BuoyancyForce, BuoyancyConfig } from './physics/voxel-buoyancy.js';

// Editor — Brush
export { iterateBrushVoxels, defaultBrushConfig } from './editor/brush.js';
export type { BrushShape, BrushPivot, BrushConfig, BrushVoxel } from './editor/brush.js';

// Editor — Brush Operations
export { applyDraw, applySculpt, applySmooth, applyFlatten, applyPaint } from './editor/brush-operations.js';
export type { FlattenMode } from './editor/brush-operations.js';

// Editor — Undo Stack
export { TerrainUndoStack } from './editor/undo-stack.js';
export type { TerrainUndoEntry } from './editor/undo-stack.js';

// Editor — Brush Controller
export { TerrainBrushController } from './editor/terrain-brush-controller.js';
export type { BrushToolType, BrushControllerConfig } from './editor/terrain-brush-controller.js';

// Rendering — Brush Cursor
export { BrushCursor } from './rendering/brush-cursor.js';
export type { CursorMode } from './rendering/brush-cursor.js';

// Editor — Region Selection (Phase 6)
export { TerrainSelection } from './editor/region-select.js';
export type { Vec3, ClipboardEntry, TerrainClipboard } from './editor/region-select.js';

// Editor — Region Transform (Phase 6)
export { transformRegion, defaultRegionTransform } from './editor/region-transform.js';
export type { RegionTransform } from './editor/region-transform.js';

// Editor — Fill & Replace (Phase 6)
export { fillRegion, replaceInRegion } from './editor/fill-replace.js';

// Editor — Sea Level (Phase 6)
export { createSeaLevel, evaporateWater } from './editor/sea-level.js';

// Heightmap & Colormap Import (Phase 5)
export { loadImage, parseHeightmap, parseColormap, importTerrain } from './generation/heightmap-importer.js';
export type { ImportRegion } from './generation/heightmap-importer.js';

// Scripting API (Phase 8)
export {
  registerTerrainBindings,
  getTerrainNamespaceShim,
  resetFrameBudget,
  fillBall,
  fillBlock,
  fillCylinder,
  fillRegionAPI,
  fillWedge,
  readVoxels,
  writeVoxels,
  getHeight,
  MAX_VOXELS_PER_FILL,
  MAX_VOXELS_PER_FRAME,
  SCRIPT_TIMEOUT_MS,
} from './api/terrain-script-bindings.js';
export type { TerrainAPIState } from './api/terrain-script-bindings.js';

// Legacy noise (still used by generation)
export { generateHeightmap, fbm, setNoiseSeed } from './noise.js';
