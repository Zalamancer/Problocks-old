/**
 * Rule-based placement system types.
 *
 * Defines the data structures for the "Dungeon Alchemist"-style
 * automatic room furnishing pipeline.
 */

/** Known room archetypes. */
export type RoomType =
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'tavern'
  | 'library'
  | 'throne-room'
  | 'dungeon-cell'
  | 'armory'
  | 'storage'
  | 'corridor'
  | 'entrance'
  | 'custom';

/** Spatial definition of a room within a dungeon. */
export interface RoomDefinition {
  bounds: { x: number; y: number; width: number; height: number };
  type: RoomType;
  /** Wall tiles on the room perimeter. */
  walls: Array<{ x: number; y: number; side: 'north' | 'south' | 'east' | 'west' }>;
  /** Door locations on the room perimeter. */
  doors: Array<{ x: number; y: number; side: 'north' | 'south' | 'east' | 'west' }>;
  /** Optional floor tile data (2D array). */
  floorTiles?: number[][];
}

/** An asset that can be placed in a room. */
export interface PlaceableObject {
  assetId: string;
  name: string;
  /** Category from AssetCategory. */
  category: string;
  /** Footprint in tile units. */
  size: { width: number; height: number };
  /** Placement constraints. */
  rules: PlacementConstraint[];
  /** Must be placed (e.g. bed in bedroom). */
  required?: boolean;
  /** Maximum instances in a single room. */
  maxCount?: number;
  /** Minimum instances (for required objects). */
  minCount?: number;
  /** Selection probability relative to other candidates. */
  weight?: number;
}

/** Constraint type for rule-based placement. */
export type ConstraintType =
  | 'against-wall'
  | 'center-room'
  | 'min-spacing'
  | 'near-wall'
  | 'away-from-door'
  | 'near'
  | 'avoid'
  | 'facing'
  | 'corner'
  | 'grid-align';

/** A single placement constraint. */
export interface PlacementConstraint {
  type: ConstraintType;
  params?: {
    /** Tile distance for spacing/proximity constraints. */
    distance?: number;
    /** Tag for 'near'/'avoid' constraints (matches other objects). */
    tag?: string;
    /** Direction for 'facing' constraint. */
    direction?: 'north' | 'south' | 'east' | 'west';
    /** Max distance from wall for 'near-wall'. */
    wallDistance?: number;
  };
}

/** A placed object in the room. */
export interface PlacedObject {
  assetId: string;
  x: number;
  y: number;
  /** Rotation in degrees: 0, 90, 180, 270. */
  rotation: number;
  flipped?: boolean;
}

/** Result of furnishing a room. */
export interface FurnishResult {
  placements: PlacedObject[];
  /** Asset names that could not be placed. */
  unplaced: string[];
  /** Quality score 0-1. */
  score: number;
}

/** Template defining how to furnish a particular room type. */
export interface RoomTemplate {
  roomType: RoomType;
  requiredObjects: PlaceableObject[];
  optionalObjects: PlaceableObject[];
  decorations: PlaceableObject[];
  /** Floor tile style name. */
  floorStyle?: string;
  /** Maximum floor fill percentage (default 0.6). */
  maxFillPercent?: number;
}
