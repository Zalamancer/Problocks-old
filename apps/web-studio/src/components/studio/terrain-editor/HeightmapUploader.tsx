import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { MaterialPicker } from './MaterialPicker';
import { TerrainMaterial } from '@problocks/engine';

// ── Types ──────────────────────────────────────────────────────────

export interface HeightmapUploaderState {
  heightmapFile: File | null;
  colormapFile: File | null;
  heightmapPreview: string | null;
  colormapPreview: string | null;
  imageWidth: number;
  imageHeight: number;
  materialSource: 'single' | 'colormap';
  selectedMaterial: TerrainMaterial;
  region: {
    posX: number;
    posY: number;
    posZ: number;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
  };
}

export const defaultHeightmapState: HeightmapUploaderState = {
  heightmapFile: null,
  colormapFile: null,
  heightmapPreview: null,
  colormapPreview: null,
  imageWidth: 0,
  imageHeight: 0,
  materialSource: 'single',
  selectedMaterial: TerrainMaterial.Grass,
  region: {
    posX: 0,
    posY: 0,
    posZ: 0,
    sizeX: 256,
    sizeY: 128,
    sizeZ: 256,
  },
};

// ── Helpers ────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
      {children}
    </h4>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-zinc-400 shrink-0 w-5 text-right">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        className="flex-1 bg-zinc-800 text-zinc-100 text-[12px] px-2 py-1 rounded-md border border-zinc-700/50 outline-none focus:border-zinc-500 transition-colors w-0"
      />
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────

