# Sprint 001
**Dates:** 2026-03-28 to TBD | **Status:** in-progress

## Goals
- Validate core sandbox performance (go/no-go for QuickJS-in-WASM)
- Set up project infrastructure (monorepo, build tools)
- Begin engine core prototype

## Tasks

### Completed
- [x] QuickJS-in-WASM performance benchmark (see `benchmarks/quickjs-sandbox/`)
  - Game logic (50 entities, collision/scoring): 3.25ms per frame -- PASS
  - Circuit evaluation (200 gates, 100 cycles): 0.53ms per frame -- PASS
  - Raw physics: ~95x slower than V8 -- confirms architecture rule: physics on host
- [x] Research: founder's vision, competitive landscape, sandbox security, scripting language analysis, devil's advocate review (docs/research/002-006)
- [x] Platform design specification finalized (docs/superpowers/specs/)

### In Progress
- [ ] Initialize monorepo structure (packages/engine, packages/sdk, packages/studio, apps/web)
- [ ] Set up TypeScript + build tooling (tsconfig, bundler, linting)
- [ ] Engine core: ECS architecture (World, Scene, Entity, Components)
- [ ] Renderer abstraction: `@problocks/renderer` wrapping Babylon.js (3D) and PixiJS (2D)
- [ ] Integrate Rapier physics on host: gravity, collisions
- [ ] Integrate QuickJS sandbox: execute TypeScript that interacts with engine via message passing
- [ ] Basic `@problocks/sdk` type definitions (`.d.ts`)

### Upcoming
- [ ] `problocks dev` local preview command
- [ ] One end-to-end prototype: create simulation locally -> runs in browser sandbox
- [ ] Document engine architecture decisions
- [ ] Show prototype to 3 educators for feedback

## Retrospective
(To be filled after sprint completion)
