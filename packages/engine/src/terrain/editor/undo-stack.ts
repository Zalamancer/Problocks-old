/**
 * Section 4.6 -- Terrain Undo/Redo Stack
 *
 * Snapshots chunk data before and after each brush edit.
 * Ctrl+Z undoes, Ctrl+Shift+Z redoes. Max 50 entries.
 */

import { CHUNK_VOLUME } from "../voxel/constants.js";
import { type VoxelGrid } from "../voxel/voxel-grid.js";

// ── Snapshot of a single chunk's data ──────────────────────────────

interface ChunkSnapshot {
  occupancy: Float32Array;
  materials: Uint8Array;
}

function takeSnapshot(grid: VoxelGrid, chunkKey: string): ChunkSnapshot | null {
  const [cxs, cys, czs] = chunkKey.split(",");
  const cx = Number(cxs);
  const cy = Number(cys);
  const cz = Number(czs);
  const chunk = grid.getChunk(cx, cy, cz);
  if (!chunk) {
    // Chunk doesn't exist yet — snapshot as empty
    return {
      occupancy: new Float32Array(CHUNK_VOLUME),
      materials: new Uint8Array(CHUNK_VOLUME),
    };
  }
  return {
    occupancy: new Float32Array(chunk.data.occupancy),
    materials: new Uint8Array(chunk.data.materials),
  };
}

function restoreSnapshot(grid: VoxelGrid, chunkKey: string, snapshot: ChunkSnapshot): void {
  const [cxs, cys, czs] = chunkKey.split(",");
  const cx = Number(cxs);
  const cy = Number(cys);
  const cz = Number(czs);
  const chunk = grid.getOrCreateChunk(cx, cy, cz);
  chunk.data.occupancy.set(snapshot.occupancy);
  chunk.data.materials.set(snapshot.materials);
  chunk.dirty = true;
}

// ── Undo entry ─────────────────────────────────────────────────────

export interface TerrainUndoEntry {
  label: string;
  before: Map<string, ChunkSnapshot>;
  after: Map<string, ChunkSnapshot>;
}

// ── Undo Stack ─────────────────────────────────────────────────────

const MAX_UNDO_ENTRIES = 50;

export class TerrainUndoStack {
  private undoStack: TerrainUndoEntry[] = [];
  private redoStack: TerrainUndoEntry[] = [];

  /** Transient state while an edit is in progress */
  private pendingLabel: string | null = null;
  private pendingBefore: Map<string, ChunkSnapshot> | null = null;
  private pendingChunkKeys: string[] = [];

  // ── Edit lifecycle ─────────────────────────────────────────────

  /**
   * Call before applying a brush operation.
   * Snapshots the "before" state of affected chunks.
   */
  beginEdit(label: string, affectedChunkKeys: string[], grid: VoxelGrid): void {
    this.pendingLabel = label;
    this.pendingChunkKeys = affectedChunkKeys;
    this.pendingBefore = new Map();
    for (const key of affectedChunkKeys) {
      const snap = takeSnapshot(grid, key);
      if (snap) {
        this.pendingBefore.set(key, snap);
      }
    }
  }

  /**
   * Call after applying a brush operation.
   * Snapshots the "after" state and pushes to undo stack.
   */
  endEdit(grid: VoxelGrid): void {
    if (!this.pendingBefore || !this.pendingLabel) return;

    const after = new Map<string, ChunkSnapshot>();
    for (const key of this.pendingChunkKeys) {
      const snap = takeSnapshot(grid, key);
      if (snap) {
        after.set(key, snap);
      }
    }

    const entry: TerrainUndoEntry = {
      label: this.pendingLabel,
      before: this.pendingBefore,
      after,
    };

    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_UNDO_ENTRIES) {
      this.undoStack.shift();
    }

    // Any new edit clears the redo stack
    this.redoStack.length = 0;

    // Clear pending state
    this.pendingLabel = null;
    this.pendingBefore = null;
    this.pendingChunkKeys = [];
  }

  // ── Undo / Redo ────────────────────────────────────────────────

  /** Undo the last edit. Returns true if an entry was undone. */
  undo(grid: VoxelGrid): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;

    for (const [key, snapshot] of entry.before) {
      restoreSnapshot(grid, key, snapshot);
    }

    this.redoStack.push(entry);
    return true;
  }

  /** Redo the last undone edit. Returns true if an entry was redone. */
  redo(grid: VoxelGrid): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;

    for (const [key, snapshot] of entry.after) {
      restoreSnapshot(grid, key, snapshot);
    }

    this.undoStack.push(entry);
    return true;
  }

  // ── Query ──────────────────────────────────────────────────────

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  /** Clear all undo/redo history. */
  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.pendingLabel = null;
    this.pendingBefore = null;
    this.pendingChunkKeys = [];
  }
}
