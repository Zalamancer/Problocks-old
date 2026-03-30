import { createContext, useContext } from 'react';

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

export type LeftPanelTab = 'scene' | 'scripts' | 'assets' | 'insert' | 'settings' | 'terrain' | 'sculpt';
export type LeftPanelGroup = 'scene' | 'scripts' | 'assets' | 'insert' | 'settings' | 'terrain' | 'sculpt';

export interface StudioState {
  entities: EntityData[];
  selectedEntityId: string | null;
  isPlaying: boolean;
  consoleLogs: string[];
  scriptRunning: boolean;
  marketplaceOpen: boolean;
  leftPanelCollapsed: boolean;
  leftPanelActiveGroup: LeftPanelGroup;
  leftPanelActiveTab: LeftPanelTab;
}

export interface StudioActions {
  selectEntity: (id: string | null) => void;
  updateEntity: (id: string, partial: Partial<EntityData>) => void;
  addEntity: (entity: EntityData) => void;
  removeEntity: (id: string) => void;
  setPlaying: (playing: boolean) => void;
  toggleMarketplace: () => void;
  toggleLeftPanel: () => void;
  setLeftPanelGroup: (group: LeftPanelGroup) => void;
  setLeftPanelTab: (tab: LeftPanelTab) => void;
  runScript: (code: string) => void;
  stopScript: () => void;
  addLog: (msg: string) => void;
  clearLogs: () => void;
  resetScene: () => void;
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
