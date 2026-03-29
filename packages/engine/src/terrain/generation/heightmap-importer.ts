/**
 * Section 5.1–5.4 -- Heightmap & Colormap Import
 *
 * Loads heightmap/colormap images, parses them into typed arrays,
 * and fills a VoxelGrid from the parsed data.
 */

import { VOXEL_SIZE } from '../voxel/constants.js';
import { TerrainMaterial, MATERIAL_DEFS, MATERIAL_COUNT } from '../voxel/terrain-materials.js';
import type { VoxelGrid } from '../voxel/voxel-grid.js';

// ── Types ──────────────────────────────────────────────────────────

export interface ImportRegion {
  posX: number;
  posY: number;
  posZ: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}

// ── 5.1  Image Loading ─────────────────────────────────────────────

const MAX_IMAGE_SIZE = 4096;
const VALID_TYPES = new Set(['image/png', 'image/jpeg']);

/**
 * Load an image File into an ImageData via OffscreenCanvas.
 * Validates format (PNG/JPG) and max dimensions (4096x4096).
 */
export async function loadImage(file: File): Promise<ImageData> {
  if (!VALID_TYPES.has(file.type)) {
    throw new Error(
      `Invalid image format: "${file.type}". Only PNG and JPEG are supported.`,
    );
  }

  const bitmap = await createImageBitmap(file);

  if (bitmap.width > MAX_IMAGE_SIZE || bitmap.height > MAX_IMAGE_SIZE) {
    bitmap.close();
    throw new Error(
      `Image too large (${bitmap.width}x${bitmap.height}). Maximum is ${MAX_IMAGE_SIZE}x${MAX_IMAGE_SIZE}.`,
    );
  }

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// ── 5.2  Heightmap Parser ──────────────────────────────────────────

/**
 * Parse a grayscale heightmap image into a Float32Array of world-Y values.
 *
 * Luminance = (R + G + B) / 3 / 255  →  normalized 0–1
 * Mapped to: minY + normalized * sizeY
 *
 * Returns one value per pixel (width * height).
 */
export function parseHeightmap(
  imageData: ImageData,
  region: ImportRegion,
): Float32Array {
  const { width, height, data } = imageData;
  const pixelCount = width * height;
  const result = new Float32Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const luminance = (r + g + b) / 3 / 255;
    result[i] = region.posY + luminance * region.sizeY;
  }

  return result;
}

// ── 5.3  Colormap Parser ──────────────────────────────────────────

/**
 * Pre-built array of non-Air material colors for nearest-match lookup.
 * Built once at module load.
 */
const _solidMaterials: Array<{
  id: TerrainMaterial;
  r: number;
  g: number;
  b: number;
}> = [];

for (let i = 1; i < MATERIAL_COUNT; i++) {
  const def = MATERIAL_DEFS[i as TerrainMaterial];
  if (!def.isTransparent) {
    _solidMaterials.push({
      id: def.id,
      r: def.color[0],
      g: def.color[1],
      b: def.color[2],
    });
  }
}

/**
 * Parse a colormap image into a Uint8Array of TerrainMaterial IDs.
 * Each pixel is matched to the nearest non-Air, non-transparent material
 * by Euclidean RGB distance.
 *
 * Returns one material ID per pixel (width * height).
 */
export function parseColormap(imageData: ImageData): Uint8Array {
  const { width, height, data } = imageData;
  const pixelCount = width * height;
  const result = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];

    let bestId: TerrainMaterial = TerrainMaterial.Grass;
    let bestDist = Infinity;

    for (let m = 0; m < _solidMaterials.length; m++) {
      const mat = _solidMaterials[m];
      const dr = r - mat.r;
      const dg = g - mat.g;
      const db = b - mat.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestId = mat.id;
      }
    }

    result[i] = bestId;
  }

  return result;
}

// ── 5.4  Grid Fill ────────────────────────────────────────────────

/**
 * Import terrain into a VoxelGrid from parsed heightmap + material data.
 *
 * For each pixel column, fills voxels from the region bottom up to the
 * heightmap Y. The topmost voxel gets a fractional occupancy for a
 * smooth surface gradient (Marching Cubes iso-surface).
 *
 * @param grid           Target voxel grid
 * @param heightmap      Float32Array of world-Y heights (from parseHeightmap)
 * @param materialMap    Uint8Array of material IDs (from parseColormap), or null to use defaultMaterial
 * @param imageWidth     Width of the source image in pixels
 * @param imageHeight    Height of the source image in pixels
 * @param region         World-space region to fill
 * @param defaultMaterial Material to use when materialMap is null
 */
export function importTerrain(
  grid: VoxelGrid,
  heightmap: Float32Array,
  materialMap: Uint8Array | null,
  imageWidth: number,
  imageHeight: number,
  region: ImportRegion,
  defaultMaterial: TerrainMaterial = TerrainMaterial.Grass,
): void {
  const minY = region.posY;

  // Walk each voxel column in the region's XZ footprint
  // Map region X/Z range to image pixels
  for (let iz = 0; iz < imageHeight; iz++) {
    for (let ix = 0; ix < imageWidth; ix++) {
      const pixelIdx = iz * imageWidth + ix;

      // Map pixel (ix, iz) to world position
      const wx = region.posX + (ix / imageWidth) * region.sizeX;
      const wz = region.posZ + (iz / imageHeight) * region.sizeZ;

      const surfaceY = heightmap[pixelIdx];
      const mat = materialMap
        ? (materialMap[pixelIdx] as TerrainMaterial)
        : defaultMaterial;

      // Fill from bottom of region up to surface
      // Step by VOXEL_SIZE (each voxel is 4 world units)
      for (let wy = minY; wy < surfaceY; wy += VOXEL_SIZE) {
        const distToSurface = surfaceY - wy;

        // Full occupancy for voxels well below surface
        // Fractional occupancy for the last voxel (smooth gradient)
        const occupancy =
          distToSurface >= VOXEL_SIZE
            ? 1.0
            : Math.max(0.0, Math.min(1.0, distToSurface / VOXEL_SIZE));

        if (occupancy > 0) {
          grid.setVoxel(wx, wy, wz, occupancy, mat);
        }
      }
    }
  }
}
