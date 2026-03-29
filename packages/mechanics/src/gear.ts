/**
 * A gear with teeth count, radius, and rotational state.
 * Connected gears rotate at inversely proportional speeds.
 */
export class Gear {
  readonly id: string;
  readonly teeth: number;
  readonly radius: number;
  rpm: number = 0;
  angle: number = 0;
  torque: number = 0;

  constructor(id: string, teeth: number) {
    this.id = id;
    this.teeth = teeth;
    this.radius = teeth * 0.05; // 0.05 units per tooth
  }

  /** Update angle based on RPM and time delta */
  step(dt: number): void {
    this.angle += (this.rpm / 60) * Math.PI * 2 * dt;
    this.angle %= Math.PI * 2;
  }

  /** Gear ratio when meshed with another gear */
  ratioWith(other: Gear): number {
    return this.teeth / other.teeth;
  }
}

/**
 * A train of meshed gears. Driving the first gear propagates
 * rotation through the chain with correct ratios.
 */
export class GearTrain {
  readonly gears: Gear[] = [];
  private connections: [number, number][] = [];

  addGear(gear: Gear): void {
    this.gears.push(gear);
  }

  /** Mesh two gears by index (they rotate in opposite directions) */
  mesh(indexA: number, indexB: number): void {
    this.connections.push([indexA, indexB]);
  }

  /** Set input RPM on the first gear and propagate through the train */
  drive(inputRpm: number): void {
    if (this.gears.length === 0) return;
    this.gears[0].rpm = inputRpm;

    // Propagate through connections
    const visited = new Set<number>([0]);
    const queue = [0];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const [a, b] of this.connections) {
        let from: number, to: number;
        if (a === current && !visited.has(b)) { from = a; to = b; }
        else if (b === current && !visited.has(a)) { from = b; to = a; }
        else continue;

        const ratio = this.gears[from].teeth / this.gears[to].teeth;
        this.gears[to].rpm = -this.gears[from].rpm * ratio; // opposite direction
        this.gears[to].torque = this.gears[from].torque / ratio;
        visited.add(to);
        queue.push(to);
      }
    }
  }

  /** Advance all gears by time delta */
  step(dt: number): void {
    for (const gear of this.gears) {
      gear.step(dt);
    }
  }

  /** Get output RPM (last gear) */
  getOutputRpm(): number {
    return this.gears.length > 0 ? this.gears[this.gears.length - 1].rpm : 0;
  }

  /** Get total gear ratio from first to last */
  getTotalRatio(): number {
    if (this.gears.length < 2) return 1;
    return this.gears[0].teeth / this.gears[this.gears.length - 1].teeth;
  }
}
