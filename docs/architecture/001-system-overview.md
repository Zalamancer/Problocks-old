# Architecture: System Overview
**Date:** 2026-03-28 | **Scope:** full-system

## Overview
Problocks is an educational simulation platform with 8 major subsystems. Students build interactive lab tools (physics sims, circuit designers, chemistry experiments, engineering projects) and share them on a marketplace. The engine and developer tools form the foundation; everything else connects through a central API layer.

## Components

```
+---------------------------------------------------------+
|                     CLIENTS                              |
|  +----------+  +----------+  +----------+               |
|  |   Web    |  | Desktop  |  |  Mobile  |               |
|  | (React)  |  | (Tauri)  |  |  (PWA)   |               |
|  +----+-----+  +----+-----+  +----+-----+               |
+-------|--------------|--------------|-----------+--------+
        |              |              |
        +--------------+--------------+
                       |
        +--------------v--------------+
        |       API GATEWAY           |
        |    (Auth, Rate Limiting)    |
        +--------------+--------------+
                       |
  +--------------------+--------------------+
  |                    |                    |
  v                    v                    v
+----------+  +--------------+  +--------------+
| Platform |  | Simulation   |  |   Social     |
| Service  |  | Servers      |  |   Service    |
|          |  |              |  |              |
| -Browse  |  | -Engine      |  | -Friends     |
| -Search  |  | -Physics     |  | -Chat        |
| -Ratings |  | -Sandbox     |  | -Groups      |
+----+-----+  +------+-------+  +------+-------+
     |               |                 |
     v               v                 v
+----------+  +--------------+  +--------------+
| Economy  |  |   Asset      |  |   User       |
| Service  |  |   Storage    |  |   Service    |
|          |  |              |  |              |
| -Currency|  | -Sim files   |  | -Auth        |
| -Payouts |  | -Assets      |  | -Profiles    |
| -Stripe  |  | -CDN         |  | -Sessions    |
+----------+  +--------------+  +--------------+

  +-----------------------------------------------+
  |       PROBLOCKS ENGINE (shared core)           |
  |  +---------+ +--------+ +----------+ +------+ |
  |  |Renderer | |Physics | |Scripting | | Sim  | |
  |  |(2D + 3D)| |(Rapier/| | Sandbox  | |Module| |
  |  |         | |matter) | |(QuickJS) | |  s   | |
  |  +---------+ +--------+ +----------+ +------+ |
  +-----------------------------------------------+

  +-----------------------------------------------+
  |           DEVELOPER TOOLS                      |
  |  +---------+ +--------+ +-----------------+   |
  |  |problocks| |SDK/API | |Dev Docs         |   |
  |  |CLI      | |(npm)   | |(AI-friendly)    |   |
  |  +---------+ +--------+ +-----------------+   |
  +-----------------------------------------------+

  +-----------------------------------------------+
  |           STUDIO (web editor)                  |
  |  +---------+ +--------+ +---------+           |
  |  |Viewport | |Explorer| | Script  |           |
  |  |(2D/3D)  | | (Tree) | | Editor  |           |
  |  +---------+ +--------+ +---------+           |
  +-----------------------------------------------+
```

## Data Flow

1. **Creator flow (CLI):** Student installs `@problocks/cli` -> vibecodes simulation with Claude Code -> runs `problocks dev` for local preview -> runs `problocks publish` to upload to marketplace
2. **Creator flow (Studio):** Student opens web Studio -> builds simulation visually -> one-click publish to marketplace
3. **Player flow:** User browses marketplace -> clicks Play -> simulation loads in browser sandbox (single-player) or connects to Simulation Server (multiplayer)
4. **Economy flow:** Virtual currency (Probux) -> creator earns when others play their simulations -> Stripe payout

## Execution Model

```
Single-player sim -> runs in player's browser (QuickJS WASM sandbox) -> FREE
Multiplayer sim   -> server instance (scale-to-zero) -> pay-per-use
```

**Key architecture rule:** Physics runs on HOST (Rapier/matter.js at native speed). QuickJS sandbox handles game logic, events, and UI only.

## Interfaces
- **Engine <-> Studio:** Engine runs embedded in Studio's viewport; Studio manipulates engine scene graph
- **Engine <-> Simulation Server:** Server runs headless engine instance; clients connect and receive state updates
- **All services <-> API Gateway:** REST/GraphQL APIs with JWT auth
- **Simulation Server <-> Client:** WebSocket for real-time state sync
- **Student code <-> Engine:** Message passing (JSON commands) through sandbox boundary

## Constraints
- Engine must run in browser (WebGL/WebGPU) -- no native-only features
- Server-authoritative multiplayer -- clients never trusted
- All user code runs in QuickJS WASM sandbox (zero ambient authority: no DOM, no network, no filesystem)
- Resource limits on sandbox: 100ms/frame execution, 10MB memory, instruction counter for infinite loops
- Physics runs on host, NOT inside sandbox (performance requirement validated by benchmarks)
