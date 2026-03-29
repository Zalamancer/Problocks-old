# Feature: Core Features Inventory
**Date:** 2026-03-28 | **Priority:** P0 | **Complexity:** high

## Description
Complete feature inventory across all 8 Problocks subsystems for the educational simulation platform.

## Feature Map

### 1. Engine Core
| Feature | Description | Priority |
|---------|-------------|----------|
| 3D rendering (meshes, materials, lighting) | Babylon.js (WebGPU), abstracted via `@problocks/renderer` | P0 |
| 2D rendering (shapes, sprites, diagrams) | Canvas API + PixiJS for circuits, 2D physics | P0 |
| Physics simulation (3D) | Rapier via WASM -- runs on host, not in sandbox | P0 |
| Physics simulation (2D) | matter.js -- runs on host, not in sandbox | P0 |
| TypeScript scripting sandbox | QuickJS-in-WASM, zero ambient authority | P0 |
| Particle effects | ParticleEmitter for visual effects | P1 |
| Audio system | Sound playback and spatial audio | P1 |
| Animation system | Keyframe animation, skeletal animation | P1 |
| Character system | Avatars, movement, interactions | P2 |

### 2. SDK & Developer Tools
| Feature | Description | Priority |
|---------|-------------|----------|
| `@problocks/sdk` npm package | Shapes, colors, physics, UI, input, camera | P0 |
| `.d.ts` type definitions | AI-friendly types so Claude Code generates correct code | P0 |
| `problocks init` | Scaffold simulation from template | P0 |
| `problocks dev` | Local preview mimicking production sandbox | P0 |
| `problocks publish` | Upload to marketplace | P0 |
| Tiered capabilities (Tier 1/2/3) | Basic -> Domain modules -> Advanced (review required) | P1 |

### 3. Web Studio (Browser Editor)
| Feature | Description | Priority |
|---------|-------------|----------|
| 2D/3D viewport with manipulation | Visual scene editing in browser | P0 |
| Explorer panel (scene tree) | Hierarchical entity browser | P0 |
| Properties panel | Component property editing | P0 |
| Script editor with TypeScript syntax | Monaco-based editor with IntelliSense | P0 |
| Asset browser | Import/manage models, textures, sounds | P1 |
| Live simulation preview | Test simulation in editor | P1 |
| Plugin system | Extend studio functionality | P2 |

### 4. Marketplace
| Feature | Description | Priority |
|---------|-------------|----------|
| Browse by category | Physics, Circuits, Chemistry, Engineering, Biology, Math, CS | P0 |
| Search (full-text, tags) | Discover simulations | P0 |
| Simulation pages | Title, author, description, screenshots, play button | P0 |
| Curriculum tags | AP Physics, IB Chemistry, etc. | P1 |
| Ratings and reviews | Community feedback | P1 |
| Featured / trending | Editorial curation and algorithms | P1 |

### 5. Social Layer
| Feature | Description | Priority |
|---------|-------------|----------|
| User accounts and authentication | Email, OAuth, .edu verification | P0 |
| User profiles | Published simulations, stats, badges | P1 |
| Friends list | Add/remove, see online status | P1 |
| Real-time chat | Text messaging | P1 |
| Groups/communities | Subject-based communities | P2 |
| Collaborative play | Multiple students in one simulation | P2 |

### 6. Economy
| Feature | Description | Priority |
|---------|-------------|----------|
| Virtual currency (Probux) | Earned and spent on platform | P1 |
| Creator payouts | Students earn when others play their simulations (Stripe) | P1 |
| Premium tier | More compute, advanced capabilities, priority review | P2 |
| Institution tier | Classroom management, analytics, SLA | P2 |

### 7. Simulation Modules (Open-Source Wraps)
| Module | Wraps | Domain | Priority |
|--------|-------|--------|----------|
| `@problocks/circuits` | Falstad circuit-simulator, digital-logic-sim | Electronics | P1 |
| `@problocks/mechanics` | Rapier constraints (gears, springs, linkages) | Mechanical eng | P1 |
| `@problocks/chemistry` | 3Dmol.js, RDKit.js, Kekule.js | Molecular/reactions | P2 |
| `@problocks/physics-2d` | matter.js | 2D physics sims | P1 |
| `@problocks/physics-3d` | Rapier | 3D physics sims | P1 |
| `@problocks/math` | math.js, function-plot | Graphing/calculus | P2 |
| `@problocks/optics` | Custom ray-tracing (WebGL) | Light/lenses | P2 |
| `@problocks/fluids` | LiquidFun (2D particles) | Fluid dynamics | P2 |

### 8. Classroom & Education Features
| Feature | Description | Priority |
|---------|-------------|----------|
| Classroom dashboard | Educators assign simulations to students | P1 |
| Progress tracking | Did the student complete the lab? | P1 |
| Version pinning | Educators pin simulations to specific versions | P1 |
| LMS integration | Canvas, Google Classroom | P2 |
| Institution accounts | School/university admin panel | P2 |

### 9. Cross-platform Clients
| Feature | Priority |
|---------|----------|
| Web client (browser) -- primary | P0 |
| Desktop client (Tauri) | P1 |
| Mobile client (PWA) | P2 |
