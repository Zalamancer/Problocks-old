/**
 * Assets module — asset management, AI generation, style system, and sprite sheets.
 */

// Schema types
export type {
  AssetCategory,
  AssetPerspective,
  AssetSource,
  CollisionShape,
  PlacementRule,
  AssetMetadata,
  AssetEntry,
} from './asset-schema.js';

// Asset manager
export { AssetManager } from './asset-manager.js';
export type { AssetManagerEvent } from './asset-manager.js';

// AI generation
export { AIGenerator } from './ai-generator.js';
export type {
  GenerationConfig,
  GenerationRequest,
  GenerationResult,
} from './ai-generator.js';

// Style system
export { StyleSystem } from './style-system.js';
export type { StyleConfig } from './style-system.js';

// Sprite sheet utilities
export { sliceGrid, parseJSONAtlas, createPixiSpriteSheet } from './sprite-sheet.js';
export type {
  SpriteSheetConfig,
  JSONAtlas,
  JSONAtlasFrame,
} from './sprite-sheet.js';