function DropZone({
  label,
  preview,
  onFile,
  onClear,
}: {
  label: string;
  preview: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  if (preview) {
    return (
      <div className="relative group">
        <img
          src={preview}
          alt={label}
          className="w-full h-24 object-cover rounded-lg border border-zinc-700/50"
        />
        <button
          onClick={onClear}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-white flex items-center justify-center text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          x
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-1 h-24 rounded-lg border border-dashed cursor-pointer transition-colors',
          dragging
            ? 'border-green-500 bg-green-500/5'
            : 'border-zinc-700/50 hover:border-zinc-500 bg-zinc-800/40',
        )}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="text-zinc-500"
        >
          <path
            d="M10 4v8m0-8L7 7m3-3l3 3M4 13l1.293-1.293a1 1 0 011.414 0L8 13l3-3a1 1 0 011.414 0L16 13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-[11px] text-zinc-500">{label}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
}

// ── Main component ────────────────────────────────────────────────

export function HeightmapUploader({
  state,
  onChange,
  onImport,
  importing,
  progress,
}: {
  state: HeightmapUploaderState;
  onChange: (state: HeightmapUploaderState) => void;
  onImport: () => void;
  importing: boolean;
  progress: number;
}) {
  const update = useCallback(
    <K extends keyof HeightmapUploaderState>(
      key: K,
      value: HeightmapUploaderState[K],
    ) => {
      onChange({ ...state, [key]: value });
    },
    [state, onChange],
  );

  const updateRegion = useCallback(
    (key: keyof HeightmapUploaderState['region'], value: number) => {
      onChange({ ...state, region: { ...state.region, [key]: value } });
    },
    [state, onChange],
  );

  const handleHeightmapFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        onChange({
          ...state,
          heightmapFile: file,
          heightmapPreview: url,
          imageWidth: img.naturalWidth,
          imageHeight: img.naturalHeight,
        });
      };
      img.src = url;
    },
    [state, onChange],
  );

  const handleColormapFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      onChange({ ...state, colormapFile: file, colormapPreview: url });
    },
    [state, onChange],
  );

  const clearHeightmap = useCallback(() => {
    if (state.heightmapPreview) URL.revokeObjectURL(state.heightmapPreview);
    onChange({
      ...state,
      heightmapFile: null,
      heightmapPreview: null,
      imageWidth: 0,
      imageHeight: 0,
    });
  }, [state, onChange]);

  const clearColormap = useCallback(() => {
    if (state.colormapPreview) URL.revokeObjectURL(state.colormapPreview);
    onChange({ ...state, colormapFile: null, colormapPreview: null });
  }, [state, onChange]);

  const canImport =
    !importing && state.heightmapFile !== null;

  return (
    <div className="space-y-4">
      {/* ── Heightmap ─────────────────────────────── */}
      <div>
        <SectionHeader>Heightmap</SectionHeader>
        <DropZone
          label="Drop heightmap PNG/JPG"
          preview={state.heightmapPreview}
          onFile={handleHeightmapFile}
          onClear={clearHeightmap}
        />
        {state.imageWidth > 0 && (
          <p className="text-[10px] text-zinc-500 mt-1">
            {state.imageWidth} x {state.imageHeight} px
          </p>
        )}
      </div>

      {/* ── Material source toggle ────────────────── */}
      <div>
        <SectionHeader>Material Source</SectionHeader>
        <div className="flex items-center gap-1 bg-zinc-800/60 rounded-lg p-0.5">
          <button
            onClick={() => update('materialSource', 'single')}
            className={cn(
              'flex-1 text-[11px] py-1.5 rounded-md transition-colors',
              state.materialSource === 'single'
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            Single Material
          </button>
          <button
            onClick={() => update('materialSource', 'colormap')}
            className={cn(
              'flex-1 text-[11px] py-1.5 rounded-md transition-colors',
              state.materialSource === 'colormap'
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            Colormap
          </button>
        </div>
      </div>

      {/* ── Material picker OR colormap drop zone ── */}
      {state.materialSource === 'single' ? (
        <div>
          <MaterialPicker
            selectedId={state.selectedMaterial}
            onChange={(id: number) => update('selectedMaterial', id as TerrainMaterial)}
          />
        </div>
      ) : (
        <div>
          <SectionHeader>Colormap</SectionHeader>
          <DropZone
            label="Drop colormap PNG/JPG"
            preview={state.colormapPreview}
            onFile={handleColormapFile}
            onClear={clearColormap}
          />
        </div>
      )}

      {/* ── Region ────────────────────────────────── */}
      <div>
        <SectionHeader>Region</SectionHeader>
        <div className="space-y-2">
          <div>
            <span className="text-[11px] text-zinc-400 block mb-1">
              Position
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <NumberField
                label="X"
                value={state.region.posX}
                onChange={(v) => updateRegion('posX', v)}
              />
              <NumberField
                label="Y"
                value={state.region.posY}
                onChange={(v) => updateRegion('posY', v)}
              />
              <NumberField
                label="Z"
                value={state.region.posZ}
                onChange={(v) => updateRegion('posZ', v)}
              />
            </div>
          </div>
          <div>
            <span className="text-[11px] text-zinc-400 block mb-1">Size</span>
            <div className="grid grid-cols-3 gap-1.5">
              <NumberField
                label="X"
                value={state.region.sizeX}
                onChange={(v) => updateRegion('sizeX', v)}
                min={1}
              />
              <NumberField
                label="Y"
                value={state.region.sizeY}
                onChange={(v) => updateRegion('sizeY', v)}
                min={1}
              />
              <NumberField
                label="Z"
                value={state.region.sizeZ}
                onChange={(v) => updateRegion('sizeZ', v)}
                min={1}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Progress bar ──────────────────────────── */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          importing ? 'h-2 opacity-100' : 'h-0 opacity-0',
        )}
      >
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-[width] duration-150 ease-linear"
            style={{ width: `${Math.min(progress * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* ── Import button ─────────────────────────── */}
      <button
        onClick={onImport}
        disabled={!canImport}
        className={cn(
          'w-full rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors',
          canImport
            ? 'bg-green-600 text-white hover:bg-green-500'
            : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
        )}
      >
        {importing ? 'Importing...' : 'Import Heightmap'}
      </button>
    </div>
  );
}
