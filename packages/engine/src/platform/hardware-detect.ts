/**
 * Hardware detection for device tier classification.
 *
 * Classifies devices as low/mid/high based on GPU, RAM, CPU cores,
 * and an optional canvas benchmark. Used for marketplace filtering.
 */

// ── Types ────────────────────────────────────────────────────────────

export type DeviceTier = 'low' | 'mid' | 'high';

export interface HardwareProfile {
  /** Detected device tier. */
  tier: DeviceTier;
  /** Device memory in GB (navigator.deviceMemory). */
  memoryGB: number;
  /** Logical CPU cores (navigator.hardwareConcurrency). */
  cpuCores: number;
  /** WebGL renderer string. */
  gpuRenderer: string;
  /** Whether GPU is considered low-end. */
  gpuIsLowEnd: boolean;
  /** Canvas benchmark score (higher = faster). 0 if not run. */
  benchmarkScore: number;
}

/** Game hardware requirements metadata. */
export interface GameHardwareReqs {
  /** Engine type. */
  engineType: '2d' | '3d';
  /** Maximum vertex count (3D games). */
  maxVertices?: number;
  /** Whether a low-poly mode is available. */
  hasLowPolyMode?: boolean;
  /** Minimum tier required. Auto-calculated if not set. */
  minTier?: DeviceTier;
}

// ── GPU classification ───────────────────────────────────────────────

/** Known low-end GPU renderer string patterns. */
const LOW_END_GPU_PATTERNS = [
  /intel.*hd/i,
  /intel.*uhd/i,
  /intel.*iris/i,
  /mali-[gt][0-9]/i,
  /adreno.*[0-3][0-9]{2}/i,
  /powervr/i,
  /sgx/i,
  /vivante/i,
  /videocore/i,
  /llvmpipe/i,
  /swiftshader/i,
  /mesa/i,
];

function isLowEndGPU(renderer: string): boolean {
  return LOW_END_GPU_PATTERNS.some((p) => p.test(renderer));
}

// ── WebGL renderer detection ─────────────────────────────────────────

function getGPURenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return 'unknown';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? 'unknown';
    }
    return gl.getParameter(gl.RENDERER) ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// ── Canvas benchmark ─────────────────────────────────────────────────

/**
 * Quick canvas draw benchmark. Returns approximate draw ops per 16ms frame.
 * Higher = faster GPU. Returns 0 if benchmark cannot run.
 */
function runCanvasBenchmark(): number {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const start = performance.now();
    let ops = 0;

    // Draw for ~16ms (one frame budget)
    while (performance.now() - start < 16) {
      ctx.fillStyle = `hsl(${ops % 360}, 50%, 50%)`;
      ctx.fillRect(
        (ops * 7) % 240,
        (ops * 11) % 240,
        16,
        16,
      );
      ops++;
    }

    return ops;
  } catch {
    return 0;
  }
}

// ── Tier classification ──────────────────────────────────────────────

function classifyTier(
  memoryGB: number,
  cpuCores: number,
  gpuIsLowEnd: boolean,
  benchmarkScore: number,
): DeviceTier {
  // Low: <=4GB RAM, <=4 cores, weak GPU
  if (memoryGB <= 4 && cpuCores <= 4 && gpuIsLowEnd) return 'low';

  // High: >=8GB RAM, >=8 cores, capable GPU, fast benchmark
  if (memoryGB >= 8 && cpuCores >= 8 && !gpuIsLowEnd && benchmarkScore > 500) return 'high';

  // If any single indicator is very strong/weak, adjust
  if (gpuIsLowEnd && memoryGB <= 4) return 'low';
  if (!gpuIsLowEnd && memoryGB >= 8) return 'high';

  return 'mid';
}

// ── Public API ───────────────────────────────────────────────────────

/** Detect hardware capabilities and classify device tier. */
export function detectHardware(): HardwareProfile {
  const memoryGB = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const cpuCores = navigator.hardwareConcurrency ?? 4;
  const gpuRenderer = getGPURenderer();
  const gpuIsLowEnd = isLowEndGPU(gpuRenderer);
  const benchmarkScore = runCanvasBenchmark();

  const tier = classifyTier(memoryGB, cpuCores, gpuIsLowEnd, benchmarkScore);

  return { tier, memoryGB, cpuCores, gpuRenderer, gpuIsLowEnd, benchmarkScore };
}

/**
 * Determine the minimum tier required for a game based on its hardware reqs.
 */
export function getGameMinTier(reqs: GameHardwareReqs): DeviceTier {
  if (reqs.minTier) return reqs.minTier;

  // 2D games always run on low-end devices
  if (reqs.engineType === '2d') return 'low';

  // 3D with low-poly mode and reasonable vertex count
  if (reqs.hasLowPolyMode && (reqs.maxVertices ?? Infinity) <= 100_000) return 'low';

  // 3D without low-poly mode
  if ((reqs.maxVertices ?? Infinity) <= 50_000) return 'mid';

  return 'high';
}

/**
 * Check whether a game can run on the detected device.
 */
export function canRunGame(profile: HardwareProfile, reqs: GameHardwareReqs): boolean {
  const tiers: Record<DeviceTier, number> = { low: 0, mid: 1, high: 2 };
  const minTier = getGameMinTier(reqs);
  return tiers[profile.tier] >= tiers[minTier];
}
