/**
 * Physics engine abstraction layer.
 * Wraps matter.js (2D) or Rapier (3D) behind a common interface.
 */
export interface PhysicsConfig {
  mode: '2d' | '3d';
  gravity: { x: number; y: number; z: number };
}

export abstract class PhysicsEngine {
  abstract readonly mode: '2d' | '3d';

  abstract init(config: PhysicsConfig): Promise<void>;
  abstract step(deltaTime: number): void;
  abstract dispose(): void;

  abstract addBody(options: {
    position: { x: number; y: number; z: number };
    shape: 'box' | 'sphere' | 'cylinder' | 'plane';
    dimensions: { width: number; height: number; depth: number };
    mass: number;
    isStatic: boolean;
    friction: number;
    restitution: number;
  }): string; // returns body ID

  abstract removeBody(id: string): void;
  abstract getBodyPosition(id: string): { x: number; y: number; z: number };
  abstract getBodyRotation(id: string): { x: number; y: number; z: number };
  abstract applyForce(id: string, force: { x: number; y: number; z: number }): void;
}
