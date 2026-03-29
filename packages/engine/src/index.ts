/**
 * @problocks/engine
 *
 * Problocks simulation engine — 2D/3D rendering, physics, scripting sandbox.
 * Runs in two modes:
 *   - Studio mode: full rendering + editing tools + live preview
 *   - Player mode: rendering + sandbox execution (client or server)
 */

// Core ECS
export { World } from './core/world.js';
export { Scene } from './core/scene.js';
export { Entity } from './core/entity.js';
export { Component } from './core/component.js';

// Renderer abstraction (2D + 3D)
export { Renderer } from './renderer/renderer.js';
export { BabylonRenderer } from './renderer/babylon-renderer.js';

// Physics abstraction (2D + 3D)
export { PhysicsEngine } from './physics/physics-engine.js';
export { RapierPhysics } from './physics/rapier-physics.js';

// Simulation loop (ties renderer + physics + sandbox together)
export { SimulationLoop } from './core/simulation-loop.js';

// Scripting sandbox
export { ScriptRuntime } from './scripting/script-runtime.js';
export { QuickJSRuntime } from './scripting/quickjs-runtime.js';

// Components
export { TransformComponent, MeshComponent, RigidBodyComponent } from './core/component.js';
export { TerrainComponent, WaterComponent } from './core/component.js';
export type { TerrainLayer } from './core/component.js';

// Water simulation
export { WaterSimulation } from './renderer/water-simulation.js';

// Terrain generation
export { generateHeightmap, fbm, setNoiseSeed } from './terrain/noise.js';
