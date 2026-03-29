import type { BabylonRenderer } from '../renderer/babylon-renderer.js';
import type { RapierPhysics } from '../physics/rapier-physics.js';

/**
 * The main simulation loop.
 * Orchestrates: sandbox scripts → physics step → sync transforms → render.
 *
 * Fixed timestep for physics (deterministic), variable render.
 */
export class SimulationLoop {
  private renderer: BabylonRenderer;
  private physics: RapierPhysics;
  private running = false;
  private physicsTimestep = 1 / 60; // 60 Hz fixed step
  private accumulator = 0;
  private lastTime = 0;
  private frameCallback: ((dt: number) => void) | null = null;

  // Entity tracking: maps entity IDs to physics body IDs
  private entityToBody: Map<string, string> = new Map();

  constructor(renderer: BabylonRenderer, physics: RapierPhysics) {
    this.renderer = renderer;
    this.physics = physics;
  }

  /**
   * Register a callback that runs each frame BEFORE physics.
   * This is where sandbox game logic executes.
   */
  onFrame(callback: (dt: number) => void): void {
    this.frameCallback = callback;
  }

  /**
   * Create a simulation entity with both visual and physics representation.
   */
  createEntity(
    entityId: string,
    shape: 'box' | 'sphere' | 'cylinder' | 'plane',
    options: {
      width?: number;
      height?: number;
      depth?: number;
      radius?: number;
      color?: string;
      position?: { x: number; y: number; z: number };
      mass?: number;
      isStatic?: boolean;
      friction?: number;
      restitution?: number;
    } = {},
  ): void {
    const pos = options.position ?? { x: 0, y: 0, z: 0 };
    const dims = {
      width: options.width ?? (options.radius ? options.radius * 2 : 1),
      height: options.height ?? 1,
      depth: options.depth ?? (options.width ?? 1),
    };

    // Create visual mesh
    this.renderer.createMesh(entityId, shape, {
      ...options,
      position: pos,
    });

    // Create physics body
    const bodyId = this.physics.addBody({
      position: pos,
      shape,
      dimensions: dims,
      mass: options.mass ?? 1,
      isStatic: options.isStatic ?? false,
      friction: options.friction ?? 0.5,
      restitution: options.restitution ?? 0.3,
    });

    this.entityToBody.set(entityId, bodyId);
  }

  removeEntity(entityId: string): void {
    const bodyId = this.entityToBody.get(entityId);
    if (bodyId) {
      this.physics.removeBody(bodyId);
      this.entityToBody.delete(entityId);
    }
    this.renderer.removeMesh(entityId);
  }

  applyForce(entityId: string, force: { x: number; y: number; z: number }): void {
    const bodyId = this.entityToBody.get(entityId);
    if (bodyId) {
      this.physics.applyForce(bodyId, force);
    }
  }

  applyImpulse(entityId: string, impulse: { x: number; y: number; z: number }): void {
    const bodyId = this.entityToBody.get(entityId);
    if (bodyId) {
      this.physics.applyImpulse(bodyId, impulse);
    }
  }

  getPosition(entityId: string): { x: number; y: number; z: number } {
    const bodyId = this.entityToBody.get(entityId);
    if (!bodyId) return { x: 0, y: 0, z: 0 };
    return this.physics.getBodyPosition(bodyId);
  }

  getVelocity(entityId: string): { x: number; y: number; z: number } {
    const bodyId = this.entityToBody.get(entityId);
    if (!bodyId) return { x: 0, y: 0, z: 0 };
    return this.physics.getVelocity(bodyId);
  }

  /**
   * Sync physics positions to visual meshes.
   */
  private syncTransforms(): void {
    for (const [entityId, bodyId] of this.entityToBody) {
      const pos = this.physics.getBodyPosition(bodyId);
      const rot = this.physics.getBodyRotation(bodyId);
      this.renderer.updateMeshTransform(entityId, pos, rot);
    }
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.tick();
  }

  stop(): void {
    this.running = false;
  }

  private tick = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const frameTime = Math.min((now - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = now;
    this.accumulator += frameTime;

    // Run sandbox game logic once per frame
    if (this.frameCallback) {
      this.frameCallback(frameTime);
    }

    // Fixed timestep physics
    while (this.accumulator >= this.physicsTimestep) {
      this.physics.step(this.physicsTimestep);
      this.accumulator -= this.physicsTimestep;
    }

    // Sync physics → renderer
    this.syncTransforms();

    // Render
    this.renderer.render();

    requestAnimationFrame(this.tick);
  };
}
