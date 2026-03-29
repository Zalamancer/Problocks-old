import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsEngine, type PhysicsConfig } from './physics-engine.js';

interface BodyEntry {
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

/**
 * Rapier 3D physics implementation.
 * Runs on the HOST (native WASM speed), NOT inside the QuickJS sandbox.
 */
export class RapierPhysics extends PhysicsEngine {
  readonly mode = '3d' as const;

  private world!: RAPIER.World;
  private bodies: Map<string, BodyEntry> = new Map();
  private nextBodyId = 1;
  private _disposed = false;

  async init(config: PhysicsConfig): Promise<void> {
    await RAPIER.init();
    const gravity = new RAPIER.Vector3(config.gravity.x, config.gravity.y, config.gravity.z);
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

    // Create rigid body
    const bodyDesc = options.isStatic
      ? RAPIER.RigidBodyDesc.fixed()
      : RAPIER.RigidBodyDesc.dynamic();

    bodyDesc.setTranslation(options.position.x, options.position.y, options.position.z);
    const rigidBody = this.world.createRigidBody(bodyDesc);

    // Create collider
    let colliderDesc: RAPIER.ColliderDesc;
    switch (options.shape) {
      case 'box':
        colliderDesc = RAPIER.ColliderDesc.cuboid(
          options.dimensions.width / 2,
          options.dimensions.height / 2,
          options.dimensions.depth / 2,
        );
        break;
      case 'sphere':
        colliderDesc = RAPIER.ColliderDesc.ball(options.dimensions.width / 2);
        break;
      case 'cylinder':
        colliderDesc = RAPIER.ColliderDesc.cylinder(
          options.dimensions.height / 2,
          options.dimensions.width / 2,
        );
        break;
      case 'plane':
        // Use a thin cuboid as ground plane
        colliderDesc = RAPIER.ColliderDesc.cuboid(
          options.dimensions.width / 2,
          0.05,
          options.dimensions.depth / 2,
        );
        break;
      default:
        colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
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
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  getBodyRotation(id: string): { x: number; y: number; z: number } {
    if (this._disposed) return { x: 0, y: 0, z: 0 };
    const entry = this.bodies.get(id);
    if (!entry) return { x: 0, y: 0, z: 0 };
    const rot = entry.rigidBody.rotation();
    // Convert quaternion to euler (simplified)
    const sinr = 2 * (rot.w * rot.x + rot.y * rot.z);
    const cosr = 1 - 2 * (rot.x * rot.x + rot.y * rot.y);
    const sinp = 2 * (rot.w * rot.y - rot.z * rot.x);
    const siny = 2 * (rot.w * rot.z + rot.x * rot.y);
    const cosy = 1 - 2 * (rot.y * rot.y + rot.z * rot.z);
    return {
      x: Math.atan2(sinr, cosr),
      y: Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp),
      z: Math.atan2(siny, cosy),
    };
  }

  setBodyPosition(id: string, position: { x: number; y: number; z: number }): void {
    const entry = this.bodies.get(id);
    if (!entry) return;
    entry.rigidBody.setTranslation(new RAPIER.Vector3(position.x, position.y, position.z), true);
  }

  applyForce(id: string, force: { x: number; y: number; z: number }): void {
    const entry = this.bodies.get(id);
    if (!entry) return;
    entry.rigidBody.addForce(new RAPIER.Vector3(force.x, force.y, force.z), true);
  }

  applyImpulse(id: string, impulse: { x: number; y: number; z: number }): void {
    const entry = this.bodies.get(id);
    if (!entry) return;
    entry.rigidBody.applyImpulse(new RAPIER.Vector3(impulse.x, impulse.y, impulse.z), true);
  }

  setVelocity(id: string, velocity: { x: number; y: number; z: number }): void {
    const entry = this.bodies.get(id);
    if (!entry) return;
    entry.rigidBody.setLinvel(new RAPIER.Vector3(velocity.x, velocity.y, velocity.z), true);
  }

  getVelocity(id: string): { x: number; y: number; z: number } {
    if (this._disposed) return { x: 0, y: 0, z: 0 };
    const entry = this.bodies.get(id);
    if (!entry) return { x: 0, y: 0, z: 0 };
    const vel = entry.rigidBody.linvel();
    return { x: vel.x, y: vel.y, z: vel.z };
  }

  /**
   * Add a triangle mesh terrain collider (static).
   * Uses exact vertex/index data from the visual mesh for perfect alignment.
   */
  addTrimesh(options: {
    vertices: Float32Array;
    indices: Uint32Array;
    position?: { x: number; y: number; z: number };
    friction?: number;
    restitution?: number;
  }): string {
    const id = `body_${this.nextBodyId++}`;

    const bodyDesc = RAPIER.RigidBodyDesc.fixed();
    const pos = options.position ?? { x: 0, y: 0, z: 0 };
    bodyDesc.setTranslation(pos.x, pos.y, pos.z);
    const rigidBody = this.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.trimesh(
      options.vertices,
      options.indices,
    );
    colliderDesc.setFriction(options.friction ?? 0.7);
    colliderDesc.setRestitution(options.restitution ?? 0.2);

    const collider = this.world.createCollider(colliderDesc, rigidBody);
    this.bodies.set(id, { rigidBody, collider });
    return id;
  }

  setGravity(x: number, y: number, z: number): void {
    this.world.gravity = new RAPIER.Vector3(x, y, z);
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
