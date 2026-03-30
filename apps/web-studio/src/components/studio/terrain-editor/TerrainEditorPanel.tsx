import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { BiomeSettings } from './BiomeSettings';
import { EditTab, defaultEditTabState } from './EditTab';
import type { EditTabState } from './EditTab';
import { HeightmapUploader, defaultHeightmapState } from './HeightmapUploader';
import type { HeightmapUploaderState } from './HeightmapUploader';
import type { SimulationLoop } from '@problocks/engine/core/simulation-loop';

// ── Types ──────────────────────────────────────────────────────────

interface TerrainSettings {
  blending: number;
  caves: boolean;
  biomeSize: number;
  seed: number;
}

interface TerrainRegion {
  posX: number;
  posY: number;
  posZ: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}

// ── Section header ─────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
      {children}
    </h4>
  );
}

// ── Number input ───────────────────────────────────────────────────

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
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
        max={max}
        step={step}
        className="flex-1 bg-zinc-800 text-zinc-100 text-[12px] px-2 py-1 rounded-md border border-zinc-700/50 outline-none focus:border-zinc-500 transition-colors w-0"
      />
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────

interface TerrainEditorPanelProps {
  /** Called when user clicks Generate — parent updates the store to trigger Viewport recreation */
  onGenerate?: (config: {
    biomes: string[];
    seed: number;
    biomeSize: number;
    blending: number;
    caves: boolean;
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  }) => void;
  /** SimulationLoop ref for wiring brush controller in Edit tab */
  sim?: SimulationLoop | null;
}

