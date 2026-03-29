# Problocks Platform — Design Specification
**Date:** 2026-03-28 | **Status:** Final Draft

---

## 1. Vision

Problocks is an educational simulation platform where students build, share, and monetize interactive lab tools — physics simulations, circuit designers, chemistry experiments, engineering projects, and more. Think "Roblox for education" with a social/gaming layer where students earn real money when others play their creations.

**What makes it unique (no competitor has all of these):**
- Student-created simulations (not pre-built)
- Multi-discipline (physics, circuits, chemistry, engineering, biology, math)
- AI-assisted creation — students vibecode with Claude Code on their own machines
- Marketplace with virtual currency and creator payouts
- 2D + 3D engine with characters, GUIs, scripting
- Social layer (friends, chat, groups, collaborative play)
- Open-source simulation modules wrapped from proven expert-built libraries

**Existing product:** EduVision (digital logic gates/circuits, 2D) — will be rebuilt as the flagship Problocks simulation.

---

## 2. Target Users

| User | Description | Primary Path |
|------|-------------|-------------|
| **Student Creator** | Builds simulations using Claude Code CLI or web studio | CLI vibecoding + web studio |
| **Student Player** | Plays/learns from simulations on the marketplace | Web browser |
| **Educator** | Assigns simulations to students, tracks progress | Classroom dashboard |
| **Institution** | School/university account managing multiple educators | Admin panel |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PROBLOCKS PLATFORM                        │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  PROBLOCKS   │    │  MARKETPLACE │    │   PLAYER     │   │
│  │  STUDIO      │    │  (Browse,    │    │   CLIENT     │   │
│  │  (Web Editor)│    │   Search,    │    │   (Run sims) │   │
│  │              │    │   Rate)      │    │              │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
│         │                   │                   │           │
│  ┌──────┴───────────────────┴───────────────────┴───────┐   │
│  │                   API GATEWAY                         │   │
│  │          (Auth, Rate Limiting, Routing)               │   │
│  └───┬──────────┬──────────┬──────────┬─────────────────┘   │
│      │          │          │          │                      │
│  ┌───▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼──────┐             │
│  │ Sim   │ │ Asset  │ │ User/  │ │ Economy  │             │
│  │Servers│ │Service │ │Social  │ │ Service  │             │
│  │       │ │        │ │Service │ │          │             │
│  │-Engine│ │-Storage│ │-Auth   │ │-Currency │             │
│  │-Physic│ │-CDN    │ │-Friends│ │-Payouts  │             │
│  │-Script│ │-Review │ │-Chat   │ │-Purchases│             │
│  │-Sndbox│ │-Version│ │-Groups │ │-Stripe   │             │
│  └───────┘ └────────┘ └────────┘ └──────────┘             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              PROBLOCKS ENGINE (shared core)           │   │
│  │  ┌─────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐  │   │
│  │  │Renderer │ │Physics │ │Scripting │ │Simulation │  │   │
│  │  │(2D + 3D)│ │Engine  │ │Sandbox   │ │Modules    │  │   │
│  │  └─────────┘ └────────┘ └──────────┘ └───────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              DEVELOPER TOOLS                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────────┐    │   │
│  │  │problocks │ │SDK/API   │ │Dev Docs           │    │   │
│  │  │CLI       │ │(npm pkg) │ │(AI-friendly .d.ts)│    │   │
│  │  └──────────┘ └──────────┘ └───────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Engine Design

### 4.1 Core Architecture (ECS-based)

```
World → Scene → Entity → Components (Position, Mesh, Physics, Script, UI...)
```

The engine runs in TWO modes from the same codebase:
- **Studio mode:** Full rendering + editing tools + live preview
- **Player mode:** Rendering + sandbox execution (client or server)

### 4.2 Rendering

| Mode | Technology | Use Case |
|------|-----------|----------|
| 2D | Canvas API + PixiJS | Circuits, 2D physics, diagrams |
| 3D | Babylon.js (WebGPU) | 3D worlds, characters, engineering |
| UI | React overlay | Menus, HUD, sliders, data displays |

**Abstraction layer required:** Simulations target `@problocks/renderer`, not Babylon.js directly. This allows swapping the backend later without breaking student code.

### 4.3 Physics

| Mode | Technology | Source |
|------|-----------|--------|
| 2D | matter.js | Open source, proven |
| 3D | Rapier (Rust → WASM) | Open source, deterministic, fast |

### 4.4 Scripting & Sandbox

**Language:** TypeScript

**Sandbox:** QuickJS compiled to WASM (proven by Figma at scale)
- Student TypeScript → compiled to JS → executed in QuickJS sandbox
- Zero ambient authority (no DOM, no network, no filesystem)
- Only @problocks/sdk APIs available
- Resource limits: 100ms/frame, 10MB memory, instruction counter for infinite loops

**Script types (like Roblox):**
- **Client Scripts** — run on player's machine (UI, input, local effects)
- **Server Scripts** — run on server (game logic, authoritative state)
- **Module Scripts** — reusable code, importable by both

