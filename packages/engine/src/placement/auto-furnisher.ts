/**
 * High-level auto-furnishing API.
 *
 * Combines room detection from dungeon data with the constraint solver
 * to automatically furnish entire dungeons.
 */

import type { DungeonResult } from '../procgen/types.js';
import type {
  RoomType,
  RoomDefinition,
  RoomTemplate,
  FurnishResult,
} from './types.js';
import { ROOM_TEMPLATES } from './room-templates.js';
import { ConstraintSolver } from './constraint-solver.js';
import { createRNG, randomInt } from '../procgen/noise.js';

// ── Tile constants (must match bsp-dungeon.ts) ──────────────────

const TILE_WALL = 0;
const TILE_FLOOR = 1;
const TILE_CORRIDOR = 2;
const TILE_DOOR = 3;

// ── Available room types for random assignment ──────────────────

const ASSIGNABLE_TYPES: RoomType[] = [
  'kitchen', 'bedroom', 'library', 'tavern', 'armory',
  'dungeon-cell', 'storage', 'bathroom',
];

// ── Auto-furnisher ──────────────────────────────────────────────

export class AutoFurnisher {
  private solver: ConstraintSolver;
  private templates: Map<RoomType, RoomTemplate>;

  constructor(templates?: Map<RoomType, RoomTemplate>) {
    this.solver = new ConstraintSolver();
    this.templates = new Map(templates ?? ROOM_TEMPLATES);
  }

  /**
   * Furnish a single room.
   */
  furnish(room: RoomDefinition, options?: { seed?: number }): FurnishResult {
    const template = this.templates.get(room.type);
    if (!template) {
      // No template — return empty result
      return { placements: [], unplaced: [], score: 0 };
    }

    return this.solver.furnishRoom(room, template, {
      seed: options?.seed,
    });
  }

  /**
   * Auto-detect rooms from a DungeonResult and furnish them all.
   *
   * For each room in the dungeon:
   *  1. Determine room type (from override map or random assignment).
   *  2. Build RoomDefinition by analyzing the tilemap.
   *  3. Run the constraint solver.
   */
  furnishDungeon(
    dungeon: DungeonResult,
    options?: {
      seed?: number;
      roomTypeAssignment?: Map<number, RoomType>;
    },
  ): Map<number, FurnishResult> {
    const seed = options?.seed ?? Date.now();
    const rng = createRNG(seed);
    const typeAssignment = options?.roomTypeAssignment ?? new Map();
    const results = new Map<number, FurnishResult>();

    for (const room of dungeon.rooms) {
      // ── Determine room type ───────────────────────────────
      let roomType: RoomType;

      if (typeAssignment.has(room.id)) {
        roomType = typeAssignment.get(room.id)!;
      } else if (room.type && this.templates.has(room.type as RoomType)) {
        roomType = room.type as RoomType;
      } else {
        // Random assignment from available types
        roomType = ASSIGNABLE_TYPES[randomInt(rng, 0, ASSIGNABLE_TYPES.length - 1)];
      }

      // ── Build RoomDefinition from tilemap data ────────────
      const roomDef = this.buildRoomDefinition(dungeon, room.id, roomType);

      // ── Furnish ───────────────────────────────────────────
      const result = this.furnish(roomDef, {
        seed: seed + room.id * 7741,
      });

      results.set(room.id, result);
    }

    return results;
  }

  /**
   * Register or replace a room template.
   */
  setTemplate(roomType: RoomType, template: RoomTemplate): void {
    this.templates.set(roomType, template);
  }

  /**
   * Get a registered template.
   */
  getTemplate(roomType: RoomType): RoomTemplate | undefined {
    return this.templates.get(roomType);
  }

  // ── Private: build RoomDefinition from dungeon data ───────────

