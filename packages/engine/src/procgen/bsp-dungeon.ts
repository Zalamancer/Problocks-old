/**
 * Binary Space Partition dungeon generator.
 *
 * Produces connected dungeon layouts with rooms, corridors, and doors.
 * The algorithm:
 *  1. Recursively split the map into partitions (alternating H/V).
 *  2. Place a random room inside each leaf partition.
 *  3. Connect sibling rooms with L-shaped corridors.
 *  4. Fill the tile map: 0=wall, 1=floor, 2=corridor, 3=door.
 */

import type { Room, Corridor, DungeonResult } from './types.js';
import { createRNG, randomInt } from './noise.js';

// ── BSP tree node ───────────────────────────────────────────────

interface BSPNode {
  x: number;
  y: number;
  width: number;
  height: number;
  left?: BSPNode;
  right?: BSPNode;
  room?: Room;
}

// ── Tile constants ──────────────────────────────────────────────

const TILE_WALL = 0;
const TILE_FLOOR = 1;
const TILE_CORRIDOR = 2;
const TILE_DOOR = 3;

// ── Options ─────────────────────────────────────────────────────

export interface DungeonOptions {
  seed?: number;
  minRoomSize?: number;
  maxRoomSize?: number;
  roomPadding?: number;
  splitDepth?: number;
  corridorWidth?: number;
  doorChance?: number;
  roomTypes?: string[];
}

// ── Generator ───────────────────────────────────────────────────

