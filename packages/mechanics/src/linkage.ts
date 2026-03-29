/**
 * Linkage types for mechanical connections.
 */
export type LinkageType = 'rigid' | 'hinge' | 'slider' | 'ball';

/**
 * A mechanical linkage connecting two points.
 */
export class Linkage {
  readonly id: string;
  readonly type: LinkageType;
  readonly length: number;
  angle: number = 0;
  angularVelocity: number = 0;

  // Endpoint positions
  pointA: { x: number; y: number; z: number };
  pointB: { x: number; y: number; z: number };

  constructor(
    id: string,
    type: LinkageType,
    length: number,
    pointA: { x: number; y: number; z: number },
  ) {
    this.id = id;
    this.type = type;
    this.length = length;
    this.pointA = { ...pointA };
    this.pointB = {
      x: pointA.x + length * Math.cos(0),
      y: pointA.y + length * Math.sin(0),
      z: pointA.z,
    };
  }

  /** Update endpoint B based on current angle */
  updateEndpoint(): void {
    this.pointB = {
      x: this.pointA.x + this.length * Math.cos(this.angle),
      y: this.pointA.y + this.length * Math.sin(this.angle),
      z: this.pointA.z,
    };
  }

  /** Rotate the linkage (for hinge type) */
  rotate(deltaAngle: number): void {
    if (this.type !== 'hinge') return;
    this.angle += deltaAngle;
    this.updateEndpoint();
  }

  /** Step simulation */
  step(dt: number): void {
    this.angle += this.angularVelocity * dt;
    this.updateEndpoint();
  }
}
