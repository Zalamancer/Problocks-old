/** Shared sculpt state — written by SculptPanel, read by ViewportThree */

export type SculptTool = 'raise' | 'lower' | 'smooth' | 'flatten';

export const VOXEL_PRESETS = [32, 48, 64, 80] as const;

export const sculptState = {
  tool: 'raise' as SculptTool,
  size: 2,
  strength: 0.5,
  wireframe: false,
  voxelRes: 48 as number,
  /** Listeners notified on any change */
  _listeners: new Set<() => void>(),
  subscribe(fn: () => void) { this._listeners.add(fn); return () => { this._listeners.delete(fn); }; },
  _notify() { this._listeners.forEach(fn => fn()); },

  setTool(t: SculptTool) { this.tool = t; this._notify(); },
  setSize(s: number) { this.size = s; this._notify(); },
  setStrength(s: number) { this.strength = s; this._notify(); },
  setWireframe(w: boolean) { this.wireframe = w; this._notify(); },
  setVoxelRes(r: number) { this.voxelRes = r; this._notify(); },
};
