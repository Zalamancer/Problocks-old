import type { NavigationGrid } from './nav-grid.js';
import type { PathResult } from './types.js';
import { findPath, heuristics } from './astar.js';

const SQRT2 = 1.4142135623730951;

// ── Binary Min-Heap (duplicated inline to avoid shared mutable state) ──

class BinaryHeap {
  private heap: Int32Array;
  private scores: Float32Array;
  private positions: Int32Array;
  private size = 0;

  constructor(capacity: number, scores: Float32Array) {
    this.heap = new Int32Array(capacity);
    this.scores = scores;
    this.positions = new Int32Array(capacity).fill(-1);
  }

  get length(): number {
    return this.size;
  }

  push(index: number): void {
    this.heap[this.size] = index;
    this.positions[index] = this.size;
    this.size++;
    this.bubbleUp(this.size - 1);
  }

  pop(): number {
    const top = this.heap[0];
    this.positions[top] = -1;
    this.size--;
    if (this.size > 0) {
      this.heap[0] = this.heap[this.size];
      this.positions[this.heap[0]] = 0;
      this.sinkDown(0);
    }
    return top;
  }

  contains(index: number): boolean {
    return this.positions[index] !== -1;
  }

  update(index: number): void {
    const pos = this.positions[index];
    if (pos === -1) return;
    this.bubbleUp(pos);
  }

  private bubbleUp(pos: number): void {
    const heap = this.heap;
    const scores = this.scores;
    const positions = this.positions;
    while (pos > 0) {
      const parentPos = (pos - 1) >> 1;
      if (scores[heap[pos]] >= scores[heap[parentPos]]) break;
      const tmp = heap[pos];
      heap[pos] = heap[parentPos];
      heap[parentPos] = tmp;
      positions[heap[pos]] = pos;
      positions[heap[parentPos]] = parentPos;
      pos = parentPos;
    }
  }

  private sinkDown(pos: number): void {
    const heap = this.heap;
    const scores = this.scores;
    const positions = this.positions;
    const size = this.size;
    while (true) {
      let smallest = pos;
      const left = 2 * pos + 1;
      const right = 2 * pos + 2;
      if (left < size && scores[heap[left]] < scores[heap[smallest]]) smallest = left;
      if (right < size && scores[heap[right]] < scores[heap[smallest]]) smallest = right;
      if (smallest === pos) break;
      const tmp = heap[pos];
      heap[pos] = heap[smallest];
      heap[smallest] = tmp;
      positions[heap[pos]] = pos;
      positions[heap[smallest]] = smallest;
      pos = smallest;
    }
  }
}

// ── Jump Point Search ─────────────────────────────────────────

/**
 * Jump Point Search — optimized A* for uniform-cost grids.
 * Falls back to regular A* if the grid has variable movement costs.
 */
export function findPathJPS(
  grid: NavigationGrid,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options?: {
    maxIterations?: number;
  },
): PathResult {
  const w = grid.getWidth();
  const h = grid.getHeight();

  // Validate input
  if (
    !grid.inBounds(startX, startY) ||
    !grid.inBounds(endX, endY) ||
    !grid.isWalkable(startX, startY) ||
    !grid.isWalkable(endX, endY)
  ) {
    return { path: [], cost: 0, found: false };
  }

  if (startX === endX && startY === endY) {
    return { path: [{ x: startX, y: startY }], cost: 0, found: true };
  }

  // Check for uniform cost. If any walkable cell != 1, fall back to A*.
  if (!isUniformCost(grid)) {
    return findPath(grid, startX, startY, endX, endY, {
      allowDiagonal: true,
      heuristic: heuristics.octile,
      maxIterations: options?.maxIterations,
    });
  }

  const maxIterations = options?.maxIterations ?? 10000;
  const totalCells = w * h;

  const gScore = new Float32Array(totalCells).fill(Infinity);
  const fScore = new Float32Array(totalCells).fill(Infinity);
  const closed = new Uint8Array(totalCells);
  const parentArr = new Int32Array(totalCells).fill(-1);

  const startIdx = startY * w + startX;
  const endIdx = endY * w + endX;

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristics.octile(startX, startY, endX, endY);

  const open = new BinaryHeap(totalCells, fScore);
  open.push(startIdx);

  let iterations = 0;

  while (open.length > 0 && iterations < maxIterations) {
    iterations++;

    const currentIdx = open.pop();
    if (currentIdx === endIdx) {
      return reconstructJPSPath(parentArr, gScore, w, startIdx, endIdx);
    }

    closed[currentIdx] = 1;

    const cx = currentIdx % w;
    const cy = (currentIdx - cx) / w;

    // Get pruned neighbors (jump points)
    const jumpPoints = identifySuccessors(grid, cx, cy, parentArr, w, h, endX, endY);

    for (let i = 0; i < jumpPoints.length; i++) {
      const jp = jumpPoints[i];
      const jpIdx = jp.y * w + jp.x;

      if (closed[jpIdx] === 1) continue;

      const dx = Math.abs(jp.x - cx);
      const dy = Math.abs(jp.y - cy);
      const dist = dx === dy ? dx * SQRT2 : dx + dy; // either all diagonal or all straight
      const tentativeG = gScore[currentIdx] + dist;

      if (tentativeG < gScore[jpIdx]) {
        parentArr[jpIdx] = currentIdx;
        gScore[jpIdx] = tentativeG;
        fScore[jpIdx] = tentativeG + heuristics.octile(jp.x, jp.y, endX, endY);

        if (open.contains(jpIdx)) {
          open.update(jpIdx);
        } else {
          open.push(jpIdx);
        }
      }
    }
  }

  return { path: [], cost: 0, found: false };
}

