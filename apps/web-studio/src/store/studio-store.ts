import { createContext, useContext } from 'react';
import type { TilemapConfig, GridType } from '@problocks/engine';
import type { AssetEntry, AssetCategory } from '@problocks/engine';

/**
 * Minimal studio state — shared between Explorer, Viewport, Properties.
 */
export interface TerrainConfig {
  mode?: 'heightmap' | 'voxel';
  // Heightmap fields
  width: number;
  depth: number;
  subdivisions: number;
  maxHeight: number;
  seed: number;
  noiseScale: number;
  octaves: number;
  // Voxel fields
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  minZ?: number;
  maxZ?: number;
  biomes?: string[];
  biomeSize?: number;
  blending?: number;
  caves?: boolean;
}

export interface EntityData {
  id: string;
  name: string;
  type: 'entity' | 'light' | 'camera' | 'script' | 'terrain';
  shape?: 'box' | 'sphere' | 'cylinder' | 'plane';
  color?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  physics?: {
    mass: number;
    friction: number;
    restitution: number;
    isStatic: boolean;
  };
  dimensions?: { width: number; height: number; depth: number };
  terrain?: TerrainConfig;
}

export type LeftPanelTab = 'scene' | 'scripts' | 'assets' | 'insert' | 'settings' | 'terrain' | 'sculpt' | 'tilemap' | 'create';
export type LeftPanelGroup = 'scene' | 'scripts' | 'assets' | 'insert' | 'settings' | 'terrain' | 'sculpt' | 'tilemap' | 'create';

export type TilemapTool = 'paint' | 'erase' | 'fill' | 'rect' | 'eyedropper' | 'raise' | 'lower';
export type HexBrushShape = 'hex' | 'ring' | 'random';

export interface TilesetInfo {
  id: string;
  name: string;
  imageUrl: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
}

export interface HexPaletteTile {
  id: number;
  name: string;
  dataUrl: string;
}

export interface HexMapData {
  map: Record<string, number>;        // "q,r" → palette index
  rotMap: Record<string, number>;     // "q,r" → rotation in radians
  flipMap: Record<string, boolean>;   // "q,r" → flip
  heightMap: Record<string, number>;  // "q,r" → stack height
}

export interface AssetFilter {
  category: AssetCategory | 'all';
  search: string;
}

export type ViewportMode = '2d' | '3d' | 'tilemap' | 'rpg';

/** Game creation mode — locked once a project is created */
export type GameMode = '2d' | '3d' | 'hex' | 'isometric' | 'cubes';

/** Which left-panel tabs are available per game mode */
export const MODE_PANELS: Record<GameMode, LeftPanelGroup[]> = {
  '2d':        ['scene', 'scripts', 'assets', 'insert', 'create', 'settings'],
  '3d':        ['scene', 'scripts', 'assets', 'insert', 'sculpt', 'terrain', 'create', 'settings'],
  'hex':       ['tilemap', 'scripts', 'assets', 'create', 'settings'],
  'isometric': ['tilemap', 'scripts', 'assets', 'create', 'settings'],
  'cubes':     ['sculpt', 'scene', 'scripts', 'assets', 'insert', 'create', 'settings'],
};

export interface StudioState {
  /** null = mode selector shown, otherwise locked */
  gameMode: GameMode | null;
  entities: EntityData[];
  selectedEntityId: string | null;
  isPlaying: boolean;
  consoleLogs: string[];
  scriptRunning: boolean;
  scriptCode: string;
  marketplaceOpen: boolean;
  leftPanelCollapsed: boolean;
  leftPanelActiveGroup: LeftPanelGroup;
  leftPanelActiveTab: LeftPanelTab;
  viewportMode: ViewportMode;

  // Tilemap state
  tilemapConfig: TilemapConfig | null;
  activeTilemapLayer: number;
  activeTileId: number;
  activeTilemapTool: TilemapTool;
  loadedTilesets: TilesetInfo[];

  // Hex painter state
  hexBrushSize: number;
  hexBrushShape: HexBrushShape;
  hexShowGrid: boolean;
  hexShowCoords: boolean;
  hexClipToHex: boolean;
  hexTileZoom: number;
  hexRandomRotation: boolean;
  hexRandomFlip: boolean;
  hexRandomPalette: boolean;
  hexRandomBrushSize: boolean;
  hexYOffset: number;
  hexPalette: HexPaletteTile[];
  hexSelectedTile: number;
  hexMapData: HexMapData;

  // Asset browser state
  assets: AssetEntry[];
  selectedAssetId: string | null;
  assetFilter: AssetFilter;
  aiGeneratorOpen: boolean;
  projectStyle: string;
  selectedAITool: string | null;
}

