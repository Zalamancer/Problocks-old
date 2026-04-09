// ═══════════════════════════════════════════════════════════════════
// Dungeon Alchemist Demo — Problocks Engine
// ═══════════════════════════════════════════════════════════════════
//
// This script generates a procedural dungeon using BSP (Binary Space
// Partition), renders it to the tilemap viewport, adds point lights
// in each room, and sets up a dark ambient atmosphere.
//
// HOW IT WORKS:
//   1. pb.procgen.generateDungeon() builds a dungeon layout
//   2. We loop through the tile map and paint each tile
//   3. Lights are placed at the center of every room
//   4. The camera centers on the dungeon
//
// TILE LEGEND:
//   0 = wall (empty/dark)
//   1 = floor (room interior)
//   2 = corridor
//   3 = door
//
// Try changing the seed, room sizes, or split depth to get
// different dungeon layouts!
// ═══════════════════════════════════════════════════════════════════

// ── Configuration ──────────────────────────────────────────────────
// Tweak these values and re-run to experiment!

var DUNGEON_WIDTH  = 40;   // tiles wide
var DUNGEON_HEIGHT = 30;   // tiles tall
var SEED           = 42;   // change for a different layout
var MIN_ROOM_SIZE  = 5;    // smallest room dimension
var MAX_ROOM_SIZE  = 12;   // largest room dimension
var SPLIT_DEPTH    = 5;    // BSP recursion depth (more = more rooms)
var CORRIDOR_WIDTH = 2;    // corridor thickness in tiles

// ── Furniture tile IDs ─────────────────────────────────────────────
// We use higher tile IDs to represent furniture placed in rooms.
// The tilemap viewport color-codes each ID, so different furniture
// types will appear as different colors.

var TILE_TABLE    = 10;
var TILE_CHAIR    = 11;
var TILE_CHEST    = 12;
var TILE_BED      = 13;
var TILE_BOOKCASE = 14;
var TILE_BARREL   = 15;
var TILE_TORCH    = 16;
var TILE_RUG      = 17;

// ── Simple seeded random (for furniture placement) ─────────────────
// We need our own RNG since QuickJS doesn't expose the engine's RNG
// directly. This is a basic LCG (linear congruential generator).

var _rngState = SEED;

function seededRandom() {
  _rngState = (_rngState * 1664525 + 1013904223) & 0x7fffffff;
  return _rngState / 0x7fffffff;
}

function randomInt(min, max) {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}

// ── Furniture placement ────────────────────────────────────────────
// Each room gets furniture appropriate to its size. Larger rooms get
// more items. We avoid placing on walls or near doors.

function furnishRoom(room, tileMap) {
  var innerX = room.x + 1;
  var innerY = room.y + 1;
  var innerW = room.width - 2;
  var innerH = room.height - 2;

  // Skip very small rooms — they become closets/passages
  if (innerW < 2 || innerH < 2) return;

  var area = innerW * innerH;

  // Place torches along walls (tile ID 16)
  // Top-left and bottom-right corners
  if (canPlace(tileMap, innerX, innerY)) {
    pb.tilemap.setTile(1, innerX, innerY, TILE_TORCH);
  }
  if (canPlace(tileMap, innerX + innerW - 1, innerY + innerH - 1)) {
    pb.tilemap.setTile(1, innerX + innerW - 1, innerY + innerH - 1, TILE_TORCH);
  }

  // Place a rug in the center of larger rooms
  if (area >= 16) {
    var rugCX = innerX + Math.floor(innerW / 2);
    var rugCY = innerY + Math.floor(innerH / 2);
    for (var ry = rugCY - 1; ry <= rugCY + 1; ry++) {
      for (var rx = rugCX - 1; rx <= rugCX + 1; rx++) {
        if (canPlace(tileMap, rx, ry)) {
          pb.tilemap.setTile(1, rx, ry, TILE_RUG);
        }
      }
    }
  }

  // Scatter furniture based on room size
  var furnitureCount = Math.min(Math.floor(area / 6), 8);
  var furnitureTypes = [TILE_TABLE, TILE_CHAIR, TILE_CHEST, TILE_BED, TILE_BOOKCASE, TILE_BARREL];

  for (var i = 0; i < furnitureCount; i++) {
    // Try a few times to find an open spot
    for (var attempt = 0; attempt < 5; attempt++) {
      var fx = innerX + randomInt(0, innerW - 1);
      var fy = innerY + randomInt(0, innerH - 1);

      if (canPlace(tileMap, fx, fy)) {
        var furnitureId = furnitureTypes[randomInt(0, furnitureTypes.length - 1)];
        pb.tilemap.setTile(1, fx, fy, furnitureId);
        break;
      }
    }
  }
}

