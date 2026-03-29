import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Globe,
  FileCode,
  Package,
  PlusCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Box,
  Circle,
  Cylinder,
  Lightbulb,
  Camera,
  Palette,
  Folder,
  Layers,
  Wrench,
  Cog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudio, type LeftPanelGroup, type LeftPanelTab } from '@/store/studio-store';
import { ExplorerPanel } from './ExplorerPanel';
import type { LucideIcon } from 'lucide-react';

// ── Tab group definitions ─────────────────────────────────────────────

interface SubTabDef {
  id: LeftPanelTab;
  label: string;
  description?: string;
  icon: LucideIcon;
}

interface TabGroupDef {
  id: LeftPanelGroup;
  label: string;
  icon: LucideIcon;
  subTabs: SubTabDef[];
}

const TAB_GROUPS: TabGroupDef[] = [
  {
    id: 'scene',
    label: 'Scene',
    icon: Globe,
    subTabs: [{ id: 'scene', label: 'Scene Explorer', icon: Layers }],
  },
  {
    id: 'scripts',
    label: 'Scripts',
    icon: FileCode,
    subTabs: [{ id: 'scripts', label: 'Script Editor', icon: FileCode }],
  },
  {
    id: 'assets',
    label: 'Assets',
    icon: Package,
    subTabs: [{ id: 'assets', label: 'Asset Library', icon: Folder }],
  },
  {
    id: 'insert',
    label: 'Insert',
    icon: PlusCircle,
    subTabs: [{ id: 'insert', label: 'Insert Objects', icon: Box }],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    subTabs: [{ id: 'settings', label: 'Project Settings', icon: Cog }],
  },
];

const CARD_GRID_THRESHOLD = 2;

// ── Insert panel content ──────────────────────────────────────────────

function InsertPanel() {
  const { addEntity } = useStudio();

  const insertEntity = (shape: 'box' | 'sphere' | 'cylinder') => {
    const id = `${shape}_${Date.now()}`;
    addEntity({
      id,
      name: `${shape.charAt(0).toUpperCase() + shape.slice(1)}`,
      type: 'entity',
      shape,
      color: ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff'][Math.floor(Math.random() * 5)],
      position: { x: (Math.random() - 0.5) * 4, y: 5 + Math.random() * 3, z: (Math.random() - 0.5) * 4 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { width: 1, height: 1, depth: 1 },
      physics: { mass: 1, friction: 0.5, restitution: 0.4, isStatic: false },
    });
  };

  const items = [
    { id: 'box', label: 'Box', description: 'Rectangular solid', icon: Box, action: () => insertEntity('box') },
    { id: 'sphere', label: 'Sphere', description: 'Round ball shape', icon: Circle, action: () => insertEntity('sphere') },
    { id: 'cylinder', label: 'Cylinder', description: 'Tube-like shape', icon: Cylinder, action: () => insertEntity('cylinder') },
    { id: 'light', label: 'Light', description: 'Point or directional', icon: Lightbulb, action: () => {} },
    { id: 'camera', label: 'Camera', description: 'View perspective', icon: Camera, action: () => {} },
    { id: 'script', label: 'Script', description: 'Code behavior', icon: FileCode, action: () => {} },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={item.action}
            className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left transition-colors hover:bg-white/[0.06] group"
          >
            <div className="shrink-0 w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center text-zinc-400 group-hover:text-green-400 group-hover:bg-green-500/10 transition-colors">
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-zinc-200 group-hover:text-white transition-colors">
                {item.label}
              </div>
              <div className="text-[11px] leading-relaxed text-zinc-500 mt-0.5">{item.description}</div>
            </div>
            <ChevronRight size={15} className="shrink-0 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </button>
        );
      })}
    </div>
  );
}

// ── Settings panel content ────────────────────────────────────────────

function SettingsPanel() {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div>
        <h4 className="text-xs font-medium text-zinc-400 mb-2">Simulation</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-zinc-300">Gravity</span>
            <span className="text-[12px] text-zinc-500">-9.81 m/s\u00B2</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-zinc-300">Time Scale</span>
            <span className="text-[12px] text-zinc-500">1.0x</span>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 pt-4">
        <h4 className="text-xs font-medium text-zinc-400 mb-2">Rendering</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-zinc-300">Shadows</span>
            <span className="text-[12px] text-green-400">On</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-zinc-300">Grid</span>
            <span className="text-[12px] text-green-400">Visible</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Assets panel placeholder ──────────────────────────────────────────

function AssetsPanel() {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="text-center">
        <Package size={32} className="mx-auto text-zinc-600 mb-2" />
        <p className="text-[13px] text-zinc-400">Asset Library</p>
        <p className="text-[11px] text-zinc-600 mt-1">Models, textures & sounds</p>
      </div>
    </div>
  );
}

