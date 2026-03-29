# Research: Godot vs Current Stack vs Alternatives
**Date:** 2026-03-28 | **Area:** architecture/engine

## Question
Should we use Godot (open source game engine) instead of Babylon.js + Rapier? What are the alternatives?

## Godot — The Case For

| Feature | Godot | Our Current Stack |
|---------|-------|-------------------|
| 3D rendering | Built-in, mature | Babylon.js (also mature) |
| 2D rendering | Built-in, excellent | PixiJS (separate lib) |
| Physics 2D + 3D | Built-in (+ Jolt, Rapier plugins) | Rapier + matter.js (separate) |
| Animation system | Built-in | We'd build it |
| Audio system | Built-in | We'd build it |
| Particle system | Built-in | We'd build it |
| Scene graph / editor | Full visual editor | We built our own (shadcn) |
| Web export | WASM + WebGL2 (~10-30MB) | Native browser (~3MB) |
| Headless server | Yes (--display-driver headless) | We'd build it |
| File format | .tscn/.tres (text, parseable) | .pblx (our custom format) |
| Scripting | GDScript (Python-like), TypeScript via GodotJS | TypeScript + QuickJS sandbox |
| License | MIT (100% free, no revenue share) | All MIT/open source |
| Community | Massive, growing fast | Babylon.js is smaller |
| React embedding | Yes (jsgdbridge, react-godot) | Native (already React) |
| Web editor | Official (editor.godotengine.org) | We'd build our own |
| Code sandboxing | None built-in | QuickJS WASM (proven) |

## Godot — The Case Against

1. **10-30MB WASM payload** — vs ~3MB for Babylon.js. Slow load on school networks.
2. **No built-in sandboxing** — Godot doesn't sandbox user scripts. We'd still need QuickJS or similar.
3. **C# doesn't work on web** — .NET can't export to WASM in Godot. Only GDScript works on web.
4. **GDScript isn't TypeScript** — Students would need to learn GDScript (or use GodotJS which is community-maintained).
5. **Heavy dependency** — Entire game engine as a dependency vs lightweight libraries we control.
6. **Web editor is experimental** — Godot's web editor works but isn't production-ready.
7. **Claude writes TypeScript better than GDScript** — Vibecoding quality would decrease.

## Three Options

### Option A: Keep Current Stack (Babylon.js + Rapier + QuickJS)
- Lightweight, web-native, we control everything
- TypeScript throughout (best for Claude vibecoding)
- We build more ourselves (animation, audio, particles) but it's exactly what we need
- 3MB bundle vs 30MB for Godot

### Option B: Switch to Godot
- Get animation, audio, particles, editor, scene format for FREE
- Huge community and ecosystem
- BUT: 30MB WASM payload, no TypeScript on web, no sandbox, Claude writes GDScript worse
- Would need: GodotJS for TypeScript, custom sandbox layer, React wrapper

### Option C: Hybrid — Godot Backend, Custom Web Frontend
- Use Godot headless on SERVER for physics/simulation
- Keep Babylon.js + React for the browser client
- Students write TypeScript (runs in QuickJS sandbox)
- Server runs Godot scenes headlessly, streams state to clients
- Gets Godot's physics/simulation power without the browser payload

### Option D: PlayCanvas
- Web-native from the ground up (like us)
- MIT licensed, collaborative cloud editor
- WebGPU + WebGL2, modern
- Smaller community than Godot or Babylon.js

## Recommendation
**Option A (keep current stack)** for these reasons:
1. Web-first platform = browser payload matters. 3MB vs 30MB is significant on school networks.
2. TypeScript throughout = best Claude vibecoding experience
3. QuickJS sandbox already proven and working
4. We only build what we need (YAGNI)
5. Godot's strengths (full game engine features) are overkill for educational simulations
6. PlayCanvas is interesting but smaller ecosystem

**Consider Option C (Godot headless server)** later if multiplayer physics simulation becomes complex enough to justify it.