export function TerrainEditorPanel({ onGenerate, sim }: TerrainEditorPanelProps = {}) {
  const [activeTab, setActiveTab] = useState<'create' | 'edit'>('create');
  const [createMode, setCreateMode] = useState<'generate' | 'import'>('generate');

  // Biome selection — defaults: Hills + Plains
  const [selectedBiomes, setSelectedBiomes] = useState<Set<string>>(
    () => new Set(['hills', 'plains']),
  );

  // Settings
  const [settings, setSettings] = useState<TerrainSettings>({
    blending: 0.5,
    caves: false,
    biomeSize: 200,
    seed: Math.floor(Math.random() * 100000),
  });

  // Region
  const [region, setRegion] = useState<TerrainRegion>({
    posX: 0,
    posY: 0,
    posZ: 0,
    sizeX: 256,
    sizeY: 128,
    sizeZ: 256,
  });

  // Edit tab state
  const [editState, setEditState] = useState<EditTabState>(defaultEditTabState);

  // Heightmap import state
  const [heightmapState, setHeightmapState] = useState<HeightmapUploaderState>(defaultHeightmapState);
  const [importingHeightmap, setImportingHeightmap] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const updateSetting = useCallback(
    <K extends keyof TerrainSettings>(key: K, value: TerrainSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateRegion = useCallback(
    <K extends keyof TerrainRegion>(key: K, value: TerrainRegion[K]) => {
      setRegion((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleGenerate = useCallback(() => {
    const biomes = Array.from(selectedBiomes);

    if (onGenerate) {
      onGenerate({
        biomes,
        seed: settings.seed,
        biomeSize: settings.biomeSize,
        blending: settings.blending,
        caves: settings.caves,
        minX: region.posX - region.sizeX / 2,
        maxX: region.posX + region.sizeX / 2,
        minY: region.posY,
        maxY: region.posY + region.sizeY,
        minZ: region.posZ - region.sizeZ / 2,
        maxZ: region.posZ + region.sizeZ / 2,
      });
    }

    setGenerating(true);
    setProgress(0);

    let p = 0;
    const interval = setInterval(() => {
      p += 0.05 + Math.random() * 0.1;
      if (p >= 1) {
        p = 1;
        clearInterval(interval);
        setTimeout(() => {
          setGenerating(false);
          setProgress(0);
        }, 300);
      }
      setProgress(p);
    }, 120);
  }, [selectedBiomes, settings, region, onGenerate]);

  const randomizeSeed = useCallback(() => {
    updateSetting('seed', Math.floor(Math.random() * 100000));
  }, [updateSetting]);

  const handleImportHeightmap = useCallback(() => {
    console.log('Import heightmap', heightmapState);
    setImportingHeightmap(true);
    setImportProgress(0);

    let p = 0;
    const interval = setInterval(() => {
      p += 0.05 + Math.random() * 0.1;
      if (p >= 1) {
        p = 1;
        clearInterval(interval);
        setTimeout(() => {
          setImportingHeightmap(false);
          setImportProgress(0);
        }, 300);
      }
      setImportProgress(p);
    }, 120);
  }, [heightmapState]);

  return (
    <div className="h-full flex flex-col bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-white/5">
        <button
          onClick={() => setActiveTab('create')}
          className={cn(
            'flex-1 text-[12px] font-medium py-1.5 rounded-lg transition-colors',
            activeTab === 'create'
              ? 'bg-green-500/10 text-green-400'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]',
          )}
        >
          Create
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={cn(
            'flex-1 text-[12px] font-medium py-1.5 rounded-lg transition-colors',
            activeTab === 'edit'
              ? 'bg-green-500/10 text-green-400'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]',
          )}
        >
          Edit
        </button>
      </div>

      {/* Panel body — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {activeTab === 'create' && (
          <>
            {/* ── Create mode toggle ─────────────────────── */}
            <div className="flex items-center gap-1 bg-zinc-800/60 rounded-lg p-0.5">
              <button
                onClick={() => setCreateMode('generate')}
                className={cn(
                  'flex-1 text-[11px] py-1.5 rounded-md transition-colors',
                  createMode === 'generate'
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200',
                )}
              >
                Generate
              </button>
              <button
                onClick={() => setCreateMode('import')}
                className={cn(
                  'flex-1 text-[11px] py-1.5 rounded-md transition-colors',
                  createMode === 'import'
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200',
                )}
              >
                Import
              </button>
            </div>

            {createMode === 'import' && (
              <HeightmapUploader
                state={heightmapState}
                onChange={setHeightmapState}
                onImport={handleImportHeightmap}
                importing={importingHeightmap}
                progress={importProgress}
              />
            )}

            {createMode === 'generate' && (
            <>
            {/* ── Biomes ─────────────────────────────────── */}
            <div>
              <SectionHeader>Biomes</SectionHeader>
              <BiomeSettings
                selected={selectedBiomes}
                onChange={setSelectedBiomes}
              />
            </div>

            {/* ── Settings ───────────────────────────────── */}
            <div>
              <SectionHeader>Settings</SectionHeader>
              <div className="space-y-2.5">
                {/* Blending */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-zinc-400">Blending</span>
                    <span className="text-[11px] text-zinc-500">
                      {settings.blending.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.blending}
                    onChange={(e) =>
                      updateSetting('blending', Number(e.target.value))
                    }
                    className="w-full h-1 accent-green-500 bg-zinc-700 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                {/* Caves */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.caves}
                    onChange={(e) =>
                      updateSetting('caves', e.target.checked)
                    }
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      'shrink-0 w-3.5 h-3.5 rounded border transition-colors flex items-center justify-center',
                      settings.caves
                        ? 'border-green-500 bg-green-500/20'
                        : 'border-zinc-600 bg-zinc-800',
                    )}
                  >
                    {settings.caves && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                      >
                        <path
                          d="M2 5L4.2 7.2L8 3"
                          stroke="#22c55e"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="text-[11px] text-zinc-300">Caves</span>
                </label>

                {/* Biome Size */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-zinc-400">
                      Biome Size
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {settings.biomeSize} units
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={500}
                    step={10}
                    value={settings.biomeSize}
                    onChange={(e) =>
                      updateSetting('biomeSize', Number(e.target.value))
                    }
                    className="w-full h-1 accent-green-500 bg-zinc-700 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                {/* Seed */}
                <div>
                  <span className="text-[11px] text-zinc-400 block mb-1">
                    Seed
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={settings.seed}
                      onChange={(e) =>
                        updateSetting('seed', Number(e.target.value))
                      }
                      className="flex-1 bg-zinc-800 text-zinc-100 text-[12px] px-2 py-1.5 rounded-md border border-zinc-700/50 outline-none focus:border-zinc-500 transition-colors w-0"
                    />
                    <button
                      onClick={randomizeSeed}
                      className="shrink-0 text-[11px] px-2.5 py-1.5 rounded-md bg-zinc-800 border border-zinc-700/50 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
                    >
                      Randomize
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Region ─────────────────────────────────── */}
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
                      value={region.posX}
                      onChange={(v) => updateRegion('posX', v)}
                    />
                    <NumberField
                      label="Y"
                      value={region.posY}
                      onChange={(v) => updateRegion('posY', v)}
                    />
                    <NumberField
                      label="Z"
                      value={region.posZ}
                      onChange={(v) => updateRegion('posZ', v)}
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-400 block mb-1">
                    Size
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <NumberField
                      label="X"
                      value={region.sizeX}
                      onChange={(v) => updateRegion('sizeX', v)}
                      min={1}
                    />
                    <NumberField
                      label="Y"
                      value={region.sizeY}
                      onChange={(v) => updateRegion('sizeY', v)}
                      min={1}
                    />
                    <NumberField
                      label="Z"
                      value={region.sizeZ}
                      onChange={(v) => updateRegion('sizeZ', v)}
                      min={1}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Progress bar (visible during generation) ── */}
            <div
              className={cn(
                'overflow-hidden transition-all duration-300',
                generating
                  ? 'h-2 opacity-100'
                  : 'h-0 opacity-0',
              )}
            >
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-[width] duration-150 ease-linear"
                  style={{ width: `${Math.min(progress * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* ── Generate button ─────────────────────────── */}
            <button
              onClick={handleGenerate}
              disabled={generating || selectedBiomes.size === 0}
              className={cn(
                'w-full rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors',
                generating || selectedBiomes.size === 0
                  ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-500',
              )}
            >
              {generating ? 'Generating...' : 'Generate Terrain'}
            </button>
            </>
            )}
          </>
        )}

        {activeTab === 'edit' && (
          <EditTab state={editState} onChange={setEditState} />
        )}
      </div>
    </div>
  );
}
