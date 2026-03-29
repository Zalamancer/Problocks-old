/**
 * Section 4.8 -- Edit Tab
 *
 * Tool selector + brush settings + material picker for terrain editing.
 * Each tool type shows its relevant controls.
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MaterialPicker } from './MaterialPicker';

// ── Types ──────────────────────────────────────────────────────────

export type BrushTool = 'draw' | 'sculpt' | 'smooth' | 'flatten' | 'paint';
export type BrushShapeUI = 'sphere' | 'box' | 'cylinder';
export type FlattenModeUI = 'both' | 'erode' | 'grow';
export type PaintModeUI = 'paint' | 'replace';
export type DrawModeUI = 'add' | 'subtract';
export type PivotUI = 'bottom' | 'center' | 'top';

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

const TOOLS: { id: BrushTool; label: string; icon: string }[] = [
  { id: 'draw',    label: 'Draw',    icon: 'D' },
  { id: 'sculpt',  label: 'Sculpt',  icon: 'S' },
  { id: 'smooth',  label: 'Smooth',  icon: '~' },
  { id: 'flatten', label: 'Flatten', icon: 'F' },
  { id: 'paint',   label: 'Paint',   icon: 'P' },
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
      {/* ── Tool selector ─────────────────────────── */}
      <div>
        <SectionHeader>Tool</SectionHeader>
        <div className="flex gap-1">
          {TOOLS.map((t) => (
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
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={state.snapToVoxel}
              onChange={(e) => update('snapToVoxel', e.target.checked)}
              className="sr-only"
            />
            <span
              className={cn(
                'shrink-0 w-3.5 h-3.5 rounded border transition-colors flex items-center justify-center',
                state.snapToVoxel
                  ? 'border-green-500 bg-green-500/20'
                  : 'border-zinc-600 bg-zinc-800',
              )}
            >
              {state.snapToVoxel && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4.2 7.2L8 3" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="text-[11px] text-zinc-300">Snap to Voxel Grid</span>
          </label>
        </div>
      </div>
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
  };
}
