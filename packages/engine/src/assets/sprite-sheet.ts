/**
 * Sprite sheet slicing utilities — grid-based and JSON atlas parsing.
 * Uses OffscreenCanvas/Canvas for sub-region extraction.
 */

import { Rectangle, Texture } from 'pixi.js';

// ── Config types ─────────────────────────────────────────────────

export interface SpriteSheetConfig {
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  /** Padding between tiles in pixels */
  padding?: number;
  /** Margin around the entire sheet in pixels */
  margin?: number;
}

export interface JSONAtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
}

export interface JSONAtlas {
  frames: Record<string, JSONAtlasFrame>;
  meta: { image: string; size: { w: number; h: number } };
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Get a 2D rendering context from either OffscreenCanvas or fallback Canvas.
 * OffscreenCanvas is preferred for web worker compatibility.
 */
function createCanvas(
  width: number,
  height: number
): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get OffscreenCanvas 2D context');
    return { canvas, ctx };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get Canvas 2D context');
  return { canvas, ctx };
}

/**
 * Extract a sub-region from a source image as an ImageBitmap.
 */
async function extractRegion(
  source: HTMLImageElement | ImageBitmap,
  sx: number,
  sy: number,
  sw: number,
  sh: number
): Promise<ImageBitmap> {
  const { ctx } = createCanvas(sw, sh);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  // createImageBitmap from canvas context's canvas
  const canvasEl = ctx.canvas;
  return createImageBitmap(canvasEl as ImageBitmapSource, 0, 0, sw, sh);
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Slice a sprite sheet image into individual ImageBitmaps using a grid layout.
 *
 * @param image — The full sprite sheet image.
 * @param config — Grid configuration (columns, rows, tile dimensions, optional padding/margin).
 * @returns Array of ImageBitmaps, ordered left-to-right, top-to-bottom.
 */
export async function sliceGrid(
  image: HTMLImageElement | ImageBitmap,
  config: SpriteSheetConfig
): Promise<ImageBitmap[]> {
  const { columns, rows, tileWidth, tileHeight } = config;
  const padding = config.padding ?? 0;
  const margin = config.margin ?? 0;

  const results: Promise<ImageBitmap>[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const sx = margin + col * (tileWidth + padding);
      const sy = margin + row * (tileHeight + padding);
      results.push(extractRegion(image, sx, sy, tileWidth, tileHeight));
    }
  }

  return Promise.all(results);
}

/**
 * Parse a TexturePacker/Aseprite JSON atlas and extract named ImageBitmaps.
 *
 * @param atlas — The parsed JSON atlas data.
 * @param image — The full atlas image.
 * @returns Map of frame name to ImageBitmap.
 */
export async function parseJSONAtlas(
  atlas: JSONAtlas,
  image: HTMLImageElement | ImageBitmap
): Promise<Map<string, ImageBitmap>> {
  const entries = Object.entries(atlas.frames);
  const results = new Map<string, ImageBitmap>();

  const promises = entries.map(async ([name, data]) => {
    const { x, y, w, h } = data.frame;
    const bitmap = await extractRegion(image, x, y, w, h);
    results.set(name, bitmap);
  });

  await Promise.all(promises);
  return results;
}

/**
 * Create an array of PixiJS Textures from a grid-based sprite sheet.
 * Uses PixiJS Rectangle to define sub-regions of the source texture
 * without copying pixel data — efficient for rendering.
 *
 * @param texture — The full PixiJS Texture of the sprite sheet.
 * @param config — Grid configuration.
 * @returns Array of PixiJS Textures, ordered left-to-right, top-to-bottom.
 */
export function createPixiSpriteSheet(
  texture: Texture,
  config: SpriteSheetConfig
): Texture[] {
  const { columns, rows, tileWidth, tileHeight } = config;
  const padding = config.padding ?? 0;
  const margin = config.margin ?? 0;

  const textures: Texture[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = margin + col * (tileWidth + padding);
      const y = margin + row * (tileHeight + padding);

      const frame = new Rectangle(x, y, tileWidth, tileHeight);
      const subTexture = new Texture({
        source: texture.source,
        frame,
      });
      textures.push(subTexture);
    }
  }

  return textures;
}
