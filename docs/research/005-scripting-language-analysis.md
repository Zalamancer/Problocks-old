# Research: Scripting Language for Student-Built Simulations
**Date:** 2026-03-28 | **Area:** technology/developer-experience

## Question
What scripting language should students use to vibecode their simulations with Claude?

## Comparison

| Language | Claude Quality | Student Familiarity | Sandbox Security | Browser Perf | Ecosystem |
|----------|---------------|--------------------|--------------------|--------------|-----------|
| **TypeScript/JS** | Excellent (best) | High | High (AST/QuickJS) | Native | Massive |
| **Python** | Excellent | Highest | RISKY (CVE-2025) | Medium (WASM) | Huge |
| **Lua/Luau** | Good | Low | High (WASM VM) | Fast | Small |
| **Custom DSL** | Excellent (with grammar) | Zero (must learn) | Highest (by design) | Very fast | None |
| **Visual blocks** | N/A | High (beginners) | High | Medium | Limited |

## Analysis

### TypeScript — RECOMMENDED
- Claude's best language for code generation
- Students increasingly know it
- Runs natively in browser (no WASM overhead for basic execution)
- Sandboxable via QuickJS-in-WASM or AST interpreter
- Massive ecosystem (Three.js, math libraries, etc.)
- npm-style publishing workflow is familiar

### Python — RISKY
- Students know it best, but CVE-2025-68668 showed Pyodide sandbox escapes
- If used: MUST add WebWorker + iframe + module whitelist layers
- Heavier bundle than TypeScript
- Good for numerical/scientific simulations

### Lua — NICHE
- Roblox familiarity but students don't know Lua outside Roblox
- Claude is less fluent in Lua than TS/Python
- Good sandboxing via WASM VM
- Less ecosystem for educational content

### Custom DSL — LONG TERM
- Grammar-limited = safest by design
- Claude generates DSL reliably with grammar prompting
- High development cost (parser, compiler, debugger)
- Could compile to TypeScript for execution

### Visual Blocks — COMPLEMENT
- Good entry point for beginners
- Can coexist with text coding (export blocks → TypeScript)
- Not sufficient alone for engineering simulations

## Recommendation

**Primary: TypeScript** — best Claude generation, strong sandbox options, browser-native
**Complementary: Visual blocks** — for beginner onboarding, exports to TypeScript
**Future: Lightweight DSL** — for specific domains (circuits, physics equations)

## Marketplace Workflow

Best model: npm-style publishing
```
problocks init physics-pendulum
# student builds with Claude Code CLI
problocks publish --category physics
```
- Uses Verdaccio (custom npm registry) or custom API
- Standard package.json + metadata
- GitHub-based auth
- Automatic versioning from git
