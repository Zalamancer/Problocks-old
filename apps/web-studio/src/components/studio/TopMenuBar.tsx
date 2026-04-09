import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Save,
  Upload,
  Box,
  Circle,
  Cylinder,
  Lightbulb,
  Camera,
  FileCode,
  Play,
  Square,
  RotateCcw,
  Store,
  Settings,
} from 'lucide-react';
import { useStudio } from '@/store/studio-store';
import { saveScene } from '@/store/storage';

interface MenuItem {
  id: string;
  label: string;
  icon: typeof Save;
  shortcut?: string;
  onClick: () => void;
  separator?: false;
}

interface MenuSeparator {
  separator: true;
}

type MenuEntry = MenuItem | MenuSeparator;

interface DropdownMenu {
  kind: 'dropdown';
  id: string;
  label: string;
  items: MenuEntry[];
}

interface DirectButton {
  kind: 'direct';
  id: string;
  label: string;
  onClick: () => void;
}

type MenuDef = DropdownMenu | DirectButton;

export function TopMenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [hoverMode, setHoverMode] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const { isPlaying, setPlaying, addEntity, entities, addLog, resetScene, marketplaceOpen, toggleMarketplace, viewportMode, setViewportMode, setLeftPanelGroup } = useStudio();

  let entityCounter = 10;
  const insertEntity = (shape: 'box' | 'sphere' | 'cylinder') => {
    const id = `${shape}_${Date.now()}`;
    entityCounter++;
    addEntity({
      id,
      name: `${shape.charAt(0).toUpperCase() + shape.slice(1)} ${entityCounter}`,
      type: 'entity',
      shape,
      color: ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff'][entityCounter % 5],
      position: { x: (Math.random() - 0.5) * 4, y: 5 + Math.random() * 3, z: (Math.random() - 0.5) * 4 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { width: 1, height: 1, depth: 1 },
      physics: { mass: 1, friction: 0.5, restitution: 0.4, isStatic: false },
    });
  };

  // Close on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setHoverMode(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  // Close on Escape
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setHoverMode(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [openMenu]);

  // Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveScene(entities);
        addLog('[system] Scene saved');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [entities, addLog]);

  const handleMenuClick = useCallback((menuId: string) => {
    setOpenMenu((prev) => {
      if (prev === menuId) {
        setHoverMode(false);
        return null;
      }
      setHoverMode(true);
      return menuId;
    });
  }, []);

  const handleMenuHover = useCallback(
    (menuId: string) => {
      if (hoverMode && openMenu) {
        setOpenMenu(menuId);
      }
    },
    [hoverMode, openMenu],
  );

  const handleItemClick = useCallback((item: MenuItem) => {
    item.onClick();
    setOpenMenu(null);
    setHoverMode(false);
  }, []);

  const handleDirectClick = useCallback((def: DirectButton) => {
    setOpenMenu(null);
    setHoverMode(false);
    def.onClick();
  }, []);

  const menus: MenuDef[] = [
    {
      kind: 'dropdown',
      id: 'file',
      label: 'File',
      items: [
        { id: 'new', label: 'New Simulation', icon: FileCode, onClick: () => resetScene() },
        { separator: true },
        { id: 'save', label: 'Save', icon: Save, shortcut: '\u2318S', onClick: () => { saveScene(entities); addLog('[system] Scene saved'); } },
        { id: 'publish', label: 'Publish to Marketplace', icon: Upload, onClick: () => {} },
      ],
    },
    {
      kind: 'dropdown',
      id: 'insert',
      label: 'Insert',
      items: [
        { id: 'box', label: 'Box', icon: Box, onClick: () => insertEntity('box') },
        { id: 'sphere', label: 'Sphere', icon: Circle, onClick: () => insertEntity('sphere') },
        { id: 'cylinder', label: 'Cylinder', icon: Cylinder, onClick: () => insertEntity('cylinder') },
        { separator: true },
        { id: 'light', label: 'Light', icon: Lightbulb, onClick: () => {} },
        { id: 'camera', label: 'Camera', icon: Camera, onClick: () => {} },
        { id: 'script', label: 'Script', icon: FileCode, onClick: () => {} },
      ],
    },
    {
      kind: 'direct',
      id: 'marketplace',
      label: 'Marketplace',
      onClick: () => toggleMarketplace(),
    },
    {
      kind: 'direct',
      id: 'settings',
      label: 'Settings',
      onClick: () => {},
    },
  ];

  return (
    <div
      ref={barRef}
      className="relative z-50 flex items-center h-8 bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-xl shrink-0 select-none shadow-sm"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3">
        <div className="h-4 w-4 rounded bg-green-500" />
        <span className="text-xs font-bold text-zinc-200">Problocks</span>
      </div>

      {/* Menu buttons */}
      <div className="flex items-center">
        {menus.map((menu) =>
          menu.kind === 'dropdown' ? (
            <DropdownMenuButton
              key={menu.id}
              menu={menu}
              isOpen={openMenu === menu.id}
              onClick={() => handleMenuClick(menu.id)}
              onHover={() => handleMenuHover(menu.id)}
              onItemClick={handleItemClick}
            />
          ) : (
            <DirectMenuButton
              key={menu.id}
              menu={menu}
              onClick={() => handleDirectClick(menu)}
              onHover={() => handleMenuHover(menu.id)}
            />
          ),
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* 2D / 3D / Tilemap toggle */}
      <div className="flex items-center bg-zinc-800/60 rounded-md p-0.5 mr-2">
        <button
          onClick={() => setViewportMode('2d')}
          className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
            viewportMode === '2d'
              ? 'bg-blue-500 text-white'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          2D
        </button>
        <button
          onClick={() => setViewportMode('3d')}
          className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
            viewportMode === '3d'
              ? 'bg-green-500 text-white'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          3D
        </button>
        <button
          onClick={() => { setViewportMode('tilemap'); setLeftPanelGroup('tilemap'); }}
          className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
            viewportMode === 'tilemap'
              ? 'bg-purple-500 text-white'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Tile
        </button>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-1 pr-3">
        <button
          onClick={() => setPlaying(true)}
          disabled={isPlaying}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
            isPlaying
              ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-400 text-white'
          }`}
        >
          <Play size={12} />
          Play
        </button>
        <button
          onClick={() => setPlaying(false)}
          disabled={!isPlaying}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors disabled:opacity-40"
        >
          <Square size={12} />
          Stop
        </button>
        <button
          className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          title="Reset"
        >
          <RotateCcw size={12} />
        </button>
        <span className="text-[10px] text-zinc-600 ml-2">v0.0.1</span>
        <button
          className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          title="Settings"
        >
          <Settings size={12} />
        </button>
      </div>
    </div>
  );
}

function DropdownMenuButton({
  menu,
  isOpen,
  onClick,
  onHover,
  onItemClick,
}: {
  menu: DropdownMenu;
  isOpen: boolean;
  onClick: () => void;
  onHover: () => void;
  onItemClick: (item: MenuItem) => void;
}) {
  return (
    <div className="relative" onMouseEnter={onHover}>
      <button
        onClick={onClick}
        className={`px-3 text-xs font-medium transition-all duration-200 rounded-md mx-0.5 mt-0.5 h-7 flex items-center ${
          isOpen ? 'bg-zinc-800/80 text-zinc-50 shadow-sm' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
        }`}
      >
        {menu.label}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 min-w-[200px] py-1.5 bg-zinc-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl mt-1">
          {menu.items.map((entry, i) => {
            if (entry.separator) {
              return <div key={`sep-${i}`} className="my-1 border-t border-zinc-700/50" />;
            }
            const item = entry as MenuItem;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onItemClick(item)}
                className="flex items-center gap-3 px-3 py-2 text-xs transition-colors rounded-md mx-1.5 w-[calc(100%-12px)] text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-50"
              >
                <Icon size={14} className="shrink-0 text-zinc-500" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut && <span className="text-[10px] text-zinc-600 ml-4">{item.shortcut}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DirectMenuButton({
  menu,
  onClick,
  onHover,
}: {
  menu: DirectButton;
  onClick: () => void;
  onHover: () => void;
}) {
  return (
    <div onMouseEnter={onHover}>
      <button
        onClick={onClick}
        className="px-3 text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-all duration-200 rounded-md mx-0.5 mt-0.5 h-7 flex items-center"
      >
        {menu.label}
      </button>
    </div>
  );
}
