# Research: Devil's Advocate Review of Problocks Architecture
**Date:** 2026-03-28 | **Area:** risk analysis

## Top 3 Project Killers Identified

### 1. Scope Paralysis
8 subsystems with zero code. Every week planning without shipping increases abandonment risk. Must ship a single working pipeline ASAP.

### 2. Undefined Target User
"Students who vibecode with Claude CLI" vs "middle school students on Chromebooks" — these are different people. Building for both = building for neither.

### 3. Unvalidated Sandbox Performance
QuickJS-in-WASM is 2-40x slower than V8. A physics sim running 60fps locally may run at 5fps in the sandbox. This is a binary go/no-go that can be tested in ONE WEEK but hasn't been tested yet.

## Critical Issues to Resolve

### Document Contradiction
Old docs describe a Roblox clone (Lua, Probux, game servers). New docs describe an educational platform (TypeScript, vibecoding). These must be reconciled — update ALL old docs to match the current vision.

### Hybrid Execution Creates Two Runtimes
Client-side + server-side must produce IDENTICAL behavior. Floating-point differences across environments will cause divergence in chaotic systems. Pick one or build extensive equivalence testing.

### Domain Modules Need Domain Experts
Building a correct circuit sim requires SPICE knowledge. Chemistry module needs quantum mechanics background. Don't build these in-house — provide the framework, let physics professors build the modules.

### COPPA Compliance
If any users are under 13, you need verifiable parental consent, data minimization, and lawyer-reviewed privacy policy. The social layer may need to be disabled for minors.

### Cold Start Problem
Empty marketplace = no educators. No educators = no student uploads. Solution: Build a TOOL first (share sims via link), not a marketplace. Add marketplace after 100+ educators actively using it.

## Recommended Immediate Actions

1. Resolve Lua vs TypeScript. Update every document. Delete the wrong one.
2. Build QuickJS-in-WASM performance benchmark THIS WEEK. Run real physics sim. Get hard numbers.
3. DELETE Social Layer and Economy from the plan. Not needed for education, massively increases scope and compliance.
4. Build ONE complete simulation end-to-end: create locally → upload → runs in browser sandbox.
5. Put it in front of 3 educators and see if they care.

## Tech Stack Aging (5-Year Risk)

| Technology | Risk |
|------------|------|
| TypeScript, WASM, WebGPU | Low — safe bets |
| Babylon.js | Medium-High — depends on Microsoft |
| QuickJS | High — single maintainer |
| Cloudflare Durable Objects | Medium-High — vendor lock-in |
| Rapier (physics) | Low — strong and growing |

## Key Mitigations Required

- Build abstraction layers around ALL risky library choices
- Define sandbox API surface as .d.ts BEFORE coding
- Don't define .pblx format until 10+ working simulations exist
- Build web-based editor as primary path (CLI is power-user path)
- Start with simple WebSocket servers, not Durable Objects
- Carry accuracy disclaimers on all simulation modules
