/**
 * A spring with Hooke's law: F = -k * displacement
 */
export class Spring {
  readonly id: string;
  readonly stiffness: number; // k (N/m)
  readonly damping: number;   // damping coefficient
  readonly restLength: number;
  currentLength: number;
  velocity: number = 0;
  force: number = 0;

  constructor(id: string, stiffness: number, restLength: number, damping = 0.1) {
    this.id = id;
    this.stiffness = stiffness;
    this.restLength = restLength;
    this.currentLength = restLength;
    this.damping = damping;
  }

  /** Calculate spring force based on current displacement */
  calculateForce(): number {
    const displacement = this.currentLength - this.restLength;
    this.force = -this.stiffness * displacement - this.damping * this.velocity;
    return this.force;
  }

  /** Step simulation with attached mass */
  step(dt: number, mass: number): void {
    const force = this.calculateForce();
    const acceleration = force / mass;
    this.velocity += acceleration * dt;
    this.currentLength += this.velocity * dt;
  }

  /** Get displacement from rest position */
  getDisplacement(): number {
    return this.currentLength - this.restLength;
  }

  /** Get potential energy stored in the spring */
  getPotentialEnergy(): number {
    const x = this.getDisplacement();
    return 0.5 * this.stiffness * x * x;
  }

  /** Get kinetic energy of attached mass */
  getKineticEnergy(mass: number): number {
    return 0.5 * mass * this.velocity * this.velocity;
  }
}
