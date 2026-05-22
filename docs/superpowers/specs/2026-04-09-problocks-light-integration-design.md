# Problocks Light Integration into ProBlocks

**Date:** 2026-04-09
**Status:** In Progress
**Approach:** Parallel Streams (Stream A: Engine, Stream B: Education Platform)

## Decision Summary

Merge Problocks Light (vanilla JS + PixiJS 2D edu-game) into the ProBlocks monorepo (React + TS + Babylon.js/PixiJS). All JS converted to TS. Educational game features (NPC encounters, adaptive learning, economy) become SDK-level modules any creator can use.

## Hardware Detection & Marketplace Filtering

Device tier detection at first load: `low | mid | high` based on `deviceMemory`, `hardwareConcurrency`, WebGL renderer string, and a quick canvas benchmark.

- 2D games → always `minTier: 'low'`
- 3D games with `hasLowPolyMode` and `maxVertices <= 100000` → `minTier: 'low'`
- 3D games without low-poly mode → `minTier: 'mid'` or `'high'`

Low-tier devices: marketplace hides games above their tier unless teacher-assigned (show warning banner).

## Stream A — Engine Enhancement

### Tilemap: Wang Tile System (`tilemap/wang-tile.ts`)
- 4-corner vertex-based tile selection (16-tile Wang sets)
- Terrain transition definitions (water↔sand, sand↔grass, grass↔dirt, grass↔cobblestone)
- Vertex grid builder for corner terrain resolution
- Pure terrain and multi-terrain fallback lookup

### Procgen: Simplex Noise (`procgen/simplex-noise.ts`)
- Seeded 2D Simplex noise (Stefan Gustavson, adapted for determinism)
- SeededRNG (LCG-based) for deterministic object/NPC placement

### Procgen: World Generation (`procgen/world-gen.ts`)
- Terrain generation: base noise + detail + radial bias → threshold classification
- Terrain band enforcement: multi-pass smoothing for valid adjacencies
- Town plaza stamping
- Zone detection: town, cave, beach, farm, forest
- Zone-based object placement with density/spacing rules
- Bridge detection and placement
- NPC placement in town zones
- Player spawn point search

### NPC System (`npc/`)
- NPC entity with sprite, position, interaction radius
- Dialogue state machine
- Proximity detection
- SDK: `pb.spawnNPC()`, `pb.setDialogue()`, `pb.onNPCInteract()`

### Player 2D Controller (`player/player-2d.ts`)
- 8-direction sprite movement with per-axis collision
- Hitbox-based collision against tilemap
- Camera follow with boundary constraints

### Hardware Detection (`platform/hardware-detect.ts`)
- Device tier classification
- GPU capability detection via WebGL renderer string
- Memory and CPU core detection

## Stream B — Education Platform (Supabase)

### Learning Package (`packages/learning/`)
- Question selection with adaptive difficulty
- Mastery tracking per student per subtopic
- Difficulty adjustment based on streaks

### Economy Package (`packages/economy/`)
- Coins/XP reward calculation by difficulty
- Level progression
- Transaction logging

### Supabase Schema
- Migrate from Express+PostgreSQL to Supabase
- Tables: question_cache, answer_log, student_mastery, player_profiles

## Backend

All backend on Supabase (PostgreSQL). Fresh design for Supabase, not porting Express code.