  private buildRoomDefinition(
    dungeon: DungeonResult,
    roomId: number,
    roomType: RoomType,
  ): RoomDefinition {
    const room = dungeon.rooms.find(r => r.id === roomId)!;
    const walls: RoomDefinition['walls'] = [];
    const doors: RoomDefinition['doors'] = [];

    const bx = room.x;
    const by = room.y;
    const bw = room.width;
    const bh = room.height;

    // Scan room perimeter for walls and doors
    // North edge
    for (let x = bx; x < bx + bw; x++) {
      const wy = by - 1;
      if (wy >= 0 && wy < dungeon.height && x >= 0 && x < dungeon.width) {
        const tile = dungeon.tileMap[wy][x];
        if (tile === TILE_WALL) {
          walls.push({ x, y: wy, side: 'north' });
        } else if (tile === TILE_DOOR) {
          doors.push({ x, y: wy, side: 'north' });
        }
      } else {
        // Out of bounds = implicit wall
        walls.push({ x, y: wy, side: 'north' });
      }
    }

    // South edge
    for (let x = bx; x < bx + bw; x++) {
      const wy = by + bh;
      if (wy >= 0 && wy < dungeon.height && x >= 0 && x < dungeon.width) {
        const tile = dungeon.tileMap[wy][x];
        if (tile === TILE_WALL) {
          walls.push({ x, y: wy, side: 'south' });
        } else if (tile === TILE_DOOR) {
          doors.push({ x, y: wy, side: 'south' });
        }
      } else {
        walls.push({ x, y: wy, side: 'south' });
      }
    }

    // West edge
    for (let y = by; y < by + bh; y++) {
      const wx = bx - 1;
      if (y >= 0 && y < dungeon.height && wx >= 0 && wx < dungeon.width) {
        const tile = dungeon.tileMap[y][wx];
        if (tile === TILE_WALL) {
          walls.push({ x: wx, y, side: 'west' });
        } else if (tile === TILE_DOOR) {
          doors.push({ x: wx, y, side: 'west' });
        }
      } else {
        walls.push({ x: wx, y, side: 'west' });
      }
    }

    // East edge
    for (let y = by; y < by + bh; y++) {
      const wx = bx + bw;
      if (y >= 0 && y < dungeon.height && wx >= 0 && wx < dungeon.width) {
        const tile = dungeon.tileMap[y][wx];
        if (tile === TILE_WALL) {
          walls.push({ x: wx, y, side: 'east' });
        } else if (tile === TILE_DOOR) {
          doors.push({ x: wx, y, side: 'east' });
        }
      } else {
        walls.push({ x: wx, y, side: 'east' });
      }
    }

    // Also detect doors from corridors connecting to this room
    for (const corridor of dungeon.corridors) {
      if (corridor.from !== roomId && corridor.to !== roomId) continue;

      for (const point of corridor.path) {
        if (
          point.x >= 0 && point.x < dungeon.width &&
          point.y >= 0 && point.y < dungeon.height &&
          dungeon.tileMap[point.y][point.x] === TILE_DOOR
        ) {
          // Determine which side this door is on
          let side: 'north' | 'south' | 'east' | 'west' = 'north';
          if (point.y < by) side = 'north';
          else if (point.y >= by + bh) side = 'south';
          else if (point.x < bx) side = 'west';
          else if (point.x >= bx + bw) side = 'east';

          // Avoid duplicates
          if (!doors.some(d => d.x === point.x && d.y === point.y)) {
            doors.push({ x: point.x, y: point.y, side });
          }
        }
      }
    }

    // Extract floor tiles
    const floorTiles: number[][] = [];
    for (let y = 0; y < bh; y++) {
      floorTiles[y] = [];
      for (let x = 0; x < bw; x++) {
        const wx = bx + x;
        const wy = by + y;
        if (wy >= 0 && wy < dungeon.height && wx >= 0 && wx < dungeon.width) {
          floorTiles[y][x] = dungeon.tileMap[wy][wx];
        } else {
          floorTiles[y][x] = TILE_WALL;
        }
      }
    }

    return {
      bounds: { x: bx, y: by, width: bw, height: bh },
      type: roomType,
      walls,
      doors,
      floorTiles,
    };
  }
}
