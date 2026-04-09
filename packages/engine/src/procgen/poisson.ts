/**
 * Poisson Disk Sampling — Bridson's algorithm.
 *
 * Generates a set of points with guaranteed minimum distance,
 * producing natural-looking distributions for trees, rocks, etc.
 *
 * Algorithm:
 *  1. Create a background grid with cell size = minDistance / sqrt(2).
 *  2. Insert a random initial point.
 *  3. For each active point, generate candidate points at
 *     distance [minDistance, 2*minDistance].
 *  4. Accept candidates that are far enough from existing points
 *     (checked via background grid for O(1) lookups).
 *  5. When an active point produces no valid candidates, retire it.
 */

import type { PoissonPoint } from './types.js';
import { createRNG, randomFloat } from './noise.js';

export interface PoissonOptions {
  seed?: number;
  /** Candidates per active point before retiring (default 30). */
  maxAttempts?: number;
  /** Rectangular exclusion zones where no points are placed. */
  bounds?: Array<{ x: number; y: number; width: number; height: number }>;
}

export function poissonDisk(
  width: number,
  height: number,
  minDistance: number,
  options?: PoissonOptions,
): PoissonPoint[] {
  const seed = options?.seed ?? Date.now();
  const maxAttempts = options?.maxAttempts ?? 30;
  const exclusions = options?.bounds ?? [];
  const rng = createRNG(seed);

  // Background grid for spatial hashing
  const cellSize = minDistance / Math.SQRT2;
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(height / cellSize);

  // Grid stores index into points array (-1 = empty)
  const grid: Int32Array = new Int32Array(gridW * gridH).fill(-1);

  const points: PoissonPoint[] = [];
  const active: number[] = []; // indices into points

  /** Convert world position to grid cell index. */
  function toGrid(x: number, y: number): number {
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    return gy * gridW + gx;
  }

  /** Check if a point is inside any exclusion zone. */
  function inExclusion(x: number, y: number): boolean {
    for (let i = 0; i < exclusions.length; i++) {
      const b = exclusions[i];
      if (x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height) {
        return true;
      }
    }
    return false;
  }

  /** Check if candidate is valid (far enough from all nearby points). */
  function isValid(x: number, y: number): boolean {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    if (inExclusion(x, y)) return false;

    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);

    // Check 5x5 neighborhood in the grid
    const searchRadius = 2;
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const nx = gx + dx;
        const ny = gy + dy;
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;

        const idx = grid[ny * gridW + nx];
        if (idx === -1) continue;

        const p = points[idx];
        const distSq = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (distSq < minDistance * minDistance) {
          return false;
        }
      }
    }

    return true;
  }

  /** Insert a point into the output and grid. */
  function insertPoint(x: number, y: number): number {
    const idx = points.length;
    points.push({ x, y });
    grid[toGrid(x, y)] = idx;
    active.push(idx);
    return idx;
  }

  // Start with a random initial point
  let startX: number;
  let startY: number;
  let attempts = 0;
  do {
    startX = randomFloat(rng, 0, width);
    startY = randomFloat(rng, 0, height);
    attempts++;
  } while (inExclusion(startX, startY) && attempts < 1000);

  if (attempts >= 1000) return points; // entire area is excluded

  insertPoint(startX, startY);

  // Main loop: process active list
  while (active.length > 0) {
    // Pick a random active point
    const activeIdx = Math.floor(rng() * active.length);
    const pointIdx = active[activeIdx];
    const origin = points[pointIdx];

    let found = false;

    for (let k = 0; k < maxAttempts; k++) {
      // Generate candidate at random angle and distance [minDistance, 2*minDistance]
      const angle = rng() * Math.PI * 2;
      const dist = minDistance + rng() * minDistance;
      const cx = origin.x + Math.cos(angle) * dist;
      const cy = origin.y + Math.sin(angle) * dist;

      if (isValid(cx, cy)) {
        insertPoint(cx, cy);
        found = true;
      }
    }

    if (!found) {
      // Remove from active list (swap with last for O(1) removal)
      active[activeIdx] = active[active.length - 1];
      active.pop();
    }
  }

  return points;
}
