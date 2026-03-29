/**
 * Base component class for the ECS architecture.
 * Components are pure data containers attached to entities.
 */
export abstract class Component {
  abstract readonly type: string;
}

/**
 * Transform component — position, rotation, scale.
 */
export class TransformComponent extends Component {
  readonly type = 'transform';
  position = { x: 0, y: 0, z: 0 };
  rotation = { x: 0, y: 0, z: 0 };
  scale = { x: 1, y: 1, z: 1 };
}

/**
 * Mesh component — visual representation.
 */
export class MeshComponent extends Component {
  readonly type = 'mesh';
  shape: 'box' | 'sphere' | 'cylinder' | 'plane' | 'custom' = 'box';
  color = '#ffffff';
  dimensions = { width: 1, height: 1, depth: 1 };
}

/**
 * RigidBody component — physics simulation.
 */
export class RigidBodyComponent extends Component {
  readonly type = 'rigidbody';
  mass = 1.0;
  isStatic = false;
  velocity = { x: 0, y: 0, z: 0 };
  angularVelocity = { x: 0, y: 0, z: 0 };
  friction = 0.5;
  restitution = 0.3;
}
