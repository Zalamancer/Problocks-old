import { useState, useRef, useCallback } from 'react';
import {
  Grid3X3,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Paintbrush,
  Eraser,
  PaintBucket,
  RectangleHorizontal,
  Pipette,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudio, type TilemapTool } from '@/store/studio-store';
import type { GridType, TilemapConfig } from '@problocks/engine';

// ── Grid type options ────────────────────────────────────────────────

const GRID_TYPES: { id: GridType; label: string }[] = [
  { id: 'orthogonal', label: 'Ortho' },
  { id: 'isometric', label: 'Iso' },
  { id: 'hex', label: 'Hex' },
];

// ── Paint tool definitions ───────────────────────────────────────────

const PAINT_TOOLS: { id: TilemapTool; label: string; icon: typeof Paintbrush }[] = [
  { id: 'paint', label: 'Paint', icon: Paintbrush },
  { id: 'erase', label: 'Erase', icon: Eraser },
  { id: 'fill', label: 'Fill', icon: PaintBucket },
  { id: 'rect', label: 'Rect', icon: RectangleHorizontal },
  { id: 'eyedropper', label: 'Pick', icon: Pipette },
];

// ── Default tilemap config ───────────────────────────────────────────

function createDefaultTilemapConfig(): TilemapConfig {
  const rows = 20;
  const cols = 20;
  return {
    gridType: 'orthogonal',
    tileWidth: 32,
    tileHeight: 32,
    mapWidth: cols,
    mapHeight: rows,
    layers: [
      {
        name: 'Ground',
        data: Array.from({ length: rows }, () => Array(cols).fill(0)),
        visible: true,
        opacity: 1,
      },
    ],
  };
}

// ── Number input ─────────────────────────────────────────────────────

