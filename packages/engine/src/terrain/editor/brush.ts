/**
 * Section 4.1 -- Brush Core
 *
 * Brush shape definitions, configuration, and voxel iteration.
 * The brush iterates over all voxels within its volume and yields
 * each with a falloff value (0..1) for smooth edges.
 */

import { VOXEL_SIZE } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";

// ── Shape enum ─────────────────────────────────────────────────────

export type BrushShape = "sphere" | "box" | "cylinder";

// ── Pivot enum ─────────────────────────────────────────────────────

export type BrushPivot = "bottom" | "center" | "top";

// ── Brush configuration ────────────────────────────────────────────

export interface BrushConfig {
  shape: BrushShape;
  /** Brush diameter in world units (4–256). Radius = size / 2. */
  size: number;
  /** Height override for box/cylinder in world units. Defaults to size. */
  height: number;
  /** Edit strength 0.1–1.0 */
  strength: number;
  /** Material to apply when drawing / painting */
  material: TerrainMaterial;
  /** Where the brush anchors relative to the hit point */
  pivot: BrushPivot;
  /** Snap brush center to voxel grid */
  snapToVoxel: boolean;
}

// ── Yielded voxel from brush iteration ─────────────────────────────

export interface BrushVoxel {
  /** World-space X (snapped to voxel grid) */
  wx: number;
  /** World-space Y */
  wy: number;
  /** World-space Z */
  wz: number;
  /** 0..1 falloff — 1 at center, 0 at edge */
  falloff: number;
}

// ── Default config ─────────────────────────────────────────────────

export function defaultBrushConfig(): BrushConfig {
  return {
    shape: "sphere",
    size: 32,
    height: 32,
    strength: 0.5,
    material: TerrainMaterial.Grass,
    pivot: "center",
    snapToVoxel: false,
  };
}

// ── Pivot offset ───────────────────────────────────────────────────

function pivotOffsetY(config: BrushConfig): number {
  const halfH = (config.shape === "sphere" ? config.size : config.height) / 2;
  switch (config.pivot) {
    case "bottom":
      return halfH;
    case "top":
      return -halfH;
    case "center":
    default:
      return 0;
  }
}

// ── Snap helper ────────────────────────────────────────────────────

function snap(v: number): number {
  return Math.floor(v / VOXEL_SIZE) * VOXEL_SIZE;
}

// ── Main iteration ─────────────────────────────────────────────────

/**
 * Iterate all voxel positions inside the brush volume.
 * Each yielded entry includes a `falloff` (1 at center, 0 at edge)
 * that brush operations use to modulate their effect.
 */
export function* iterateBrushVoxels(
  center: { x: number; y: number; z: number },
  config: BrushConfig,
): Generator<BrushVoxel> {
  const cx = config.snapToVoxel ? snap(center.x) + VOXEL_SIZE / 2 : center.x;
  const cy = config.snapToVoxel ? snap(center.y) + VOXEL_SIZE / 2 : center.y;
  const cz = config.snapToVoxel ? snap(center.z) + VOXEL_SIZE / 2 : center.z;

  const oy = pivotOffsetY(config);

  const radius = config.size / 2;
  const halfH = (config.shape === "sphere" ? config.size : config.height) / 2;

  // Bounding box in world units, snapped to voxel grid
  const minX = snap(cx - radius);
  const maxX = snap(cx + radius);
  const minY = snap(cy + oy - halfH);
  const maxY = snap(cy + oy + halfH);
  const minZ = snap(cz - radius);
  const maxZ = snap(cz + radius);

  for (let wz = minZ; wz <= maxZ; wz += VOXEL_SIZE) {
    for (let wy = minY; wy <= maxY; wy += VOXEL_SIZE) {
      for (let wx = minX; wx <= maxX; wx += VOXEL_SIZE) {
        const falloff = computeFalloff(
          wx + VOXEL_SIZE / 2,
          wy + VOXEL_SIZE / 2,
          wz + VOXEL_SIZE / 2,
          cx,
          cy + oy,
          cz,
          radius,
          halfH,
          config.shape,
        );
        if (falloff > 0) {
          yield { wx, wy, wz, falloff };
        }
      }
    }
  }
}

// ── Falloff computation per shape ──────────────────────────────────

function computeFalloff(
  px: number,
  py: number,
  pz: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  halfH: number,
  shape: BrushShape,
): number {
  switch (shape) {
    case "sphere": {
      const dx = px - cx;
      const dy = py - cy;
      const dz = pz - cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist >= radius) return 0;
      // Smooth hermite falloff
      const t = dist / radius;
      return 1 - t * t * (3 - 2 * t);
    }

    case "box": {
      const dx = Math.abs(px - cx);
      const dy = Math.abs(py - cy);
      const dz = Math.abs(pz - cz);
      if (dx >= radius || dy >= halfH || dz >= radius) return 0;
      // Uniform falloff inside box — 1.0 everywhere
      return 1;
    }

    case "cylinder": {
      const dx = px - cx;
      const dz = pz - cz;
      const distXZ = Math.sqrt(dx * dx + dz * dz);
      const dy = Math.abs(py - cy);
      if (distXZ >= radius || dy >= halfH) return 0;
      // Radial falloff only
      const t = distXZ / radius;
      return 1 - t * t * (3 - 2 * t);
    }
  }
}
