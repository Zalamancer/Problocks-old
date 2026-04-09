import type { NavigationGrid } from './nav-grid.js';
import type { Heuristic, PathResult } from './types.js';

// ── Heuristics ────────────────────────────────────────────────

const SQRT2 = 1.4142135623730951;

export const heuristics = {
  manhattan: ((ax, ay, bx, by) =>
    Math.abs(ax - bx) + Math.abs(ay - by)) as Heuristic,

  euclidean: ((ax, ay, bx, by) =>
    Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)) as Heuristic,

  octile: ((ax, ay, bx, by) => {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
  }) as Heuristic,

  chebyshev: ((ax, ay, bx, by) =>
    Math.max(Math.abs(ax - bx), Math.abs(ay - by))) as Heuristic,
};

// ── Binary Min-Heap ───────────────────────────────────────────

class BinaryHeap {
  private heap: Int32Array; // packed node indices
  private scores: Float32Array; // f-scores for each node
  private positions: Int32Array; // node index → position in heap (-1 if absent)
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
    this.sinkDown(pos);
  }

  private bubbleUp(pos: number): void {
    const heap = this.heap;
    const scores = this.scores;
    const positions = this.positions;
    while (pos > 0) {
      const parent = (pos - 1) >> 1;
      if (scores[heap[pos]] >= scores[heap[parent]]) break;
      // Swap
      const tmp = heap[pos];
      heap[pos] = heap[parent];
      heap[parent] = tmp;
      positions[heap[pos]] = pos;
      positions[heap[parent]] = parent;
      pos = parent;
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
      if (left < size && scores[heap[left]] < scores[heap[smallest]]) {
        smallest = left;
      }
      if (right < size && scores[heap[right]] < scores[heap[smallest]]) {
        smallest = right;
      }
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

// ── A* pathfinding ────────────────────────────────────────────

export function findPath(
  grid: NavigationGrid,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options?: {
    allowDiagonal?: boolean;
    heuristic?: Heuristic;
    maxIterations?: number;
    maxPathLength?: number;
  },
): PathResult {
  const w = grid.getWidth();
  const h = grid.getHeight();
  const totalCells = w * h;

  // Validate input
  if (
    !grid.inBounds(startX, startY) ||
    !grid.inBounds(endX, endY) ||
    !grid.isWalkable(startX, startY) ||
    !grid.isWalkable(endX, endY)
  ) {
    return { path: [], cost: 0, found: false };
  }

  // Already at the target
  if (startX === endX && startY === endY) {
    return { path: [{ x: startX, y: startY }], cost: 0, found: true };
  }

  const allowDiagonal = options?.allowDiagonal ?? true;
  const heuristic = options?.heuristic ?? heuristics.octile;
  const maxIterations = options?.maxIterations ?? 10000;

  // Typed arrays for O(1) access
  const gScore = new Float32Array(totalCells).fill(Infinity);
  const fScore = new Float32Array(totalCells).fill(Infinity);
  const closed = new Uint8Array(totalCells); // 0 = open, 1 = closed
  const parent = new Int32Array(totalCells).fill(-1);

  const startIdx = startY * w + startX;
  const endIdx = endY * w + endX;

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(startX, startY, endX, endY);

  const open = new BinaryHeap(totalCells, fScore);
  open.push(startIdx);

  let iterations = 0;

  while (open.length > 0 && iterations < maxIterations) {
    iterations++;
    const currentIdx = open.pop();

    if (currentIdx === endIdx) {
      // Reconstruct path
      return reconstructPath(parent, w, startIdx, endIdx, gScore[endIdx], options?.maxPathLength);
    }

    closed[currentIdx] = 1;

    const cx = currentIdx % w;
    const cy = (currentIdx - cx) / w;

    const neighbors = grid.getNeighbors(cx, cy, allowDiagonal);

    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i];
      const nIdx = n.y * w + n.x;

      if (closed[nIdx] === 1) continue;

      const tentativeG = gScore[currentIdx] + n.cost;

      if (tentativeG < gScore[nIdx]) {
        parent[nIdx] = currentIdx;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + heuristic(n.x, n.y, endX, endY);

        if (open.contains(nIdx)) {
          open.update(nIdx);
        } else {
          open.push(nIdx);
        }
      }
    }
  }

  // No path found
  return { path: [], cost: 0, found: false };
}

function reconstructPath(
  parent: Int32Array,
  width: number,
  startIdx: number,
  endIdx: number,
  totalCost: number,
  maxPathLength?: number,
): PathResult {
  const path: Array<{ x: number; y: number }> = [];
  let idx = endIdx;

  while (idx !== -1) {
    const x = idx % width;
    const y = (idx - x) / width;
    path.push({ x, y });

    if (idx === startIdx) break;
    idx = parent[idx];

    // Safety: prevent infinite loops if parent chain is broken
    if (path.length > parent.length) break;
  }

  path.reverse();

  // Enforce max path length
  if (maxPathLength !== undefined && path.length > maxPathLength) {
    return { path: [], cost: 0, found: false };
  }

  return { path, cost: totalCost, found: true };
}
