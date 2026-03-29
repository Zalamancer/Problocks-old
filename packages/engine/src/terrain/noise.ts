/**
 * Simplex-like noise implementation for procedural terrain generation.
 * Based on improved Perlin noise with permutation table.
 * Zero dependencies — runs in browser and Node.
 */

// Permutation table (doubled to avoid overflow)
const perm = new Uint8Array(512);
const grad3 = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
];

function seedPermutation(seed: number): void {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates shuffle with seed
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647; // LCG
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}

// Initialize with default seed
seedPermutation(42);

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function dot3(g: number[], x: number, y: number, z: number): number {
  return g[0] * x + g[1] * y + g[2] * z;
}

/**
 * 2D Perlin noise, returns value in [-1, 1].
 */
function noise2D(x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);

  const aa = perm[perm[X] + Y];
  const ab = perm[perm[X] + Y + 1];
  const ba = perm[perm[X + 1] + Y];
  const bb = perm[perm[X + 1] + Y + 1];

  const g00 = grad3[aa % 12];
  const g10 = grad3[ba % 12];
  const g01 = grad3[ab % 12];
  const g11 = grad3[bb % 12];

  const n00 = dot3(g00, xf, yf, 0);
  const n10 = dot3(g10, xf - 1, yf, 0);
  const n01 = dot3(g01, xf, yf - 1, 0);
  const n11 = dot3(g11, xf - 1, yf - 1, 0);

  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

/**
 * Fractal Brownian Motion — layered noise for natural-looking terrain.
 */
export function fbm(
  x: number,
  y: number,
  octaves = 6,
  lacunarity = 2.0,
  persistence = 0.5,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxValue; // normalize to [-1, 1]
}

/**
 * Generate a heightmap as a Float32Array.
 * Returns row-major array of height values, size = rows * cols.
 */
export function generateHeightmap(options: {
  rows: number;
  cols: number;
  scale?: number;
  height?: number;
  octaves?: number;
  seed?: number;
  offsetX?: number;
  offsetZ?: number;
}): Float32Array {
  const {
    rows, cols,
    scale = 0.03,
    height = 10,
    octaves = 6,
    seed = 42,
    offsetX = 0,
    offsetZ = 0,
  } = options;

  seedPermutation(seed);

  const data = new Float32Array(rows * cols);
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const nx = (x + offsetX) * scale;
      const nz = (z + offsetZ) * scale;
      // fbm gives [-1, 1], remap to [0, height]
      const h = (fbm(nx, nz, octaves) + 1) * 0.5 * height;
      data[z * cols + x] = h;
    }
  }

  return data;
}

/**
 * Seed the noise generator.
 */
export function setNoiseSeed(seed: number): void {
  seedPermutation(seed);
}
