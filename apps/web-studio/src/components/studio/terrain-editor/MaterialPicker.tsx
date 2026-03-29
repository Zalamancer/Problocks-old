/**
 * Section 4.5 -- Material Picker
 *
 * 4-column grid of all 23 terrain material swatches.
 * Click to select, Alt+click for eyedropper (handled by parent).
 */

import { cn } from '@/lib/utils';

// ── Material list (matches TerrainMaterial enum order) ─────────────

const MATERIALS = [
  { id: 0,  name: 'Air',         hex: '#FFFFFF' },
  { id: 1,  name: 'Grass',       hex: '#6A7F3F' },
  { id: 2,  name: 'Sand',        hex: '#8F7E5F' },
  { id: 3,  name: 'Rock',        hex: '#666C6F' },
  { id: 4,  name: 'Snow',        hex: '#C3C7DA' },
  { id: 5,  name: 'Water',       hex: '#0C545C' },
  { id: 6,  name: 'Mud',         hex: '#3A2E24' },
  { id: 7,  name: 'Ground',      hex: '#665C3B' },
  { id: 8,  name: 'Ice',         hex: '#81C2E0' },
  { id: 9,  name: 'Sandstone',   hex: '#895A47' },
  { id: 10, name: 'Slate',       hex: '#3F7F6B' },
  { id: 11, name: 'Concrete',    hex: '#7F663F' },
  { id: 12, name: 'Limestone',   hex: '#CEAD94' },
  { id: 13, name: 'Basalt',      hex: '#1E1E25' },
  { id: 14, name: 'Brick',       hex: '#8A563E' },
  { id: 15, name: 'Cobblestone', hex: '#847B5A' },
  { id: 16, name: 'Asphalt',     hex: '#737B6B' },
  { id: 17, name: 'Pavement',    hex: '#94948C' },
  { id: 18, name: 'Salt',        hex: '#C6BDB5' },
  { id: 19, name: 'CrackedLava', hex: '#E89C4A' },
  { id: 20, name: 'Glacier',     hex: '#65B0EA' },
  { id: 21, name: 'LeafyGrass',  hex: '#73844A' },
  { id: 22, name: 'WoodPlanks',  hex: '#8B6D4F' },
] as const;

// Skip Air (id 0) — user shouldn't paint Air
const PICKABLE_MATERIALS = MATERIALS.filter((m) => m.id !== 0);

// ── Props ──────────────────────────────────────────────────────────

interface MaterialPickerProps {
  selectedId: number;
  onChange: (id: number) => void;
}

// ── Component ──────────────────────────────────────────────────────

export function MaterialPicker({ selectedId, onChange }: MaterialPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {PICKABLE_MATERIALS.map((mat) => {
        const isSelected = mat.id === selectedId;
        return (
          <button
            key={mat.id}
            onClick={() => onChange(mat.id)}
            title={mat.name}
            className={cn(
              'group flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md transition-colors',
              isSelected
                ? 'bg-white/10 ring-1 ring-green-500/60'
                : 'hover:bg-white/[0.06]',
            )}
          >
            <span
              className={cn(
                'w-5 h-5 rounded-sm border transition-all',
                isSelected ? 'border-green-400 scale-110' : 'border-zinc-600',
              )}
              style={{ backgroundColor: mat.hex }}
            />
            <span
              className={cn(
                'text-[9px] leading-tight truncate w-full text-center',
                isSelected ? 'text-green-300' : 'text-zinc-500 group-hover:text-zinc-300',
              )}
            >
              {mat.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { MATERIALS, PICKABLE_MATERIALS };
