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
export { PixiRenderer } from './renderer/pixi-renderer.js';

// Physics abstraction
export { PhysicsEngine } from './physics/physics-engine.js';
export { RapierPhysics } from './physics/rapier-physics.js';
export { Rapier2DPhysics } from './physics/rapier2d-physics.js';

// Simulation loop
export { SimulationLoop } from './core/simulation-loop.js';

// Scripting sandbox
export { ScriptRuntime } from './scripting/script-runtime.js';
export { QuickJSRuntime } from './scripting/quickjs-runtime.js';

// Components — 3D
export { TransformComponent, MeshComponent, RigidBodyComponent } from './core/component.js';
export { TerrainComponent, VoxelTerrainComponent } from './core/component.js';
export type { TerrainLayer } from './core/component.js';

// Components — 2D
export { SpriteComponent, TilemapComponent, Shape2DComponent } from './core/component.js';

// Tilemap engine (isometric, orthogonal, hex)
export * from './tilemap/index.js';

// Asset manager + AI generation pipeline
export * from './assets/index.js';
