import { useState, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  Sparkles,
  Upload,
  MoreHorizontal,
  Copy,
  Trash2,
  Pencil,
  Image as ImageIcon,
  X,
  Package,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudio } from '@/store/studio-store';
import type { AssetCategory, AssetEntry, AssetPerspective } from '@problocks/engine';

// ── Category definitions ─────────────────────────────────────────────

type FilterCategory = AssetCategory | 'all';

const CATEGORIES: { id: FilterCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'floor', label: 'Floor' },
  { id: 'wall', label: 'Wall' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'decoration', label: 'Decor' },
  { id: 'character', label: 'Character' },
  { id: 'item', label: 'Item' },
  { id: 'effect', label: 'Effect' },
];

// ── Style presets ────────────────────────────────────────────────────

const STYLE_PRESETS = [
  'Medieval Fantasy',
  'Sci-Fi',
  'Modern City',
  'Pixel Art',
  'Low Poly',
  'Hand-Drawn',
  'Voxel',
  'Retro 8-bit',
];

const PERSPECTIVE_OPTIONS: { id: AssetPerspective; label: string }[] = [
  { id: 'top-down', label: 'Top-Down' },
  { id: 'isometric', label: 'Isometric' },
  { id: 'side-view', label: 'Side View' },
];

// ── Category badge color ─────────────────────────────────────────────

function categoryColor(cat: AssetCategory): string {
  switch (cat) {
    case 'floor': return 'bg-amber-500/15 text-amber-400';
    case 'wall': return 'bg-stone-500/15 text-stone-400';
    case 'furniture': return 'bg-blue-500/15 text-blue-400';
    case 'decoration': return 'bg-purple-500/15 text-purple-400';
    case 'character': return 'bg-green-500/15 text-green-400';
    case 'item': return 'bg-yellow-500/15 text-yellow-400';
    case 'effect': return 'bg-pink-500/15 text-pink-400';
    case 'tileset': return 'bg-cyan-500/15 text-cyan-400';
    case 'audio': return 'bg-orange-500/15 text-orange-400';
    default: return 'bg-zinc-500/15 text-zinc-400';
  }
}

// ── AI Generator Dialog ──────────────────────────────────────────────

