# Research: Educational Simulation Platform Landscape
**Date:** 2026-03-28 | **Area:** competitive analysis

## Question
What existing platforms let users create interactive educational tools, and how do they work?

## Key Findings

### Platforms That Let Users BUILD Simulations
| Platform | How Users Create | Language | Sharing Model |
|----------|-----------------|----------|---------------|
| GlowScript/VPython | Python code | Python | Cloud URLs |
| GeoGebra | Equations + script | GeoGebra Script | Web/embed |
| NetLogo | NetLogo code | Custom language | Model library |
| MIT App Inventor | Visual blocks | Block-based | APK export |
| Scratch/Snap! | Visual blocks | Block-based | Community web |
| Open Source Physics | EJSS environment | Java/JavaScript | Open source |
| Algodoo | Visual drawing | No code | Community scenes |
| Blender | 3D + Python scripts | Python | .blend files |
| Unity | Visual + C# | C# | Multi-platform builds |

### Platforms With Pre-Built Labs Only (No User Creation)
PhET, Labster, PraxiLabs, LabXchange, Khan Academy, PASCO Capstone, Vernier

### Engineering/Mechanism Simulation Tools
| Tool | Domain | User Input | Open Source |
|------|--------|-----------|-------------|
| Gear Generator | Gears/mechanisms | Visual parametric | Web-based |
| MechDesigner | Mechanisms | Drag-drop | No |
| Project Chrono | Multibody dynamics | C++/Python | Yes |
| MuJoCo | Robotics/biomechanics | XML/Python | Yes |
| Flowsquare | CFD (2D) | Paint interface | Yes |
| Algodoo | 2D physics | Visual drawing | Free |
| Siemens Simcenter | Professional CAE | CAD integration | No |

## Gap Analysis — What Problocks Fills

**No existing platform combines ALL of:**
1. Student-created simulations (not just pre-built)
2. Multi-discipline (physics, circuits, chemistry, engineering)
3. AI-assisted creation (vibecoding with Claude)
4. Marketplace for sharing/discovering
5. 2D + 3D support
6. Engineering simulation (gears, combustion, mechanisms)
7. Sandboxed execution for security

**Closest competitors and their limitations:**
- **Roblox** — gaming-focused, not educational, no engineering simulation
- **Scratch** — 2D only, simple, no physics/engineering
- **GlowScript** — Python-only, 3D only, no marketplace, no sandbox
- **Algodoo** — 2D only, no scripting, no marketplace
- **PhET** — pre-built only, no user creation
- **Labster** — pre-built only, expensive subscription

## Implications
- Problocks has a unique market position: "vibecoded educational simulations marketplace"
- Engineering simulation (gears, mechanisms) is an underserved niche
- Most platforms are either code-heavy OR visual-only — Problocks should support both
- The "build locally with AI, upload to marketplace" workflow doesn't exist anywhere
