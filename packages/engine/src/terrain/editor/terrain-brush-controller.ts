/**
 * Section 4.4 + 4.7 -- Terrain Brush Controller
 *
 * Stateful controller that connects brush tools, undo stack, and
 * brush cursor to pointer events. Used by the Viewport or any
 * framework integration to drive terrain editing.
 */

import { type VoxelGrid } from "../voxel/voxel-grid.js";
import { type ChunkManager } from "../voxel/chunk-manager.js";
import { CHUNK_WORLD_SIZE } from "../voxel/constants.js";
import { type TerrainMaterial } from "../voxel/terrain-materials.js";
import {
  type BrushConfig,
  type BrushShape,
  type BrushPivot,
  defaultBrushConfig,
  iterateBrushVoxels,
} from "./brush.js";
import {
  applyDraw,
  applySculpt,
  applySmooth,
  applyFlatten,
  applyPaint,
  type FlattenMode,
} from "./brush-operations.js";
import { TerrainUndoStack } from "./undo-stack.js";

// ── Tool types ─────────────────────────────────────────────────────

export type BrushToolType = "draw" | "sculpt" | "smooth" | "flatten" | "paint";

export interface BrushControllerConfig {
  tool: BrushToolType;
  shape: BrushShape;
  size: number;
  height: number;
  strength: number;
  material: TerrainMaterial;
  drawMode: "add" | "subtract";
  flattenMode: FlattenMode;
  paintMode: "paint" | "replace";
  sourceMaterial?: TerrainMaterial;
  targetMaterial?: TerrainMaterial;
  pivot: BrushPivot;
  snapToVoxel: boolean;
}

// ── Controller ─────────────────────────────────────────────────────

export class TerrainBrushController {
  private grid: VoxelGrid;
  private chunkManager: ChunkManager;
  readonly undoStack: TerrainUndoStack;

  /** Brush application throttle (ms) */
  applyIntervalMs = 50;

  /** Is the user currently dragging (painting)? */
  private _isDragging = false;
  private lastApplyTime = 0;
  private flattenPlaneY: number | null = null;

  config: BrushControllerConfig;

  constructor(grid: VoxelGrid, chunkManager: ChunkManager) {
    this.grid = grid;
    this.chunkManager = chunkManager;
    this.undoStack = new TerrainUndoStack();

    const defaults = defaultBrushConfig();
    this.config = {
      tool: "draw",
      shape: defaults.shape,
      size: defaults.size,
      height: defaults.height,
      strength: defaults.strength,
      material: defaults.material,
      drawMode: "add",
      flattenMode: "both",
      paintMode: "paint",
      pivot: defaults.pivot,
      snapToVoxel: defaults.snapToVoxel,
    };
  }

  get isDragging(): boolean {
    return this._isDragging;
  }

  // ── Pointer events ─────────────────────────────────────────────

  /**
   * Call on pointer down. Begins an undo entry and applies the
   * brush at the hit point.
   */
  pointerDown(hitPoint: { x: number; y: number; z: number }, ctrlHeld: boolean, shiftHeld: boolean): void {
    this._isDragging = true;
    this.lastApplyTime = 0;

    // Flatten: lock the plane Y on first click
    if (this.config.tool === "flatten") {
      this.flattenPlaneY = hitPoint.y;
    }

    // Determine affected chunk keys for undo snapshot
    const chunkKeys = this.collectAffectedChunkKeys(hitPoint);
    const label = this.getEditLabel(ctrlHeld, shiftHeld);
    this.undoStack.beginEdit(label, chunkKeys, this.grid);

    this.applyBrush(hitPoint, ctrlHeld, shiftHeld);
  }

  /**
   * Call on pointer move while dragging.
   * Applies the brush debounced to `applyIntervalMs`.
   */
  pointerMove(hitPoint: { x: number; y: number; z: number }, ctrlHeld: boolean, shiftHeld: boolean): void {
    if (!this._isDragging) return;

    const now = performance.now();
    if (now - this.lastApplyTime < this.applyIntervalMs) return;
    this.lastApplyTime = now;

    this.applyBrush(hitPoint, ctrlHeld, shiftHeld);
  }

  /**
   * Call on pointer up. Ends the undo entry.
   */
  pointerUp(): void {
    if (!this._isDragging) return;
    this._isDragging = false;
    this.flattenPlaneY = null;
    this.undoStack.endEdit(this.grid);
  }

  // ── Undo/Redo ──────────────────────────────────────────────────

  undo(): boolean {
    return this.undoStack.undo(this.grid);
  }

  redo(): boolean {
    return this.undoStack.redo(this.grid);
  }

  // ── Internal brush application ─────────────────────────────────

  private applyBrush(
    center: { x: number; y: number; z: number },
    ctrlHeld: boolean,
    shiftHeld: boolean,
  ): void {
    const cfg = this.buildBrushConfig();

    // Ctrl toggles subtract mode, Shift toggles smooth
    const effectiveTool = shiftHeld ? "smooth" : this.config.tool;
    const effectiveDrawMode = ctrlHeld ? "subtract" : this.config.drawMode;

    switch (effectiveTool) {
      case "draw":
        applyDraw(this.grid, center, cfg, effectiveDrawMode);
        break;
      case "sculpt":
        applySculpt(this.grid, center, cfg, effectiveDrawMode);
        break;
      case "smooth":
        applySmooth(this.grid, center, cfg);
        break;
      case "flatten":
        applyFlatten(
          this.grid,
          center,
          cfg,
          this.config.flattenMode,
          this.flattenPlaneY ?? center.y,
        );
        break;
      case "paint":
        applyPaint(
          this.grid,
          center,
          cfg,
          this.config.paintMode,
          this.config.sourceMaterial,
          this.config.targetMaterial,
        );
        break;
    }
  }

  private buildBrushConfig(): BrushConfig {
    return {
      shape: this.config.shape,
      size: this.config.size,
      height: this.config.height,
      strength: this.config.strength,
      material: this.config.material,
      pivot: this.config.pivot,
      snapToVoxel: this.config.snapToVoxel,
    };
  }

  /**
   * Collect the chunk keys that the brush volume touches.
   * Used to snapshot for undo.
   */
  private collectAffectedChunkKeys(
    center: { x: number; y: number; z: number },
  ): string[] {
    const keys = new Set<string>();
    const cfg = this.buildBrushConfig();
    for (const v of iterateBrushVoxels(center, cfg)) {
      const { cx, cy, cz } = this.grid.worldToChunk(v.wx, v.wy, v.wz);
      keys.add(`${cx},${cy},${cz}`);
    }
    return Array.from(keys);
  }

  private getEditLabel(ctrlHeld: boolean, shiftHeld: boolean): string {
    if (shiftHeld) return "Smooth";
    const tool = this.config.tool.charAt(0).toUpperCase() + this.config.tool.slice(1);
    if (ctrlHeld && (this.config.tool === "draw" || this.config.tool === "sculpt")) {
      return `${tool} (Subtract)`;
    }
    return tool;
  }
}
