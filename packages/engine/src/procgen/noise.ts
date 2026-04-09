/**
 * Seeded noise functions for procedural generation.
 *
 * All functions are deterministic: same seed = same output.
 * Uses permutation-table-based gradient noise for smooth results
 * and Mulberry32 for fast seeded PRNG.
 */

import type { NoiseConfig } from './types.js';

// ── Seeded PRNG (Mulberry32) ────────────────────────────────────

/**
 * Create a seedable pseudo-random number generator using Mulberry32.
 * Fast, small state, good distribution for game use.
 * @returns A function that returns a float in [0, 1) on each call.
 */
export function createRNG(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random integer in [min, max] (inclusive). */
export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Random float in [min, max). */
export function randomFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

/** Fisher-Yates shuffle (in-place, returns same array). */
export function shuffle<T>(rng: () => number, array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
  return array;
}

// ── Permutation table noise ─────────────────────────────────────

/** 2D gradient vectors for noise. */
const GRAD2: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

/**
 * Build a seeded permutation table (256 entries, doubled for wrapping).
 */
function buildPermTable(seed: number): Uint8Array {
  const rng = createRNG(seed);
  const p = new Uint8Array(512);
  // Initialize 0..255
  for (let i = 0; i < 256; i++) {
    p[i] = i;
  }
  // Shuffle the first 256 entries
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  // Mirror for wrapping
  for (let i = 0; i < 256; i++) {
    p[i + 256] = p[i];
  }
  return p;
}

/** Quintic smoothstep (Ken Perlin's improved interpolation). */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Linear interpolation. */
function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/** Dot product of gradient and distance vector. */
function grad2d(hash: number, x: number, y: number): number {
  const g = GRAD2[hash & 7];
  return g[0] * x + g[1] * y;
}

// ── Default permutation table (seed 0) ──────────────────────────
let cachedSeed: number | undefined;
let cachedPerm: Uint8Array = buildPermTable(0);

function getPermTable(seed: number): Uint8Array {
  if (seed === cachedSeed) return cachedPerm;
  cachedSeed = seed;
  cachedPerm = buildPermTable(seed);
  return cachedPerm;
}

// ── Public noise functions ──────────────────────────────────────

/**
 * 2D gradient noise, seeded, deterministic.
 * @returns Value in approximately [-1, 1].
 */
export function noise2D(x: number, y: number, seed: number = 0): number {
  const perm = getPermTable(seed);

  // Grid cell coordinates
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;

  // Fractional position within cell
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  // Smoothstep
  const u = fade(xf);
  const v = fade(yf);

  // Hash corner coordinates
  const aa = perm[perm[xi] + yi];
  const ab = perm[perm[xi] + yi + 1];
  const ba = perm[perm[xi + 1] + yi];
  const bb = perm[perm[xi + 1] + yi + 1];

  // Gradient dot products + bilinear interpolation
  const x1 = lerp(grad2d(aa, xf, yf), grad2d(ba, xf - 1, yf), u);
  const x2 = lerp(grad2d(ab, xf, yf - 1), grad2d(bb, xf - 1, yf - 1), u);

  return lerp(x1, x2, v);
}

/**
 * Fractal Brownian Motion — layered noise for natural-looking terrain.
 * @returns Value in approximately [-1, 1] (depends on octaves/persistence).
 */
export function fbm2D(x: number, y: number, config?: NoiseConfig): number {
  const seed = config?.seed ?? 0;
  const octaves = config?.octaves ?? 6;
  const frequency = config?.frequency ?? 1;
  const lacunarity = config?.lacunarity ?? 2;
  const persistence = config?.persistence ?? 0.5;

  let value = 0;
  let amplitude = 1;
  let freq = frequency;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * freq, y * freq, seed + i * 31) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    freq *= lacunarity;
  }

  // Normalize to [-1, 1]
  return value / maxAmplitude;
}
