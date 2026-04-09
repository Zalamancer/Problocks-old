/**
 * Wave Function Collapse (WFC) tile solver.
 *
 * Given a set of tiles with labeled edges and a grid size,
 * fills the grid such that adjacent tiles have matching edge labels.
 *
 * Algorithm:
 *  1. Each cell starts with all tiles as possibilities (superposition).
 *  2. Pick the cell with minimum entropy (fewest options).
 *  3. Collapse it to a single tile (weighted random).
 *  4. Propagate constraints to neighbors — remove incompatible tiles.
 *  5. Repeat until solved or contradiction.
 *  6. On contradiction, retry up to maxAttempts.
 */

import type { WFCTile, WFCResult } from './types.js';
import { createRNG } from './noise.js';

// ── Direction helpers ────────────────────────────────────────────

/** Direction indices: 0=top, 1=right, 2=bottom, 3=left */
const OPPOSITE: readonly number[] = [2, 3, 0, 1];
const DX: readonly number[] = [0, 1, 0, -1];
const DY: readonly number[] = [-1, 0, 1, 0];

// ── Options ─────────────────────────────────────────────────────

export interface WFCOptions {
  seed?: number;
  maxAttempts?: number;
  maxIterations?: number;
}

// ── Solver ──────────────────────────────────────────────────────

