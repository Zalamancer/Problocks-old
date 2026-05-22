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
  Pipette,
  Upload,
  ArrowUp,
  ArrowDown,
  Download,
  Image as ImageIcon,
  FileJson,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudio, type TilemapTool, type HexBrushShape } from '@/store/studio-store';
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
  { id: 'eyedropper', label: 'Pick', icon: Pipette },
];

const HEIGHT_TOOLS: { id: TilemapTool; label: string; icon: typeof ArrowUp }[] = [
  { id: 'raise', label: 'Raise', icon: ArrowUp },
  { id: 'lower', label: 'Lower', icon: ArrowDown },
];

const BRUSH_PRESETS = [8, 16, 32, 64, 128, 256];

const BRUSH_SHAPES: { id: HexBrushShape; label: string }[] = [
  { id: 'hex', label: 'Hex' },
  { id: 'ring', label: 'Ring' },
  { id: 'random', label: 'Scatter' },
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

// ── Inline number input ──────────────────────────────────────────────

function NumberInput({
  label,
  value,
  onChange,
  min = 1,
  max = 999,
  className = '',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <label className={cn('flex items-center gap-1.5 text-[11px] text-zinc-400', className)}>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        className="w-12 px-1.5 py-1 text-[11px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded text-center tabular-nums focus:outline-none focus:border-emerald-500/50"
      />
    </label>
  );
}

// ── Checkbox ─────────────────────────────────────────────────────────

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer hover:text-zinc-300 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-emerald-400 w-3.5 h-3.5"
      />
      {label}
    </label>
  );
}

// ── Section heading ──────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
      {children}
    </h4>
  );
}

// ── Dim button ───────────────────────────────────────────────────────

