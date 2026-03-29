/**
 * CPU-based 2D heightfield water simulation.
 * Uses the wave equation (finite differences) for realistic surface ripples.
 * Technique from madebyevan.com/webgl-water/
 */
export class WaterSimulation {
  readonly size: number;
  private heights: Float32Array;
  private velocities: Float32Array;

  constructor(size: number) {
    this.size = size;
    this.heights = new Float32Array(size * size);
    this.velocities = new Float32Array(size * size);
  }

  /** Run one simulation step (wave equation with damping). */
  step(): void {
    const s = this.size;
    const h = this.heights;
    const v = this.velocities;

    // Update velocities from height differences (reads h, writes v)
    for (let z = 1; z < s - 1; z++) {
      for (let x = 1; x < s - 1; x++) {
        const i = z * s + x;
        const avg = (h[i - 1] + h[i + 1] + h[i - s] + h[i + s]) * 0.25;
        v[i] += (avg - h[i]) * 2.0;
        v[i] *= 0.995; // damping
      }
    }

    // Integrate heights (reads v, writes h)
    for (let i = 0; i < s * s; i++) {
      h[i] += v[i];
    }
  }

  /** Add a circular ripple at normalized grid coordinates (0-1). */
  addDrop(nx: number, nz: number, radius: number, strength: number): void {
    if (nx < 0 || nx > 1 || nz < 0 || nz > 1) return;

    const s = this.size;
    const cx = nx * (s - 1);
    const cz = nz * (s - 1);
    const r = Math.max(1, radius * s);

    const x0 = Math.max(1, Math.floor(cx - r));
    const x1 = Math.min(s - 2, Math.ceil(cx + r));
    const z0 = Math.max(1, Math.floor(cz - r));
    const z1 = Math.min(s - 2, Math.ceil(cz + r));

    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dz = z - cz;
        const dist2 = (dx * dx + dz * dz) / (r * r);
        if (dist2 > 1) continue;
        this.heights[z * s + x] += strength * Math.exp(-dist2 * 6);
      }
    }
  }

  /** Get interpolated height at normalized coordinates (0-1). */
  getHeight(nx: number, nz: number): number {
    const s = this.size;
    const gx = Math.max(0, Math.min(s - 1, nx * (s - 1)));
    const gz = Math.max(0, Math.min(s - 1, nz * (s - 1)));
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const x1 = Math.min(x0 + 1, s - 1);
    const z1 = Math.min(z0 + 1, s - 1);
    const fx = gx - x0;
    const fz = gz - z0;

    return (
      (this.heights[z0 * s + x0] * (1 - fx) + this.heights[z0 * s + x1] * fx) * (1 - fz) +
      (this.heights[z1 * s + x0] * (1 - fx) + this.heights[z1 * s + x1] * fx) * fz
    );
  }

  get heightData(): Float32Array {
    return this.heights;
  }
}
