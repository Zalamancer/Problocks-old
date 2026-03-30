/**
 * @problocks/engine
 *
 * Problocks simulation engine — rendering, physics, scripting sandbox.
 */

// Core ECS
export { World } from './core/world.js';
export { Scene } from './core/scene.js';
export { Entity } from './core/entity.js';
export { Component } from './core/component.js';

// Renderer abstraction
export { Renderer } from './renderer/renderer.js';

// Physics abstraction
export { PhysicsEngine } from './physics/physics-engine.js';
export { RapierPhysics } from './physics/rapier-physics.js';

// Simulation loop
export { SimulationLoop } from './core/simulation-loop.js';

// Scripting sandbox
export { ScriptRuntime } from './scripting/script-runtime.js';
export { QuickJSRuntime } from './scripting/quickjs-runtime.js';

// Components
export { TransformComponent, MeshComponent, RigidBodyComponent } from './core/component.js';
export { TerrainComponent, VoxelTerrainComponent } from './core/component.js';
export type { TerrainLayer } from './core/component.js';