function AIGeneratorDialog({
  open,
  onClose,
  projectStyle,
  onGenerate,
}: {
  open: boolean;
  onClose: () => void;
  projectStyle: string;
  onGenerate: (config: {
    prompt: string;
    style: string;
    perspective: AssetPerspective;
    width: number;
    height: number;
  }) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(projectStyle);
  const [perspective, setPerspective] = useState<AssetPerspective>('top-down');
  const [width, setWidth] = useState(64);
  const [height, setHeight] = useState(64);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (!open) return null;

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    // Simulate generation delay — actual integration calls engine's AIGenerator
    setTimeout(() => {
      setGenerating(false);
      // In production this would be a real generated image URL
      setPreviewUrl(null);
      onGenerate({ prompt: prompt.trim(), style, perspective, width, height });
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-zinc-900 border border-white/[0.08] rounded-2xl shadow-2xl w-[420px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            <h3 className="text-[14px] font-semibold text-zinc-100">Generate with AI</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Prompt */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the asset you want to generate..."
              rows={3}
              className="w-full px-3 py-2 text-[13px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded-xl placeholder-zinc-600 resize-none focus:outline-none focus:border-purple-500/50"
            />
          </div>

          {/* Style preset */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Style</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full px-3 py-2 text-[13px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded-xl focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
            >
              {STYLE_PRESETS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Perspective */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Perspective</label>
            <div className="grid grid-cols-3 gap-1.5">
              {PERSPECTIVE_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPerspective(p.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-[12px] font-medium transition-colors',
                    perspective === p.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Width (px)</label>
              <input
                type="number"
                min={16}
                max={512}
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value) || 64)}
                className="w-full px-3 py-2 text-[13px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded-xl tabular-nums focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Height (px)</label>
              <input
                type="number"
                min={16}
                max={512}
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value) || 64)}
                className="w-full px-3 py-2 text-[13px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded-xl tabular-nums focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          {/* Preview area */}
          {previewUrl && (
            <div className="rounded-xl border border-white/[0.06] bg-zinc-800/50 p-3 flex items-center justify-center">
              <img src={previewUrl} alt="Preview" className="max-w-full max-h-[200px] rounded-lg" style={{ imageRendering: 'pixelated' }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors',
              generating
                ? 'bg-purple-600/50 text-purple-300 cursor-wait'
                : 'bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {generating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import Dialog ────────────────────────────────────────────────────

function ImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (entry: AssetEntry) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('decoration');
  const [tags, setTags] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setName(f.name.replace(/\.[^.]+$/, ''));
    setPreviewUrl(URL.createObjectURL(f));
  };

  const handleImport = () => {
    if (!file || !name.trim()) return;

    const entry: AssetEntry = {
      metadata: {
        id: `asset_${Date.now()}`,
        name: name.trim(),
        category,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        style: '',
        perspective: 'any',
        collisionShape: { type: 'none' },
        placementRules: [],
        anchor: { x: 0.5, y: 0.5 },
        size: { width: 64, height: 64 },
        source: 'imported',
        createdAt: Date.now(),
        thumbnailUrl: previewUrl ?? undefined,
      },
      blobUrl: previewUrl ?? undefined,
      loaded: true,
    };

    onImport(entry);
    onClose();
    setFile(null);
    setPreviewUrl(null);
    setName('');
    setTags('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-zinc-900 border border-white/[0.08] rounded-2xl shadow-2xl w-[380px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-blue-400" />
            <h3 className="text-[14px] font-semibold text-zinc-100">Import Asset</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* File picker */}
          {!file ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center py-8 border-2 border-dashed border-white/10 rounded-xl text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition-colors"
            >
              <ImageIcon size={28} className="mb-2" />
              <span className="text-[12px]">Click to select an image</span>
              <span className="text-[10px] text-zinc-600 mt-0.5">PNG, JPG, or SVG</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl">
              {previewUrl && (
                <img src={previewUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover" style={{ imageRendering: 'pixelated' }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-zinc-200 truncate">{file.name}</p>
                <p className="text-[10px] text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={() => { setFile(null); setPreviewUrl(null); }}
                className="shrink-0 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleFileChange} className="hidden" />

          {/* Metadata */}
          {file && (
            <>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded-xl focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AssetCategory)}
                  className="w-full px-3 py-2 text-[13px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded-xl focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                >
                  {CATEGORIES.filter(c => c.id !== 'all').map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Tags (comma separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="medieval, stone, 32x32"
                  className="w-full px-3 py-2 text-[13px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded-xl placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Upload size={14} />
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Asset Card Context Menu ──────────────────────────────────────────

function AssetContextMenu({
  position,
  onClose,
  onDelete,
  onDuplicate,
  onEdit,
}: {
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <div
        className="fixed z-[91] bg-zinc-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[160px]"
        style={{ top: position.y, left: position.x }}
      >
        <button
          onClick={() => { onEdit(); onClose(); }}
          className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-50 w-full text-left transition-colors"
        >
          <Pencil size={13} className="text-zinc-500" />
          Edit Metadata
        </button>
        <button
          onClick={() => { onDuplicate(); onClose(); }}
          className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-50 w-full text-left transition-colors"
        >
          <Copy size={13} className="text-zinc-500" />
          Duplicate
        </button>
        <div className="my-1 border-t border-zinc-700/50" />
        <button
          onClick={() => { onDelete(); onClose(); }}
          className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full text-left transition-colors"
        >
          <Trash2 size={13} />
          Delete
        </button>
      </div>
    </>
  );
}

// ── Main AssetBrowser component ──────────────────────────────────────

export function AssetBrowser() {
  const {
    assets,
    selectedAssetId,
    assetFilter,
    aiGeneratorOpen,
    projectStyle,
    addAsset,
    removeAsset,
    setSelectedAsset,
    setAssetFilter,
    setAiGeneratorOpen,
    setProjectStyle,
  } = useStudio();

  const [importOpen, setImportOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ position: { x: number; y: number }; assetId: string } | null>(null);

  // Filter assets
  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (assetFilter.category !== 'all' && a.metadata.category !== assetFilter.category) return false;
      if (assetFilter.search) {
        const q = assetFilter.search.toLowerCase();
        const matchName = a.metadata.name.toLowerCase().includes(q);
        const matchTags = a.metadata.tags.some(t => t.toLowerCase().includes(q));
        if (!matchName && !matchTags) return false;
      }
      return true;
    });
  }, [assets, assetFilter]);

  const handleContextMenu = useCallback((e: React.MouseEvent, assetId: string) => {
    e.preventDefault();
    setContextMenu({ position: { x: e.clientX, y: e.clientY }, assetId });
  }, []);

  const handleDuplicate = useCallback((id: string) => {
    const source = assets.find(a => a.metadata.id === id);
    if (!source) return;
    const dupe: AssetEntry = {
      ...source,
      metadata: {
        ...source.metadata,
        id: `asset_${Date.now()}`,
        name: `${source.metadata.name} (copy)`,
        createdAt: Date.now(),
      },
    };
    addAsset(dupe);
  }, [assets, addAsset]);

  const handleAIGenerate = useCallback((config: {
    prompt: string;
    style: string;
    perspective: AssetPerspective;
    width: number;
    height: number;
  }) => {
    // Create a placeholder asset — actual generation would call engine's AIGenerator
    const entry: AssetEntry = {
      metadata: {
        id: `asset_${Date.now()}`,
        name: config.prompt.slice(0, 40),
        category: 'decoration',
        tags: ['ai-generated', config.style.toLowerCase()],
        style: config.style,
        perspective: config.perspective,
        collisionShape: { type: 'none' },
        placementRules: [],
        anchor: { x: 0.5, y: 0.5 },
        size: { width: config.width, height: config.height },
        source: 'ai-generated',
        sourcePrompt: config.prompt,
        createdAt: Date.now(),
      },
      loaded: false,
    };
    addAsset(entry);
  }, [addAsset]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Header: style indicator + action buttons ───────────── */}
      <div className="shrink-0 px-3 pt-3 pb-2 space-y-2">
        {/* Project style */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-zinc-500">Style:</span>
          <select
            value={projectStyle}
            onChange={(e) => setProjectStyle(e.target.value)}
            className="px-1.5 py-0.5 text-[10px] text-zinc-300 bg-zinc-800 border border-white/[0.06] rounded-md focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
          >
            {STYLE_PRESETS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setAiGeneratorOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-semibold transition-colors"
          >
            <Sparkles size={14} />
            Generate with AI
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[12px] font-medium transition-colors border border-white/[0.06]"
          >
            <Upload size={14} />
            Import
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search assets..."
            value={assetFilter.search}
            onChange={(e) => setAssetFilter({ search: e.target.value })}
            className="w-full pl-8 pr-3 py-1.5 text-[12px] text-zinc-200 bg-zinc-800 border border-white/[0.06] rounded-lg placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
          />
          {assetFilter.search && (
            <button
              onClick={() => setAssetFilter({ search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Category tabs ──────────────────────────────────────── */}
      <div className="shrink-0 px-3 pb-2">
        <div className="flex gap-0.5 overflow-x-auto scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setAssetFilter({ category: cat.id })}
              className={cn(
                'shrink-0 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors',
                assetFilter.category === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Asset grid ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Package size={32} className="text-zinc-600 mb-2" />
            <p className="text-[13px] text-zinc-400">
              {assets.length === 0 ? 'No assets yet' : 'No matching assets'}
            </p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              {assets.length === 0
                ? 'Generate or import assets to get started'
                : 'Try adjusting your search or category filter'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {filtered.map((asset) => {
              const isSelected = selectedAssetId === asset.metadata.id;
              const thumb = asset.metadata.thumbnailUrl || asset.blobUrl || asset.url;
              return (
                <div
                  key={asset.metadata.id}
                  onClick={() => setSelectedAsset(asset.metadata.id)}
                  onContextMenu={(e) => handleContextMenu(e, asset.metadata.id)}
                  className={cn(
                    'group relative rounded-xl border overflow-hidden cursor-pointer transition-all',
                    isSelected
                      ? 'border-blue-500/40 ring-1 ring-blue-500/30 bg-blue-600/10'
                      : 'border-white/[0.06] bg-zinc-800/50 hover:border-white/10 hover:bg-zinc-800',
                  )}
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-zinc-900/50 flex items-center justify-center overflow-hidden">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={asset.metadata.name}
                        className="w-full h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <ImageIcon size={24} className="text-zinc-700" />
                    )}
                    {!asset.loaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 size={16} className="text-zinc-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="px-2 py-1.5">
                    <p className="text-[11px] text-zinc-200 truncate">{asset.metadata.name}</p>
                    <span className={cn('inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium', categoryColor(asset.metadata.category))}>
                      {asset.metadata.category}
                    </span>
                  </div>

                  {/* Context menu button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleContextMenu(e, asset.metadata.id); }}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-zinc-800/80 text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Context menu ───────────────────────────────────────── */}
      {contextMenu && (
        <AssetContextMenu
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onDelete={() => removeAsset(contextMenu.assetId)}
          onDuplicate={() => handleDuplicate(contextMenu.assetId)}
          onEdit={() => {
            // For now, just select the asset — full edit UI is a future enhancement
            setSelectedAsset(contextMenu.assetId);
          }}
        />
      )}

      {/* ── Dialogs ────────────────────────────────────────────── */}
      <AIGeneratorDialog
        open={aiGeneratorOpen}
        onClose={() => setAiGeneratorOpen(false)}
        projectStyle={projectStyle}
        onGenerate={handleAIGenerate}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={addAsset}
      />
    </div>
  );
}
