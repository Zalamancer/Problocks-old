/**
 * Section 4.8 -- Edit Tab
 *
 * Tool selector + brush settings + material picker for terrain editing.
 * Each tool type shows its relevant controls.
 */

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MaterialPicker } from './MaterialPicker';

// ── Types ──────────────────────────────────────────────────────────

export type BrushTool = 'draw' | 'sculpt' | 'smooth' | 'flatten' | 'paint'
  | 'select' | 'transform' | 'fill' | 'sealevel' | 'water' | 'colors';
export type BrushShapeUI = 'sphere' | 'box' | 'cylinder';
export type FlattenModeUI = 'both' | 'erode' | 'grow';
export type PaintModeUI = 'paint' | 'replace';
export type DrawModeUI = 'add' | 'subtract';
export type PivotUI = 'bottom' | 'center' | 'top';
export type FillModeUI = 'fill' | 'replace';

export interface EditTabState {
  tool: BrushTool;
  shape: BrushShapeUI;
  size: number;
  height: number;
  strength: number;
  materialId: number;
  drawMode: DrawModeUI;
  flattenMode: FlattenModeUI;
  paintMode: PaintModeUI;
  sourceMaterialId: number;
  pivot: PivotUI;
  snapToVoxel: boolean;
  // Region tool state (Phase 6)
  fillMode: FillModeUI;
  fillMaterialId: number;
  replaceSrcId: number;
  replaceDstId: number;
  transformX: number;
  transformY: number;
  transformZ: number;
  transformRotY: number;
  transformScaleX: number;
  transformScaleY: number;
  transformScaleZ: number;
  mergeEmpty: boolean;
  waterLevel: number;
  // Water properties (Phase 7)
  waterColorR: number;
  waterColorG: number;
  waterColorB: number;
  waterReflectance: number;
  waterTransparency: number;
  waterWaveSize: number;
  waterWaveSpeed: number;
  // Visual polish (Phase 9)
  decoration: boolean;
  grassLength: number;
  colorPreset: string;
}

// ── Section header (reused) ────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
      {children}
    </h4>
  );
}

// ── Slider ─────────────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-zinc-400">{label}</span>
        <span className="text-[11px] text-zinc-500">{displayValue ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-green-500 bg-zinc-700 rounded-full appearance-none cursor-pointer"
      />
    </div>
  );
}

// ── Tool icons (simple text labels for now) ────────────────────────

const BRUSH_TOOLS: { id: BrushTool; label: string; icon: string }[] = [
  { id: 'draw',    label: 'Draw',    icon: 'D' },
  { id: 'sculpt',  label: 'Sculpt',  icon: 'S' },
  { id: 'smooth',  label: 'Smooth',  icon: '~' },
  { id: 'flatten', label: 'Flatten', icon: 'F' },
  { id: 'paint',   label: 'Paint',   icon: 'P' },
];

const REGION_TOOLS: { id: BrushTool; label: string; icon: string }[] = [
  { id: 'select',    label: 'Select',    icon: '▢' },
  { id: 'transform', label: 'Transform', icon: '⤡' },
  { id: 'fill',      label: 'Fill',      icon: '▮' },
  { id: 'sealevel',  label: 'Sea Level', icon: '≋' },
  { id: 'water',     label: 'Water',     icon: '~' },
  { id: 'colors',    label: 'Colors',    icon: '◐' },
];

const SHAPES: { id: BrushShapeUI; label: string }[] = [
  { id: 'sphere',   label: 'Sphere' },
  { id: 'box',      label: 'Box' },
  { id: 'cylinder', label: 'Cylinder' },
];

// ── Toggle button group ────────────────────────────────────────────

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            'flex-1 text-[11px] py-1 rounded-md transition-colors',
            value === opt.id
              ? 'bg-green-500/15 text-green-400 font-medium'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

const BRUSH_TOOL_SET = new Set<BrushTool>(['draw', 'sculpt', 'smooth', 'flatten', 'paint']);

