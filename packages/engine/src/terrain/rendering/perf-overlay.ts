/**
 * Section 10.5 -- Terrain Performance Tracking & Budgets
 *
 * Tracks per-frame mesh/collider/render times, recommends mesh budget
 * adjustments, and exposes stats for a dev-mode performance overlay.
 */

// ── Stats snapshot ────────────────────────────────────────────────────

export interface TerrainPerfStats {
  /** Mesh time for the most recent frame (ms). */
  meshTimeMs: number;
  /** Rolling average mesh time over the sample window (ms). */
  avgMeshTimeMs: number;
  /** Collider rebuild time for the most recent frame (ms). */
  colliderTimeMs: number;
  /** Number of chunks currently loaded (with meshes). */
  chunksLoaded: number;
  /** Total triangle count across all loaded chunk meshes. */
  totalTriangles: number;
  /** Current recommended mesh budget per frame. */
  meshBudget: number;
  /** Current LOD breakdown: [Full, Half, Quarter, Eighth] counts. */
  lodCounts: [number, number, number, number];
}

// ── Perf Tracker ──────────────────────────────────────────────────────

export class TerrainPerfTracker {
  /** Target frame budget for mesh operations (ms). */
  targetFrameMs = 12;

  /** Current recommended mesh budget (chunks per frame). */
  meshBudgetRecommendation = 4;

  // ── Live counters (set externally by ChunkManager) ────────────────

  meshTimeMs = 0;
  colliderTimeMs = 0;
  chunksLoaded = 0;
  totalTriangles = 0;
  lodCounts: [number, number, number, number] = [0, 0, 0, 0];

  // ── Rolling average ───────────────────────────────────────────────

  private meshTimeSamples: number[] = [];
  private readonly SAMPLE_WINDOW = 30;

  /**
   * Record a mesh frame. Call once per ChunkManager.update().
   * @param timeMs  Total mesh time this frame
   * @param budget  Current mesh budget used for this frame
   */
  recordMeshFrame(timeMs: number, budget: number): void {
    this.meshTimeMs = timeMs;

    this.meshTimeSamples.push(timeMs);
    if (this.meshTimeSamples.length > this.SAMPLE_WINDOW) {
      this.meshTimeSamples.shift();
    }

    this.updateBudgetRecommendation(budget);
  }

  /** Record collider rebuild time for this frame (ms). */
  recordColliderFrame(timeMs: number): void {
    this.colliderTimeMs = timeMs;
  }

  /** Get a snapshot of all performance stats. */
  getStats(): TerrainPerfStats {
    return {
      meshTimeMs: this.meshTimeMs,
      avgMeshTimeMs: this.getAvgMeshTime(),
      colliderTimeMs: this.colliderTimeMs,
      chunksLoaded: this.chunksLoaded,
      totalTriangles: this.totalTriangles,
      meshBudget: this.meshBudgetRecommendation,
      lodCounts: [...this.lodCounts] as [number, number, number, number],
    };
  }

  /** Reset all counters and samples. */
  reset(): void {
    this.meshTimeSamples.length = 0;
    this.meshTimeMs = 0;
    this.colliderTimeMs = 0;
    this.chunksLoaded = 0;
    this.totalTriangles = 0;
    this.lodCounts = [0, 0, 0, 0];
    this.meshBudgetRecommendation = 4;
  }

  // ── Private ─────────────────────────────────────────────────────────

  private getAvgMeshTime(): number {
    if (this.meshTimeSamples.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.meshTimeSamples.length; i++) {
      sum += this.meshTimeSamples[i];
    }
    return sum / this.meshTimeSamples.length;
  }

  /**
   * Auto-adjust mesh budget: decrease if average frame time exceeds
   * target, increase if well under target (hysteresis at 50%).
   */
  private updateBudgetRecommendation(currentBudget: number): void {
    if (this.meshTimeSamples.length < 5) return;

    const avg = this.getAvgMeshTime();

    if (avg > this.targetFrameMs) {
      // Over budget — reduce
      this.meshBudgetRecommendation = Math.max(1, currentBudget - 1);
    } else if (avg < this.targetFrameMs * 0.4) {
      // Well under budget — try increasing
      this.meshBudgetRecommendation = Math.min(8, currentBudget + 1);
    } else {
      // Within acceptable range — keep current
      this.meshBudgetRecommendation = currentBudget;
    }
  }
}
