/**
 * Procedural generation types for the Problocks engine.
 */

/** A room within a generated dungeon layout. */
export interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
  id: number;
  /** Room purpose: "bedroom", "kitchen", "corridor", etc. */
  type?: string;
  /** IDs of rooms connected via corridors. */
  connections: number[];
}

/** Corridor connecting two rooms. */
export interface Corridor {
  from: number;
  to: number;
  path: Array<{ x: number; y: number }>;
}

/** Result of dungeon generation. */
export interface DungeonResult {
  rooms: Room[];
  corridors: Corridor[];
  /** 2D tile array: 0=wall, 1=floor, 2=corridor, 3=door */
  tileMap: number[][];
  width: number;
  height: number;
}

/** Tile definition for Wave Function Collapse. */
export interface WFCTile {
  id: number;
  /** Edge labels: [top, right, bottom, left] */
  edges: [string, string, string, string];
  /** Relative frequency weight (default 1). */
  weight?: number;
  /** Rotation in degrees: 0, 90, 180, 270 */
  rotation?: number;
}

/** Result of WFC solving. */
export interface WFCResult {
  /** 2D grid of tile IDs. */
  grid: number[][];
  width: number;
  height: number;
  /** Whether the solve completed without contradiction. */
  solved: boolean;
}

/** A point from Poisson disk sampling. */
export interface PoissonPoint {
  x: number;
  y: number;
}

/** Configuration for fractal noise generation. */
export interface NoiseConfig {
  seed?: number;
  octaves?: number;
  frequency?: number;
  lacunarity?: number;
  persistence?: number;
}

/** L-System production rule. */
export interface LSystemRule {
  predecessor: string;
  successor: string;
  /** Probability of this rule firing (0-1, default 1). */
  probability?: number;
}

/** Configuration for L-System generation. */
export interface LSystemConfig {
  /** Starting string. */
  axiom: string;
  /** Production rules. */
  rules: LSystemRule[];
  /** Number of rewriting iterations. */
  iterations: number;
  /** Turn angle in degrees. */
  angle: number;
  /** Distance per F step in pixels. */
  stepLength: number;
  /** Random seed for stochastic rules. */
  seed?: number;
}

/** Result of L-System generation. */
export interface LSystemResult {
  /** All visited points. */
  points: Array<{ x: number; y: number }>;
  /** All line segments drawn by the turtle. */
  segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  /** The final rewritten string. */
  string: string;
}
