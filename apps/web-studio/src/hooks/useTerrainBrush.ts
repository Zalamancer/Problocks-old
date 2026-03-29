/**
 * Section 4.4 + 4.7 -- useTerrainBrush React hook
 *
 * Wires keyboard shortcuts and pointer events for terrain brush editing.
 * Integrates with the Viewport's canvas element.
 *
 * Keyboard shortcuts:
 *   B + scroll → adjust brush size
 *   Ctrl+B + scroll → adjust brush height
 *   Shift+B + scroll → adjust brush strength
 *   Ctrl+Z → undo
 *   Ctrl+Shift+Z → redo
 *   Alt + click → eyedropper (pick material under cursor)
 */

import { useEffect, useRef, useCallback } from 'react';

// ── Types matching the engine brush controller ─────────────────────

export interface TerrainBrushHookConfig {
  /** Whether the terrain editor mode is active */
  active: boolean;
  /** Current brush size in world units */
  size: number;
  /** Current brush height */
  height: number;
  /** Current brush strength */
  strength: number;

  onSizeChange: (size: number) => void;
  onHeightChange: (height: number) => void;
  onStrengthChange: (strength: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onEyedropper: () => void;
}

/**
 * Attaches keyboard listeners for terrain brush shortcuts.
 * Returns a ref that tracks whether the "B" key is currently held.
 */
export function useTerrainBrush(config: TerrainBrushHookConfig) {
  const bHeldRef = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!config.active) return;

    function handleKeyDown(e: KeyboardEvent) {
      const cfg = configRef.current;

      // B key held for brush size adjustment mode
      if (e.key === 'b' || e.key === 'B') {
        bHeldRef.current = true;
        return;
      }

      // Ctrl+Z / Ctrl+Shift+Z for undo/redo
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          cfg.onRedo();
        } else {
          cfg.onUndo();
        }
        return;
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'b' || e.key === 'B') {
        bHeldRef.current = false;
      }
    }

    function handleWheel(e: WheelEvent) {
      if (!bHeldRef.current) return;
      const cfg = configRef.current;

      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY > 0 ? -4 : 4;

      if (e.ctrlKey || e.metaKey) {
        // Ctrl+B + scroll → height
        const next = Math.max(4, Math.min(256, cfg.height + delta));
        cfg.onHeightChange(next);
      } else if (e.shiftKey) {
        // Shift+B + scroll → strength
        const sDelta = e.deltaY > 0 ? -0.05 : 0.05;
        const next = Math.max(0.1, Math.min(1.0, cfg.strength + sDelta));
        cfg.onStrengthChange(parseFloat(next.toFixed(2)));
      } else {
        // B + scroll → size
        const next = Math.max(4, Math.min(256, cfg.size + delta));
        cfg.onSizeChange(next);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
      bHeldRef.current = false;
    };
  }, [config.active]);

  return { bHeldRef };
}
