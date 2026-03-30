import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { BiomeSettings } from './BiomeSettings';
import { EditTab, defaultEditTabState } from './EditTab';
import type { EditTabState, BrushTool } from './EditTab';
import { HeightmapUploader, defaultHeightmapState } from './HeightmapUploader';
import type { HeightmapUploaderState } from './HeightmapUploader';
import type { SimulationLoop } from '@problocks/engine/core/simulation-loop';
import {
  TerrainMaterial,
  TerrainSelection,
  fillRegion, replaceInRegion,
  transformRegion,
  createSeaLevel, evaporateWater,
  TERRAIN_COLOR_PRESETS,
  CHUNK_WORLD_SIZE,
} from '@problocks/engine';
import type { BrushToolType, BrushControllerConfig, TerrainColorPreset } from '@problocks/engine';
import { useTerrainEditor } from './TerrainEditorContext';

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

  // ── Terrain editor context — brush active + config sync ──
  const terrainEditor = useTerrainEditor();

  const BRUSH_TOOL_SET: Set<BrushTool> = new Set(['draw', 'sculpt', 'smooth', 'flatten', 'paint']);

  // Set brushActive when Edit tab is active with a brush tool
  useEffect(() => {
    const isBrush = activeTab === 'edit' && BRUSH_TOOL_SET.has(editState.tool);
    terrainEditor.setBrushActive(isBrush);
    return () => terrainEditor.setBrushActive(false);
  }, [activeTab, editState.tool]);

  // Sync EditTab state → BrushController config
  useEffect(() => {
    const ctrl = terrainEditor.brushController;
    if (!ctrl) return;
    if (activeTab !== 'edit' || !BRUSH_TOOL_SET.has(editState.tool)) return;

    ctrl.config = {
      tool: editState.tool as BrushToolType,
      shape: editState.shape,
      size: editState.size,
      height: editState.height,
      strength: editState.strength,
      material: editState.materialId as TerrainMaterial,
      drawMode: editState.drawMode,
      flattenMode: editState.flattenMode,
      paintMode: editState.paintMode,
      sourceMaterial: editState.sourceMaterialId as TerrainMaterial,
      targetMaterial: editState.materialId as TerrainMaterial,
      pivot: editState.pivot,
      snapToVoxel: editState.snapToVoxel,
    };
  }, [activeTab, editState, terrainEditor.brushController]);

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

  // ── Helper: create a TerrainSelection covering the entire loaded grid ──
  const createFullGridSelection = useCallback(() => {
    const grid = terrainEditor.voxelGrid;
    if (!grid) return null;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const chunk of grid.getAllChunks()) {
      const o = chunk.worldOrigin;
      minX = Math.min(minX, o.x);
      minY = Math.min(minY, o.y);
      minZ = Math.min(minZ, o.z);
      maxX = Math.max(maxX, o.x + CHUNK_WORLD_SIZE);
      maxY = Math.max(maxY, o.y + CHUNK_WORLD_SIZE);
      maxZ = Math.max(maxZ, o.z + CHUNK_WORLD_SIZE);
    }

    if (!isFinite(minX)) return null;
    return new TerrainSelection({ x: minX, y: minY, z: minZ }, { x: maxX, y: maxY, z: maxZ });
  }, [terrainEditor.voxelGrid]);

  // ── Helper: get all chunk keys for undo ──
  const getAllChunkKeys = useCallback(() => {
    const grid = terrainEditor.voxelGrid;
    if (!grid) return [];
    const keys: string[] = [];
    for (const chunk of grid.getAllChunks()) {
      keys.push(`${chunk.cx},${chunk.cy},${chunk.cz}`);
    }
    return keys;
  }, [terrainEditor.voxelGrid]);

  // ── 1. Fill & Replace ──
  const handleApplyFill = useCallback(() => {
    const grid = terrainEditor.voxelGrid;
    const cm = terrainEditor.chunkManager;
    const ctrl = terrainEditor.brushController;
    if (!grid || !cm || !ctrl) return;

    const selection = createFullGridSelection();
    if (!selection) return;

    const chunkKeys = getAllChunkKeys();
    ctrl.undoStack.beginEdit(editState.fillMode === 'fill' ? 'Fill Region' : 'Replace Region', chunkKeys, grid);

    if (editState.fillMode === 'fill') {
      fillRegion(grid, selection, editState.fillMaterialId as TerrainMaterial);
    } else {
      replaceInRegion(grid, selection, editState.replaceSrcId as TerrainMaterial, editState.replaceDstId as TerrainMaterial);
    }

    ctrl.undoStack.endEdit(grid);
    cm.forceRemeshAll();
    terrainEditor.refreshUndoState();
  }, [editState.fillMode, editState.fillMaterialId, editState.replaceSrcId, editState.replaceDstId, terrainEditor, createFullGridSelection, getAllChunkKeys]);

  // ── 2. Transform ──
  const handleApplyTransform = useCallback(() => {
    const grid = terrainEditor.voxelGrid;
    const cm = terrainEditor.chunkManager;
    const ctrl = terrainEditor.brushController;
    if (!grid || !cm || !ctrl) return;

    const selection = createFullGridSelection();
    if (!selection) return;

    const chunkKeys = getAllChunkKeys();
    ctrl.undoStack.beginEdit('Transform Region', chunkKeys, grid);

    transformRegion(grid, selection, {
      position: { x: editState.transformX, y: editState.transformY, z: editState.transformZ },
      rotationY: editState.transformRotY,
      scale: { x: editState.transformScaleX, y: editState.transformScaleY, z: editState.transformScaleZ },
    }, editState.mergeEmpty);

    ctrl.undoStack.endEdit(grid);
    cm.forceRemeshAll();
    terrainEditor.refreshUndoState();
  }, [editState.transformX, editState.transformY, editState.transformZ, editState.transformRotY, editState.transformScaleX, editState.transformScaleY, editState.transformScaleZ, editState.mergeEmpty, terrainEditor, createFullGridSelection, getAllChunkKeys]);

  // ── 3. Sea Level ──
  const handleCreateSea = useCallback(() => {
    const grid = terrainEditor.voxelGrid;
    const cm = terrainEditor.chunkManager;
    const ctrl = terrainEditor.brushController;
    if (!grid || !cm || !ctrl) return;

    const selection = createFullGridSelection();
    if (!selection) return;

    const chunkKeys = getAllChunkKeys();
    ctrl.undoStack.beginEdit('Create Sea Level', chunkKeys, grid);
    createSeaLevel(grid, selection, editState.waterLevel);
    ctrl.undoStack.endEdit(grid);
    cm.forceRemeshAll();
    terrainEditor.refreshUndoState();
  }, [editState.waterLevel, terrainEditor, createFullGridSelection, getAllChunkKeys]);

  const handleEvaporate = useCallback(() => {
    const grid = terrainEditor.voxelGrid;
    const cm = terrainEditor.chunkManager;
    const ctrl = terrainEditor.brushController;
    if (!grid || !cm || !ctrl) return;

    const selection = createFullGridSelection();
    if (!selection) return;

    const chunkKeys = getAllChunkKeys();
    ctrl.undoStack.beginEdit('Evaporate Water', chunkKeys, grid);
    evaporateWater(grid, selection);
    ctrl.undoStack.endEdit(grid);
    cm.forceRemeshAll();
    terrainEditor.refreshUndoState();
  }, [terrainEditor, createFullGridSelection, getAllChunkKeys]);

  // ── 4. Water Properties — sync to WaterVoxelRenderer ──
  useEffect(() => {
    const wr = terrainEditor.waterRenderer;
    if (!wr) return;
    wr.setProperties({
      color: { r: editState.waterColorR / 255, g: editState.waterColorG / 255, b: editState.waterColorB / 255 },
      reflectance: editState.waterReflectance,
      transparency: editState.waterTransparency,
      waveSize: editState.waterWaveSize,
      waveSpeed: editState.waterWaveSpeed,
    });
  }, [editState.waterColorR, editState.waterColorG, editState.waterColorB, editState.waterReflectance, editState.waterTransparency, editState.waterWaveSize, editState.waterWaveSpeed, terrainEditor.waterRenderer]);

  // ── 5. Colors / Decoration — sync to GrassRenderer + ChunkManager ──
  useEffect(() => {
    const gr = terrainEditor.grassRenderer;
    const cm = terrainEditor.chunkManager;
    if (!gr || !cm) return;
    gr.decoration = editState.decoration;
    gr.grassLength = editState.grassLength;
    // Re-mesh to rebuild grass blades with new settings
    cm.forceRemeshAll();
  }, [editState.decoration, editState.grassLength, terrainEditor.grassRenderer, terrainEditor.chunkManager]);

  useEffect(() => {
    const cm = terrainEditor.chunkManager;
    if (!cm) return;
    const overrides = TERRAIN_COLOR_PRESETS[editState.colorPreset as TerrainColorPreset] ?? null;
    cm.setColorOverrides(overrides);
  }, [editState.colorPreset, terrainEditor.chunkManager]);

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
          <>
            {/* Undo/Redo bar */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={terrainEditor.undo}
                disabled={!terrainEditor.canUndo}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-md transition-colors',
                  terrainEditor.canUndo
                    ? 'text-zinc-300 hover:text-white hover:bg-white/[0.06]'
                    : 'text-zinc-600 cursor-not-allowed',
                )}
                title="Undo (Ctrl+Z)"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h7a2 2 0 110 4H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 4L2 6l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Undo{terrainEditor.undoCount > 0 ? ` (${terrainEditor.undoCount})` : ''}
              </button>
              <button
                onClick={terrainEditor.redo}
                disabled={!terrainEditor.canRedo}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-md transition-colors',
                  terrainEditor.canRedo
                    ? 'text-zinc-300 hover:text-white hover:bg-white/[0.06]'
                    : 'text-zinc-600 cursor-not-allowed',
                )}
                title="Redo (Ctrl+Shift+Z)"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 6H3a2 2 0 100 4h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 4l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Redo{terrainEditor.redoCount > 0 ? ` (${terrainEditor.redoCount})` : ''}
              </button>
            </div>
            <EditTab
              state={editState}
              onChange={setEditState}
              onApplyFill={handleApplyFill}
              onApplyTransform={handleApplyTransform}
              onCreateSea={handleCreateSea}
              onEvaporate={handleEvaporate}
            />
          </>
        )}
      </div>
    </div>
  );
}