**State containers (like Roblox):**
- **ClientStorage** — client-only state
- **ServerStorage** — server-only state (hidden from clients)
- **SharedStorage** — replicated to all clients
- **DataStore** — persistent player data (save progress)

### 4.5 Execution Model (Hybrid)

```
Single-player sim → runs in player's browser (WASM sandbox) → FREE
Multiplayer sim   → server instance (serverless, scale-to-zero) → pay-per-use
```

**VALIDATED (2026-03-28):** QuickJS-in-WASM is ~95x slower than V8 for raw physics compute, BUT game logic (what actually runs in the sandbox) fits comfortably in a 60fps frame:
- Game logic (50 entities, collision/scoring): 3.25ms per frame ✅
- Circuit evaluation (200 gates, 100 cycles): 0.53ms per frame ✅
**Architecture rule:** Physics runs on HOST (Rapier/matter.js, native speed). Sandbox handles game logic, events, UI only.

---

## 5. Simulation Modules (Open Source Integrations)

**Strategy:** Do NOT build domain simulation libraries from scratch. Wrap proven open-source projects built by domain experts.

| Module | Wraps | Domain |
|--------|-------|--------|
| `@problocks/circuits` | Falstad circuit-simulator, digital-logic-sim | Electronics |
| `@problocks/mechanics` | Rapier constraints (gears, springs, linkages) | Mechanical eng |
| `@problocks/chemistry` | 3Dmol.js, RDKit.js, Kekule.js | Molecular/reactions |
| `@problocks/physics-2d` | matter.js | 2D physics sims |
| `@problocks/physics-3d` | Rapier | 3D physics sims |
| `@problocks/math` | math.js, function-plot | Graphing/calculus |
| `@problocks/optics` | Custom ray-tracing (WebGL) | Light/lenses |
| `@problocks/fluids` | LiquidFun (2D particles) | Fluid dynamics |

Each module provides a safe, documented API that students import. The underlying open-source lib runs inside the sandbox.

---

## 6. SDK & Tiered Capabilities

### Tier 1: Basic (instant publish, no review)
```typescript
import { World, Entity, Shape, Color, Physics, Camera, Light, UI } from '@problocks/sdk';
```
Math, shapes, colors, physics, UI sliders, input handling, camera control.

### Tier 2: Domain Modules (instant publish, opt-in)
```typescript
import { Circuit, Wire, Gate, LED } from '@problocks/circuits';
import { Gear, Spring, Linkage } from '@problocks/mechanics';
```
Pre-wrapped open-source simulation libraries.

### Tier 3: Advanced (requires review before publish)
```typescript
import { Multiplayer, Storage, Network } from '@problocks/advanced';
```
Networking, persistent storage, custom shaders, external data.

### SDK Distribution
- Published as `@problocks/sdk` on npm
- Ships with `.d.ts` type definitions (so IDE gives errors for unavailable APIs)
- Ships with local sandbox emulator (`problocks dev` mimics production sandbox exactly)
- AI-friendly documentation: structured so Claude Code can read and generate correct code

---

## 7. File Format: `.pblx`

**NOTE:** Don't finalize format until 10+ working simulations exist. Use plain directories during development.

**Planned structure:**
```
my-simulation.pblx (ZIP archive)
├── manifest.json          ← metadata, capabilities, version
├── src/
│   └── index.ts           ← entry point
│   └── components/        ← student code
├── assets/
│   ├── models/            ← 3D models (.glb)
│   ├── textures/          ← images
│   └── sounds/            ← audio
├── preview.png            ← marketplace thumbnail
└── README.md              ← description
```

**Security:** Zip bomb detection (max decompressed size, max file count), path traversal sanitization, signed manifests.

### 7.1 Versioning & Updates

**Semver model:**
```bash
problocks publish                    → v1.0.0 (first publish)
problocks publish --patch "fix bug"  → v1.0.1 (bugfix)
problocks publish --minor "add lab"  → v1.1.0 (new feature)
problocks publish --major "rewrite"  → v2.0.0 (breaking change)
```

**Immutable snapshots:** Every publish creates a permanent, immutable `.pblx` snapshot. Old versions are never deleted or modified.

**Player behavior:** Players always get the latest LIVE version. Changelog visible on the simulation page.

**Developer dashboard actions:**
- **Rollback** — instantly make a previous version LIVE again
- **Restore** — download a previous version's source for editing
- **Diff** — compare changes between any two versions
- **Unpublish** — remove from marketplace (existing classroom pins still work, cached)
- **Transfer** — transfer ownership to another user

**Educator version pinning:** When assigning a simulation to a class, educators can pin to a specific version. Students always get the pinned version, even if newer versions exist. Educators see a notification when updates are available and can choose to upgrade the pin.

**Storage model:**
```
simulations/{sim-id}/
  manifest.json
  versions/
    1.0.0.pblx    ← immutable
    1.0.1.pblx
    1.1.0.pblx
    1.2.0.pblx
  live → 1.2.0    ← pointer to active version
```

Each `.pblx` is a complete self-contained snapshot. No delta patching — simpler, reliable, easy rollback.

---

## 8. Developer Workflow

