import type { RapierPhysics } from '../physics/rapier-physics.js';

/**
 * The main simulation loop.
 * Orchestrates: sandbox scripts → physics step → sync transforms → render.
 * Fixed timestep for physics (deterministic), variable render.
 */
export class SimulationLoop {
  private physics: RapierPhysics;
  private running = false;
  private physicsTimestep = 1 / 60;
  private accumulator = 0;
  private lastTime = 0;
  private frameCallback: ((dt: number) => void) | null = null;
  private renderCallback: (() => void) | null = null;

  // Entity tracking: maps entity IDs to physics body IDs
  private entityToBody: Map<string, string> = new Map();

  constructor(physics: RapierPhysics) {
    this.physics = physics;
  }

  onFrame(callback: (dt: number) => void): void {
    this.frameCallback = callback;
  }

  onRender(callback: () => void): void {
    this.renderCallback = callback;
  }

  createEntity(
    entityId: string,
    shape: 'box' | 'sphere' | 'cylinder' | 'plane',
    options: {
      position?: { x: number; y: number; z: number };
      dimensions?: { width: number; height: number; depth: number };
      mass?: number;
      isStatic?: boolean;
      friction?: number;
      restitution?: number;
    } = {},
  ): void {
    const pos = options.position ?? { x: 0, y: 0, z: 0 };
    const dims = options.dimensions ?? { width: 1, height: 1, depth: 1 };

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

  applyForce(entityId: string, force: { x: number; y: number; z: number }): void {
    const bodyId = this.entityToBody.get(entityId);
    if (bodyId) this.physics.applyForce(bodyId, force);
  }

  applyImpulse(entityId: string, impulse: { x: number; y: number; z: number }): void {
    const bodyId = this.entityToBody.get(entityId);
    if (bodyId) this.physics.applyImpulse(bodyId, impulse);
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
    const frameTime = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.accumulator += frameTime;

    if (this.frameCallback) {
      this.frameCallback(frameTime);
    }

    while (this.accumulator >= this.physicsTimestep) {
      this.physics.step(this.physicsTimestep);
      this.accumulator -= this.physicsTimestep;
    }

    if (this.renderCallback) {
      this.renderCallback();
    }

    requestAnimationFrame(this.tick);
  };
}
