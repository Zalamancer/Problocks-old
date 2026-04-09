/**
 * Navigation / pathfinding types.
 */

export interface PathNode {
  x: number;
  y: number;
  walkable: boolean;
  cost: number;
}

export interface NavGrid {
  width: number;
  height: number;
  nodes: PathNode[][];
}

export interface PathResult {
  path: Array<{ x: number; y: number }>;
  cost: number;
  found: boolean;
}

export interface FlowFieldResult {
  field: Int8Array;
  width: number;
  height: number;
}

export type Heuristic = (ax: number, ay: number, bx: number, by: number) => number;
