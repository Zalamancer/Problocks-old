/**
 * A motor that provides rotational power.
 */
export class Motor {
  readonly id: string;
  rpm: number;
  maxTorque: number;
  running: boolean = false;

  constructor(id: string, rpm: number, maxTorque: number) {
    this.id = id;
    this.rpm = rpm;
    this.maxTorque = maxTorque;
  }

  start(): void { this.running = true; }
  stop(): void { this.running = false; }

  /** Get current angular velocity in rad/s */
  getAngularVelocity(): number {
    return this.running ? (this.rpm / 60) * Math.PI * 2 : 0;
  }

  /** Get current torque output */
  getTorque(): number {
    return this.running ? this.maxTorque : 0;
  }

  /** Get power output in watts (torque * angular velocity) */
  getPower(): number {
    return this.getTorque() * this.getAngularVelocity();
  }
}