export function solveWFC(
  tiles: WFCTile[],
  width: number,
  height: number,
  options?: WFCOptions,
): WFCResult {
  const seed = options?.seed ?? Date.now();
  const maxAttempts = options?.maxAttempts ?? 10;
  const maxIterations = options?.maxIterations ?? width * height * 10;

  // Precompute adjacency: for each direction, for each tile, which tile IDs can neighbor it
  const tileCount = tiles.length;
  const tileById = new Map<number, WFCTile>();
  const tileIndex = new Map<number, number>(); // tile.id → index in tiles array

  for (let i = 0; i < tileCount; i++) {
    tileById.set(tiles[i].id, tiles[i]);
    tileIndex.set(tiles[i].id, i);
  }

  // Precompute: compatible[direction][tileIndex] = set of compatible tile indices
  const compatible: Set<number>[][] = [];
  for (let dir = 0; dir < 4; dir++) {
    compatible[dir] = [];
    for (let i = 0; i < tileCount; i++) {
      compatible[dir][i] = new Set<number>();
      const myEdge = tiles[i].edges[dir];
      const oppDir = OPPOSITE[dir];
      for (let j = 0; j < tileCount; j++) {
        if (tiles[j].edges[oppDir] === myEdge) {
          compatible[dir][i].add(j);
        }
      }
    }
  }

  // Precompute weights
  const weights = tiles.map(t => t.weight ?? 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // ── Attempt loop ────────────────────────────────────────────

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = createRNG(seed + attempt * 7919);

    // Initialize wave: each cell has all tiles as possible
    // Represent as array of boolean arrays (cell × tileIndex)
    const wave: boolean[][] = [];
    const possibleCount: number[] = []; // number of remaining possibilities per cell
    const entropyNoise: number[] = []; // small random noise for tie-breaking

    for (let i = 0; i < width * height; i++) {
      wave[i] = new Array(tileCount).fill(true);
      possibleCount[i] = tileCount;
      entropyNoise[i] = rng() * 0.001;
    }

    let collapsed = 0;
    let contradiction = false;

    // ── Helper: compute Shannon entropy for a cell ──────────
    function entropy(cellIdx: number): number {
      if (possibleCount[cellIdx] <= 1) return 0;

      let sumW = 0;
      let sumWLogW = 0;
      for (let t = 0; t < tileCount; t++) {
        if (wave[cellIdx][t]) {
          const w = weights[t];
          sumW += w;
          sumWLogW += w * Math.log(w);
        }
      }

      if (sumW <= 0) return 0;
      return Math.log(sumW) - sumWLogW / sumW;
    }

    // ── Helper: ban a tile from a cell ──────────────────────
    function ban(cellIdx: number, tileIdx: number): void {
      if (!wave[cellIdx][tileIdx]) return;
      wave[cellIdx][tileIdx] = false;
      possibleCount[cellIdx]--;
    }

    // ── Propagation ─────────────────────────────────────────
    function propagate(startCell: number): boolean {
      const stack = [startCell];
      const visited = new Set<number>();

      while (stack.length > 0) {
        const cell = stack.pop()!;
        if (visited.has(cell)) continue;
        visited.add(cell);

        const cx = cell % width;
        const cy = Math.floor(cell / width);

        for (let dir = 0; dir < 4; dir++) {
          const nx = cx + DX[dir];
          const ny = cy + DY[dir];

          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const neighborIdx = ny * width + nx;
          if (possibleCount[neighborIdx] <= 1) continue;

          // For each still-possible tile in the neighbor,
          // check if at least one tile in the current cell is compatible
          let changed = false;
          for (let nt = 0; nt < tileCount; nt++) {
            if (!wave[neighborIdx][nt]) continue;

            // nt must be compatible with at least one tile in current cell
            let hasCompatible = false;
            const oppDir = OPPOSITE[dir];
            for (let ct = 0; ct < tileCount; ct++) {
              if (!wave[cell][ct]) continue;
              if (compatible[dir][ct].has(nt)) {
                hasCompatible = true;
                break;
              }
            }

            if (!hasCompatible) {
              ban(neighborIdx, nt);
              changed = true;

              if (possibleCount[neighborIdx] === 0) {
                return false; // Contradiction
              }
            }
          }

          if (changed) {
            stack.push(neighborIdx);
          }
        }
      }

      return true;
    }

    // ── Main WFC loop ───────────────────────────────────────
    for (let iter = 0; iter < maxIterations; iter++) {
      // Find the uncollapsed cell with minimum entropy
      let minEntropy = Infinity;
      let minCell = -1;

      for (let i = 0; i < width * height; i++) {
        if (possibleCount[i] <= 1) continue;

        const e = entropy(i) + entropyNoise[i];
        if (e < minEntropy) {
          minEntropy = e;
          minCell = i;
        }
      }

      if (minCell === -1) {
        // All cells collapsed
        break;
      }

      // Collapse: pick a tile weighted by frequency
      const cell = wave[minCell];
      let sumW = 0;
      for (let t = 0; t < tileCount; t++) {
        if (cell[t]) sumW += weights[t];
      }

      let pick = rng() * sumW;
      let chosenIdx = -1;
      for (let t = 0; t < tileCount; t++) {
        if (!cell[t]) continue;
        pick -= weights[t];
        if (pick <= 0) {
          chosenIdx = t;
          break;
        }
      }

      // Fallback: pick last valid
      if (chosenIdx === -1) {
        for (let t = tileCount - 1; t >= 0; t--) {
          if (cell[t]) { chosenIdx = t; break; }
        }
      }

      if (chosenIdx === -1) {
        contradiction = true;
        break;
      }

      // Ban all other tiles
      for (let t = 0; t < tileCount; t++) {
        if (t !== chosenIdx && cell[t]) {
          ban(minCell, t);
        }
      }

      collapsed++;

      // Propagate constraints
      if (!propagate(minCell)) {
        contradiction = true;
        break;
      }
    }

    if (contradiction) continue;

    // Check full solve
    let fullySolved = true;
    for (let i = 0; i < width * height; i++) {
      if (possibleCount[i] !== 1) {
        fullySolved = false;
        break;
      }
    }

    // Build result grid
    const grid: number[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        const cellIdx = y * width + x;
        let tileId = -1;
        for (let t = 0; t < tileCount; t++) {
          if (wave[cellIdx][t]) {
            tileId = tiles[t].id;
            break;
          }
        }
        grid[y][x] = tileId;
      }
    }

    return { grid, width, height, solved: fullySolved };
  }

  // All attempts failed — return empty unsolved grid
  const grid: number[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = new Array(width).fill(-1);
  }
  return { grid, width, height, solved: false };
}
