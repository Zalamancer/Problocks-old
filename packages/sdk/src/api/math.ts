/**
 * Math utilities safe for the sandbox.
 * Wraps standard Math with vector operations commonly needed in simulations.
 */
export const ProblocksMath = {
  /** Create a 3D vector */
  vec3(x: number, y: number, z: number) {
    return { x, y, z };
  },

  /** Create a 2D vector */
  vec2(x: number, y: number) {
    return { x, y };
  },

  /** Vector addition */
  add(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }) {
    return { x: a.x + b.x, y: a.y + b.y, z: (a.z ?? 0) + (b.z ?? 0) };
  },

  /** Vector subtraction */
  sub(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }) {
    return { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) };
  },

  /** Scalar multiply */
  scale(v: { x: number; y: number; z?: number }, s: number) {
    return { x: v.x * s, y: v.y * s, z: (v.z ?? 0) * s };
  },

  /** Vector magnitude */
  magnitude(v: { x: number; y: number; z?: number }) {
    return Math.sqrt(v.x * v.x + v.y * v.y + (v.z ?? 0) * (v.z ?? 0));
  },

  /** Normalize vector */
  normalize(v: { x: number; y: number; z?: number }) {
    const mag = ProblocksMath.magnitude(v);
    if (mag === 0) return { x: 0, y: 0, z: 0 };
    return ProblocksMath.scale(v, 1 / mag);
  },

  /** Dot product */
  dot(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }) {
    return a.x * b.x + a.y * b.y + (a.z ?? 0) * (b.z ?? 0);
  },

  /** Cross product (3D) */
  cross(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  },

  /** Linear interpolation */
  lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  },

  /** Clamp value between min and max */
  clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  },

  /** Degrees to radians */
  degToRad(degrees: number) {
    return degrees * (Math.PI / 180);
  },

  /** Radians to degrees */
  radToDeg(radians: number) {
    return radians * (180 / Math.PI);
  },

  PI: Math.PI,
  TWO_PI: Math.PI * 2,
  HALF_PI: Math.PI / 2,
};
