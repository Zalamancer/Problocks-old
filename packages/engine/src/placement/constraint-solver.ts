/**
 * Constraint-based room furnishing solver.
 *
 * The "Dungeon Alchemist" brain: takes a room definition and a template,
 * then places objects according to their placement constraints.
 *
 * Placement algorithm:
 *  1. Build occupancy grid from room bounds.
 *  2. Place required objects first (highest priority).
 *  3. Place optional objects (skip if room too full).
 *  4. Place decorations (fill remaining space).
 *  5. Score the final layout.
 */

import type {
  RoomDefinition,
  RoomTemplate,
  PlaceableObject,
  PlacedObject,
  PlacementConstraint,
  FurnishResult,
} from './types.js';
import { createRNG, randomInt } from '../procgen/noise.js';

// ── Occupancy grid ──────────────────────────────────────────────

/** Tracks which tiles in the room are occupied. */
class OccupancyGrid {
  readonly width: number;
  readonly height: number;
  readonly offsetX: number;
  readonly offsetY: number;
  private cells: Uint8Array; // 0=free, 1=occupied

  constructor(bounds: { x: number; y: number; width: number; height: number }) {
    this.width = bounds.width;
    this.height = bounds.height;
    this.offsetX = bounds.x;
    this.offsetY = bounds.y;
    this.cells = new Uint8Array(this.width * this.height);
  }

  /** Check if a tile is within bounds and free. */
  isFree(worldX: number, worldY: number): boolean {
    const lx = worldX - this.offsetX;
    const ly = worldY - this.offsetY;
    if (lx < 0 || lx >= this.width || ly < 0 || ly >= this.height) return false;
    return this.cells[ly * this.width + lx] === 0;
  }

  /** Mark a tile as occupied. */
  occupy(worldX: number, worldY: number): void {
    const lx = worldX - this.offsetX;
    const ly = worldY - this.offsetY;
    if (lx >= 0 && lx < this.width && ly >= 0 && ly < this.height) {
      this.cells[ly * this.width + lx] = 1;
    }
  }

  /** Check if an object footprint fits at the given position. */
  canPlace(worldX: number, worldY: number, w: number, h: number): boolean {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (!this.isFree(worldX + dx, worldY + dy)) return false;
      }
    }
    return true;
  }

  /** Mark an object footprint as occupied. */
  placeFootprint(worldX: number, worldY: number, w: number, h: number): void {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.occupy(worldX + dx, worldY + dy);
      }
    }
  }

  /** Count total occupied tiles. */
  occupiedCount(): number {
    let count = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === 1) count++;
    }
    return count;
  }

  /** Fraction of room filled (0-1). */
  fillRatio(): number {
    return this.occupiedCount() / (this.width * this.height);
  }
}

// ── Geometry helpers ────────────────────────────────────────────

/** Get the rotated footprint dimensions. */
function rotatedSize(
  w: number,
  h: number,
  rotation: number,
): { w: number; h: number } {
  if (rotation === 90 || rotation === 270) return { w: h, h: w };
  return { w, h };
}