function isBrushTool(tool: BrushTool): boolean {
  return BRUSH_TOOL_SET.has(tool);
}

/** Convert 0-255 RGB to hex string. */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Parse hex string to 0-255 RGB. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// ── Checkbox ──────────────────────────────────────────────────────

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          'shrink-0 w-3.5 h-3.5 rounded border transition-colors flex items-center justify-center',
          checked
            ? 'border-green-500 bg-green-500/20'
            : 'border-zinc-600 bg-zinc-800',
        )}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.2 7.2L8 3" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-[11px] text-zinc-300">{label}</span>
    </label>
  );
}

// ── Number input ──────────────────────────────────────────────────

function NumberInput({
  label,
  value,
  onChange,
  step = 4,
  min = -9999,
  max = 9999,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <span className="text-[10px] text-zinc-500 block mb-0.5">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-1.5 py-1 text-[11px] rounded bg-zinc-800 border border-zinc-700 text-zinc-200 focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────

interface EditTabProps {
  state: EditTabState;
  onChange: (state: EditTabState) => void;
}

// ── Component ──────────────────────────────────────────────────────

export function EditTab({ state, onChange }: EditTabProps) {
  const update = useCallback(
    <K extends keyof EditTabState>(key: K, value: EditTabState[K]) => {
      onChange({ ...state, [key]: value });
    },
    [state, onChange],
  );

  return (
    <div className="space-y-4">
      {/* ── Brush tools ─────────────────────────────── */}
      <div>
        <SectionHeader>Brush Tools</SectionHeader>
        <div className="flex gap-1">
          {BRUSH_TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => update('tool', t.id)}
              title={t.label}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-md transition-colors',
                state.tool === t.id
                  ? 'bg-green-500/15 text-green-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]',
              )}
            >
              <span className="text-[14px] font-mono font-bold leading-none">{t.icon}</span>
              <span className="text-[9px]">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Region tools ─────────────────────────────── */}
      <div>
        <SectionHeader>Region Tools</SectionHeader>
        <div className="flex gap-1">
          {REGION_TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => update('tool', t.id)}
              title={t.label}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-md transition-colors',
                state.tool === t.id
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]',
              )}
            >
              <span className="text-[14px] font-mono font-bold leading-none">{t.icon}</span>
              <span className="text-[9px]">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Brush-specific settings ────────────────── */}
      {isBrushTool(state.tool) && (
        <>
          {/* ── Brush shape ───────────────────────────── */}
          <div>
            <SectionHeader>Brush Shape</SectionHeader>
            <ToggleGroup options={SHAPES} value={state.shape} onChange={(v) => update('shape', v)} />
          </div>

          {/* ── Brush settings ────────────────────────── */}
          <div>
            <SectionHeader>Brush Settings</SectionHeader>
            <div className="space-y-2.5">
              <Slider
                label="Size"
                value={state.size}
                min={4}
                max={256}
                step={4}
                displayValue={`${state.size} units`}
                onChange={(v) => update('size', v)}
              />
              {state.shape !== 'sphere' && (
                <Slider
                  label="Height"
                  value={state.height}
                  min={4}
                  max={256}
                  step={4}
                  displayValue={`${state.height} units`}
                  onChange={(v) => update('height', v)}
                />
              )}
              <Slider
                label="Strength"
                value={state.strength}
                min={0.1}
                max={1}
                step={0.05}
                displayValue={state.strength.toFixed(2)}
                onChange={(v) => update('strength', v)}
              />
            </div>
          </div>

          {/* ── Mode toggles (tool-specific) ──────────── */}
          {state.tool === 'draw' && (
            <div>
              <SectionHeader>Draw Mode</SectionHeader>
              <ToggleGroup
                options={[
                  { id: 'add' as DrawModeUI, label: 'Add' },
                  { id: 'subtract' as DrawModeUI, label: 'Subtract' },
                ]}
                value={state.drawMode}
                onChange={(v) => update('drawMode', v)}
              />
            </div>
          )}

          {state.tool === 'sculpt' && (
            <div>
              <SectionHeader>Sculpt Mode</SectionHeader>
              <ToggleGroup
                options={[
                  { id: 'add' as DrawModeUI, label: 'Build Up' },
                  { id: 'subtract' as DrawModeUI, label: 'Carve' },
                ]}
                value={state.drawMode}
                onChange={(v) => update('drawMode', v)}
              />
            </div>
          )}

          {state.tool === 'flatten' && (
            <div>
              <SectionHeader>Flatten Mode</SectionHeader>
              <ToggleGroup
                options={[
                  { id: 'both' as FlattenModeUI, label: 'Both' },
                  { id: 'erode' as FlattenModeUI, label: 'Erode' },
                  { id: 'grow' as FlattenModeUI, label: 'Grow' },
                ]}
                value={state.flattenMode}
                onChange={(v) => update('flattenMode', v)}
              />
            </div>
          )}

          {state.tool === 'paint' && (
            <div>
              <SectionHeader>Paint Mode</SectionHeader>
              <ToggleGroup
                options={[
                  { id: 'paint' as PaintModeUI, label: 'Paint' },
                  { id: 'replace' as PaintModeUI, label: 'Replace' },
                ]}
                value={state.paintMode}
                onChange={(v) => update('paintMode', v)}
              />
              {state.paintMode === 'replace' && (
                <div className="mt-2">
                  <span className="text-[11px] text-zinc-400 block mb-1">Source Material</span>
                  <MaterialPicker
                    selectedId={state.sourceMaterialId}
                    onChange={(id) => update('sourceMaterialId', id)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Material ──────────────────────────────── */}
          {state.tool !== 'smooth' && (
            <div>
              <SectionHeader>Material</SectionHeader>
              <MaterialPicker
                selectedId={state.materialId}
                onChange={(id) => update('materialId', id)}
              />
            </div>
          )}

          {/* ── Advanced ──────────────────────────────── */}
          <div>
            <SectionHeader>Advanced</SectionHeader>
            <div className="space-y-2">
              <ToggleGroup
                options={[
                  { id: 'bottom' as PivotUI, label: 'Bottom' },
                  { id: 'center' as PivotUI, label: 'Center' },
                  { id: 'top' as PivotUI, label: 'Top' },
                ]}
                value={state.pivot}
                onChange={(v) => update('pivot', v)}
              />
              <Checkbox
                checked={state.snapToVoxel}
                onChange={(v) => update('snapToVoxel', v)}
                label="Snap to Voxel Grid"
              />
            </div>
          </div>
        </>
      )}

      {/* ── Select tool ──────────────────────────────── */}
      {state.tool === 'select' && (
        <div>
          <SectionHeader>Selection</SectionHeader>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Click and drag on terrain to create a selection box.
          </p>
          <div className="mt-2 space-y-1 text-[10px] text-zinc-500">
            <div>Ctrl+C — Copy</div>
            <div>Ctrl+X — Cut</div>
            <div>Ctrl+V — Paste</div>
            <div>Ctrl+D — Duplicate</div>
            <div>Delete — Clear region</div>
          </div>
        </div>
      )}

      {/* ── Transform tool ───────────────────────────── */}
      {state.tool === 'transform' && (
        <div className="space-y-3">
          <div>
            <SectionHeader>Position Offset</SectionHeader>
            <div className="grid grid-cols-3 gap-1.5">
              <NumberInput label="X" value={state.transformX} onChange={(v) => update('transformX', v)} />
              <NumberInput label="Y" value={state.transformY} onChange={(v) => update('transformY', v)} />
              <NumberInput label="Z" value={state.transformZ} onChange={(v) => update('transformZ', v)} />
            </div>
          </div>
          <div>
            <SectionHeader>Rotation (Y)</SectionHeader>
            <ToggleGroup
              options={[
                { id: '0', label: '0' },
                { id: '90', label: '90' },
                { id: '180', label: '180' },
                { id: '270', label: '270' },
              ]}
              value={String(state.transformRotY)}
              onChange={(v) => update('transformRotY', Number(v))}
            />
          </div>
          <div>
            <SectionHeader>Scale</SectionHeader>
            <div className="grid grid-cols-3 gap-1.5">
              <NumberInput label="X" value={state.transformScaleX} step={0.5} min={0.5} max={4} onChange={(v) => update('transformScaleX', v)} />
              <NumberInput label="Y" value={state.transformScaleY} step={0.5} min={0.5} max={4} onChange={(v) => update('transformScaleY', v)} />
              <NumberInput label="Z" value={state.transformScaleZ} step={0.5} min={0.5} max={4} onChange={(v) => update('transformScaleZ', v)} />
            </div>
          </div>
          <Checkbox
            checked={state.mergeEmpty}
            onChange={(v) => update('mergeEmpty', v)}
            label="Merge Empty (air overwrites)"
          />
          <button className="w-full py-1.5 text-[11px] font-medium rounded-md bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors">
            Apply Transform
          </button>
        </div>
      )}

      {/* ── Fill tool ────────────────────────────────── */}
      {state.tool === 'fill' && (
        <div className="space-y-3">
          <div>
            <SectionHeader>Fill Mode</SectionHeader>
            <ToggleGroup
              options={[
                { id: 'fill' as FillModeUI, label: 'Fill' },
                { id: 'replace' as FillModeUI, label: 'Replace' },
              ]}
              value={state.fillMode}
              onChange={(v) => update('fillMode', v)}
            />
          </div>
          {state.fillMode === 'fill' && (
            <div>
              <SectionHeader>Fill Material</SectionHeader>
              <MaterialPicker
                selectedId={state.fillMaterialId}
                onChange={(id) => update('fillMaterialId', id)}
              />
            </div>
          )}
          {state.fillMode === 'replace' && (
            <div className="space-y-2">
              <div>
                <span className="text-[11px] text-zinc-400 block mb-1">Source</span>
                <MaterialPicker
                  selectedId={state.replaceSrcId}
                  onChange={(id) => update('replaceSrcId', id)}
                />
              </div>
              <div>
                <span className="text-[11px] text-zinc-400 block mb-1">Target</span>
                <MaterialPicker
                  selectedId={state.replaceDstId}
                  onChange={(id) => update('replaceDstId', id)}
                />
              </div>
            </div>
          )}
          <button className="w-full py-1.5 text-[11px] font-medium rounded-md bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors">
            Apply {state.fillMode === 'fill' ? 'Fill' : 'Replace'}
          </button>
        </div>
      )}

      {/* ── Sea Level tool ───────────────────────────── */}
      {state.tool === 'sealevel' && (
        <div className="space-y-3">
          <div>
            <SectionHeader>Water Level</SectionHeader>
            <Slider
              label="Y Level"
              value={state.waterLevel}
              min={-256}
              max={512}
              step={4}
              displayValue={`${state.waterLevel} units`}
              onChange={(v) => update('waterLevel', v)}
            />
          </div>
          <div className="flex gap-1.5">
            <button className="flex-1 py-1.5 text-[11px] font-medium rounded-md bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors">
              Create Sea
            </button>
            <button className="flex-1 py-1.5 text-[11px] font-medium rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
              Evaporate
            </button>
          </div>
        </div>
      )}

      {/* ── Colors / Decoration (Phase 9) ──────────── */}
      {state.tool === 'colors' && (
        <div className="space-y-3">
          <div>
            <SectionHeader>Grass</SectionHeader>
            <div className="space-y-2">
              <Checkbox
                checked={state.decoration}
                onChange={(v) => update('decoration', v)}
                label="Show Grass"
              />
              {state.decoration && (
                <Slider
                  label="Grass Length"
                  value={state.grassLength}
                  min={0.1}
                  max={1}
                  step={0.05}
                  displayValue={state.grassLength.toFixed(2)}
                  onChange={(v) => update('grassLength', v)}
                />
              )}
            </div>
          </div>
          <div>
            <SectionHeader>Color Preset</SectionHeader>
            <ToggleGroup
              options={[
                { id: 'default', label: 'Default' },
                { id: 'fantasy', label: 'Fantasy' },
                { id: 'tundra', label: 'Tundra' },
              ]}
              value={state.colorPreset}
              onChange={(v) => update('colorPreset', v)}
            />
          </div>
        </div>
      )}

      {/* ── Water Properties tool (Phase 7) ─────────── */}
      {state.tool === 'water' && (
        <div className="space-y-3">
          <div>
            <SectionHeader>Water Color</SectionHeader>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={rgbToHex(state.waterColorR, state.waterColorG, state.waterColorB)}
                onChange={(e) => {
                  const { r, g, b } = hexToRgb(e.target.value);
                  onChange({ ...state, waterColorR: r, waterColorG: g, waterColorB: b });
                }}
                className="w-8 h-8 rounded border border-zinc-700 bg-zinc-800 cursor-pointer"
              />
              <span className="text-[11px] text-zinc-400">
                {rgbToHex(state.waterColorR, state.waterColorG, state.waterColorB)}
              </span>
            </div>
          </div>
          <div>
            <SectionHeader>Appearance</SectionHeader>
            <div className="space-y-2.5">
              <Slider
                label="Reflectance"
                value={state.waterReflectance}
                min={0}
                max={1}
                step={0.05}
                displayValue={state.waterReflectance.toFixed(2)}
                onChange={(v) => update('waterReflectance', v)}
              />
              <Slider
                label="Transparency"
                value={state.waterTransparency}
                min={0}
                max={1}
                step={0.05}
                displayValue={state.waterTransparency.toFixed(2)}
                onChange={(v) => update('waterTransparency', v)}
              />
            </div>
          </div>
          <div>
            <SectionHeader>Waves</SectionHeader>
            <div className="space-y-2.5">
              <Slider
                label="Wave Size"
                value={state.waterWaveSize}
                min={0}
                max={1}
                step={0.05}
                displayValue={state.waterWaveSize.toFixed(2)}
                onChange={(v) => update('waterWaveSize', v)}
              />
              <Slider
                label="Wave Speed"
                value={state.waterWaveSpeed}
                min={0}
                max={100}
                step={1}
                displayValue={`${state.waterWaveSpeed}`}
                onChange={(v) => update('waterWaveSpeed', v)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Default state ──────────────────────────────────────────────────

export function defaultEditTabState(): EditTabState {
  return {
    tool: 'draw',
    shape: 'sphere',
    size: 32,
    height: 32,
    strength: 0.5,
    materialId: 1, // Grass
    drawMode: 'add',
    flattenMode: 'both',
    paintMode: 'paint',
    sourceMaterialId: 1,
    pivot: 'center',
    snapToVoxel: false,
    // Region tools
    fillMode: 'fill',
    fillMaterialId: 1,
    replaceSrcId: 1,
    replaceDstId: 3, // Rock
    transformX: 0,
    transformY: 0,
    transformZ: 0,
    transformRotY: 0,
    transformScaleX: 1,
    transformScaleY: 1,
    transformScaleZ: 1,
    mergeEmpty: false,
    waterLevel: 64,
    // Water properties (Phase 7)
    waterColorR: 12,
    waterColorG: 84,
    waterColorB: 92,
    waterReflectance: 0.4,
    waterTransparency: 0.5,
    waterWaveSize: 0.3,
    waterWaveSpeed: 15,
    // Visual polish (Phase 9)
    decoration: true,
    grassLength: 0.5,
    colorPreset: 'default',
  };
}
