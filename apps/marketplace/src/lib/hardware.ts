/**
 * Client-side hardware detection for marketplace filtering.
 *
 * Runs once on load and caches the result in sessionStorage.
 * Used to filter out games that are too heavy for the current device.
 */

export type DeviceTier = 'low' | 'mid' | 'high';

export interface HardwareProfile {
  tier: DeviceTier;
  memoryGB: number;
  cpuCores: number;
  gpuRenderer: string;
  gpuIsLowEnd: boolean;
}

// Known low-end GPU patterns
const LOW_END_GPU = [
  /intel.*hd/i, /intel.*uhd/i, /intel.*iris/i,
  /mali-[gt][0-9]/i, /adreno.*[0-3][0-9]{2}/i,
  /powervr/i, /sgx/i, /vivante/i, /videocore/i,
  /llvmpipe/i, /swiftshader/i, /mesa/i,
];

function getGPURenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return 'unknown';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? 'unknown';
    return gl.getParameter(gl.RENDERER) ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function detectTier(mem: number, cores: number, lowGpu: boolean): DeviceTier {
  if (mem <= 4 && cores <= 4 && lowGpu) return 'low';
  if (mem >= 8 && cores >= 8 && !lowGpu) return 'high';
  if (lowGpu && mem <= 4) return 'low';
  if (!lowGpu && mem >= 8) return 'high';
  return 'mid';
}

const CACHE_KEY = 'pb_hw_profile';

export function getHardwareProfile(): HardwareProfile {
  // Check cache
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* fallthrough */ }
  }

  const memoryGB = (navigator as any).deviceMemory ?? 4;
  const cpuCores = navigator.hardwareConcurrency ?? 4;
  const gpuRenderer = getGPURenderer();
  const gpuIsLowEnd = LOW_END_GPU.some((p) => p.test(gpuRenderer));
  const tier = detectTier(memoryGB, cpuCores, gpuIsLowEnd);

  const profile: HardwareProfile = { tier, memoryGB, cpuCores, gpuRenderer, gpuIsLowEnd };
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(profile));
  return profile;
}