/** Manhattan distance between two points. */
function manhattan(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/** Euclidean distance squared. */
function distSq(x1: number, y1: number, x2: number, y2: number): number {
  return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}

// ── Constraint evaluators ───────────────────────────────────────

/** Score a single constraint for a candidate placement. Returns 0 (fail) to 1 (perfect). */
function scoreConstraint(
  constraint: PlacementConstraint,
  candidateX: number,
  candidateY: number,
  candidateW: number,
  candidateH: number,
  candidateRotation: number,
  room: RoomDefinition,
  existingPlacements: PlacedObject[],
  objectName: string,
): number {
  const cx = candidateX + candidateW / 2;
  const cy = candidateY + candidateH / 2;
  const roomCx = room.bounds.x + room.bounds.width / 2;
  const roomCy = room.bounds.y + room.bounds.height / 2;

  switch (constraint.type) {
    case 'against-wall': {
      // Check if any edge of the object touches a wall
      let touchCount = 0;
      let maxTouch = 0;

      // Check north edge (top of object)
      for (let dx = 0; dx < candidateW; dx++) {
        const wx = candidateX + dx;
        const wy = candidateY - 1;
        if (room.walls.some(w => w.x === wx && w.y === wy)) touchCount++;
      }
      maxTouch += candidateW;

      // Check south edge
      for (let dx = 0; dx < candidateW; dx++) {
        const wx = candidateX + dx;
        const wy = candidateY + candidateH;
        if (room.walls.some(w => w.x === wx && w.y === wy)) touchCount++;
      }
      maxTouch += candidateW;

      // Check west edge
      for (let dy = 0; dy < candidateH; dy++) {
        const wx = candidateX - 1;
        const wy = candidateY + dy;
        if (room.walls.some(w => w.x === wx && w.y === wy)) touchCount++;
      }
      maxTouch += candidateH;

      // Check east edge
      for (let dy = 0; dy < candidateH; dy++) {
        const wx = candidateX + candidateW;
        const wy = candidateY + dy;
        if (room.walls.some(w => w.x === wx && w.y === wy)) touchCount++;
      }
      maxTouch += candidateH;

      // Also accept placement at room boundary (within 1 tile of edge)
      const atNorthEdge = candidateY <= room.bounds.y;
      const atSouthEdge = candidateY + candidateH >= room.bounds.y + room.bounds.height;
      const atWestEdge = candidateX <= room.bounds.x;
      const atEastEdge = candidateX + candidateW >= room.bounds.x + room.bounds.width;

      if (atNorthEdge || atSouthEdge || atWestEdge || atEastEdge) {
        return 1.0;
      }

      return maxTouch > 0 ? Math.min(touchCount / Math.max(1, Math.min(candidateW, candidateH)), 1) : 0;
    }

    case 'center-room': {
      const maxDist = Math.sqrt(distSq(room.bounds.x, room.bounds.y, roomCx, roomCy));
      const dist = Math.sqrt(distSq(cx, cy, roomCx, roomCy));
      return maxDist > 0 ? 1 - Math.min(dist / maxDist, 1) : 1;
    }

    case 'min-spacing': {
      const minDist = constraint.params?.distance ?? 1;
      const tag = constraint.params?.tag;

      for (const placed of existingPlacements) {
        if (tag && !placed.assetId.includes(tag)) continue;
        const dist = manhattan(cx, cy, placed.x + 0.5, placed.y + 0.5);
        if (dist < minDist) return 0; // Hard fail
      }
      return 1;
    }

    case 'near-wall': {
      const maxWallDist = constraint.params?.wallDistance ?? 2;
      // Distance to nearest room edge
      const distToNorth = candidateY - room.bounds.y;
      const distToSouth = (room.bounds.y + room.bounds.height) - (candidateY + candidateH);
      const distToWest = candidateX - room.bounds.x;
      const distToEast = (room.bounds.x + room.bounds.width) - (candidateX + candidateW);
      const minEdgeDist = Math.min(distToNorth, distToSouth, distToWest, distToEast);
      return minEdgeDist <= maxWallDist ? 1 - minEdgeDist / (maxWallDist + 1) : 0;
    }

    case 'away-from-door': {
      const minDist = constraint.params?.distance ?? 2;
      if (room.doors.length === 0) return 1;

      let nearest = Infinity;
      for (const door of room.doors) {
        const d = manhattan(cx, cy, door.x, door.y);
        if (d < nearest) nearest = d;
      }
      if (nearest < minDist) return nearest / minDist; // Soft penalty
      return Math.min(nearest / (minDist * 2), 1);
    }

    case 'near': {
      const maxDist = constraint.params?.distance ?? 3;
      const tag = constraint.params?.tag;
      if (!tag || existingPlacements.length === 0) return 0.5; // Neutral if no targets

      let nearest = Infinity;
      for (const placed of existingPlacements) {
        if (!placed.assetId.includes(tag)) continue;
        const d = manhattan(cx, cy, placed.x + 0.5, placed.y + 0.5);
        if (d < nearest) nearest = d;
      }

      if (nearest === Infinity) return 0.5; // No matching objects yet
      return nearest <= maxDist ? 1 - nearest / (maxDist * 2) : 0;
    }

    case 'avoid': {
      const minDist = constraint.params?.distance ?? 2;
      const tag = constraint.params?.tag;
      if (!tag || existingPlacements.length === 0) return 1;

      let nearest = Infinity;
      for (const placed of existingPlacements) {
        if (!placed.assetId.includes(tag)) continue;
        const d = manhattan(cx, cy, placed.x + 0.5, placed.y + 0.5);
        if (d < nearest) nearest = d;
      }

      if (nearest === Infinity) return 1;
      return nearest >= minDist ? 1 : nearest / minDist;
    }

    case 'facing': {
      const dir = constraint.params?.direction;
      if (!dir) return 0.5;

      // Check if object's rotation matches the desired facing
      const rotMap: Record<string, number> = {
        north: 0,
        east: 90,
        south: 180,
        west: 270,
      };

      const desiredRot = rotMap[dir] ?? 0;
      return candidateRotation === desiredRot ? 1 : 0.3;
    }

    case 'corner': {
      // Check if two perpendicular room edges are within 1 tile
      const nearNorth = candidateY - room.bounds.y <= 1;
      const nearSouth = (room.bounds.y + room.bounds.height) - (candidateY + candidateH) <= 1;
      const nearWest = candidateX - room.bounds.x <= 1;
      const nearEast = (room.bounds.x + room.bounds.width) - (candidateX + candidateW) <= 1;

      const inCorner = (nearNorth || nearSouth) && (nearWest || nearEast);
      return inCorner ? 1 : 0;
    }

    case 'grid-align': {
      // Check if position is on integer coordinates
      const xAligned = Math.abs(candidateX - Math.round(candidateX)) < 0.01;
      const yAligned = Math.abs(candidateY - Math.round(candidateY)) < 0.01;
      return xAligned && yAligned ? 1 : 0;
    }
  }
}

/** Score all constraints for a candidate. Returns average score (0-1). */
function scoreAllConstraints(
  constraints: PlacementConstraint[],
  x: number, y: number, w: number, h: number, rotation: number,
  room: RoomDefinition,
  existing: PlacedObject[],
  name: string,
): number {
  if (constraints.length === 0) return 0.5;

  let totalScore = 0;
  let hardFail = false;

  for (const constraint of constraints) {
    const s = scoreConstraint(constraint, x, y, w, h, rotation, room, existing, name);
    if (s === 0 && (constraint.type === 'min-spacing' || constraint.type === 'corner')) {
      // Hard constraints: min-spacing=0 means overlap, corner=0 means not in corner
      // Only hard-fail min-spacing, corner is soft unless it's the only constraint
      if (constraint.type === 'min-spacing') {
        hardFail = true;
      }
    }
    totalScore += s;
  }

  if (hardFail) return 0;
  return totalScore / constraints.length;
}

// ── Constraint Solver ───────────────────────────────────────────

export class ConstraintSolver {
  /**
   * Furnish a room using the provided template.
   */
  furnishRoom(
    room: RoomDefinition,
    template: RoomTemplate,
    options?: {
      seed?: number;
      maxAttempts?: number;
      fillPercent?: number;
    },
  ): FurnishResult {
    const seed = options?.seed ?? Date.now();
    const maxAttempts = options?.maxAttempts ?? 100;
    const maxFill = options?.fillPercent ?? template.maxFillPercent ?? 0.6;
    const rng = createRNG(seed);

    const grid = new OccupancyGrid(room.bounds);
    const placements: PlacedObject[] = [];
    const unplaced: string[] = [];

    // ── Phase 1: Required objects ─────────────────────────────
    for (const obj of template.requiredObjects) {
      const count = obj.minCount ?? 1;
      let placed = 0;

      for (let i = 0; i < (obj.maxCount ?? count); i++) {
        if (placed >= count && grid.fillRatio() >= maxFill) break;

        const result = this.placeObject(room, obj, placements, {
          seed: seed + i * 97 + placements.length * 13,
          maxAttempts,
        });

        if (result) {
          const rs = rotatedSize(obj.size.width, obj.size.height, result.rotation);
          grid.placeFootprint(result.x, result.y, rs.w, rs.h);
          placements.push(result);
          placed++;
        }
      }

      if (placed < (obj.minCount ?? 1)) {
        unplaced.push(obj.name);
      }
    }

    // ── Phase 2: Optional objects ─────────────────────────────
    // Shuffle optional objects for variety
    const optionals = [...template.optionalObjects];
    for (let i = optionals.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [optionals[i], optionals[j]] = [optionals[j], optionals[i]];
    }

    for (const obj of optionals) {
      if (grid.fillRatio() >= maxFill) break;

      // Decide how many to place based on weight
      const count = obj.maxCount ?? 1;
      for (let i = 0; i < count; i++) {
        if (grid.fillRatio() >= maxFill) break;

        // Weight-based skip
        if (rng() > (obj.weight ?? 0.5)) continue;

        const result = this.placeObject(room, obj, placements, {
          seed: seed + i * 53 + placements.length * 17,
          maxAttempts: Math.floor(maxAttempts * 0.7),
        });

        if (result) {
          const rs = rotatedSize(obj.size.width, obj.size.height, result.rotation);
          grid.placeFootprint(result.x, result.y, rs.w, rs.h);
          placements.push(result);
        }
      }
    }

    // ── Phase 3: Decorations ──────────────────────────────────
    const decorations = [...template.decorations];
    for (let i = decorations.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [decorations[i], decorations[j]] = [decorations[j], decorations[i]];
    }

    for (const obj of decorations) {
      if (grid.fillRatio() >= maxFill) break;

      const count = obj.maxCount ?? 1;
      for (let i = 0; i < count; i++) {
        if (grid.fillRatio() >= maxFill) break;
        if (rng() > (obj.weight ?? 0.3)) continue;

        const result = this.placeObject(room, obj, placements, {
          seed: seed + i * 41 + placements.length * 23,
          maxAttempts: Math.floor(maxAttempts * 0.5),
        });

        if (result) {
          const rs = rotatedSize(obj.size.width, obj.size.height, result.rotation);
          grid.placeFootprint(result.x, result.y, rs.w, rs.h);
          placements.push(result);
        }
      }
    }

    const score = this.scoreLayout(room, placements, template);
    return { placements, unplaced, score };
  }

  /**
   * Attempt to place a single object in the room.
   * Generates random candidate positions and picks the best one.
   */
  placeObject(
    room: RoomDefinition,
    object: PlaceableObject,
    existingPlacements: PlacedObject[],
    options?: { seed?: number; maxAttempts?: number },
  ): PlacedObject | null {
    const seed = options?.seed ?? Date.now();
    const maxAttempts = options?.maxAttempts ?? 100;
    const rng = createRNG(seed);

    const rotations = [0, 90, 180, 270];
    let bestCandidate: PlacedObject | null = null;
    let bestScore = -1;

    // Build a temporary occupancy grid for collision checking
    const grid = new OccupancyGrid(room.bounds);
    for (const placed of existingPlacements) {
      // Estimate footprint as 1x1 for simplicity in collision check
      // (we don't know the original object's size, so use the tile)
      grid.occupy(placed.x, placed.y);
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const rotation = rotations[Math.floor(rng() * rotations.length)];
      const rs = rotatedSize(object.size.width, object.size.height, rotation);

      // Random position within room bounds
      const maxX = room.bounds.x + room.bounds.width - rs.w;
      const maxY = room.bounds.y + room.bounds.height - rs.h;

      if (maxX < room.bounds.x || maxY < room.bounds.y) continue;

      const x = randomInt(rng, room.bounds.x, maxX);
      const y = randomInt(rng, room.bounds.y, maxY);

      // Check if footprint is free
      if (!grid.canPlace(x, y, rs.w, rs.h)) continue;

      // Score against constraints
      const score = scoreAllConstraints(
        object.rules,
        x, y, rs.w, rs.h, rotation,
        room, existingPlacements, object.name,
      );

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = { assetId: object.assetId, x, y, rotation };
      }

      // Early out if we found a good placement
      if (bestScore >= 0.8) break;
    }

    // Only accept if score is above a minimum threshold
    if (bestCandidate && bestScore >= 0.15) {
      return bestCandidate;
    }

    return null;
  }

  /**
   * Validate that a single placement satisfies all constraints.
   */
  validatePlacement(
    placement: PlacedObject,
    object: PlaceableObject,
    room: RoomDefinition,
    existingPlacements: PlacedObject[],
  ): boolean {
    const rs = rotatedSize(object.size.width, object.size.height, placement.rotation);

    // Bounds check
    if (
      placement.x < room.bounds.x ||
      placement.y < room.bounds.y ||
      placement.x + rs.w > room.bounds.x + room.bounds.width ||
      placement.y + rs.h > room.bounds.y + room.bounds.height
    ) {
      return false;
    }

    // Check overlap with existing placements
    for (const other of existingPlacements) {
      if (other.x === placement.x && other.y === placement.y && other.assetId === placement.assetId) {
        continue; // Skip self
      }
    }

    const score = scoreAllConstraints(
      object.rules,
      placement.x, placement.y, rs.w, rs.h, placement.rotation,
      room, existingPlacements, object.name,
    );

    return score > 0.1;
  }

  /**
   * Score the overall quality of a room layout.
   * Returns 0-1 based on required object coverage, constraint satisfaction,
   * and spacing aesthetics.
   */
  scoreLayout(
    room: RoomDefinition,
    placements: PlacedObject[],
    template: RoomTemplate,
  ): number {
    if (template.requiredObjects.length === 0 && placements.length === 0) {
      return 0.5; // Empty room with no requirements
    }

    let score = 0;
    let factors = 0;

    // Factor 1: Required object coverage (40% weight)
    if (template.requiredObjects.length > 0) {
      let requiredPlaced = 0;
      let requiredTotal = 0;

      for (const req of template.requiredObjects) {
        const minNeeded = req.minCount ?? 1;
        requiredTotal += minNeeded;
        const placedCount = placements.filter(p => p.assetId === req.assetId).length;
        requiredPlaced += Math.min(placedCount, minNeeded);
      }

      score += (requiredTotal > 0 ? requiredPlaced / requiredTotal : 1) * 0.4;
      factors += 0.4;
    }

    // Factor 2: Fill ratio (20% weight) — not too empty, not too full
    const grid = new OccupancyGrid(room.bounds);
    for (const p of placements) {
      grid.occupy(p.x, p.y);
    }
    const fill = grid.fillRatio();
    const idealFill = (template.maxFillPercent ?? 0.6) * 0.7;
    const fillScore = 1 - Math.abs(fill - idealFill) / idealFill;
    score += Math.max(0, fillScore) * 0.2;
    factors += 0.2;

    // Factor 3: Average constraint satisfaction (30% weight)
    if (placements.length > 0) {
      let constraintSum = 0;
      let constraintCount = 0;

      const allObjects = [
        ...template.requiredObjects,
        ...template.optionalObjects,
        ...template.decorations,
      ];

      for (const placement of placements) {
        const objDef = allObjects.find(o => o.assetId === placement.assetId);
        if (!objDef || objDef.rules.length === 0) continue;

        const rs = rotatedSize(objDef.size.width, objDef.size.height, placement.rotation);
        const cs = scoreAllConstraints(
          objDef.rules,
          placement.x, placement.y, rs.w, rs.h, placement.rotation,
          room, placements, objDef.name,
        );
        constraintSum += cs;
        constraintCount++;
      }

      score += (constraintCount > 0 ? constraintSum / constraintCount : 0.5) * 0.3;
      factors += 0.3;
    }

    // Factor 4: Spacing aesthetics (10% weight) — penalize clustering
    if (placements.length > 1) {
      let spacingScore = 1;
      for (let i = 0; i < placements.length; i++) {
        for (let j = i + 1; j < placements.length; j++) {
          const d = manhattan(placements[i].x, placements[i].y, placements[j].x, placements[j].y);
          if (d === 0) spacingScore -= 0.2; // Same tile = bad
          else if (d === 1) spacingScore -= 0.05; // Very close
        }
      }
      score += Math.max(0, spacingScore) * 0.1;
      factors += 0.1;
    }

    return factors > 0 ? Math.min(1, Math.max(0, score / factors)) : 0.5;
  }
}