// ── JPS internals ─────────────────────────────────────────────

function identifySuccessors(
  grid: NavigationGrid,
  cx: number,
  cy: number,
  parentArr: Int32Array,
  w: number,
  h: number,
  endX: number,
  endY: number,
): Array<{ x: number; y: number }> {
  const successors: Array<{ x: number; y: number }> = [];
  const neighbors = prunedNeighbors(grid, cx, cy, parentArr, w);

  for (const n of neighbors) {
    const dx = clamp(n.x - cx, -1, 1);
    const dy = clamp(n.y - cy, -1, 1);
    const jp = jump(grid, cx, cy, dx, dy, w, h, endX, endY);
    if (jp) {
      successors.push(jp);
    }
  }

  return successors;
}

function prunedNeighbors(
  grid: NavigationGrid,
  cx: number,
  cy: number,
  parentArr: Int32Array,
  w: number,
): Array<{ x: number; y: number }> {
  const currentIdx = cy * w + cx;
  const parentIdx = parentArr[currentIdx];

  // Start node: return all walkable neighbors
  if (parentIdx === -1) {
    const all: Array<{ x: number; y: number }> = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (grid.isWalkable(nx, ny)) {
          // For diagonals, check corner cutting
          if (dx !== 0 && dy !== 0) {
            if (grid.isWalkable(cx + dx, cy) || grid.isWalkable(cx, cy + dy)) {
              all.push({ x: nx, y: ny });
            }
          } else {
            all.push({ x: nx, y: ny });
          }
        }
      }
    }
    return all;
  }

  const px = parentIdx % w;
  const py = (parentIdx - px) / w;
  const dx = clamp(cx - px, -1, 1);
  const dy = clamp(cy - py, -1, 1);
  const result: Array<{ x: number; y: number }> = [];

  if (dx !== 0 && dy !== 0) {
    // Diagonal movement — natural neighbors
    if (grid.isWalkable(cx, cy + dy)) result.push({ x: cx, y: cy + dy });
    if (grid.isWalkable(cx + dx, cy)) result.push({ x: cx + dx, y: cy });
    if (grid.isWalkable(cx + dx, cy + dy)) {
      if (grid.isWalkable(cx + dx, cy) || grid.isWalkable(cx, cy + dy)) {
        result.push({ x: cx + dx, y: cy + dy });
      }
    }
    // Forced neighbors
    if (!grid.isWalkable(cx - dx, cy) && grid.isWalkable(cx - dx, cy + dy)) {
      if (grid.isWalkable(cx, cy + dy)) {
        result.push({ x: cx - dx, y: cy + dy });
      }
    }
    if (!grid.isWalkable(cx, cy - dy) && grid.isWalkable(cx + dx, cy - dy)) {
      if (grid.isWalkable(cx + dx, cy)) {
        result.push({ x: cx + dx, y: cy - dy });
      }
    }
  } else if (dx !== 0) {
    // Horizontal movement
    if (grid.isWalkable(cx + dx, cy)) {
      result.push({ x: cx + dx, y: cy });
      // Forced neighbors
      if (!grid.isWalkable(cx, cy + 1) && grid.isWalkable(cx + dx, cy + 1)) {
        result.push({ x: cx + dx, y: cy + 1 });
      }
      if (!grid.isWalkable(cx, cy - 1) && grid.isWalkable(cx + dx, cy - 1)) {
        result.push({ x: cx + dx, y: cy - 1 });
      }
    }
  } else {
    // Vertical movement
    if (grid.isWalkable(cx, cy + dy)) {
      result.push({ x: cx, y: cy + dy });
      // Forced neighbors
      if (!grid.isWalkable(cx + 1, cy) && grid.isWalkable(cx + 1, cy + dy)) {
        result.push({ x: cx + 1, y: cy + dy });
      }
      if (!grid.isWalkable(cx - 1, cy) && grid.isWalkable(cx - 1, cy + dy)) {
        result.push({ x: cx - 1, y: cy + dy });
      }
    }
  }

  return result;
}

