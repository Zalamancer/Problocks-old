# Founder's Vision: Problocks Platform
**Date:** 2026-03-28 | **Source:** Direct founder input

## Core Mission
Problocks is NOT a Roblox clone. It is an **educational platform where students can build and share interactive lab tools** — physics simulations, chemistry experiments, circuit designers, engineering projects, and more.

## Key Principles

### 1. Platform for Education Labs
- Users create their own lab tools (not games)
- Supports 2D, 3D, camera, lighting, objects, scripts, characters, multiplayer
- Marketplace of lab apps — like Roblox's game marketplace but for educational tools
- Engineering-focused: gears that mesh and move, combustion simulations, circuit design, physics engines
- Goes beyond what Roblox offers — proper engineering simulation (not just games)

### 2. Existing Product Context
- **EduVision** — existing app for digital logic gates and circuits, completely 2D with scripts and UI
- Problocks extends this vision to a full platform supporting any kind of educational simulation

### 3. "Vibecoding" Philosophy — Students Build Apps Cheaply
- Students should NOT build apps from scratch inside our platform
- Students use their OWN tools (Claude Code CLI, terminal, Claude Code website) to build apps on their own laptops
- They download a development kit / template from Problocks
- They vibecode their app using AI assistance they already pay for (their own Claude subscription)
- They upload the finished app to the Problocks marketplace
- **This is the most cost-effective design** — we don't pay for AI usage, students use tools they already have

### 4. File Format & Security Dilemma
- Need a custom file format (like Roblox's .rbxl/.rbxlx) that's configurable to our platform
- Must provide developers with instructions: what variables to use, block colors, etc.
- **Tension:** If we define strict variables/APIs → limits creativity to only what we've defined
- **Tension:** If we accept any file → massive security risk, players could get hacked
- Need a sandboxed execution model that's both flexible AND secure

### 5. Developer Experience
- Provide a set of dev docs / SDK that developers follow
- Like Roblox's creator docs but for educational lab tools
- Must be AI-friendly — docs should be structured so Claude/AI can help students build apps
- Download options: multiple formats, configurable project templates

### 6. Engineering Simulation (Beyond Roblox)
- Roblox doesn't have proper engineering design systems
- Problocks needs: gear systems, combustion, mechanical linkages, fluid dynamics
- Similar to engineering simulation tools but accessible to students
- Think: interactive PhET simulations + Roblox Studio building tools + engineering CAD lite

## Architecture Must Be Future-Proof
- The infrastructure must support ANY kind of educational simulation
- Marketplace must scale to thousands of community-built lab tools
- Security model must protect users while allowing creative freedom
- System should be cheap to run — students building on their own hardware is key