// ── Main group header with prev/next chevrons ─────────────────────────

function MainGroupHeader() {
  const { leftPanelActiveGroup, setLeftPanelGroup } = useStudio();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentIndex = TAB_GROUPS.findIndex((g) => g.id === leftPanelActiveGroup);
  const groupDef = TAB_GROUPS[currentIndex];

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const goPrev = useCallback(() => {
    const prev = currentIndex <= 0 ? TAB_GROUPS.length - 1 : currentIndex - 1;
    setLeftPanelGroup(TAB_GROUPS[prev].id);
  }, [currentIndex, setLeftPanelGroup]);

  const goNext = useCallback(() => {
    const next = currentIndex >= TAB_GROUPS.length - 1 ? 0 : currentIndex + 1;
    setLeftPanelGroup(TAB_GROUPS[next].id);
  }, [currentIndex, setLeftPanelGroup]);

  if (!groupDef) return null;
  const GroupIcon = groupDef.icon;

  return (
    <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-white/5">
      <button
        onClick={goPrev}
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
        title="Previous"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Title with group dropdown */}
      <div ref={dropdownRef} className="relative flex-1 min-w-0">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] font-medium text-zinc-200 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <GroupIcon size={14} className="shrink-0 text-zinc-400" />
          <span className="truncate">{groupDef.label}</span>
          <ChevronDown
            size={14}
            className={cn('shrink-0 text-zinc-500 transition-transform duration-200', dropdownOpen && 'rotate-180')}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-zinc-800 border border-white/10 rounded-xl shadow-2xl py-1.5 max-h-[320px] overflow-y-auto">
            {TAB_GROUPS.map((group) => {
              const Icon = group.icon;
              const isActive = group.id === leftPanelActiveGroup;
              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setLeftPanelGroup(group.id);
                    setDropdownOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors',
                    isActive
                      ? 'bg-green-500/10 text-green-400'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]',
                  )}
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="truncate">{group.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={goNext}
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
        title="Next"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── Panel content switcher ────────────────────────────────────────────

function PanelContent({ group }: { group: LeftPanelGroup }) {
  switch (group) {
    case 'scene':
      return <ExplorerPanel />;
    case 'scripts':
      return (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <FileCode size={32} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-[13px] text-zinc-400">Scripts</p>
            <p className="text-[11px] text-zinc-600 mt-1">Use the script editor below</p>
          </div>
        </div>
      );
    case 'assets':
      return <AssetsPanel />;
    case 'insert':
      return <InsertPanel />;
    case 'settings':
      return <SettingsPanel />;
    default:
      return null;
  }
}

// ── Collapse/expand pill ──────────────────────────────────────────────

export function LeftPanelToggle() {
  const { leftPanelCollapsed, toggleLeftPanel } = useStudio();

  return (
    <button
      onClick={toggleLeftPanel}
      className="absolute top-1/2 -translate-y-1/2 z-20 w-6 h-12 bg-zinc-700 rounded-r-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-600 transition-all duration-300"
      style={{ left: leftPanelCollapsed ? 0 : 288 }}
    >
      {leftPanelCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
    </button>
  );
}

// ── Main LeftPanel ────────────────────────────────────────────────────

export function LeftPanel() {
  const { leftPanelCollapsed, leftPanelActiveGroup } = useStudio();

  return (
    <aside
      className={cn(
        'flex-shrink-0 overflow-visible transition-all duration-300',
        leftPanelCollapsed ? 'w-0' : 'w-[300px]',
      )}
    >
      <div
        className={cn(
          'h-full flex flex-col bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden transition-opacity duration-300',
          leftPanelCollapsed ? 'opacity-0 border-transparent' : '',
        )}
      >
        <MainGroupHeader />

        {!leftPanelCollapsed && (
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            <PanelContent group={leftPanelActiveGroup} />
          </div>
        )}
      </div>
    </aside>
  );
}