export interface StudioActions {
  setGameMode: (mode: GameMode) => void;
  selectEntity: (id: string | null) => void;
  updateEntity: (id: string, partial: Partial<EntityData>) => void;
  addEntity: (entity: EntityData) => void;
  removeEntity: (id: string) => void;
  setPlaying: (playing: boolean) => void;
  toggleMarketplace: () => void;
  toggleLeftPanel: () => void;
  setLeftPanelGroup: (group: LeftPanelGroup) => void;
  setLeftPanelTab: (tab: LeftPanelTab) => void;
  setViewportMode: (mode: ViewportMode) => void;
  setScriptCode: (code: string) => void;
  runScript: (code: string) => void;
  stopScript: () => void;
  addLog: (msg: string) => void;
  clearLogs: () => void;
  resetScene: () => void;

  // Tilemap actions
  setTilemapConfig: (config: TilemapConfig) => void;
  setActiveTilemapLayer: (layer: number) => void;
  setActiveTileId: (tileId: number) => void;
  setActiveTilemapTool: (tool: TilemapTool) => void;
  addTilemapLayer: (name: string) => void;
  removeTilemapLayer: (index: number) => void;
  toggleLayerVisibility: (index: number) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  addLoadedTileset: (tileset: TilesetInfo) => void;

  // Hex painter actions
  setHexBrushSize: (size: number) => void;
  setHexBrushShape: (shape: HexBrushShape) => void;
  setHexShowGrid: (show: boolean) => void;
  setHexShowCoords: (show: boolean) => void;
  setHexClipToHex: (clip: boolean) => void;
  setHexTileZoom: (zoom: number) => void;
  setHexRandomRotation: (on: boolean) => void;
  setHexRandomFlip: (on: boolean) => void;
  setHexRandomPalette: (on: boolean) => void;
  setHexRandomBrushSize: (on: boolean) => void;
  setHexYOffset: (offset: number) => void;
  hexAddTile: (name: string, dataUrl: string) => void;
  hexRemoveTile: (index: number) => void;
  hexClearPalette: () => void;
  setHexSelectedTile: (index: number) => void;
  setHexMapData: (data: HexMapData) => void;
  hexUpdateMap: (updater: (data: HexMapData) => HexMapData) => void;

  // Asset browser actions
  addAsset: (asset: AssetEntry) => void;
  removeAsset: (id: string) => void;
  setSelectedAsset: (id: string | null) => void;
  setAssetFilter: (filter: Partial<AssetFilter>) => void;
  setAiGeneratorOpen: (open: boolean) => void;
  setProjectStyle: (style: string) => void;
  setSelectedAITool: (tool: string | null) => void;
}

export type StudioContextType = StudioState & StudioActions;

export const StudioContext = createContext<StudioContextType | null>(null);

export function useStudio(): StudioContextType {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within StudioProvider');
  return ctx;
}

/** Default scene entities */
export const DEFAULT_ENTITIES: EntityData[] = [
  {
    id: '__terrain',
    name: 'Terrain',
    type: 'terrain',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    terrain: {
      width: 100,
      depth: 100,
      subdivisions: 128,
      maxHeight: 10,
      seed: 42,
      noiseScale: 0.03,
      octaves: 6,
    },
  },
  {
    id: 'ground',
    name: 'Ground',
    type: 'entity',
    shape: 'plane',
    color: '#333340',
    position: { x: 0, y: -0.05, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    dimensions: { width: 50, height: 50, depth: 50 },
    physics: { mass: 0, friction: 0.5, restitution: 0.3, isStatic: true },
  },
  {
    id: 'ball',
    name: 'Ball',
    type: 'entity',
    shape: 'sphere',
    color: '#ff4444',
    position: { x: 0, y: 5, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    dimensions: { width: 1, height: 1, depth: 1 },
    physics: { mass: 1.0, friction: 0.5, restitution: 0.6, isStatic: false },
  },
  {
    id: 'ramp',
    name: 'Ramp',
    type: 'entity',
    shape: 'box',
    color: '#4488ff',
    position: { x: -2, y: 2, z: 0 },
    rotation: { x: 0, y: 0, z: 0.3 },
    scale: { x: 1, y: 1, z: 1 },
    dimensions: { width: 4, height: 0.2, depth: 2 },
    physics: { mass: 0, friction: 0.5, restitution: 0.3, isStatic: true },
  },
  {
    id: 'box1',
    name: 'Box 1',
    type: 'entity',
    shape: 'box',
    color: '#44ff44',
    position: { x: 3, y: 3, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    dimensions: { width: 1, height: 1, depth: 1 },
    physics: { mass: 1.0, friction: 0.5, restitution: 0.4, isStatic: false },
  },
  {
    id: 'cylinder1',
    name: 'Cylinder 1',
    type: 'entity',
    shape: 'cylinder',
    color: '#ff44ff',
    position: { x: -3, y: 6, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    dimensions: { width: 0.8, height: 1.5, depth: 0.8 },
    physics: { mass: 1.5, friction: 0.4, restitution: 0.5, isStatic: false },
  },
];
