import type { NavigationGrid } from './nav-grid.js';

/**
 * Check line-of-sight between two points using Bresenham's line algorithm.
 * Returns true if every cell along the line is walkable.
 */
export function hasLineOfSight(
  grid: NavigationGrid,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  // Bresenham's line algorithm
  let dx = Math.abs(x2 - x1);
  let dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  let cx = x1;
  let cy = y1;

  while (true) {
    if (!grid.inBounds(cx, cy) || !grid.isWalkable(cx, cy)) {
      return false;
    }

    if (cx === x2 && cy === y2) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }

  return true;
}

/**
 * Cast a ray from (x1, y1) toward (x2, y2).
 * Returns the first non-walkable cell hit, or the endpoint if no hit.
 */
export function raycast(
  grid: NavigationGrid,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { hit: boolean; x: number; y: number; distance: number } {
  let dx = Math.abs(x2 - x1);
  let dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  let cx = x1;
  let cy = y1;

  while (true) {
    // Check current cell
    if (!grid.inBounds(cx, cy) || !grid.isWalkable(cx, cy)) {
      const distX = cx - x1;
      const distY = cy - y1;
      return {
        hit: true,
        x: cx,
        y: cy,
        distance: Math.sqrt(distX * distX + distY * distY),
      };
    }

    // Reached the end
    if (cx === x2 && cy === y2) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }

  // No obstacle hit
  const distX = x2 - x1;
  const distY = y2 - y1;
  return {
    hit: false,
    x: x2,
    y: y2,
    distance: Math.sqrt(distX * distX + distY * distY),
  };
}
