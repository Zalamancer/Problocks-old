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

// Sprite animation + tweening
export * from './animation/index.js';

// 2D camera
export * from './camera/index.js';

// 2D lighting
export * from './lighting/index.js';

// Particle system
export * from './particles/index.js';

// Audio engine
export * from './audio/index.js';

// Input manager
export * from './input/index.js';

// Prefab system
export * from './prefabs/index.js';

// Navigation / pathfinding
export * from './navigation/index.js';

// Procedural generation
export * from './procgen/index.js';

// Rule-based placement
export * from './placement/index.js';

// AI — behavior trees, FSM, presets
export * from './ai/index.js';

// NPC system
export * from './npc/index.js';

// 2D player controller
export * from './player/index.js';

// Platform detection (hardware tiers)
export * from './platform/index.js';

// Scripting API extensions
export { registerAPIExtensions } from './scripting/api-extensions.js';
export type { APIExtensionDeps } from './scripting/api-extensions.js';
