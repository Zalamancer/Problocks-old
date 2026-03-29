# Update: Project Kickoff
**Date:** 2026-03-28 | **Type:** milestone

## Summary
Problocks project officially started as an educational simulation platform. Established project vision, completed critical sandbox benchmark, and built comprehensive research foundation.

## Changes
- Defined platform vision: educational simulation marketplace where students vibecode lab tools with Claude Code CLI or web studio
- Completed QuickJS-in-WASM performance benchmark (`benchmarks/quickjs-sandbox/`)
  - Game logic: 3.25ms/frame (50 entities) -- fits 60fps budget
  - Circuit evaluation: 0.53ms/frame (200 gates) -- fits 60fps budget
  - Confirmed architecture rule: physics on host (Rapier/matter.js), game logic in sandbox
- Conducted 5 research studies: founder's vision, competitive landscape, sandbox security, scripting language analysis, devil's advocate review
- Finalized platform design specification covering all 8 subsystems
- Scaffolded complete `docs/` structure with 9 sections
- Decided on TypeScript + QuickJS sandbox (rejected Lua/Wasmoon and Python/Pyodide)
- Identified simulation module strategy: wrap open-source libs (Falstad, 3Dmol.js, math.js, etc.)

## Next Steps
- Initialize monorepo structure and build tooling
- Build engine core: ECS architecture, renderer abstraction, physics integration
- Integrate QuickJS sandbox with engine via message passing
- Define `@problocks/sdk` API surface as `.d.ts` types
- Build one end-to-end prototype: create locally -> runs in browser sandbox
- Show prototype to 3 educators for validation