function jump(
  grid: NavigationGrid,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  w: number,
  h: number,
  endX: number,
  endY: number,
): { x: number; y: number } | null {
  let nx = cx + dx;
  let ny = cy + dy;

  // Safety limit — prevent infinite jumps on huge grids
  const maxJump = w + h;
  let steps = 0;

  while (steps < maxJump) {
    steps++;

    if (!grid.inBounds(nx, ny) || !grid.isWalkable(nx, ny)) return null;

    // Reached the goal
    if (nx === endX && ny === endY) return { x: nx, y: ny };

    // Diagonal movement
    if (dx !== 0 && dy !== 0) {
      // Check for forced neighbors
      if (
        (grid.inBounds(nx - dx, ny + dy) &&
          !grid.isWalkable(nx - dx, ny) &&
          grid.isWalkable(nx - dx, ny + dy)) ||
        (grid.inBounds(nx + dx, ny - dy) &&
          !grid.isWalkable(nx, ny - dy) &&
          grid.isWalkable(nx + dx, ny - dy))
      ) {
        return { x: nx, y: ny };
      }

      // Recursively jump in horizontal and vertical directions
      if (jump(grid, nx, ny, dx, 0, w, h, endX, endY) !== null) {
        return { x: nx, y: ny };
      }
      if (jump(grid, nx, ny, 0, dy, w, h, endX, endY) !== null) {
        return { x: nx, y: ny };
      }

      // Can only continue diagonally if both cardinal directions are clear
      if (!grid.isWalkable(nx + dx, ny) && !grid.isWalkable(nx, ny + dy)) {
        return null;
      }
    } else {
      // Straight movement — check forced neighbors
      if (dx !== 0) {
        if (
          (grid.inBounds(nx + dx, ny + 1) &&
            !grid.isWalkable(nx, ny + 1) &&
            grid.isWalkable(nx + dx, ny + 1)) ||
          (grid.inBounds(nx + dx, ny - 1) &&
            !grid.isWalkable(nx, ny - 1) &&
            grid.isWalkable(nx + dx, ny - 1))
        ) {
          return { x: nx, y: ny };
        }
      } else {
        if (
          (grid.inBounds(nx + 1, ny + dy) &&
            !grid.isWalkable(nx + 1, ny) &&
            grid.isWalkable(nx + 1, ny + dy)) ||
          (grid.inBounds(nx - 1, ny + dy) &&
            !grid.isWalkable(nx - 1, ny) &&
            grid.isWalkable(nx - 1, ny + dy))
        ) {
          return { x: nx, y: ny };
        }
      }
    }

    nx += dx;
    ny += dy;
  }

  return null;
}

function reconstructJPSPath(
  parentArr: Int32Array,
  gScore: Float32Array,
  w: number,
  startIdx: number,
  endIdx: number,
): PathResult {
  // Collect jump points from end to start
  const jumpPoints: Array<{ x: number; y: number }> = [];
  let idx = endIdx;

  while (idx !== -1) {
    const x = idx % w;
    const y = (idx - x) / w;
    jumpPoints.push({ x, y });
    if (idx === startIdx) break;
    idx = parentArr[idx];
    if (jumpPoints.length > parentArr.length) break;
  }

  jumpPoints.reverse();

  // Interpolate between jump points to produce a full step-by-step path
  const path: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < jumpPoints.length; i++) {
    if (i === 0) {
      path.push(jumpPoints[i]);
      continue;
    }

    const prev = jumpPoints[i - 1];
    const curr = jumpPoints[i];
    const dx = clamp(curr.x - prev.x, -1, 1);
    const dy = clamp(curr.y - prev.y, -1, 1);

    let sx = prev.x + dx;
    let sy = prev.y + dy;

    while (sx !== curr.x || sy !== curr.y) {
      path.push({ x: sx, y: sy });
      sx += dx;
      sy += dy;
    }

    path.push(curr);
  }

  return { path, cost: gScore[endIdx], found: true };
}

// ── Utility ───────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function isUniformCost(grid: NavigationGrid): boolean {
  const w = grid.getWidth();
  const h = grid.getHeight();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid.isWalkable(x, y) && grid.getCost(x, y) !== 1) {
        return false;
      }
    }
  }
  return true;
}
