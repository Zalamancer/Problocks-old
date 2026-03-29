# Terrain Save & Scene Persistence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save and restore terrain configs + full scene state via localStorage, with terrain presets and terrain data in simulation exports.

**Architecture:** A thin `storage.ts` module handles all localStorage read/write. StudioProvider auto-persists on every entity change via useEffect. Terrain presets are stored separately under their own key. The API's simulation publish/download endpoints are extended with an optional `scene_data` JSON column.

**Tech Stack:** React (useState + useEffect), localStorage, Hono API, better-sqlite3

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/web-studio/src/store/storage.ts` | localStorage read/write helpers |
| Modify | `apps/web-studio/src/store/StudioProvider.tsx` | Auto-persist + restore on mount |
| Modify | `apps/web-studio/src/store/studio-store.ts` | Export TerrainConfig type |
| Modify | `apps/web-studio/src/components/studio/PropertiesPanel.tsx` | Preset save/load UI |
| Modify | `apps/web-studio/src/components/studio/TopMenuBar.tsx` | Wire Save button |
| Modify | `apps/api/src/db/schema.ts` | Add `scene_data` column |
| Modify | `apps/api/src/routes/simulations.ts` | Include scene_data in publish/download |

---

### Task 1: Storage Module

**Files:**
- Create: `apps/web-studio/src/store/storage.ts`

- [ ] **Step 1: Create storage.ts with scene persistence helpers**

```ts
import type { EntityData } from './studio-store';

const SCENE_KEY = 'problocks:scene';
const PRESETS_KEY = 'problocks:terrain-presets';

export interface TerrainPreset {
  name: string;
  terrain: NonNullable<EntityData['terrain']>;
}

