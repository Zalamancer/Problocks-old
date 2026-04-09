import type { NavGrid, PathNode } from './types.js';

/**
 * Grid data structure for 2D navigation / pathfinding.
 * Stores walkability and movement cost per cell.
 * Nodes are stored as [y][x] for cache-friendly row access.
 */
export class NavigationGrid {
  private grid: NavGrid;

  constructor(width: number, height: number) {
    const nodes: PathNode[][] = new Array(height);
    for (let y = 0; y < height; y++) {
      nodes[y] = new Array(width);
      for (let x = 0; x < width; x++) {
        nodes[y][x] = { x, y, walkable: true, cost: 1 };
      }
    }
    this.grid = { width, height, nodes };
  }

  // ── Single-cell operations ────────────────────────────────

  setWalkable(x: number, y: number, walkable: boolean): void {
    if (!this.inBounds(x, y)) return;
    this.grid.nodes[y][x].walkable = walkable;
  }

  isWalkable(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return this.grid.nodes[y][x].walkable;
  }

  setCost(x: number, y: number, cost: number): void {
    if (!this.inBounds(x, y)) return;
    this.grid.nodes[y][x].cost = cost;
  }

  getCost(x: number, y: number): number {
    if (!this.inBounds(x, y)) return Infinity;
    return this.grid.nodes[y][x].cost;
  }

  // ── Bulk operations ───────────────────────────────────────

  setRegionWalkable(
    x: number,
    y: number,
    w: number,
    h: number,
    walkable: boolean,
  ): void {
    const x1 = Math.max(0, x);
    const y1 = Math.max(0, y);
    const x2 = Math.min(this.grid.width, x + w);
    const y2 = Math.min(this.grid.height, y + h);
    for (let row = y1; row < y2; row++) {
      for (let col = x1; col < x2; col++) {
        this.grid.nodes[row][col].walkable = walkable;
      }
    }
  }

  // ── Factory methods ───────────────────────────────────────

  static fromCollisionLayer(
    layerData: number[][],
    width: number,
    height: number,
  ): NavigationGrid {
    const grid = new NavigationGrid(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = layerData[y]?.[x] ?? 0;
        grid.setWalkable(x, y, tile === 0);
      }
    }
    return grid;
  }

  static fromCostMap(
    walkableLayer: number[][],
    costLayer: number[][],
    width: number,
    height: number,
  ): NavigationGrid {
    const grid = new NavigationGrid(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = walkableLayer[y]?.[x] ?? 0;
        grid.setWalkable(x, y, tile === 0);
        const cost = costLayer[y]?.[x] ?? 1;
        grid.setCost(x, y, cost);
      }
    }
    return grid;
  }

  // ── Queries ───────────────────────────────────────────────

  getWidth(): number {
    return this.grid.width;
  }

  getHeight(): number {
    return this.grid.height;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.grid.width && y >= 0 && y < this.grid.height;
  }

  getNeighbors(
    x: number,
    y: number,
    allowDiagonal: boolean,
  ): Array<{ x: number; y: number; cost: number }> {
    const neighbors: Array<{ x: number; y: number; cost: number }> = [];

    // Cardinal directions: N, E, S, W
    const cardinals: [number, number][] = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    // Diagonal directions: NE, SE, SW, NW
    const diagonals: [number, number][] = [
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
    ];

    for (const [dx, dy] of cardinals) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.inBounds(nx, ny) && this.grid.nodes[ny][nx].walkable) {
        neighbors.push({ x: nx, y: ny, cost: this.grid.nodes[ny][nx].cost });
      }
    }

    if (allowDiagonal) {
      for (let i = 0; i < diagonals.length; i++) {
        const [dx, dy] = diagonals[i];
        const nx = x + dx;
        const ny = y + dy;
        if (!this.inBounds(nx, ny) || !this.grid.nodes[ny][nx].walkable) continue;

        // Prevent diagonal movement through corners of walls.
        // For diagonal (dx, dy), both adjacent cardinals must be walkable.
        const cx = x + dx;
        const cy = y;
        const rx = x;
        const ry = y + dy;
        if (
          (!this.inBounds(cx, cy) || !this.grid.nodes[cy][cx].walkable) &&
          (!this.inBounds(rx, ry) || !this.grid.nodes[ry][rx].walkable)
        ) {
          continue;
        }

        const SQRT2 = 1.4142135623730951;
        neighbors.push({
          x: nx,
          y: ny,
          cost: this.grid.nodes[ny][nx].cost * SQRT2,
        });
      }
    }

    return neighbors;
  }
}
