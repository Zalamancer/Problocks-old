# Research: Core Technology Evaluation
**Date:** 2026-03-28 | **Area:** full-system

## Question
What technologies should Problocks use for each subsystem of the educational simulation platform?

## Findings

### 3D Rendering
- **Options evaluated:** Three.js (mature WebGL), Babylon.js (feature-rich WebGL/WebGPU), PlayCanvas (lightweight), custom WebGPU renderer
- **Decision:** Babylon.js for 3D (WebGPU native, PBR), PixiJS for 2D (circuits, diagrams)
- **Abstraction layer required:** Simulations target `@problocks/renderer`, not Babylon.js directly, allowing backend swap

### Physics
- **Options evaluated:** Cannon-es (JS), Rapier (Rust/WASM), Ammo.js (Bullet port), matter.js (2D JS)
- **Decision:** Rapier for 3D (fast, deterministic), matter.js for 2D (lightweight, proven)
- **Architecture rule:** Physics runs on host at native speed, NOT inside the QuickJS sandbox

### Scripting & Sandbox
- **Language decision:** TypeScript -- Claude's best language for code generation, students know it, browser-native, massive ecosystem
- **Sandbox decision:** QuickJS compiled to WASM -- lightweight JS engine, zero ambient authority (no DOM, no network, no filesystem), proven by Figma for plugin sandboxing
- **Rejected:** Lua/Wasmoon (students don't know Lua, Claude is less fluent, smaller ecosystem), Python/Pyodide (CVE-2025-68668 sandbox escape vulnerability)
- **Benchmark results (2026-03-28):** QuickJS is ~95x slower than V8 for raw physics compute, but game logic fits comfortably in 60fps frame: 3.25ms for 50-entity collision/scoring, 0.53ms for 200-gate circuit evaluation

### Editor (Studio)
- **Decision:** Web-based visual editor (React + WebGL/WebGPU viewport)
- **Two creation paths:** Web Studio (primary, works on Chromebooks) and CLI vibecoding with Claude Code (power users)

### Backend/Platform
- **Decision:** Node.js/Bun + PostgreSQL + Redis
- **Real-time:** WebSocket (initial), WebRTC (future for P2P)

### Simulation Modules
- **Strategy:** Wrap proven open-source libraries, do NOT build from scratch
- **Key wraps:** Falstad (circuits), 3Dmol.js (chemistry), math.js (graphing), Rapier constraints (mechanisms), LiquidFun (fluids)

## Sources
- QuickJS-in-WASM benchmark (local: `benchmarks/quickjs-sandbox/`)
- Figma plugin sandboxing architecture blog
- CVE-2025-68668 (Pyodide sandbox escape)
- WebAssembly security specification
- Competitive analysis of educational simulation platforms (see 003-edu-sim-landscape.md)

## Implications
- Web-first approach confirmed; TypeScript + QuickJS sandbox is the execution model
- Physics on host, game logic in sandbox -- this is a non-negotiable architecture rule
- Open-source simulation modules reduce domain expertise requirements
- Need to define `@problocks/sdk` API surface (as `.d.ts`) before writing any module code
