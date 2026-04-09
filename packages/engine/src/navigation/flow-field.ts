import type { NavigationGrid } from './nav-grid.js';
import type { FlowFieldResult } from './types.js';

/**
 * Direction encoding (0-8):
 *   0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW, 8=NONE
 */
const DIR_N = 0;
const DIR_NE = 1;
const DIR_E = 2;
const DIR_SE = 3;
const DIR_S = 4;
const DIR_SW = 5;
const DIR_W = 6;
const DIR_NW = 7;
const DIR_NONE = 8;

/** Direction vectors: dx, dy for each direction code. */
const DIR_DX = [0, 1, 1, 1, 0, -1, -1, -1, 0];
const DIR_DY = [-1, -1, 0, 1, 1, 1, 0, -1, 0];

const SQRT2 = 1.4142135623730951;

/**
 * Generate a flow field from a single target using Dijkstra's algorithm.
 * Every reachable cell stores the direction toward the neighbor with the
 * lowest cost-to-target.
 */
export function generateFlowField(
  grid: NavigationGrid,
  targetX: number,
  targetY: number,
  options?: {
    maxDistance?: number;
  },
): FlowFieldResult {
  const w = grid.getWidth();
  const h = grid.getHeight();
  const totalCells = w * h;
  const maxDistance = options?.maxDistance ?? Infinity;

  // Cost-to-target per cell (Infinity = unreached)
  const costMap = new Float32Array(totalCells).fill(Infinity);
  const field = new Int8Array(totalCells).fill(DIR_NONE);

  if (!grid.inBounds(targetX, targetY) || !grid.isWalkable(targetX, targetY)) {
    return { field, width: w, height: h };
  }

  // BFS with cost (Dijkstra from target outward)
  // Use a simple queue since most costs are uniform-ish.
  // For truly weighted grids a proper priority queue would be better,
  // but for the Chromebook target a typed-array queue is lighter.

  // We use a ring buffer backed by Int32Array for the queue.
  const queueCapacity = totalCells;
  const queue = new Int32Array(queueCapacity);
  let qHead = 0;
  let qTail = 0;

  const enqueue = (idx: number): void => {
    queue[qTail % queueCapacity] = idx;
    qTail++;
  };
  const dequeue = (): number => {
    const idx = queue[qHead % queueCapacity];
    qHead++;
    return idx;
  };
  const isEmpty = (): boolean => qHead >= qTail;

  const targetIdx = targetY * w + targetX;
  costMap[targetIdx] = 0;
  enqueue(targetIdx);

  // Cardinal + diagonal neighbor offsets
  const DX = [0, 1, 1, 1, 0, -1, -1, -1];
  const DY = [-1, -1, 0, 1, 1, 1, 0, -1];
  const DCOST = [1, SQRT2, 1, SQRT2, 1, SQRT2, 1, SQRT2];

  while (!isEmpty()) {
    const idx = dequeue();
    const cx = idx % w;
    const cy = (idx - cx) / w;
    const currentCost = costMap[idx];

    if (currentCost > maxDistance) continue;

    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];

      if (!grid.inBounds(nx, ny) || !grid.isWalkable(nx, ny)) continue;

      // Prevent diagonal corner cutting
      if (d % 2 === 1) {
        // Diagonal
        const c1x = cx + DX[d];
        const c1y = cy;
        const c2x = cx;
        const c2y = cy + DY[d];
        if (!grid.isWalkable(c1x, c1y) && !grid.isWalkable(c2x, c2y)) continue;
      }

      const nIdx = ny * w + nx;
      const moveCost = DCOST[d] * grid.getCost(nx, ny);
      const newCost = currentCost + moveCost;

      if (newCost < costMap[nIdx]) {
        costMap[nIdx] = newCost;
        enqueue(nIdx);
      }
    }
  }

  // Build the direction field: for each cell, pick the neighbor with the
  // lowest cost-to-target and store the direction toward it.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (costMap[idx] === Infinity) continue;
      if (x === targetX && y === targetY) {
        field[idx] = DIR_NONE; // already at target
        continue;
      }

      let bestCost = Infinity;
      let bestDir = DIR_NONE;

      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (!grid.inBounds(nx, ny)) continue;
        const nIdx = ny * w + nx;
        if (costMap[nIdx] < bestCost) {
          bestCost = costMap[nIdx];
          bestDir = d;
        }
      }

      field[idx] = bestDir;
    }
  }

  return { field, width: w, height: h };
}

/**
 * Read the flow direction for a cell as a unit-ish vector.
 * Returns {dx: 0, dy: 0} for DIR_NONE or out-of-bounds.
 */
export function getFlowDirection(
  field: FlowFieldResult,
  x: number,
  y: number,
): { dx: number; dy: number } {
  if (x < 0 || x >= field.width || y < 0 || y >= field.height) {
    return { dx: 0, dy: 0 };
  }
  const dir = field.field[y * field.width + x];
  return { dx: DIR_DX[dir], dy: DIR_DY[dir] };
}