### Path A: Vibecoding (Power Users)
```bash
npm install -g @problocks/cli
problocks init pendulum-lab --template physics
# Student vibecodes with Claude Code CLI using @problocks/sdk docs
problocks dev          # local preview in browser
problocks publish      # upload to marketplace
```

### Path B: Web Studio (Primary Path)
- Browser-based visual editor (like Roblox Studio in-browser)
- 3D/2D viewport, explorer panel, properties panel, script editor
- Built-in simulation preview
- One-click publish to marketplace
- No installation required — works on Chromebooks

Both paths produce the same output: a simulation that runs on the platform.

---

## 9. Marketplace

### Discovery
- Browse by category: Physics, Circuits, Chemistry, Engineering, Biology, Math, CS, Earth Science
- Search (full-text, tags)
- Featured / trending / highest rated
- Curriculum tags (AP Physics, IB Chemistry, etc.)

### Simulation Pages
- Title, author, description, screenshots/video
- Play button, rating, favorites, share
- Version history
- "Used in: [institution names]"

### Education Features
- **Classrooms:** Educators assign simulations to students
- **Progress tracking:** Did the student complete the lab?
- **Institution accounts:** School/university admin, .edu verification
- **LMS integration:** Canvas, Google Classroom (future)

---

## 10. Economy

| Feature | Description |
|---------|-------------|
| **Virtual currency** | "Probux" or similar — earned and spent on platform |
| **Creator payouts** | Students earn when others play their simulations |
| **In-sim purchases** | Optional premium content within simulations |
| **Payment integration** | Stripe for payouts and purchases |
| **Premium tier** | More compute, advanced capabilities, priority review |
| **Institution tier** | Classroom management, analytics, SLA |

---

## 11. Social Layer

| Feature | Description |
|---------|-------------|
| Friends | Add/remove, see online status |
| Chat | Real-time messaging (text) |
| Groups | Create/join communities around subjects |
| Profiles | Published simulations, stats, badges |
| Collaborative play | Multiple students in one simulation |

**COPPA compliance required:** If users under 13, need verifiable parental consent, data minimization, privacy policy review. Budget for legal review.

---

## 12. Cross-Platform

| Priority | Platform | Technology |
|----------|----------|------------|
| P0 | Web (browser) | React + Babylon.js + WebGPU |
| P1 | Desktop (Win/Mac) | Tauri wrapper (test WebGPU in system webview first) |
| P2 | Mobile | React Native or PWA |

---

## 13. Phased Build Order

### Phase 0 — Validation (FIRST)
1. **Benchmark QuickJS-in-WASM** with real physics simulation. Go/no-go decision.
2. **Build ONE end-to-end prototype:** create locally → upload → runs in browser sandbox.
3. **Show it to 3 educators.** Get feedback.

### Phase 1 — Foundation
1. Engine core: renderer (2D + 3D), physics, scripting sandbox
2. Basic SDK: shapes, colors, physics, UI, input
3. Problocks CLI: init, dev, publish
4. Simple web upload + play (share via link)

### Phase 2 — Platform
5. Web Studio: visual editor in browser
6. Marketplace: browse, search, play, rate
7. User accounts, profiles, authentication
8. First simulation modules: circuits (wrapping Falstad), mechanics (wrapping Rapier)

### Phase 3 — Social & Economy
9. Friends, chat, groups
10. Virtual currency, creator payouts (Stripe)
11. Classroom/educator features
12. More simulation modules: chemistry, math, optics

### Phase 4 — Scale
13. Desktop client (Tauri)
14. LMS integration
15. Mobile client
16. Institution tier

---

## 14. Known Risks & Mitigations

| Risk | Level | Mitigation |
|------|-------|-----------|
| QuickJS too slow for physics | Critical | Benchmark FIRST. Fallback: V8 isolates. |
| Scope paralysis (8 subsystems) | Critical | Phase 0 validation before building anything else. |
| COPPA compliance (minors + social) | High | Budget for legal review. Age-gate social features. |
| Babylon.js depends on Microsoft | Medium-High | Abstraction layer. Could swap to Three.js. |
| QuickJS single maintainer | High | Monitor project health. Fallback: V8 isolates. |
| Marketplace cold start | High | Seed with 10-20 quality sims. EduVision as flagship. |
| Domain module accuracy | High | Wrap proven open-source libs, not custom. Disclaimers. |
| SDK version drift (local vs platform) | Medium | Ship .d.ts types. Sandbox emulator in `problocks dev`. |
| Serverless multiplayer costs | Medium | Start with simple WebSocket servers (Fly.io). |

---

## 15. Document Cleanup Required

The following docs from the initial session describe a Roblox clone and must be updated to match this spec:
- `docs/architecture/001-system-overview.md` — references Luau, Probux as game currency
- `docs/decisions/001-tech-stack.md` — references Wasmoon/Lua, game servers
- `docs/plans/001-initial-plan.md` — references Roblox class hierarchy
- `docs/features/001-core-features.md` — framed as games, not educational sims
- `docs/sprints/sprint-001.md` — includes Wasmoon integration task
- `docs/research/001-initial-research.md` — evaluates Lua options

These will be reconciled to match this specification.
