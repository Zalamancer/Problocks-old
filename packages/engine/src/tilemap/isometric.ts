/**
 * Isometric-specific utilities.
 *
 * Depth sorting, height-level projection, hit-testing with diamond
 * polygons, and isometric bounding-box picking.
 */

import type { ScreenPoint } from './types.js';

// ── Depth sorting ────────────────────────────────────────────────

/**
 * Entity-like interface — anything with a grid position and optional
 * layer.  The caller can pass any array of objects that satisfy this.
 */
export interface DepthSortable {
  gridX: number;
  gridY: number;
  /** Higher layers render on top of lower layers. */
  layer?: number;
}

/**
 * Compute a single numeric depth index for an isometric tile.
 *
 * Tiles further from the camera (higher gridX + gridY sum) have a
 * higher depth value and should be rendered first (back-to-front).
 * Within the same row, higher gridX renders on top (left-to-right
 * in grid space = right-to-left on screen for diamond iso).
 *
 * The layer acts as a major sort key so that overlay layers always
 * draw above ground layers regardless of position.
 */
export function getDepthIndex(
  gridX: number,
  gridY: number,
  layer: number = 0,
): number {
  // layer * large multiplier keeps layers fully separated.
  // Within a layer, (gridX + gridY) orders back-to-front,
  // gridX breaks ties for same-row tiles.
  return layer * 1_000_000 + (gridX + gridY) * 1_000 + gridX;
}

/**
 * Sort an array of depth-sortable objects in isometric render order
 * (back-to-front).  Returns a new sorted array — does not mutate.
 */
export function depthSort<T extends DepthSortable>(entities: ReadonlyArray<T>): T[] {
  return [...entities].sort((a, b) => {
    const da = getDepthIndex(a.gridX, a.gridY, a.layer ?? 0);
    const db = getDepthIndex(b.gridX, b.gridY, b.layer ?? 0);
    return da - db;
  });
}

// ── Height projection ────────────────────────────────────────────

/**
 * Convert grid coordinates + height level to screen coordinates.
 *
 * Height adds a vertical (upward) offset.  One height unit equals
 * half the tile height, matching the standard isometric convention
 * where a "1 block high" wall covers the tile visually.
 *
 * @param gridX      Tile column.
 * @param gridY      Tile row.
 * @param height     Height above the ground plane (in tile-height units).
 * @param tileWidth  Tile width in pixels.
 * @param tileHeight Tile height in pixels.
 */
export function worldToScreenWithHeight(
  gridX: number,
  gridY: number,
  height: number,
  tileWidth: number,
  tileHeight: number,
): ScreenPoint {
  return {
    screenX: (gridX - gridY) * (tileWidth / 2),
    screenY: (gridX + gridY) * (tileHeight / 2) - height * (tileHeight / 2),
  };
}

// ── Diamond hit-testing ──────────────────────────────────────────

/**
 * Vertices of an isometric diamond tile polygon centered at the
 * given screen position.  The diamond is the standard rhombus shape
 * for a single tile.
 *
 *          top
 *         /    \
 *      left    right
 *         \    /
 *         bottom
 */
export function diamondPolygon(
  centerScreenX: number,
  centerScreenY: number,
  tileWidth: number,
  tileHeight: number,
): [number, number][] {
  const hw = tileWidth / 2;
  const hh = tileHeight / 2;
  return [
    [centerScreenX,      centerScreenY - hh], // top
    [centerScreenX + hw, centerScreenY],       // right
    [centerScreenX,      centerScreenY + hh], // bottom
    [centerScreenX - hw, centerScreenY],       // left
  ];
}

/**
 * Test whether a screen point is inside an isometric diamond tile.
 *
 * Uses the standard point-in-rhombus formula:
 *   |dx / halfWidth| + |dy / halfHeight| <= 1
 *
 * @param testX       Screen X to test.
 * @param testY       Screen Y to test.
 * @param tileCenterX Screen X center of the tile.
 * @param tileCenterY Screen Y center of the tile.
 * @param tileWidth   Tile width in pixels.
 * @param tileHeight  Tile height in pixels.
 */
export function isPointInDiamond(
  testX: number,
  testY: number,
  tileCenterX: number,
  tileCenterY: number,
  tileWidth: number,
  tileHeight: number,
): boolean {
  const dx = Math.abs(testX - tileCenterX);
  const dy = Math.abs(testY - tileCenterY);
  return (dx / (tileWidth / 2)) + (dy / (tileHeight / 2)) <= 1;
}

/**
 * Isometric mouse-picking with height consideration.
 *
 * Given a screen point and a list of potential tiles (with their
 * heights), returns the topmost tile that the point falls within.
 * Tiles are checked from highest depth (front) to lowest (back)
 * so the first hit is the correct visual pick.
 */
export interface PickCandidate {
  gridX: number;
  gridY: number;
  layer: number;
  height: number;
}

export function pickTileAtScreen(
  screenX: number,
  screenY: number,
  candidates: ReadonlyArray<PickCandidate>,
  tileWidth: number,
  tileHeight: number,
): PickCandidate | null {
  // Sort by depth descending (frontmost first) so first hit is on top
  const sorted = [...candidates].sort((a, b) => {
    const da = getDepthIndex(a.gridX, a.gridY, a.layer) + a.height * 500;
    const db = getDepthIndex(b.gridX, b.gridY, b.layer) + b.height * 500;
    return db - da;
  });

  for (const candidate of sorted) {
    const screen = worldToScreenWithHeight(
      candidate.gridX,
      candidate.gridY,
      candidate.height,
      tileWidth,
      tileHeight,
    );
    if (isPointInDiamond(
      screenX,
      screenY,
      screen.screenX,
      screen.screenY,
      tileWidth,
      tileHeight,
    )) {
      return candidate;
    }
  }
  return null;
}

// ── Isometric bounding box ───────────────────────────────────────

/**
 * Axis-aligned bounding box in screen space for an isometric tile
 * at a given height.  Useful for broad-phase culling.
 */
export interface ScreenAABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function getTileScreenAABB(
  gridX: number,
  gridY: number,
  height: number,
  tileWidth: number,
  tileHeight: number,
): ScreenAABB {
  const screen = worldToScreenWithHeight(gridX, gridY, height, tileWidth, tileHeight);
  const hw = tileWidth / 2;
  const hh = tileHeight / 2;
  return {
    minX: screen.screenX - hw,
    minY: screen.screenY - hh,
    maxX: screen.screenX + hw,
    maxY: screen.screenY + hh,
  };
}
