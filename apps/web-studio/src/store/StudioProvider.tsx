import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StudioContext, DEFAULT_ENTITIES, type EntityData, type LeftPanelGroup, type LeftPanelTab, type ViewportMode, type TilemapTool, type TilesetInfo, type AssetFilter } from './studio-store';
import type { TilemapConfig } from '@problocks/engine';
import type { AssetEntry } from '@problocks/engine';
import { saveScene, loadScene, clearScene } from './storage';
import type { SimulationLoop } from '@problocks/engine/core/simulation-loop';
import type { QuickJSRuntime } from '@problocks/engine/scripting/quickjs-runtime';
import type { Grid } from '@problocks/engine';

export function StudioProvider({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<EntityData[]>(() => loadScene() ?? DEFAULT_ENTITIES);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>('ball');
  const [isPlaying, setIsPlaying] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [scriptRunning, setScriptRunning] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [leftPanelActiveGroup, setLeftPanelActiveGroup] = useState<LeftPanelGroup>('scene');
  const [leftPanelActiveTab, setLeftPanelActiveTab] = useState<LeftPanelTab>('scene');
  const [viewportMode, setViewportMode] = useState<ViewportMode>('3d');

  // Tilemap state
  const [tilemapConfig, setTilemapConfigRaw] = useState<TilemapConfig | null>(null);
  const [activeTilemapLayer, setActiveTilemapLayer] = useState(0);
  const [activeTileId, setActiveTileId] = useState(1);
  const [activeTilemapTool, setActiveTilemapTool] = useState<TilemapTool>('paint');
  const [loadedTilesets, setLoadedTilesets] = useState<TilesetInfo[]>([]);

  // Asset browser state
  const [assets, setAssets] = useState<AssetEntry[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetFilter, setAssetFilterRaw] = useState<AssetFilter>({ category: 'all', search: '' });
  const [aiGeneratorOpen, setAiGeneratorOpen] = useState(false);
  const [projectStyle, setProjectStyle] = useState('Medieval Fantasy');

  const simRef = useRef<SimulationLoop | null>(null);
  const sandboxRef = useRef<QuickJSRuntime | null>(null);

  const selectEntity = useCallback((id: string | null) => {
    setSelectedEntityId(id);
  }, []);

  const updateEntity = useCallback((id: string, partial: Partial<EntityData>) => {
    setEntities(prev => prev.map(e => (e.id === id ? { ...e, ...partial } : e)));
  }, []);

  const addEntity = useCallback((entity: EntityData) => {
    setEntities(prev => [...prev, entity]);
    if (simRef.current && entity.shape) {
      simRef.current.createEntity(entity.id, entity.shape, {
        width: entity.dimensions?.width,
        height: entity.dimensions?.height,
        depth: entity.dimensions?.depth,
        radius: entity.shape === 'sphere' ? (entity.dimensions?.width ?? 1) / 2 : undefined,
        color: entity.color,
        position: entity.position,
        mass: entity.physics?.mass ?? 1,
        isStatic: entity.physics?.isStatic ?? false,
        friction: entity.physics?.friction ?? 0.5,
        restitution: entity.physics?.restitution ?? 0.3,
      });
    }
  }, []);

  const removeEntity = useCallback((id: string) => {
    setEntities(prev => prev.filter(e => e.id !== id));
    if (simRef.current) simRef.current.removeEntity(id);
  }, []);

  const toggleMarketplace = useCallback(() => {
    setMarketplaceOpen(prev => !prev);
  }, []);

  const toggleLeftPanel = useCallback(() => {
    setLeftPanelCollapsed(prev => !prev);
  }, []);

  const setLeftPanelGroup = useCallback((group: LeftPanelGroup) => {
    setLeftPanelActiveGroup(group);
    setLeftPanelActiveTab(group);
  }, []);

  const setLeftPanelTab = useCallback((tab: LeftPanelTab) => {
    setLeftPanelActiveTab(tab);
  }, []);

  const setPlaying = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    if (simRef.current) {
      if (playing) simRef.current.start();
      else simRef.current.stop();
    }
  }, []);

  const addLog = useCallback((msg: string) => {
    setConsoleLogs(prev => [...prev.slice(-99), msg]);
  }, []);

  const clearLogs = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  const resetScene = useCallback(() => {
    clearScene();
    setEntities(DEFAULT_ENTITIES);
    setSelectedEntityId(null);
  }, []);

  // Auto-persist scene to localStorage
  useEffect(() => {
    saveScene(entities);
  }, [entities]);

  // Ref for the tilemap tick interval (used by tilemap script mode)
  const tilemapTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Sync a Grid instance back to the store's tilemapConfig.
   * Reads all tiles from the Grid's chunk storage and writes them
   * into a TilemapConfig-shaped data structure.
   */
  const syncGridToConfig = useCallback((grid: Grid, mapWidth: number, mapHeight: number, layerCount: number) => {
    const layers = [];
    for (let li = 0; li < layerCount; li++) {
      const data: number[][] = [];
      for (let y = 0; y < mapHeight; y++) {
        const row: number[] = [];
        for (let x = 0; x < mapWidth; x++) {
          row.push(grid.getTile(li, x, y));
        }
        data.push(row);
      }
      layers.push({
        name: li === 0 ? 'Ground' : li === 1 ? 'Objects' : `Layer ${li}`,
        data,
        visible: true,
        opacity: 1,
      });
    }

    const config: TilemapConfig = {
      gridType: 'orthogonal',
      tileWidth: 32,
      tileHeight: 32,
      mapWidth,
      mapHeight,
      layers,
    };

    setTilemapConfigRaw(config);
  }, []);

  const runScript = useCallback(async (code: string) => {
    // Intercept console.log from sandbox
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      if (msg.startsWith('[sandbox]')) {
        addLog(msg.replace('[sandbox] ', ''));
      }
      origLog(...args);
    };

    try {
      addLog('--- Script started ---');
      setScriptRunning(true);

      // Create new sandbox if needed
      if (sandboxRef.current) {
        sandboxRef.current.dispose();
      }

      // Get sim from viewport (registered on window) — only available in 3D mode
      const sim = (window as any).__problocks_sim;

      const { QuickJSRuntime } = await import('@problocks/engine/scripting/quickjs-runtime');
      const sandbox = new QuickJSRuntime();
      await sandbox.init({ maxFrameMs: 100, maxMemoryBytes: 10 * 1024 * 1024, maxApiCallsPerSec: 60 });

      if (sim) {
        // ── 3D mode: bind to SimulationLoop for physics ──
        simRef.current = sim;
        sandbox.bindSimulation(sim);
        sandboxRef.current = sandbox;

        await sandbox.loadSimulation(code);

        sim.onFrame((dt: number) => {
          if (sandboxRef.current) sandboxRef.current.callTick(dt);
        });

        sim.start();
        setIsPlaying(true);
        addLog('--- Script running (physics started) ---');
      } else {
        // ── Tilemap / 2D mode: lightweight sandbox with API extensions ──
        // No physics sim needed. Wire tilemap, procgen, nav, lighting, camera
        // APIs directly to engine instances, then sync tilemap changes to store.

        const { Grid, NavigationGrid } = await import('@problocks/engine');

        // Create engine instances for the script
        const mapWidth = 64;
        const mapHeight = 64;
        const layerCount = 3;
        const grid = new Grid(32, 32, 'orthogonal', layerCount);
        const navGrid = new NavigationGrid(mapWidth, mapHeight);

        // Bind API extensions (tilemap, procgen, nav, lighting, etc.)
        sandbox.bindExtensions({
          grid,
          navGrid,
          // camera, audio, lighting, etc. are optional — gracefully no-op
        });

        sandboxRef.current = sandbox;

        // Execute the student code (calls onStart)
        await sandbox.loadSimulation(code);

        // Sync Grid contents → store tilemapConfig (immediate update after onStart)
        syncGridToConfig(grid, mapWidth, mapHeight, layerCount);

        // Set up a lightweight tick loop for onTick (100ms ~ 10fps)
        // Slower than physics tick but sufficient for tilemap updates.
        tilemapTickRef.current = setInterval(() => {
          if (sandboxRef.current) {
            sandboxRef.current.callTick(0.1);
            // Re-sync tilemap after each tick in case it was modified
            syncGridToConfig(grid, mapWidth, mapHeight, layerCount);
          }
        }, 100);

        setIsPlaying(true);
        addLog('--- Script running (tilemap mode) ---');
      }
    } catch (err: any) {
      addLog(`[error] ${err.message}`);
      setScriptRunning(false);
    } finally {
      console.log = origLog;
    }
  }, [addLog, syncGridToConfig]);

  const stopScript = useCallback(() => {
    if (sandboxRef.current) {
      sandboxRef.current.dispose();
      sandboxRef.current = null;
    }
    if (tilemapTickRef.current) {
      clearInterval(tilemapTickRef.current);
      tilemapTickRef.current = null;
    }
    if (simRef.current) {
      simRef.current.stop();
      simRef.current.onFrame(() => {}); // clear tick callback
    }
    setScriptRunning(false);
    setIsPlaying(false);
    addLog('--- Script stopped ---');
  }, [addLog]);

  // ── Tilemap actions ──────────────────────────────────────────────────
  const setTilemapConfig = useCallback((config: TilemapConfig) => {
    setTilemapConfigRaw(config);
  }, []);

  const addTilemapLayer = useCallback((name: string) => {
    setTilemapConfigRaw(prev => {
      if (!prev) return prev;
      const rows = prev.mapHeight;
      const cols = prev.mapWidth;
      const emptyData = Array.from({ length: rows }, () => Array(cols).fill(0));
      return {
        ...prev,
        layers: [...prev.layers, { name, data: emptyData, visible: true, opacity: 1 }],
      };
    });
  }, []);

  const removeTilemapLayer = useCallback((index: number) => {
    setTilemapConfigRaw(prev => {
      if (!prev || prev.layers.length <= 1) return prev;
      return { ...prev, layers: prev.layers.filter((_, i) => i !== index) };
    });
    setActiveTilemapLayer(prev => Math.max(0, prev - 1));
  }, []);

  const toggleLayerVisibility = useCallback((index: number) => {
    setTilemapConfigRaw(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        layers: prev.layers.map((l, i) => i === index ? { ...l, visible: !l.visible } : l),
      };
    });
  }, []);

  const reorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    setTilemapConfigRaw(prev => {
      if (!prev) return prev;
      const layers = [...prev.layers];
      const [moved] = layers.splice(fromIndex, 1);
      layers.splice(toIndex, 0, moved);
      return { ...prev, layers };
    });
  }, []);

  const addLoadedTileset = useCallback((tileset: TilesetInfo) => {
    setLoadedTilesets(prev => [...prev, tileset]);
  }, []);

  // ── Asset browser actions ───────────────────────────────────────────
  const addAsset = useCallback((asset: AssetEntry) => {
    setAssets(prev => [...prev, asset]);
  }, []);

  const removeAsset = useCallback((id: string) => {
    setAssets(prev => prev.filter(a => a.metadata.id !== id));
    setSelectedAssetId(prev => prev === id ? null : prev);
  }, []);

  const setSelectedAsset = useCallback((id: string | null) => {
    setSelectedAssetId(id);
  }, []);

  const setAssetFilter = useCallback((filter: Partial<AssetFilter>) => {
    setAssetFilterRaw(prev => ({ ...prev, ...filter }));
  }, []);

  const value = {
    entities,
    selectedEntityId,
    isPlaying,
    consoleLogs,
    scriptRunning,
    marketplaceOpen,
    leftPanelCollapsed,
    leftPanelActiveGroup,
    leftPanelActiveTab,
    viewportMode,
    selectEntity,
    updateEntity,
    addEntity,
    removeEntity,
    setPlaying,
    toggleMarketplace,
    toggleLeftPanel,
    setLeftPanelGroup,
    setLeftPanelTab,
    setViewportMode,
    runScript,
    stopScript,
    addLog,
    clearLogs,
    resetScene,

    // Tilemap
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

    // Asset browser
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

    _simRef: simRef,
  };

  return (
    <StudioContext.Provider value={value}>
      {children}
    </StudioContext.Provider>
  );
}
