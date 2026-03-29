# Plan: Problocks Phased Build Order
**Date:** 2026-03-28 | **Status:** active

## Goal
Build a complete educational simulation platform across 8 subsystems, sequenced by dependency order so each phase builds on the last. Students build interactive lab tools (physics sims, circuit designers, chemistry experiments) and share them on a marketplace.

## Phases

### Phase 0 -- Validation (FIRST)
Ship one working pipeline before building anything else. Prove the core works.

1. **Benchmark QuickJS-in-WASM** with real physics simulation -- go/no-go decision on sandbox performance (DONE: game logic fits in 60fps frame)
2. **Build ONE end-to-end prototype:** create simulation locally -> upload -> runs in browser sandbox
3. **Show it to 3 educators.** Get feedback before committing to full platform scope.

### Phase 1 -- Foundation
The engine and developer tools are the bedrock. Everything else depends on them.

1. **Engine Core** -- 2D + 3D rendering, physics (Rapier/matter.js on host), TypeScript scripting sandbox (QuickJS-in-WASM)
   - ECS architecture: World -> Scene -> Entity -> Components
   - Abstraction layer: `@problocks/renderer` wraps Babylon.js/PixiJS
2. **Basic SDK** -- `@problocks/sdk` npm package with shapes, colors, physics, UI, input, camera
   - Ships with `.d.ts` type definitions (AI-friendly for Claude Code)
3. **Developer CLI** -- `problocks init`, `problocks dev` (local preview), `problocks publish`
4. **Simple web upload + play** -- share simulations via link (no marketplace yet)

### Phase 2 -- Platform
Once simulations can be created and shared, build the discovery and creation tools.

5. **Web Studio** -- Browser-based visual editor (viewport, explorer, properties, script editor)
6. **Marketplace** -- Browse, search, play, and rate simulations by category
7. **User accounts** -- Authentication, profiles, .edu verification for institutions
8. **First simulation modules** -- `@problocks/circuits` (wrapping Falstad), `@problocks/mechanics` (wrapping Rapier constraints)

### Phase 3 -- Social & Economy
Platform needs community and monetization.

9. **Social Layer** -- Friends, chat, groups (COPPA compliance required for minors)
10. **Economy** -- Virtual currency (Probux) for creator payouts via Stripe, premium tier
11. **Classroom features** -- Educator dashboard, simulation assignment, progress tracking
12. **More simulation modules** -- chemistry (3Dmol.js), math (math.js), optics

### Phase 4 -- Distribution
Reach users everywhere.

13. **Desktop client** (Tauri) -- test WebGPU in system webview first
14. **LMS integration** -- Canvas, Google Classroom
15. **Mobile client** (PWA or React Native)
16. **Institution tier** -- Admin panel, analytics, SLA

## Dependencies
```
Engine <- SDK/CLI <- Web Upload (share via link)
                  <- Web Studio <- Marketplace
                                <- Simulation Modules
                                <- User Accounts
                                <- Social Layer
                                <- Economy
                                <- Cross-platform Clients
```

## Risks
- Scope paralysis (8 subsystems, zero code) -- Phase 0 validation mitigates this
- QuickJS sandbox performance -- benchmarked and validated, architecture rule: physics on host
- Marketplace cold start -- seed with 10-20 quality sims, EduVision as flagship
- Domain module accuracy -- wrap proven open-source libs, carry accuracy disclaimers
- COPPA compliance for social features -- budget for legal review, age-gate social
- Babylon.js depends on Microsoft -- abstraction layer allows swapping to Three.js