export function generateDungeon(
  width: number,
  height: number,
  options?: DungeonOptions,
): DungeonResult {
  const seed = options?.seed ?? Date.now();
  const minRoomSize = options?.minRoomSize ?? 5;
  const maxRoomSize = options?.maxRoomSize ?? 15;
  const roomPadding = options?.roomPadding ?? 1;
  const splitDepth = options?.splitDepth ?? 5;
  const corridorWidth = options?.corridorWidth ?? 1;
  const doorChance = options?.doorChance ?? 0.5;
  const roomTypes = options?.roomTypes;

  const rng = createRNG(seed);

  // Initialize tile map filled with walls
  const tileMap: number[][] = [];
  for (let y = 0; y < height; y++) {
    tileMap[y] = new Array(width).fill(TILE_WALL);
  }

  const rooms: Room[] = [];
  const corridors: Corridor[] = [];
  let nextRoomId = 0;

  // ── Step 1: Build BSP tree ──────────────────────────────────

  function splitNode(node: BSPNode, depth: number): void {
    if (depth <= 0) return;

    // Decide split direction: prefer splitting the longer axis
    const canSplitH = node.height >= minRoomSize * 2 + roomPadding * 2;
    const canSplitV = node.width >= minRoomSize * 2 + roomPadding * 2;

    if (!canSplitH && !canSplitV) return;

    let splitHorizontally: boolean;
    if (!canSplitH) splitHorizontally = false;
    else if (!canSplitV) splitHorizontally = true;
    else splitHorizontally = node.height > node.width ? true : node.width > node.height ? false : rng() > 0.5;

    if (splitHorizontally) {
      // Horizontal split — divide top/bottom
      const minSplit = Math.floor(node.height * 0.3);
      const maxSplit = Math.floor(node.height * 0.7);
      const splitAt = randomInt(rng, Math.max(minSplit, minRoomSize + roomPadding), Math.min(maxSplit, node.height - minRoomSize - roomPadding));

      node.left = { x: node.x, y: node.y, width: node.width, height: splitAt };
      node.right = { x: node.x, y: node.y + splitAt, width: node.width, height: node.height - splitAt };
    } else {
      // Vertical split — divide left/right
      const minSplit = Math.floor(node.width * 0.3);
      const maxSplit = Math.floor(node.width * 0.7);
      const splitAt = randomInt(rng, Math.max(minSplit, minRoomSize + roomPadding), Math.min(maxSplit, node.width - minRoomSize - roomPadding));

      node.left = { x: node.x, y: node.y, width: splitAt, height: node.height };
      node.right = { x: node.x + splitAt, y: node.y, width: node.width - splitAt, height: node.height };
    }

    splitNode(node.left, depth - 1);
    splitNode(node.right, depth - 1);
  }

  const root: BSPNode = { x: 0, y: 0, width, height };
  splitNode(root, splitDepth);

  // ── Step 2: Create rooms in leaf partitions ─────────────────

  function createRooms(node: BSPNode): void {
    if (node.left && node.right) {
      createRooms(node.left);
      createRooms(node.right);
      return;
    }

    // Leaf node: place a room
    const maxW = Math.min(maxRoomSize, node.width - roomPadding * 2);
    const maxH = Math.min(maxRoomSize, node.height - roomPadding * 2);

    if (maxW < minRoomSize || maxH < minRoomSize) return;

    const roomW = randomInt(rng, minRoomSize, maxW);
    const roomH = randomInt(rng, minRoomSize, maxH);
    const roomX = randomInt(rng, node.x + roomPadding, node.x + node.width - roomW - roomPadding);
    const roomY = randomInt(rng, node.y + roomPadding, node.y + node.height - roomH - roomPadding);

    const room: Room = {
      x: roomX,
      y: roomY,
      width: roomW,
      height: roomH,
      id: nextRoomId++,
      connections: [],
    };

    if (roomTypes && roomTypes.length > 0) {
      room.type = roomTypes[randomInt(rng, 0, roomTypes.length - 1)];
    }

    node.room = room;
    rooms.push(room);

    // Carve room floor
    for (let ry = roomY; ry < roomY + roomH; ry++) {
      for (let rx = roomX; rx < roomX + roomW; rx++) {
        if (ry >= 0 && ry < height && rx >= 0 && rx < width) {
          tileMap[ry][rx] = TILE_FLOOR;
        }
      }
    }
  }

  createRooms(root);

  // ── Step 3: Connect sibling rooms with corridors ────────────

  /** Get a room from a subtree (pick the first leaf room found). */
  function getRoom(node: BSPNode): Room | undefined {
    if (node.room) return node.room;
    if (node.left) {
      const leftRoom = getRoom(node.left);
      if (leftRoom) return leftRoom;
    }
    if (node.right) {
      return node.right ? getRoom(node.right) : undefined;
    }
    return undefined;
  }

  /** Get the closest room to a point from a subtree. */
  function getClosestRoom(node: BSPNode, px: number, py: number): Room | undefined {
    if (node.room) return node.room;

    let best: Room | undefined;
    let bestDist = Infinity;

    function search(n: BSPNode): void {
      if (n.room) {
        const cx = n.room.x + n.room.width / 2;
        const cy = n.room.y + n.room.height / 2;
        const dist = Math.abs(cx - px) + Math.abs(cy - py);
        if (dist < bestDist) {
          bestDist = dist;
          best = n.room;
        }
        return;
      }
      if (n.left) search(n.left);
      if (n.right) search(n.right);
    }

    search(node);
    return best;
  }

  /** Carve a corridor tile. */
  function carveTile(x: number, y: number, isFloor: boolean): void {
    for (let dy = 0; dy < corridorWidth; dy++) {
      for (let dx = 0; dx < corridorWidth; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if (cy >= 0 && cy < height && cx >= 0 && cx < width) {
          if (tileMap[cy][cx] === TILE_WALL) {
            tileMap[cy][cx] = isFloor ? TILE_FLOOR : TILE_CORRIDOR;
          }
        }
      }
    }
  }

  /** Check if a tile is at the boundary of a room (potential door location). */
  function isRoomEdge(x: number, y: number): boolean {
    for (const room of rooms) {
      // Check if (x,y) is exactly on the room boundary
      if (
        (x === room.x - 1 || x === room.x + room.width) &&
        y >= room.y && y < room.y + room.height
      ) return true;
      if (
        (y === room.y - 1 || y === room.y + room.height) &&
        x >= room.x && x < room.x + room.width
      ) return true;
    }
    return false;
  }

  function connectNodes(node: BSPNode): void {
    if (!node.left || !node.right) return;

    connectNodes(node.left);
    connectNodes(node.right);

    // Find rooms to connect (closest pair from each subtree)
    const leftRoom = getRoom(node.left);
    const rightRoom = getRoom(node.right);

    if (!leftRoom || !rightRoom) return;

    // Use the closest rooms from each side
    const leftCenter = { x: Math.floor(leftRoom.x + leftRoom.width / 2), y: Math.floor(leftRoom.y + leftRoom.height / 2) };
    const rightCenter = { x: Math.floor(rightRoom.x + rightRoom.width / 2), y: Math.floor(rightRoom.y + rightRoom.height / 2) };

    // Get closest room in the right subtree to the left room center
    const actualRight = getClosestRoom(node.right, leftCenter.x, leftCenter.y) ?? rightRoom;
    const actualLeft = getClosestRoom(node.left, rightCenter.x, rightCenter.y) ?? leftRoom;

    const fromCenter = {
      x: Math.floor(actualLeft.x + actualLeft.width / 2),
      y: Math.floor(actualLeft.y + actualLeft.height / 2),
    };
    const toCenter = {
      x: Math.floor(actualRight.x + actualRight.width / 2),
      y: Math.floor(actualRight.y + actualRight.height / 2),
    };

    // Build an L-shaped corridor path
    const path: Array<{ x: number; y: number }> = [];
    const goHorizontalFirst = rng() > 0.5;

    let cx = fromCenter.x;
    let cy = fromCenter.y;

    if (goHorizontalFirst) {
      // Horizontal then vertical
      while (cx !== toCenter.x) {
        path.push({ x: cx, y: cy });
        cx += cx < toCenter.x ? 1 : -1;
      }
      while (cy !== toCenter.y) {
        path.push({ x: cx, y: cy });
        cy += cy < toCenter.y ? 1 : -1;
      }
    } else {
      // Vertical then horizontal
      while (cy !== toCenter.y) {
        path.push({ x: cx, y: cy });
        cy += cy < toCenter.y ? 1 : -1;
      }
      while (cx !== toCenter.x) {
        path.push({ x: cx, y: cy });
        cx += cx < toCenter.x ? 1 : -1;
      }
    }
    path.push({ x: toCenter.x, y: toCenter.y });

    // Carve the corridor, optionally placing doors
    for (const point of path) {
      const atRoomEdge = isRoomEdge(point.x, point.y);
      if (atRoomEdge && rng() < doorChance) {
        if (point.y >= 0 && point.y < height && point.x >= 0 && point.x < width) {
          if (tileMap[point.y][point.x] === TILE_WALL) {
            tileMap[point.y][point.x] = TILE_DOOR;
          }
        }
      } else {
        carveTile(point.x, point.y, false);
      }
    }

    // Record connection
    if (!actualLeft.connections.includes(actualRight.id)) {
      actualLeft.connections.push(actualRight.id);
    }
    if (!actualRight.connections.includes(actualLeft.id)) {
      actualRight.connections.push(actualLeft.id);
    }

    corridors.push({
      from: actualLeft.id,
      to: actualRight.id,
      path,
    });
  }

  connectNodes(root);

  // ── Step 4: Ensure full connectivity ────────────────────────
  // Verify all rooms are reachable via BFS. If not, connect isolated groups.
  if (rooms.length > 1) {
    const visited = new Set<number>();
    const queue = [rooms[0].id];
    visited.add(rooms[0].id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const room = rooms.find(r => r.id === current);
      if (!room) continue;
      for (const connId of room.connections) {
        if (!visited.has(connId)) {
          visited.add(connId);
          queue.push(connId);
        }
      }
    }

    // Connect any unreachable rooms to the nearest reachable room
    for (const room of rooms) {
      if (visited.has(room.id)) continue;

      let nearestId = -1;
      let nearestDist = Infinity;
      const rx = room.x + room.width / 2;
      const ry = room.y + room.height / 2;

      for (const visitedId of visited) {
        const other = rooms.find(r => r.id === visitedId)!;
        const dist = Math.abs(other.x + other.width / 2 - rx) + Math.abs(other.y + other.height / 2 - ry);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = visitedId;
        }
      }

      if (nearestId >= 0) {
        const other = rooms.find(r => r.id === nearestId)!;
        const fromPt = { x: Math.floor(rx), y: Math.floor(ry) };
        const toPt = { x: Math.floor(other.x + other.width / 2), y: Math.floor(other.y + other.height / 2) };

        const path: Array<{ x: number; y: number }> = [];
        let cx = fromPt.x;
        let cy = fromPt.y;

        while (cx !== toPt.x) {
          path.push({ x: cx, y: cy });
          cx += cx < toPt.x ? 1 : -1;
        }
        while (cy !== toPt.y) {
          path.push({ x: cx, y: cy });
          cy += cy < toPt.y ? 1 : -1;
        }
        path.push(toPt);

        for (const point of path) {
          carveTile(point.x, point.y, false);
        }

        room.connections.push(nearestId);
        other.connections.push(room.id);
        corridors.push({ from: room.id, to: nearestId, path });

        visited.add(room.id);
      }
    }
  }

  return { rooms, corridors, tileMap, width, height };
}
