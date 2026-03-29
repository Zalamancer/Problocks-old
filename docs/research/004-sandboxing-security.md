# Research: Sandboxing & Security Architecture
**Date:** 2026-03-28 | **Area:** security/architecture

## Question
How do we safely execute user-created simulations while keeping them flexible?

## How Roblox Does It

**File formats:** .rbxl (binary) and .rbxlx (XML) — serialized instance trees
**Security model:** Server-authoritative + capabilities-based sandboxing
- Server is truth source for all critical logic
- Scripts have fine-grained capabilities: RunClientScript, AccessOutsideWrite, CreateInstances, etc.
- All RemoteEvent calls validated server-side (type check, NaN detection, range validation, rate limiting)
- Core principle: "A determined exploiter has complete control over their local state"

## Sandboxing Options Ranked

### 1. WASM Sandbox (Highest Security) — RECOMMENDED
- No syscall interface, memory-safe by design
- Used by: Figma (plugins), Shopify (Functions), Fastly (Compute@Edge)
- Each module gets isolated memory space
- Only explicitly imported host functions accessible
- Production-proven at massive scale

### 2. QuickJS in WASM (Best Balance)
- Lightweight JS engine compiled to WASM
- 2.5% of V8's resources
- Zero ambient authority (no browser APIs)
- Used by Figma for plugin sandboxing
- Student code runs in QuickJS, interacts with engine via message passing

### 3. iframe + CSP (Browser-Native)
- Same-origin policy, no localStorage/cookies
- Good additional layer on top of WASM
- CSP sandbox directive blocks unsafe-eval

### 4. Web Workers (Computation Isolation)
- Separate thread, no DOM access
- Good for heavy simulation compute
- Message-based communication

### 5. Python/Pyodide (CAUTION)
- CVE-2025-68668: documented sandbox escape in 2025
- Python introspection allows host `sys` module access
- If used: MUST run in WebWorker + iframe + module whitelist

## Recommended Layered Architecture

```
Student Code (sandboxed)
    ↓ message passing (JSON commands)
Input Validator (server-side)
    ↓ validated commands
Physics/Simulation Engine (authoritative)
    ↓ state updates
Renderer (client-side, read-only)
```

**Student code CAN:** math ops, create objects, read state, handle events
**Student code CANNOT:** file I/O, network, access other users, modify engine rules

**Resource limits:** 100ms/frame execution, 10MB memory, 60 API calls/sec, instruction counter for infinite loops

## File Format Recommendation

**JSON package with signed metadata (npm-style):**
```json
{
  "name": "pendulum-lab",
  "version": "1.0.0",
  "main": "dist/index.js",
  "metadata": {
    "category": "physics",
    "requiredCapabilities": ["Math", "SimRead", "SimWrite"]
  },
  "signature": "sha256_hash"
}
```
Start with JSON, migrate to WASM binary format if tampering becomes an issue.

## Sources
- Roblox security-tactics.md, capabilities.md, client-server-boundary.md
- Figma plugin system architecture blog
- Shopify WASM Functions engineering blog
- CVE-2025-68668 (Pyodide sandbox escape)
- WebAssembly security specification
