/**
 * TerrainEditorContext
 *
 * Thin coordination layer between Viewport (pointer events, BrushCursor)
 * and TerrainEditorPanel (brush config, active state).
 *
 * The Viewport creates and registers the BrushController + BrushCursor
 * once voxel terrain exists. The EditTab sets brushActive and syncs config.
 */

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import type { TerrainBrushController } from '@problocks/engine';
import type { BrushCursor } from '@problocks/engine';
import type { ChunkManager } from '@problocks/engine';

// ── Context value ─────────────────────────────────────────────────

export interface TerrainEditorContextValue {
  /** True when Edit tab is active with a brush tool selected */
  brushActive: boolean;
  setBrushActive: (v: boolean) => void;

  /** Set by Viewport once voxel terrain is created */
  brushController: TerrainBrushController | null;
  brushCursor: BrushCursor | null;
  chunkManager: ChunkManager | null;

  /** Called by Viewport to register engine objects */
  registerBrush: (ctrl: TerrainBrushController, cursor: BrushCursor, cm: ChunkManager) => void;
  unregisterBrush: () => void;

  /** Undo/redo state for UI */
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  undo: () => void;
  redo: () => void;
  refreshUndoState: () => void;
}

const TerrainEditorCtx = createContext<TerrainEditorContextValue | null>(null);

export function useTerrainEditor(): TerrainEditorContextValue {
  const ctx = useContext(TerrainEditorCtx);
  if (!ctx) throw new Error('useTerrainEditor must be used within TerrainEditorProvider');
  return ctx;
}

/** Optional — returns null if not inside provider (used by Viewport which mounts before provider might) */
export function useTerrainEditorOptional(): TerrainEditorContextValue | null {
  return useContext(TerrainEditorCtx);
}

// ── Provider ──────────────────────────────────────────────────────

export function TerrainEditorProvider({ children }: { children: React.ReactNode }) {
  const [brushActive, setBrushActive] = useState(false);
  const [brushController, setBrushController] = useState<TerrainBrushController | null>(null);
  const [brushCursor, setBrushCursor] = useState<BrushCursor | null>(null);
  const [chunkManager, setChunkManager] = useState<ChunkManager | null>(null);
  const [undoState, setUndoState] = useState({ canUndo: false, canRedo: false, undoCount: 0, redoCount: 0 });

  const ctrlRef = useRef<TerrainBrushController | null>(null);
  const cmRef = useRef<ChunkManager | null>(null);

  const registerBrush = useCallback((ctrl: TerrainBrushController, cursor: BrushCursor, cm: ChunkManager) => {
    ctrlRef.current = ctrl;
    cmRef.current = cm;
    setBrushController(ctrl);
    setBrushCursor(cursor);
    setChunkManager(cm);
  }, []);

  const unregisterBrush = useCallback(() => {
    ctrlRef.current = null;
    cmRef.current = null;
    setBrushController(null);
    setBrushCursor(null);
    setChunkManager(null);
    setBrushActive(false);
    setUndoState({ canUndo: false, canRedo: false, undoCount: 0, redoCount: 0 });
  }, []);

  const refreshUndoState = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    setUndoState({
      canUndo: ctrl.undoStack.canUndo,
      canRedo: ctrl.undoStack.canRedo,
      undoCount: ctrl.undoStack.undoCount,
      redoCount: ctrl.undoStack.redoCount,
    });
  }, []);

  const undo = useCallback(() => {
    const ctrl = ctrlRef.current;
    const cm = cmRef.current;
    if (!ctrl || !cm) return;
    ctrl.undo();
    cm.forceRemeshAll();
    refreshUndoState();
  }, [refreshUndoState]);

  const redo = useCallback(() => {
    const ctrl = ctrlRef.current;
    const cm = cmRef.current;
    if (!ctrl || !cm) return;
    ctrl.redo();
    cm.forceRemeshAll();
    refreshUndoState();
  }, [refreshUndoState]);

  const value = useMemo<TerrainEditorContextValue>(() => ({
    brushActive,
    setBrushActive,
    brushController,
    brushCursor,
    chunkManager,
    registerBrush,
    unregisterBrush,
    ...undoState,
    undo,
    redo,
    refreshUndoState,
  }), [brushActive, brushController, brushCursor, chunkManager, registerBrush, unregisterBrush, undoState, undo, redo, refreshUndoState]);

  return (
    <TerrainEditorCtx.Provider value={value}>
      {children}
    </TerrainEditorCtx.Provider>
  );
}
