/**
 * Seeded 2D Simplex noise — zero dependencies.
 *
 * Based on Stefan Gustavson's implementation, adapted for seeded determinism.
 * All output is clamped to [-1, 1].
 */

// ── Seeded Simplex Noise ─────────────────────────────────────────────

export class SimplexNoise {
  private readonly perm: Uint8Array;

  constructor(seed: number) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);

    // Seed-based permutation using simple LCG
    let s = seed | 0;
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = (s >>> 0) % (i + 1);
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  /** Sample 2D Simplex noise at (x, y). Returns a value in [-1, 1]. */
  noise2D(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const perm = this.perm;

    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * grad(perm[ii + perm[jj]], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * grad(perm[ii + i1 + perm[jj + j1]], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * grad(perm[ii + 1 + perm[jj + 1]], x2, y2);
    }

    const raw = 70 * (n0 + n1 + n2);
    return Math.max(-1, Math.min(1, raw));
  }
}

function grad(hash: number, gx: number, gy: number): number {
  const h = hash & 7;
  const u = h < 4 ? gx : gy;
  const v = h < 4 ? gy : gx;
  return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
}

// ── Seeded PRNG ──────────────────────────────────────────────────────

/** Deterministic pseudo-random number generator using LCG. */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0xffffffff;
  }

  /** Returns an integer in [0, max). */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** Fisher-Yates shuffle (in-place, deterministic). */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }
}
