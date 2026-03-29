import type { EntityData } from './studio-store';

const SCENE_KEY = 'problocks:scene';
const PRESETS_KEY = 'problocks:terrain-presets';

export interface TerrainPreset {
  name: string;
  terrain: NonNullable<EntityData['terrain']>;
}

export const BUILT_IN_PRESETS: TerrainPreset[] = [
  { name: 'Mountains', terrain: { width: 100, depth: 100, subdivisions: 128, maxHeight: 30, seed: 42, noiseScale: 0.02, octaves: 8 } },
  { name: 'Desert', terrain: { width: 200, depth: 200, subdivisions: 128, maxHeight: 5, seed: 7, noiseScale: 0.01, octaves: 3 } },
  { name: 'Islands', terrain: { width: 150, depth: 150, subdivisions: 128, maxHeight: 15, seed: 99, noiseScale: 0.04, octaves: 6 } },
  { name: 'Flat', terrain: { width: 100, depth: 100, subdivisions: 128, maxHeight: 0.5, seed: 1, noiseScale: 0.01, octaves: 1 } },
];

export function saveScene(entities: EntityData[]): void {
  try {
    localStorage.setItem(SCENE_KEY, JSON.stringify(entities));
  } catch { /* quota exceeded — silently fail */ }
}

export function loadScene(): EntityData[] | null {
  try {
    const raw = localStorage.getItem(SCENE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as EntityData[];
  } catch {
    return null;
  }
}

export function clearScene(): void {
  localStorage.removeItem(SCENE_KEY);
}

export function getTerrainPresets(): TerrainPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    const userPresets: TerrainPreset[] = raw ? JSON.parse(raw) : [];
    return [...BUILT_IN_PRESETS, ...userPresets];
  } catch {
    return [...BUILT_IN_PRESETS];
  }
}

export function saveTerrainPreset(preset: TerrainPreset): void {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    const userPresets: TerrainPreset[] = raw ? JSON.parse(raw) : [];
    const idx = userPresets.findIndex(p => p.name === preset.name);
    if (idx >= 0) userPresets[idx] = preset;
    else userPresets.push(preset);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(userPresets));
  } catch { /* quota exceeded */ }
}

export function deleteTerrainPreset(name: string): void {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return;
    const userPresets: TerrainPreset[] = JSON.parse(raw);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(userPresets.filter(p => p.name !== name)));
  } catch { /* ignore */ }
}