const BUILT_IN_PRESETS: TerrainPreset[] = [
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
    // Replace if same name exists
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

export { BUILT_IN_PRESETS };
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-studio/src/store/storage.ts
git commit -m "feat: add localStorage storage module for scene + terrain presets"
```

---

### Task 2: Export TerrainConfig Type

**Files:**
- Modify: `apps/web-studio/src/store/studio-store.ts`

- [ ] **Step 1: Extract TerrainConfig as a named type**

In `studio-store.ts`, extract the inline terrain type to a named export so storage.ts and other modules can reference it:

```ts
export interface TerrainConfig {
  width: number;
  depth: number;
  subdivisions: number;
  maxHeight: number;
  seed: number;
  noiseScale: number;
  octaves: number;
}
```

Update `EntityData.terrain` to use `terrain?: TerrainConfig`.

- [ ] **Step 2: Commit**

```bash
git add apps/web-studio/src/store/studio-store.ts
git commit -m "refactor: extract TerrainConfig type from EntityData"
```

---

### Task 3: Auto-Persist in StudioProvider

**Files:**
- Modify: `apps/web-studio/src/store/StudioProvider.tsx`

- [ ] **Step 1: Import storage helpers and restore on mount**

Add to StudioProvider.tsx:
- Import `saveScene` and `loadScene` from `./storage`
- Change `useState<EntityData[]>(DEFAULT_ENTITIES)` to `useState<EntityData[]>(() => loadScene() ?? DEFAULT_ENTITIES)` (lazy initializer)

- [ ] **Step 2: Add useEffect to persist on entity changes**

```ts
useEffect(() => {
  saveScene(entities);
}, [entities]);
```

- [ ] **Step 3: Add resetScene action**

Add a `resetScene` callback that clears localStorage and resets to defaults:

```ts
const resetScene = useCallback(() => {
  clearScene();
  setEntities(DEFAULT_ENTITIES);
  setSelectedEntityId(null);
}, []);
```

Expose `resetScene` in the context value.

- [ ] **Step 4: Update StudioState and StudioActions in studio-store.ts**

Add `resetScene: () => void` to StudioActions interface.

- [ ] **Step 5: Commit**

```bash
git add apps/web-studio/src/store/StudioProvider.tsx apps/web-studio/src/store/studio-store.ts
git commit -m "feat: auto-persist scene to localStorage, restore on mount"
```

---

### Task 4: Wire Save Button + Cmd+S

**Files:**
- Modify: `apps/web-studio/src/components/studio/TopMenuBar.tsx`

- [ ] **Step 1: Wire the Save menu item**

Import `saveScene` from storage. In the File dropdown, update the Save item's onClick to call `saveScene(entities)` and show a brief toast/log via `addLog('[system] Scene saved')`. Also add `entities` to the destructured useStudio() call.

- [ ] **Step 2: Wire New Simulation to resetScene**

Add `resetScene` to the destructured useStudio() call. Update the "New Simulation" item's onClick to call `resetScene()`.

- [ ] **Step 3: Add Cmd+S keyboard shortcut**

Add a useEffect in TopMenuBar that listens for `keydown` with `e.metaKey && e.key === 's'`, calls `e.preventDefault()`, and saves.

- [ ] **Step 4: Commit**

```bash
git add apps/web-studio/src/components/studio/TopMenuBar.tsx
git commit -m "feat: wire Save button + Cmd+S shortcut, New Simulation resets scene"
```

---

### Task 5: Terrain Preset UI in PropertiesPanel

**Files:**
- Modify: `apps/web-studio/src/components/studio/PropertiesPanel.tsx`

- [ ] **Step 1: Add preset selector dropdown**

Import `getTerrainPresets`, `saveTerrainPreset`, `BUILT_IN_PRESETS` from storage. Add a "Presets" PanelSection above the existing Terrain section (only shown when `entity.terrain` exists).

Contents:
- A `<select>` dropdown listing all presets (built-in + user). On change, apply the selected preset's terrain config via `updateEntity`.
- A "Save As Preset" button that prompts for a name (simple `window.prompt`) and saves current terrain config.

```tsx
<PanelSection title="Presets" collapsible>
  <div className="space-y-2">
    <select
      className="w-full bg-[#2a2a2a] text-white text-sm px-3 py-2 rounded-lg border border-white/10"
      value=""
      onChange={(e) => {
        const preset = presets.find(p => p.name === e.target.value);
        if (preset) updateEntity(entity.id, { terrain: { ...preset.terrain } });
      }}
    >
      <option value="" disabled>Load preset...</option>
      <optgroup label="Built-in">
        {presets.filter(p => builtInNames.has(p.name)).map(p => (
          <option key={p.name} value={p.name}>{p.name}</option>
        ))}
      </optgroup>
      {presets.some(p => !builtInNames.has(p.name)) && (
        <optgroup label="My Presets">
          {presets.filter(p => !builtInNames.has(p.name)).map(p => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </optgroup>
      )}
    </select>
    <button
      className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
      onClick={() => {
        const name = window.prompt('Preset name:');
        if (name && entity.terrain) {
          saveTerrainPreset({ name, terrain: { ...entity.terrain } });
          setPresets(getTerrainPresets());
        }
      }}
    >
      Save As Preset
    </button>
  </div>
</PanelSection>
```

- [ ] **Step 2: Add local state for presets list**

```ts
const [presets, setPresets] = useState(() => getTerrainPresets());
const builtInNames = new Set(BUILT_IN_PRESETS.map(p => p.name));
```

- [ ] **Step 3: Commit**

```bash
git add apps/web-studio/src/components/studio/PropertiesPanel.tsx
git commit -m "feat: terrain preset save/load UI with built-in presets"
```

---

### Task 6: Include Terrain in Simulation Export

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Modify: `apps/api/src/routes/simulations.ts`

- [ ] **Step 1: Add scene_data column to simulations table**

In the `CREATE TABLE simulations` statement, add:
```sql
scene_data TEXT DEFAULT '{}'
```

This stores the full entities array as JSON.

- [ ] **Step 2: Update POST /simulations to accept scene_data**

In the publish endpoint, extract `scene_data` from the request body and store it:

```ts
const { name, description, category, source_code, version, scene_data } = body;
```

Update the INSERT to include `scene_data`:
```ts
db.prepare(`
  INSERT INTO simulations (id, user_id, name, slug, description, category, version, source_code, scene_data)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(id, userId.id, name, slug, description ?? '', category ?? 'general', version ?? '1.0.0', source_code, JSON.stringify(scene_data ?? {}));
```

- [ ] **Step 3: Update GET /simulations/:slug/download to include scene_data**

In the download endpoint, add `scene_data` to the response:

```ts
return c.json({
  manifest: { /* ... existing fields ... */ },
  files: { 'src/index.ts': sim.source_code },
  scene_data: JSON.parse(sim.scene_data || '{}'),
});
```

- [ ] **Step 4: Update PUT /simulations/:slug to accept scene_data**

In the update endpoint, also accept and store scene_data:

```ts
const { source_code, version, changelog, scene_data } = body;
// ...
if (scene_data !== undefined) {
  db.prepare(`UPDATE simulations SET scene_data = ? WHERE slug = ?`).run(JSON.stringify(scene_data), slug);
}
```

- [ ] **Step 5: Update GET /simulations/:slug to return scene_data**

In the single simulation endpoint, parse and include scene_data in the response.

- [ ] **Step 6: Update fork endpoint to copy scene_data**

In POST /simulations/:slug/fork, copy `scene_data` from the original to the fork.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/src/routes/simulations.ts
git commit -m "feat: include scene_data (terrain + entities) in simulation publish/download"
```

---

## Summary

| Task | What it does |
|------|-------------|
| 1 | Storage module (localStorage helpers + built-in presets) |
| 2 | Extract TerrainConfig type |
| 3 | Auto-persist scene on change, restore on mount |
| 4 | Wire Save button + Cmd+S |
| 5 | Terrain preset UI (dropdown + save-as) |
| 6 | Include terrain in simulation API export/publish |
