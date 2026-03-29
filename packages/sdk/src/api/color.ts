/**
 * Color utilities for simulation developers.
 */
export const Color = {
  hex(value: string) {
    return { type: 'hex' as const, value };
  },

  rgb(r: number, g: number, b: number) {
    return { type: 'rgb' as const, r, g, b };
  },

  // Common presets
  Red: { type: 'hex' as const, value: '#ff4444' },
  Green: { type: 'hex' as const, value: '#44ff44' },
  Blue: { type: 'hex' as const, value: '#4444ff' },
  White: { type: 'hex' as const, value: '#ffffff' },
  Black: { type: 'hex' as const, value: '#000000' },
  Yellow: { type: 'hex' as const, value: '#ffff44' },
  Orange: { type: 'hex' as const, value: '#ff8844' },
  Purple: { type: 'hex' as const, value: '#8844ff' },
  Cyan: { type: 'hex' as const, value: '#44ffff' },
  Gray: { type: 'hex' as const, value: '#888888' },
};
