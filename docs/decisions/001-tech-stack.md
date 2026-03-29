# Decision: Initial Tech Stack
**Date:** 2026-03-28 | **Status:** accepted

## Context
Problocks needs a tech stack that supports 2D + 3D rendering in browser, TypeScript scripting in a secure sandbox, real-time multiplayer, and scales to a full educational simulation platform. Must be web-first. Students vibecode simulations with Claude Code CLI or build in a web-based studio.

## Options Considered

### Rendering
| Option | Pros | Cons |
|--------|------|------|
| Three.js | Massive ecosystem, mature, great docs | WebGL only (WebGPU experimental) |
| Babylon.js | WebGPU native, physics built-in, PBR | Heavier, steeper learning curve |
| PixiJS (2D) | Fast 2D, Canvas + WebGL | 2D only |
| Custom WebGPU | Full control, best performance | Massive effort, no ecosystem |

### Physics
| Option | Pros | Cons |
|--------|------|------|
| Rapier (WASM) | Fast, Rust-based, deterministic, 3D | WASM overhead, newer |
| matter.js | Pure JS, easy to debug, 2D | Slower, 2D only |
| Cannon-es | Pure JS, 3D | Slower, less features |
| Ammo.js | Full Bullet port, proven | Large bundle, complex API |

### Scripting / Sandbox
| Option | Pros | Cons |
|--------|------|------|
| QuickJS (WASM) | Lightweight, zero ambient authority, proven by Figma | ~95x slower than V8 for raw compute |
| V8 Isolates | Native speed, production-proven | Heavier, harder to embed in browser |
| iframe + CSP | Browser-native, no WASM needed | Weaker isolation, escape risks |
| Pyodide (Python) | Students know Python best | CVE-2025-68668 sandbox escape, heavy |

### Backend
| Option | Pros | Cons |
|--------|------|------|
| Node.js/Bun + PostgreSQL | JS ecosystem, fast dev | Single-threaded |
| Go + PostgreSQL | Great concurrency, fast | Separate language from frontend |
| Rust + PostgreSQL | Performance, safety | Slow dev speed |

## Decision
**Accepted:**
- **Rendering (2D):** Canvas API + PixiJS -- for circuits, 2D physics, diagrams
- **Rendering (3D):** Babylon.js -- native WebGPU, built-in physics integration, PBR materials
- **Physics (2D):** matter.js -- open source, proven, lightweight
- **Physics (3D):** Rapier via WASM -- fast, deterministic, good for server-side simulation
- **Scripting language:** TypeScript -- best Claude Code generation quality, students know it, massive ecosystem
- **Sandbox:** QuickJS compiled to WASM -- zero ambient authority, proven at scale by Figma
- **Frontend:** React + TypeScript
- **Backend:** Node.js/Bun + PostgreSQL + Redis
- **Real-time:** WebSocket (initial), WebRTC (future)

## Rationale
- Web-first means everything must work in browser
- TypeScript chosen over Lua/Python: Claude generates it best, students know it, browser-native, strong sandbox options via QuickJS
- QuickJS-in-WASM benchmarked: ~95x slower than V8 for raw physics, BUT game logic (what runs in sandbox) fits in 60fps frame budget -- 3.25ms for 50-entity collision/scoring, 0.53ms for 200-gate circuit evaluation
- Architecture rule: physics runs on HOST (Rapier/matter.js at native speed), sandbox handles game logic/events/UI only
- Rapier over Cannon-es for deterministic simulation (critical for multiplayer)
- Babylon.js chosen over Three.js for native WebGPU and built-in physics hooks
- Abstraction layer (`@problocks/renderer`) wraps Babylon.js so it can be swapped later
- Each subsystem decision will be refined during its own brainstorm cycle

## Consequences
- Must learn Babylon.js API deeply
- WASM dependencies (Rapier, QuickJS) add build complexity
- QuickJS single-maintainer risk -- need abstraction layer and V8 isolate fallback plan
- Simulation modules wrap open-source libs (Falstad for circuits, 3Dmol.js for chemistry, etc.) rather than building from scratch