function DimButton({
  children,
  onClick,
  className = '',
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 px-2 py-1.5 text-[11px] font-medium rounded border transition-colors',
        danger
          ? 'bg-zinc-800 border-white/[0.06] text-red-400 hover:bg-red-500/10 hover:border-red-500/30'
          : 'bg-zinc-800 border-white/[0.06] text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ── Accent button ────────────────────────────────────────────────────

function AccentButton({
  children,
  onClick,
  disabled = false,
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full px-3 py-2 text-[12px] font-semibold rounded-lg transition-colors',
        'bg-emerald-400 text-zinc-900 hover:bg-emerald-300',
        'disabled:opacity-50 disabled:cursor-wait',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ── Hex count for brush ──────────────────────────────────────────────

function getBrushHexCount(size: number, shape: HexBrushShape): string {
  const rad = size - 1;
  if (shape === 'ring' && rad > 0) return `${6 * rad}`;
  if (shape === 'random') return `~${Math.round(0.4 * (3 * rad * rad + 3 * rad + 1))}`;
  return `${3 * rad * rad + 3 * rad + 1}`;
}

// ── Main component ───────────────────────────────────────────────────

export function TilemapEditor() {
  const store = useStudio();
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
    // Hex painter state
    hexBrushSize,
    hexBrushShape,
    hexShowGrid,
    hexShowCoords,
    hexClipToHex,
    hexTileZoom,
    hexRandomRotation,
    hexRandomFlip,
    hexRandomPalette,
    hexRandomBrushSize,
    hexYOffset,
    setHexBrushSize,
    setHexBrushShape,
    setHexShowGrid,
    setHexShowCoords,
    setHexClipToHex,
    setHexTileZoom,
    setHexRandomRotation,
    setHexRandomFlip,
    setHexRandomPalette,
    setHexRandomBrushSize,
    setHexYOffset,
    // Hex palette
    hexPalette,
    hexSelectedTile,
    hexAddTile,
    hexRemoveTile,
    hexClearPalette,
    setHexSelectedTile,
    setHexMapData,
  } = useStudio();

  // Local UI state
  const [newLayerName, setNewLayerName] = useState('');
  const [genPrompt, setGenPrompt] = useState('1). grass hex\n2). stone hex\n3). water hex');
  const [genTileCount, setGenTileCount] = useState(4);
  const [genSize, setGenSize] = useState(32);
  const [genAngle, setGenAngle] = useState(70);
  const [genDepth, setGenDepth] = useState(100);
  const [genStatus, setGenStatus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mapName, setMapName] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [sheetCols, setSheetCols] = useState(4);
  const [sheetRows, setSheetRows] = useState(4);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

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
  const handleUploadTiles = () => {
    fileInputRef.current?.click();
  };

  const handleUploadSheet = () => {
    sheetInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        hexAddTile(file.name.replace(/\.\w+$/, ''), reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSheetSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const tileW = Math.round(img.width / sheetCols);
        const tileH = Math.round(img.height / sheetRows);
        const name = file.name.replace(/\.\w+$/, '');
        for (let r = 0; r < sheetRows; r++) {
          for (let c = 0; c < sheetCols; c++) {
            const cv = document.createElement('canvas');
            cv.width = tileW; cv.height = tileH;
            const cx = cv.getContext('2d')!;
            cx.drawImage(img, c * tileW, r * tileH, tileW, tileH, 0, 0, tileW, tileH);
            hexAddTile(`${name}_${r * sheetCols + c}`, cv.toDataURL());
          }
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenStatus('Generating...');
    try {
      const resp = await fetch('/api/tilegen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: genPrompt,
          count: genTileCount,
          size: genSize,
          angle: genAngle,
          depth: genDepth,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setGenStatus(`Generated ${data.tiles?.length ?? 0} tiles`);
    } catch (err: any) {
      setGenStatus(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveMap = () => {
    setSaveStatus('Saving...');
    // TODO: Save to backend
    setTimeout(() => setSaveStatus('Saved'), 500);
  };

  const handleExportPng = () => {
    // TODO: Export canvas to PNG
  };

  const handleExportJson = () => {
    const data = JSON.stringify({
      hexR: 16,
      yOff: hexYOffset,
      palette: hexPalette.map(t => ({ id: t.id, name: t.name, dataUrl: t.dataUrl })),
      map: store.hexMapData.map,
      rotMap: store.hexMapData.rotMap,
      flipMap: store.hexMapData.flipMap,
      heightMap: store.hexMapData.heightMap,
      selectedTile: hexSelectedTile,
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${mapName || 'hex-map'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImportJson = () => {
    jsonInputRef.current?.click();
  };

  const handleJsonSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // Restore palette
      hexClearPalette();
      for (const t of (data.palette || [])) {
        hexAddTile(t.name, t.dataUrl);
      }
      // Restore map
      setHexMapData({
        map: data.map || {},
        rotMap: data.rotMap || {},
        flipMap: data.flipMap || {},
        heightMap: data.heightMap || {},
      });
      if (data.selectedTile !== undefined) setHexSelectedTile(data.selectedTile);
    } catch {
      // ignore
    }
    e.target.value = '';
  };

  const handleClearMap = () => {
    setHexMapData({ map: {}, rotMap: {}, flipMap: {}, heightMap: {} });
  };

  const handleRegenFlat = () => {
    // TODO: Regenerate flat map via PixelLab
  };

  const handleBlockViz = () => {
    // TODO: Open block visualizer overlay
  };

  const hexCount = getBrushHexCount(hexBrushSize, hexBrushShape);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0">
      {/* ── Title ─────────────────────────────────────────────────── */}
      <div className="pb-3 border-b border-white/5">
        <h3 className="text-[15px] font-bold text-emerald-400">Hex Painter</h3>
      </div>

      {/* ── Generate (PixelLab) ───────────────────────────────────── */}
      <div className="py-3 border-b border-white/5 space-y-2">
        <SectionTitle>Generate (PixelLab)</SectionTitle>
        <textarea
          value={genPrompt}
          onChange={(e) => setGenPrompt(e.target.value)}
          rows={3}
          placeholder={'1). grass hex\n2). stone hex\n3). water hex'}
          className="w-full px-2 py-1.5 text-[12px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded resize-y min-h-[50px] font-inherit placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
        />
        <div className="flex gap-2">
          <NumberInput label="Tiles" value={genTileCount} onChange={setGenTileCount} min={1} max={16} />
          <NumberInput label="Size" value={genSize} onChange={setGenSize} min={16} max={256} />
        </div>
        <div className="flex gap-2">
          <NumberInput label="Angle" value={genAngle} onChange={setGenAngle} min={0} max={90} />
          <NumberInput label="Depth%" value={genDepth} onChange={setGenDepth} min={0} max={100} />
        </div>
        <AccentButton onClick={handleGenerate} disabled={isGenerating}>
          Generate
        </AccentButton>
        {genStatus && (
          <p className="text-[10px] text-zinc-500">{genStatus}</p>
        )}
      </div>

      {/* ── Palette ───────────────────────────────────────────────── */}
      <div className="py-3 border-b border-white/5 space-y-2">
        <SectionTitle>Palette</SectionTitle>

        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelected} className="hidden" />
        <input ref={sheetInputRef} type="file" accept="image/*" onChange={handleSheetSelected} className="hidden" />
        <input ref={jsonInputRef} type="file" accept=".json" onChange={handleJsonSelected} className="hidden" />

        {hexPalette.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 px-2">
            <Grid3X3 size={24} className="text-zinc-600 mb-1.5" />
            <p className="text-[11px] text-zinc-500 text-center">No tiles loaded</p>
          </div>
        ) : (
          <div
            className="grid gap-1 bg-zinc-800/50 rounded-lg p-1.5 max-h-[200px] overflow-y-auto"
            style={{ gridTemplateColumns: `repeat(4, 1fr)` }}
          >
            {hexPalette.map((tile, i) => (
              <div key={tile.id} className="relative group">
                <button
                  onClick={() => { setHexSelectedTile(i); setActiveTilemapTool('paint'); }}
                  className={cn(
                    'w-full aspect-square rounded border-2 transition-colors',
                    hexSelectedTile === i
                      ? 'border-emerald-400'
                      : 'border-transparent hover:border-zinc-500',
                  )}
                  title={tile.name}
                >
                  <img
                    src={tile.dataUrl}
                    alt={tile.name}
                    className="w-full h-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); hexRemoveTile(i); }}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1.5">
          <DimButton onClick={handleUploadTiles}>Upload</DimButton>
          <DimButton onClick={handleUploadSheet}>Sheet</DimButton>
          <DimButton onClick={hexClearPalette}>Clear</DimButton>
        </div>
        <div className="flex gap-2">
          <NumberInput label="Cols" value={sheetCols} onChange={setSheetCols} min={1} max={32} />
          <NumberInput label="Rows" value={sheetRows} onChange={setSheetRows} min={1} max={32} />
        </div>
      </div>

      {/* ── Tools ─────────────────────────────────────────────────── */}
      <div className="py-3 border-b border-white/5 space-y-2">
        <SectionTitle>Tools</SectionTitle>
        <div className="flex gap-1">
          {PAINT_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTilemapTool(tool.id)}
                title={tool.label}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded text-[10px] font-medium transition-colors',
                  activeTilemapTool === tool.id
                    ? 'bg-emerald-400 text-zinc-900'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200',
                )}
              >
                <Icon size={14} />
                {tool.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1">
          {HEIGHT_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTilemapTool(tool.id)}
                title={tool.label}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded text-[10px] font-medium transition-colors',
                  activeTilemapTool === tool.id
                    ? 'bg-emerald-400 text-zinc-900'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200',
                )}
              >
                <Icon size={14} />
                {tool.label}
              </button>
            );
          })}
        </div>

        {/* Brush size + shape */}
        <div className="flex items-center gap-2 mt-1">
          <NumberInput
            label="Size"
            value={hexBrushSize}
            onChange={setHexBrushSize}
            min={1}
            max={256}
          />
          <select
            value={hexBrushShape}
            onChange={(e) => setHexBrushShape(e.target.value as HexBrushShape)}
            className="px-1.5 py-1 text-[11px] bg-zinc-800 border border-white/[0.06] rounded text-zinc-200 focus:outline-none focus:border-emerald-500/50"
          >
            {BRUSH_SHAPES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Brush presets */}
        <div className="flex gap-1 flex-wrap">
          {BRUSH_PRESETS.map((size) => (
            <button
              key={size}
              onClick={() => setHexBrushSize(size)}
              className={cn(
                'px-1.5 py-0.5 text-[10px] rounded border transition-colors',
                hexBrushSize === size
                  ? 'bg-emerald-400/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-zinc-800 border-white/[0.06] text-zinc-400 hover:bg-zinc-700',
              )}
            >
              {size}
            </button>
          ))}
        </div>

        {/* Hex count preview */}
        <p className="text-[10px] text-zinc-600">
          {hexCount} hex{hexCount === '1' ? '' : 'es'}
          {hexBrushShape !== 'hex' ? ` (${hexBrushShape === 'random' ? 'scatter' : hexBrushShape})` : ''}
        </p>
      </div>

      {/* ── Options ───────────────────────────────────────────────── */}
      <div className="py-3 border-b border-white/5 space-y-1.5">
        <Check label="Show grid" checked={hexShowGrid} onChange={setHexShowGrid} />
        <Check label="Show coords" checked={hexShowCoords} onChange={setHexShowCoords} />
        <Check label="Clip to hex (hide thickness)" checked={hexClipToHex} onChange={setHexClipToHex} />

        {/* Tile zoom slider */}
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-[11px] text-zinc-400 shrink-0">Tile zoom</span>
          <input
            type="range"
            min={-50}
            max={50}
            value={hexTileZoom}
            onChange={(e) => setHexTileZoom(parseInt(e.target.value))}
            className="flex-1 accent-emerald-400 h-1"
          />
          <span className="text-[10px] text-zinc-500 tabular-nums min-w-[30px] text-right">
            {hexTileZoom}%
          </span>
        </div>

        <Check label="Random rotation" checked={hexRandomRotation} onChange={setHexRandomRotation} />
        <Check label="Random flip" checked={hexRandomFlip} onChange={setHexRandomFlip} />
        <Check label="Random palette" checked={hexRandomPalette} onChange={setHexRandomPalette} />
        <Check label="Random brush size" checked={hexRandomBrushSize} onChange={setHexRandomBrushSize} />

        <div className="pt-1">
          <NumberInput label="Y-off" value={hexYOffset} onChange={setHexYOffset} min={-32} max={32} />
        </div>

        <div className="flex gap-1.5 pt-1">
          <DimButton onClick={handleRegenFlat}>Regen Flat</DimButton>
          <DimButton onClick={handleBlockViz}>Block Viz</DimButton>
        </div>
      </div>

      {/* ── Save / Export ─────────────────────────────────────────── */}
      <div className="py-3 border-b border-white/5 space-y-2">
        <input
          type="text"
          value={mapName}
          onChange={(e) => setMapName(e.target.value)}
          placeholder="Map name..."
          className="w-full px-2 py-1.5 text-[11px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
        />
        <div className="flex gap-1.5">
          <AccentButton onClick={handleSaveMap} className="flex-[2]">
            Save Map
          </AccentButton>
          <DimButton onClick={handleExportPng}>PNG</DimButton>
        </div>
        <div className="flex gap-1.5">
          <DimButton onClick={handleExportJson}>JSON</DimButton>
          <DimButton onClick={handleImportJson}>Load</DimButton>
        </div>
        {saveStatus && (
          <p className="text-[10px] text-emerald-400">{saveStatus}</p>
        )}
        <DimButton onClick={handleClearMap} danger>
          Clear Map
        </DimButton>
      </div>

      {/* ── Layers ────────────────────────────────────────────────── */}
      <div className="py-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>Layers</SectionTitle>
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
                  ? 'bg-emerald-400/10 text-emerald-300 border border-emerald-500/20'
                  : 'bg-zinc-800/50 text-zinc-300 border border-transparent hover:bg-zinc-800',
              )}
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(i); }}
                className={cn(
                  'shrink-0 p-0.5 rounded transition-colors',
                  layer.visible ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600',
                )}
              >
                {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <span className="flex-1 truncate">{layer.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleMoveLayer(i, 'up'); }}
                disabled={i === 0}
                className="shrink-0 p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors opacity-0 group-hover:opacity-100"
              >
                <ChevronUp size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleMoveLayer(i, 'down'); }}
                disabled={i === config.layers.length - 1}
                className="shrink-0 p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors opacity-0 group-hover:opacity-100"
              >
                <ChevronDown size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); removeTilemapLayer(i); }}
                disabled={config.layers.length <= 1}
                className="shrink-0 p-0.5 text-zinc-500 hover:text-red-400 disabled:opacity-30 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 mt-2">
          <input
            type="text"
            placeholder="New layer name..."
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddLayer(); }}
            className="flex-1 px-2 py-1.5 text-[11px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded-lg placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* ── Grid Type ─────────────────────────────────────────────── */}
      <div className="py-3 border-b border-white/5">
        <SectionTitle>Grid Type</SectionTitle>
        <div className="grid grid-cols-3 gap-1.5">
          {GRID_TYPES.map((gt) => (
            <button
              key={gt.id}
              onClick={() => updateGridType(gt.id)}
              className={cn(
                'px-3 py-2 rounded-lg text-[12px] font-medium transition-colors',
                config.gridType === gt.id
                  ? 'bg-emerald-400 text-zinc-900'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300',
              )}
            >
              {gt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Active tile / layer indicator ─────────────────────────── */}
      <div className="py-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span>Active Tile:</span>
          <span className="text-zinc-300 tabular-nums font-medium">{activeTileId}</span>
          <span className="text-zinc-600">|</span>
          <span>Layer:</span>
          <span className="text-zinc-300">{config.layers[activeTilemapLayer]?.name ?? '?'}</span>
        </div>
      </div>

      {/* ── Help text ─────────────────────────────────────────────── */}
      <div className="py-3 text-[9px] text-zinc-600 leading-relaxed">
        Scroll = zoom &middot; Shift+drag / middle = pan<br />
        Right-click = erase &middot; 1-4 = tools<br />
        [ ] = brush size &middot; Space+drag = pan
      </div>
    </div>
  );
}
