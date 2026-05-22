import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsEngine, type PhysicsConfig } from './physics-engine.js';

interface BodyEntry {
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

/**
 * Rapier 2D physics implementation.
 * For side-scrollers, circuit sims, molecular diagrams, etc.
 */
export class Rapier2DPhysics extends PhysicsEngine {
  readonly mode = '2d' as const;

  private world!: RAPIER.World;
  private bodies: Map<string, BodyEntry> = new Map();
  private nextBodyId = 1;
  private _disposed = false;

  async init(config: PhysicsConfig): Promise<void> {
    await RAPIER.init();
    const gravity = new RAPIER.Vector2(config.gravity.x, config.gravity.y);
    this.world = new RAPIER.World(gravity);
    this._disposed = false;
  }

  step(deltaTime: number): void {
    if (this._disposed) return;
    this.world.timestep = deltaTime;
    this.world.step();
  }

  addBody(options: {
    position: { x: number; y: number; z: number };
    shape: 'box' | 'sphere' | 'cylinder' | 'plane';
    dimensions: { width: number; height: number; depth: number };
    mass: number;
    isStatic: boolean;
    friction: number;
    restitution: number;
  }): string {
    const id = `body_${this.nextBodyId++}`;

    const bodyDesc = options.isStatic
      ? RAPIER.RigidBodyDesc.fixed()
      : RAPIER.RigidBodyDesc.dynamic();

    bodyDesc.setTranslation(options.position.x, options.position.y);
    const rigidBody = this.world.createRigidBody(bodyDesc);

    let colliderDesc: RAPIER.ColliderDesc;
    switch (options.shape) {
      case 'box':
      case 'plane':
        colliderDesc = RAPIER.ColliderDesc.cuboid(
          options.dimensions.width / 2,
          options.dimensions.height / 2,
        );
        break;
      case 'sphere':
        colliderDesc = RAPIER.ColliderDesc.ball(options.dimensions.width / 2);
        break;
      case 'cylinder':
        // 2D: treat cylinder as a capsule
        colliderDesc = RAPIER.ColliderDesc.capsule(
          options.dimensions.height / 2,
          options.dimensions.width / 2,
        );
        break;
      default:
        colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5);
    }

    colliderDesc.setFriction(options.friction);
    colliderDesc.setRestitution(options.restitution);

    if (!options.isStatic) {
      colliderDesc.setMass(options.mass);
    }

    const collider = this.world.createCollider(colliderDesc, rigidBody);
    this.bodies.set(id, { rigidBody, collider });
    return id;
  }

  removeBody(id: string): void {
    const entry = this.bodies.get(id);
    if (entry) {
      this.world.removeRigidBody(entry.rigidBody);
      this.bodies.delete(id);
    }
  }

  getBodyPosition(id: string): { x: number; y: number; z: number } {
    if (this._disposed) return { x: 0, y: 0, z: 0 };
    const entry = this.bodies.get(id);
    if (!entry) return { x: 0, y: 0, z: 0 };
    const pos = entry.rigidBody.translation();
    return { x: pos.x, y: pos.y, z: 0 };
  }

  getBodyRotation(id: string): { x: number; y: number; z: number } {
    if (this._disposed) return { x: 0, y: 0, z: 0 };
    const entry = this.bodies.get(id);
    if (!entry) return { x: 0, y: 0, z: 0 };
    const angle = entry.rigidBody.rotation();
    return { x: 0, y: 0, z: angle };
  }

  applyForce(id: string, force: { x: number; y: number; z: number }): void {
    const entry = this.bodies.get(id);
    if (!entry) return;
    entry.rigidBody.addForce(new RAPIER.Vector2(force.x, force.y), true);
  }

  applyImpulse(id: string, impulse: { x: number; y: number }): void {
    const entry = this.bodies.get(id);
    if (!entry) return;
    entry.rigidBody.applyImpulse(new RAPIER.Vector2(impulse.x, impulse.y), true);
  }

  setVelocity(id: string, velocity: { x: number; y: number }): void {
    const entry = this.bodies.get(id);
    if (!entry) return;
    entry.rigidBody.setLinvel(new RAPIER.Vector2(velocity.x, velocity.y), true);
  }

  getVelocity(id: string): { x: number; y: number; z: number } {
    if (this._disposed) return { x: 0, y: 0, z: 0 };
    const entry = this.bodies.get(id);
    if (!entry) return { x: 0, y: 0, z: 0 };
    const vel = entry.rigidBody.linvel();
    return { x: vel.x, y: vel.y, z: 0 };
  }

  setPosition(id: string, x: number, y: number): void {
    const entry = this.bodies.get(id);
    if (!entry) return;
    entry.rigidBody.setTranslation(new RAPIER.Vector2(x, y), true);
  }

  setGravity(x: number, y: number): void {
    this.world.gravity = new RAPIER.Vector2(x, y);
  }

  /** Expose the Rapier 2D world for advanced use. */
  getWorld(): RAPIER.World {
    return this.world;
  }

  dispose(): void {
    this._disposed = true;
    for (const [, entry] of this.bodies) {
      try { this.world.removeRigidBody(entry.rigidBody); } catch { /* already freed */ }
    }
    this.bodies.clear();
    try { this.world.free(); } catch { /* already freed */ }
  }
}