function NumberInput({
  label,
  value,
  onChange,
  min = 1,
  max = 999,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-zinc-400 shrink-0">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        className="w-16 px-2 py-1 text-[12px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded-lg text-right tabular-nums focus:outline-none focus:border-blue-500/50"
      />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function TilemapEditor() {
  const {
    tilemapConfig,
    activeTilemapLayer,
    activeTileId,
    activeTilemapTool,
    loadedTilesets,
    setTilemapConfig,
    setActiveTilemapLayer,
    setActiveTileId,
    setActiveTilemapTool,
    addTilemapLayer,
    removeTilemapLayer,
    toggleLayerVisibility,
    reorderLayers,
    addLoadedTileset,
  } = useStudio();

  const [newLayerName, setNewLayerName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize config if needed
  const config = tilemapConfig ?? createDefaultTilemapConfig();

  const ensureConfig = useCallback(() => {
    if (!tilemapConfig) setTilemapConfig(createDefaultTilemapConfig());
  }, [tilemapConfig, setTilemapConfig]);

  // ── Grid config handlers ─────────────────────────────────────────
  const updateGridType = (gridType: GridType) => {
    ensureConfig();
    setTilemapConfig({ ...config, gridType });
  };

  const updateMapSize = (key: 'mapWidth' | 'mapHeight', value: number) => {
    ensureConfig();
    setTilemapConfig({ ...config, [key]: value });
  };

  const updateTileSize = (key: 'tileWidth' | 'tileHeight', value: number) => {
    ensureConfig();
    setTilemapConfig({ ...config, [key]: value });
  };

  // ── Layer management ─────────────────────────────────────────────
  const handleAddLayer = () => {
    ensureConfig();
    const name = newLayerName.trim() || `Layer ${config.layers.length + 1}`;
    addTilemapLayer(name);
    setNewLayerName('');
  };

  const handleMoveLayer = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= config.layers.length) return;
    reorderLayers(index, newIndex);
    if (activeTilemapLayer === index) setActiveTilemapLayer(newIndex);
    else if (activeTilemapLayer === newIndex) setActiveTilemapLayer(index);
  };

  // ── Tileset loading ──────────────────────────────────────────────
  const handleLoadTileset = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const tw = config.tileWidth;
      const th = config.tileHeight;
      const cols = Math.floor(img.width / tw);
      const rows = Math.floor(img.height / th);
      addLoadedTileset({
        id: `tileset_${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        imageUrl: url,
        tileWidth: tw,
        tileHeight: th,
        columns: cols,
        rows: rows,
      });
    };
    img.src = url;

    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  // Build tile palette from all loaded tilesets
  const allTiles: { tilesetIdx: number; tileId: number; col: number; row: number }[] = [];
  loadedTilesets.forEach((ts, tsIdx) => {
    for (let r = 0; r < ts.rows; r++) {
      for (let c = 0; c < ts.columns; c++) {
        allTiles.push({ tilesetIdx: tsIdx, tileId: r * ts.columns + c + 1, col: c, row: r });
      }
    }
  });

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
      {/* ── Grid Type ────────────────────────────────────────────── */}
      <div>
        <h4 className="text-xs font-medium text-zinc-400 mb-2">Grid Type</h4>
        <div className="grid grid-cols-3 gap-1.5">
          {GRID_TYPES.map((gt) => (
            <button
              key={gt.id}
              onClick={() => updateGridType(gt.id)}
              className={cn(
                'px-3 py-2 rounded-lg text-[12px] font-medium transition-colors',
                config.gridType === gt.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300',
              )}
            >
              {gt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Map Size ─────────────────────────────────────────────── */}
      <div>
        <h4 className="text-xs font-medium text-zinc-400 mb-2">Map Size</h4>
        <div className="space-y-1.5">
          <NumberInput label="Width" value={config.mapWidth} onChange={(v) => updateMapSize('mapWidth', v)} />
          <NumberInput label="Height" value={config.mapHeight} onChange={(v) => updateMapSize('mapHeight', v)} />
        </div>
      </div>

      {/* ── Tile Size ────────────────────────────────────────────── */}
      <div>
        <h4 className="text-xs font-medium text-zinc-400 mb-2">Tile Size (px)</h4>
        <div className="space-y-1.5">
          <NumberInput label="Width" value={config.tileWidth} onChange={(v) => updateTileSize('tileWidth', v)} min={8} max={256} />
          <NumberInput label="Height" value={config.tileHeight} onChange={(v) => updateTileSize('tileHeight', v)} min={8} max={256} />
        </div>
      </div>

      {/* ── Layers ───────────────────────────────────────────────── */}
      <div className="border-t border-white/5 pt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-zinc-400">Layers</h4>
          <button
            onClick={handleAddLayer}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            <Plus size={12} />
            Add
          </button>
        </div>

        <div className="space-y-1">
          {config.layers.map((layer, i) => (
            <div
              key={i}
              onClick={() => setActiveTilemapLayer(i)}
              className={cn(
                'flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] cursor-pointer transition-colors group',
                activeTilemapLayer === i
                  ? 'bg-blue-600/15 text-blue-300 border border-blue-500/20'
                  : 'bg-zinc-800/50 text-zinc-300 border border-transparent hover:bg-zinc-800',
              )}
            >
              {/* Visibility toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(i); }}
                className={cn(
                  'shrink-0 p-0.5 rounded transition-colors',
                  layer.visible ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600',
                )}
                title={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>

              {/* Layer name */}
              <span className="flex-1 truncate">{layer.name}</span>

              {/* Reorder buttons */}
              <button
                onClick={(e) => { e.stopPropagation(); handleMoveLayer(i, 'up'); }}
                disabled={i === 0}
                className="shrink-0 p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors opacity-0 group-hover:opacity-100"
                title="Move up"
              >
                <ChevronUp size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleMoveLayer(i, 'down'); }}
                disabled={i === config.layers.length - 1}
                className="shrink-0 p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors opacity-0 group-hover:opacity-100"
                title="Move down"
              >
                <ChevronDown size={12} />
              </button>

              {/* Delete button */}
              <button
                onClick={(e) => { e.stopPropagation(); removeTilemapLayer(i); }}
                disabled={config.layers.length <= 1}
                className="shrink-0 p-0.5 text-zinc-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors opacity-0 group-hover:opacity-100"
                title="Delete layer"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* New layer name input */}
        <div className="flex items-center gap-1.5 mt-2">
          <input
            type="text"
            placeholder="New layer name..."
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddLayer(); }}
            className="flex-1 px-2 py-1.5 text-[11px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded-lg placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* ── Paint Tools ──────────────────────────────────────────── */}
      <div className="border-t border-white/5 pt-4">
        <h4 className="text-xs font-medium text-zinc-400 mb-2">Tools</h4>
        <div className="flex gap-1">
          {PAINT_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTilemapTool(tool.id)}
                title={tool.label}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] transition-colors',
                  activeTilemapTool === tool.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200',
                )}
              >
                <Icon size={16} />
                {tool.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tile Palette ─────────────────────────────────────────── */}
      <div className="border-t border-white/5 pt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-zinc-400">Tile Palette</h4>
          <button
            onClick={handleLoadTileset}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            <Upload size={12} />
            Load Tileset
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif"
          onChange={handleFileSelected}
          className="hidden"
        />

        {loadedTilesets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 px-4">
            <Grid3X3 size={28} className="text-zinc-600 mb-2" />
            <p className="text-[12px] text-zinc-500 text-center">No tilesets loaded</p>
            <p className="text-[10px] text-zinc-600 text-center mt-0.5">
              Load a sprite sheet image to get started
            </p>
            <button
              onClick={handleLoadTileset}
              className="mt-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors"
            >
              Load Tileset
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {loadedTilesets.map((ts, tsIdx) => (
              <div key={ts.id}>
                <p className="text-[10px] text-zinc-500 mb-1 truncate">{ts.name}</p>
                <div
                  className="grid gap-0.5 bg-zinc-800/50 rounded-lg p-1.5 max-h-[200px] overflow-y-auto"
                  style={{ gridTemplateColumns: `repeat(${Math.min(ts.columns, 10)}, 1fr)` }}
                >
                  {Array.from({ length: ts.rows * ts.columns }, (_, i) => {
                    const col = i % ts.columns;
                    const row = Math.floor(i / ts.columns);
                    const tileId = i + 1;
                    return (
                      <button
                        key={i}
                        onClick={() => setActiveTileId(tileId)}
                        className={cn(
                          'aspect-square rounded border transition-colors',
                          activeTileId === tileId
                            ? 'border-blue-500 ring-1 ring-blue-500/50'
                            : 'border-transparent hover:border-white/20',
                        )}
                        title={`Tile ${tileId}`}
                        style={{
                          backgroundImage: `url(${ts.imageUrl})`,
                          backgroundPosition: `-${col * ts.tileWidth}px -${row * ts.tileHeight}px`,
                          backgroundSize: `${ts.columns * ts.tileWidth}px ${ts.rows * ts.tileHeight}px`,
                          imageRendering: 'pixelated',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Active tile indicator ────────────────────────────────── */}
      <div className="border-t border-white/5 pt-3 pb-1">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span>Active Tile:</span>
          <span className="text-zinc-300 tabular-nums font-medium">{activeTileId}</span>
          <span className="text-zinc-600">|</span>
          <span>Layer:</span>
          <span className="text-zinc-300">{config.layers[activeTilemapLayer]?.name ?? '?'}</span>
        </div>
      </div>
    </div>
  );
}
