/**
 * Shape factory — convenience methods for creating common shapes.
 * This is the friendly API students use instead of raw components.
 */
export const Shape = {
  Box(options?: { width?: number; height?: number; depth?: number }) {
    return {
      type: 'box' as const,
      width: options?.width ?? 1,
      height: options?.height ?? 1,
      depth: options?.depth ?? 1,
    };
  },

  Sphere(options?: { radius?: number }) {
    return {
      type: 'sphere' as const,
      radius: options?.radius ?? 0.5,
    };
  },

  Cylinder(options?: { radius?: number; height?: number }) {
    return {
      type: 'cylinder' as const,
      radius: options?.radius ?? 0.5,
      height: options?.height ?? 1,
    };
  },

  Plane(options?: { width?: number; height?: number }) {
    return {
      type: 'plane' as const,
      width: options?.width ?? 10,
      height: options?.height ?? 10,
    };
  },
};
