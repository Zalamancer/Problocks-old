# Problocks

An educational simulation platform where students build, share, and monetize interactive lab tools. Physics engines, circuit designers, chemistry experiments, engineering projects — vibecoded with AI, played by anyone.

**Live:** [marketplace-sigma-ebon.vercel.app](https://marketplace-sigma-ebon.vercel.app)

## What is Problocks?

Problocks is "Roblox for education" — a platform where students create interactive STEM simulations using TypeScript, run them in a secure 3D sandbox, and share them on a marketplace. Creators earn virtual currency (Probux) when others play their simulations.

### Key Features

- **3D Engine** — Babylon.js rendering + Rapier physics, running at 60 FPS
- **Secure Sandbox** — Student code executes in QuickJS WASM with zero access to files, network, or DOM
- **Web Studio** — Browser-based editor with Monaco (VS Code editor), live script execution, 3D viewport
- **CLI Tools** — `problocks init`, `dev`, `build`, `publish`, `clone`
- **Marketplace** — Browse, search, filter, play, rate, fork simulations
- **7 Templates** — Physics, circuits, chemistry, engineering, biology, math, blank
- **Classroom System** — Educators create classes, assign simulations, track completion
- **Economy** — Probux virtual currency, creator payouts, earnings dashboard
- **Multiplayer** — WebSocket server for collaborative simulations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| 3D Rendering | Babylon.js (WebGPU/WebGL) |
| Physics | Rapier 3D (Rust compiled to WASM) |
| Scripting Sandbox | QuickJS compiled to WASM |
| Code Editor | Monaco Editor (VS Code engine) |
| Frontend | React 19 + TypeScript + Tailwind CSS + shadcn/ui |
| Backend API | Hono + SQLite (better-sqlite3) |
| Auth | JWT (bcryptjs) |
| Multiplayer | WebSocket (ws) |
| CLI | Commander.js + chalk + ora |
| Deployment | Vercel (frontend) + Fly.io (API) |

## Architecture

```
packages/
  engine/       — 3D engine core (ECS, Babylon.js renderer, Rapier physics, QuickJS sandbox)
  sdk/          — Student-facing API (Shape, Color, Math helpers)
  cli/          — CLI tools (init, dev, build, publish, clone)
  circuits/     — Digital logic simulation module (Gate, Circuit, Switch, LED, Wire)
  mechanics/    — Mechanical engineering module (Gear, Spring, Linkage, Motor)

apps/
  web-studio/   — Browser-based visual editor (Monaco + 3D viewport)
  marketplace/  — Marketplace frontend (landing, explore, play, profiles, classrooms)
  api/          — Backend API (Hono + SQLite)
  multiplayer/  — WebSocket server for real-time collaboration
  player/       — Standalone simulation player
```

## Quick Start

### Play Simulations

Visit [the marketplace](https://marketplace-sigma-ebon.vercel.app) and click any simulation to play it.

### Build a Simulation

```bash
# Install CLI
npm install -g @problocks/cli

# Create a new simulation
problocks init my-physics-lab --template physics

# Preview locally (loads 3D engine in browser)
cd my-physics-lab
problocks dev

# Publish to marketplace
problocks publish
```

### Clone & Improve

```bash
# Download any simulation from the marketplace
problocks clone pendulum-physics

# Edit the code
cd pendulum-physics
# Use Claude Code or any editor to modify src/index.ts

# Republish as your own
problocks publish
```

### Run Locally

```bash
# Clone the repo
git clone https://github.com/Zalamancer/Problocks.git
cd Problocks

# Install dependencies
npm install

# Start all services
cd apps/api && PORT=5001 node --import tsx/esm src/index.ts &
cd apps/web-studio && npx vite --port 4000 &
cd apps/marketplace && npx vite --port 4001 &

# Open in browser
# Studio:      http://localhost:4000
# Marketplace: http://localhost:4001
# API:         http://localhost:5001
```

## Sandbox API

Student simulations run in a QuickJS WASM sandbox with these host functions:

```javascript
// Create 3D entities
pb.createEntity("ball", "sphere", JSON.stringify({
  radius: 0.5, position: { x: 0, y: 5, z: 0 },
  mass: 1.0, color: "#ff4444", restitution: 0.6,
}));

// Physics
pb.applyForce("ball", 0, 50, 0);
pb.applyImpulse("ball", 5, 10, 0);

// Read state
var pos = parseVec3(pb.getPosition("ball")); // pos.x, pos.y, pos.z
var vel = parseVec3(pb.getVelocity("ball"));

// Lifecycle
function onStart() { /* create entities */ }
function onTick(dt) { /* game logic each frame */ }
```

## CLI Templates

```bash
problocks init my-sim --template physics      # balls, ramps, gravity
problocks init my-sim --template circuits     # logic gates, LEDs
problocks init my-sim --template chemistry    # molecules, bonds
problocks init my-sim --template engineering  # gears, motors
problocks init my-sim --template biology      # cell division
problocks init my-sim --template math         # 3D function plotter
problocks init my-sim --template blank        # empty template
```

## Pages

| Page | URL | Purpose |
|------|-----|---------|
| Landing | `/` | Marketing homepage |
| Explore | `/explore` | Browse/search simulations |
| Detail | `/sim/:slug` | Info, reviews, source, fork |
| Play | `/play/:slug` | Run simulation in 3D engine |
| Profile | `/user/:username` | Public creator profile |
| Dashboard | `/dashboard` | Earnings & analytics |
| Classrooms | `/classrooms` | Create/join classes |
| Docs | `/docs` | SDK API reference |
| Settings | `/settings` | Account management |

## Tests

```bash
# Run all tests (31 passing)
cd packages/engine && npx vitest run     # 20 tests (World, Entity, Scene)
cd packages/circuits && npx vitest run   # 11 tests (Gate truth tables, Circuit evaluation)
```

## Deploy

```bash
# Marketplace → Vercel
cd apps/marketplace && vercel deploy --prod

# API → Fly.io
cd apps/api && fly deploy
```

## License

MIT