// Check if a tile is a plain floor (safe to place furniture)
function canPlace(tileMap, x, y) {
  if (y < 0 || y >= tileMap.length) return false;
  if (x < 0 || x >= tileMap[0].length) return false;
  // Only place on floor tiles (1), not corridors/doors/existing furniture
  return tileMap[y][x] === 1;
}

// ═══════════════════════════════════════════════════════════════════
// onStart — called once when you hit "Run"
// ═══════════════════════════════════════════════════════════════════

function onStart() {
  pb.log("=== Dungeon Alchemist Demo ===");
  pb.log("Generating dungeon: " + DUNGEON_WIDTH + "x" + DUNGEON_HEIGHT + " (seed: " + SEED + ")");

  // ── Step 1: Generate the dungeon layout ──────────────────────
  // pb.procgen.generateDungeon() uses BSP to create rooms and
  // corridors. It returns a JSON string with rooms[], corridors[],
  // tileMap[][], width, and height.

  var dungeonJSON = pb.procgen.generateDungeon(
    DUNGEON_WIDTH,
    DUNGEON_HEIGHT,
    JSON.stringify({
      seed: SEED,
      minRoomSize: MIN_ROOM_SIZE,
      maxRoomSize: MAX_ROOM_SIZE,
      splitDepth: SPLIT_DEPTH,
      corridorWidth: CORRIDOR_WIDTH,
    })
  );

  var data = JSON.parse(dungeonJSON);
  pb.log("Generated " + data.rooms.length + " rooms, " + data.corridors.length + " corridors");

  // ── Step 2: Render dungeon to tilemap (layer 0 = structure) ──
  // Layer 0 holds the dungeon structure: walls, floors, corridors,
  // and doors. Each tile type gets a unique ID so the viewport
  // renders them in distinct colors.

  for (var y = 0; y < data.height; y++) {
    for (var x = 0; x < data.width; x++) {
      var tile = data.tileMap[y][x];
      if (tile > 0) {
        // tile: 1=floor, 2=corridor, 3=door
        pb.tilemap.setTile(0, x, y, tile);
      }
    }
  }

  pb.log("Tilemap layer 0 painted (structure)");

  // ── Step 3: Auto-furnish rooms (layer 1 = objects) ───────────
  // Each room gets furniture placed on layer 1. The furnishRoom()
  // function scatters tables, chairs, chests, etc. based on room
  // size. Furniture uses tile IDs 10-17.

  for (var i = 0; i < data.rooms.length; i++) {
    furnishRoom(data.rooms[i], data.tileMap);
  }

  pb.log("Rooms furnished on layer 1");

  // ── Step 4: Set up camera ────────────────────────────────────
  // Center the camera on the middle of the dungeon.
  // Coordinates are in pixels: tile position * tile size (32px).

  var centerX = (data.width / 2) * 32;
  var centerY = (data.height / 2) * 32;
  pb.camera.setPosition(centerX, centerY);
  pb.camera.setZoom(1.5);

  pb.log("Camera centered at (" + centerX + ", " + centerY + ")");

  // ── Step 5: Add point lights in each room ────────────────────
  // Each room gets a warm point light at its center. Larger rooms
  // get brighter, wider lights. This creates a "torchlit dungeon"
  // atmosphere when combined with the dark ambient.

  for (var li = 0; li < data.rooms.length; li++) {
    var room = data.rooms[li];
    var cx = (room.x + room.width / 2) * 32;
    var cy = (room.y + room.height / 2) * 32;
    var radius = Math.max(room.width, room.height) * 32;

    pb.light.add("room_" + li, JSON.stringify({
      type: "point",
      color: 0xffaa44,        // warm orange torch light
      intensity: 0.8,
      radius: radius,
      falloff: 0.5,
    }));

    pb.light.setPosition("room_" + li, cx, cy);
  }

  pb.log("Added " + data.rooms.length + " room lights");

  // ── Step 6: Dark ambient lighting ────────────────────────────
  // A very dim blue-ish ambient simulates underground darkness.
  // Without room lights, the dungeon would be nearly invisible.

  pb.light.setAmbient(0x111122, 0.2);

  // ── Step 7: Set up navigation grid ───────────────────────────
  // Mark floor/corridor/door tiles as walkable so pathfinding works.
  // Wall tiles (0) remain non-walkable by default.

  for (var ny = 0; ny < data.height; ny++) {
    for (var nx = 0; nx < data.width; nx++) {
      if (data.tileMap[ny][nx] > 0) {
        pb.nav.setWalkable(nx, ny, 1);
      }
    }
  }

  pb.log("Navigation grid configured");

  // ── Step 8: Demo pathfinding between first and last room ─────
  // Show that the nav system works by finding a path between the
  // first and last rooms.

  if (data.rooms.length >= 2) {
    var startRoom = data.rooms[0];
    var endRoom = data.rooms[data.rooms.length - 1];
    var sx = Math.floor(startRoom.x + startRoom.width / 2);
    var sy = Math.floor(startRoom.y + startRoom.height / 2);
    var ex = Math.floor(endRoom.x + endRoom.width / 2);
    var ey = Math.floor(endRoom.y + endRoom.height / 2);

    var pathJSON = pb.nav.findPath(sx, sy, ex, ey);
    var path = JSON.parse(pathJSON);

    if (path.length > 0) {
      pb.log("Pathfinding: found route (" + path.length + " steps) from room 0 to room " + (data.rooms.length - 1));

      // Mark the path on a high tile ID so it shows up in the viewport
      for (var pi = 0; pi < path.length; pi++) {
        pb.tilemap.setTile(1, path[pi].x, path[pi].y, 20); // ID 20 = path marker
      }
    } else {
      pb.log("Pathfinding: no route found (rooms may not be connected)");
    }
  }

  // ── Done! ────────────────────────────────────────────────────
  pb.log("");
  pb.log("=== Dungeon ready! ===");
  pb.log("Tile legend: 1=floor, 2=corridor, 3=door");
  pb.log("Furniture: 10=table, 11=chair, 12=chest, 13=bed, 14=bookcase, 15=barrel, 16=torch, 17=rug");
  pb.log("Path marker: 20 (magenta trail between room 0 and last room)");
  pb.log("");
  pb.log("Try changing SEED, DUNGEON_WIDTH, DUNGEON_HEIGHT, or SPLIT_DEPTH");
  pb.log("at the top of the script, then hit Run again!");
}

// ═══════════════════════════════════════════════════════════════════
// onTick — called every frame while running
// ═══════════════════════════════════════════════════════════════════

function onTick(dt) {
  // The dungeon is static, so we don't need per-frame updates.
  // In a real game you might:
  //   - Move NPCs along patrol paths
  //   - Animate torch flicker (pb.light.setIntensity with sin wave)
  //   - Check player input (pb.input.isKeyPressed)
  //   - Update AI state machines (pb.ai.*)
}
