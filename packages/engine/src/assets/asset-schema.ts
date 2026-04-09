/**
 * Asset schema — type definitions for the Problocks asset pipeline.
 */

export type AssetCategory =
  | 'floor'
  | 'wall'
  | 'furniture'
  | 'decoration'
  | 'character'
  | 'item'
  | 'effect'
  | 'tileset'
  | 'audio'
  | 'other';

export type AssetPerspective = 'top-down' | 'isometric' | 'side-view' | 'any';

export type AssetSource = 'imported' | 'ai-generated' | 'marketplace' | 'built-in';

export interface CollisionShape {
  type: 'rect' | 'circle' | 'polygon' | 'none';
  /** For rect: width relative to asset size (0-1) */
  width?: number;
  /** For rect: height relative to asset size (0-1) */
  height?: number;
  /** For circle: radius relative to asset size (0-1) */
  radius?: number;
  /** For polygon: array of {x, y} points relative to asset size (0-1) */
  points?: Array<{ x: number; y: number }>;
  /** Offset from anchor */
  offset?: { x: number; y: number };
}

export interface PlacementRule {
  type:
    | 'against-wall'
    | 'center-room'
    | 'min-spacing'
    | 'on-floor'
    | 'near'
    | 'avoid'
    | 'align-grid';
  /** Rule-specific parameters, e.g. { distance: 2 } for min-spacing */
  params?: Record<string, number | string | boolean>;
}

export interface AssetMetadata {
  id: string;
  name: string;
  category: AssetCategory;
  tags: string[];
  /** Art style descriptor: "medieval", "sci-fi", "modern", etc. */
  style: string;
  perspective: AssetPerspective;
  collisionShape: CollisionShape;
  placementRules: PlacementRule[];
  /** Normalized anchor point (0-1) */
  anchor: { x: number; y: number };
  /** Asset dimensions in pixels */
  size: { width: number; height: number };
  /** IDs of variant assets */
  variants?: string[];
  source: AssetSource;
  /** Original AI prompt if ai-generated */
  sourcePrompt?: string;
  /** Creation timestamp (ms since epoch) */
  createdAt: number;
  /** Thumbnail URL for asset browser */
  thumbnailUrl?: string;
}

export interface AssetEntry {
  metadata: AssetMetadata;
  /** Base64 data URL for small assets */
  dataUrl?: string;
  /** Object URL for loaded blobs */
  blobUrl?: string;
  /** Remote URL */
  url?: string;
  /** Whether the asset image data is loaded and ready */
  loaded: boolean;
}
