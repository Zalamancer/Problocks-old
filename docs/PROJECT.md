# Problocks
> An educational simulation platform where students build, share, and monetize interactive lab tools -- physics simulations, circuit designers, chemistry experiments, engineering projects, and more. Students vibecode with Claude Code CLI or use the web studio. Engine runs 2D + 3D rendering with physics on host (Rapier/matter.js) and game logic in a QuickJS WASM sandbox.

**Created:** 2026-03-28 | **Status:** Active

## Documentation Map

| Section | Description | Latest Entry |
|---------|-------------|--------------|
| [Plans](plans/) | Roadmaps and build orders | [001-initial-plan](plans/001-initial-plan.md) |
| [Research](research/) | Technical research and analysis | [006-devils-advocate-review](research/006-devils-advocate-review.md) |
| [Features](features/) | Feature specs and requirements | [001-core-features](features/001-core-features.md) |
| [Architecture](architecture/) | System design and diagrams | [001-system-overview](architecture/001-system-overview.md) |
| [Updates](updates/) | Development log | [001-project-kickoff](updates/001-project-kickoff.md) |
| [Bugs](bugs/) | Bug tracking | -- |
| [Decisions](decisions/) | ADRs and tech choices | [001-tech-stack](decisions/001-tech-stack.md) |
| [API Specs](api-specs/) | API contracts and schemas | -- |
| [Sprints](sprints/) | Sprint plans and retros | [sprint-001](sprints/sprint-001.md) |

## Reference Material

### Platform Design
- `docs/superpowers/specs/2026-03-28-problocks-platform-design.md` -- Full platform design specification (source of truth)

### Research
- `docs/research/002-founders-vision.md` -- Founder's vision and platform mission
- `docs/research/003-edu-sim-landscape.md` -- Competitive analysis of educational simulation platforms
- `docs/research/004-sandboxing-security.md` -- Sandbox architecture and security model
- `docs/research/005-scripting-language-analysis.md` -- TypeScript vs Lua vs Python analysis
- `docs/research/006-devils-advocate-review.md` -- Risk analysis and critical review

### Benchmarks
- `benchmarks/quickjs-sandbox/` -- QuickJS-in-WASM performance benchmark (game logic, circuit evaluation)

### Key Decisions
- **Scripting language:** TypeScript (not Lua/Luau)
- **Sandbox:** QuickJS compiled to WASM (not Wasmoon/Fengari)
- **Physics:** Runs on host (Rapier 3D, matter.js 2D), NOT inside sandbox
- **Rendering:** Babylon.js (3D) + PixiJS (2D), behind `@problocks/renderer` abstraction
- **Simulation modules:** Wrap open-source libs (Falstad, 3Dmol.js, math.js, LiquidFun, etc.)
