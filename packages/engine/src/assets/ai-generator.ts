/**
 * AI image generation service — generates game assets via Freepik or fal.ai APIs.
 * Uses raw fetch() calls, no external SDKs.
 */

import type {
  AssetCategory,
  AssetMetadata,
  AssetPerspective,
  CollisionShape,
} from './asset-schema.js';
import type { AssetManager } from './asset-manager.js';
import { StyleSystem } from './style-system.js';

// ── Config & Request types ───────────────────────────────────────

export interface GenerationConfig {
  provider: 'freepik' | 'fal';
  apiKey: string;
  /** Provider-specific model ID */
  model?: string;
}

export interface GenerationRequest {
  prompt: string;
  /** Art style to apply (overrides style system if set) */
  style?: string;
  perspective?: AssetPerspective;
  size?: { width: number; height: number };
  negativePrompt?: string;
  /** Seed for reproducibility */
  seed?: number;
}

export interface GenerationResult {
  imageUrl: string;
  imageBlob: Blob;
  prompt: string;
  provider: string;
  /** Auto-suggested metadata from prompt analysis */
  metadata: Partial<AssetMetadata>;
}

// ── Keyword maps for heuristic categorization ────────────────────

const CATEGORY_KEYWORDS: Record<AssetCategory, string[]> = {
  furniture: [
    'table', 'chair', 'desk', 'bed', 'sofa', 'couch', 'shelf', 'bookshelf',
    'cabinet', 'dresser', 'wardrobe', 'bench', 'stool', 'throne', 'lamp',
    'chandelier', 'rug', 'carpet', 'curtain',
  ],
  wall: [
    'wall', 'door', 'gate', 'window', 'fence', 'barrier', 'arch', 'pillar',
    'column',
  ],
  floor: [
    'floor', 'tile', 'ground', 'path', 'road', 'bridge', 'platform', 'plank',
  ],
  decoration: [
    'tree', 'flower', 'plant', 'bush', 'rock', 'stone', 'statue', 'fountain',
    'painting', 'vase', 'candle', 'torch', 'banner', 'flag', 'sign', 'barrel',
    'crate', 'pot', 'grass', 'mushroom',
  ],
  character: [
    'character', 'person', 'npc', 'hero', 'villain', 'enemy', 'monster',
    'creature', 'soldier', 'knight', 'mage', 'wizard', 'archer', 'guard',
    'merchant', 'farmer', 'animal', 'pet', 'dragon', 'goblin', 'skeleton',
    'zombie', 'slime',
  ],
  item: [
    'sword', 'shield', 'weapon', 'armor', 'potion', 'scroll', 'key', 'gem',
    'coin', 'treasure', 'chest', 'bag', 'tool', 'hammer', 'axe', 'bow',
    'arrow', 'staff', 'wand', 'ring', 'amulet', 'book', 'map', 'food',
    'apple', 'bread',
  ],
  effect: [
    'fire', 'explosion', 'smoke', 'particle', 'spark', 'lightning', 'magic',
    'spell', 'aura', 'glow', 'beam', 'projectile', 'impact', 'trail', 'mist',
    'fog',
  ],
  tileset: [
    'tileset', 'tile set', 'sprite sheet', 'terrain tiles', 'floor tiles',
    'wall tiles',
  ],
  audio: [
    'sound', 'music', 'sfx', 'audio', 'ambience', 'theme',
  ],
  other: [],
};

const TAG_KEYWORDS: string[] = [
  'medieval', 'fantasy', 'sci-fi', 'modern', 'cartoon', 'pixel', 'dark',
  'light', 'wooden', 'stone', 'metal', 'crystal', 'ancient', 'magical',
  'broken', 'old', 'new', 'small', 'large', 'tiny', 'giant', 'animated',
  'static', 'interactive', 'collectible', 'weapon', 'armor', 'nature',
  'indoor', 'outdoor', 'underground', 'water', 'ice', 'fire', 'electric',
  'poison', 'holy', 'shadow', 'rare', 'common', 'epic', 'legendary',
];

// ── AIGenerator class ────────────────────────────────────────────

/**
 * Generates game assets using AI image generation APIs (Freepik or fal.ai).
 * Handles prompt building, API calls, post-processing, and auto-metadata.
 */
export class AIGenerator {
  private config: GenerationConfig;
  private styleSystem: StyleSystem;

  constructor(config: GenerationConfig, styleSystem?: StyleSystem) {
    this.config = config;
    this.styleSystem = styleSystem ?? new StyleSystem();
  }

  // ── Generation ───────────────────────────────────────────────

  /**
   * Generate a single asset image from a prompt.
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const fullPrompt = this.styleSystem.buildPrompt(request.prompt);
    const negativePrompt = this.styleSystem.buildNegativePrompt(
      request.negativePrompt
    );
    const size = request.size ?? this.styleSystem.getStyle().defaultSize;

    let imageUrl: string;
    let imageBlob: Blob;

    if (this.config.provider === 'freepik') {
      const result = await this.callFreepik(fullPrompt, negativePrompt, size, request.seed);
      imageUrl = result.url;
      imageBlob = result.blob;
    } else if (this.config.provider === 'fal') {
      const result = await this.callFal(fullPrompt, negativePrompt, size, request.seed);
      imageUrl = result.url;
      imageBlob = result.blob;
    } else {
      throw new Error(`Unknown provider: ${this.config.provider}`);
    }

    const suggestedCategory = this.suggestCategory(request.prompt);
    const suggestedTags = this.suggestTags(request.prompt);

    return {
      imageUrl,
      imageBlob,
      prompt: fullPrompt,
      provider: this.config.provider,
      metadata: {
        name: this.promptToName(request.prompt),
        category: suggestedCategory,
        tags: suggestedTags,
        style: request.style ?? this.styleSystem.getStyle().name,
        perspective:
          request.perspective ?? this.styleSystem.getStyle().perspective,
        collisionShape: this.suggestCollisionShape(suggestedCategory),
        anchor: this.suggestAnchor(
          request.perspective ?? this.styleSystem.getStyle().perspective
        ),
        size,
        source: 'ai-generated' as const,
        sourcePrompt: fullPrompt,
      },
    };
  }

  /**
   * Generate multiple assets in parallel.
   */
  async generateBatch(
    requests: GenerationRequest[]
  ): Promise<GenerationResult[]> {
    return Promise.all(requests.map((req) => this.generate(req)));
  }

  // ── API calls ────────────────────────────────────────────────

  /**
   * Call the Freepik AI text-to-image API.
   */
  private async callFreepik(
    prompt: string,
    negativePrompt: string,
    size: { width: number; height: number },
    seed?: number
  ): Promise<{ url: string; blob: Blob }> {
    const body: Record<string, unknown> = {
      prompt,
      negative_prompt: negativePrompt,
      image: {
        size: {
          width: size.width,
          height: size.height,
        },
      },
      ...(seed != null && { seed }),
    };

    const response = await fetch(
      'https://api.freepik.com/v1/ai/text-to-image',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-freepik-api-key': this.config.apiKey,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Freepik API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();

    // Freepik returns an array of generated images under data.data
    const images = data?.data as Array<{ base64?: string; url?: string }> | undefined;
    if (!images || images.length === 0) {
      throw new Error('Freepik API returned no images');
    }

    const imageData = images[0];

    if (imageData.base64) {
      const binaryStr = atob(imageData.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      return { url, blob };
    }

    if (imageData.url) {
      const imgResponse = await fetch(imageData.url);
      if (!imgResponse.ok) {
        throw new Error(`Failed to download Freepik image: ${imgResponse.status}`);
      }
      const blob = await imgResponse.blob();
      return { url: imageData.url, blob };
    }

    throw new Error('Freepik API returned image with no base64 or url');
  }

  /**
   * Call the fal.ai text-to-image API.
   */
  private async callFal(
    prompt: string,
    negativePrompt: string,
    size: { width: number; height: number },
    seed?: number
  ): Promise<{ url: string; blob: Blob }> {
    const model = this.config.model ?? 'fal-ai/flux/schnell';

    const body: Record<string, unknown> = {
      prompt,
      image_size: {
        width: size.width,
        height: size.height,
      },
      num_images: 1,
      ...(negativePrompt && { negative_prompt: negativePrompt }),
      ...(seed != null && { seed }),
    };

    const response = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`fal.ai API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // fal.ai returns images under data.images
    const images = data?.images as Array<{ url: string }> | undefined;
    if (!images || images.length === 0) {
      throw new Error('fal.ai API returned no images');
    }

    const imageUrl = images[0].url;

    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      throw new Error(`Failed to download fal.ai image: ${imgResponse.status}`);
    }
    const blob = await imgResponse.blob();
    return { url: imageUrl, blob };
  }

  // ── Post-processing ──────────────────────────────────────────

  /**
   * Remove the background from an image using canvas alpha thresholding.
   * For production quality, call an external API like remove.bg instead.
   *
   * This implementation converts near-white pixels to transparent,
   * which works for assets generated with "transparent background" in the prompt.
   */
  async removeBackground(imageBlob: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(imageBlob);
    const { width, height } = bitmap;

    const canvas = this.makeCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Threshold: pixels where R, G, B are all > 240 become transparent
    const threshold = 240;
    for (let i = 0; i < data.length; i += 4) {
      if (
        data[i] > threshold &&
        data[i + 1] > threshold &&
        data[i + 2] > threshold
      ) {
        data[i + 3] = 0; // set alpha to 0
      }
    }

    ctx.putImageData(imageData, 0, 0);
    bitmap.close();

    return this.canvasToBlob(canvas);
  }

  /**
   * Resize an image to a target size while preserving aspect ratio (fit inside).
   */
  async normalize(
    imageBlob: Blob,
    targetSize: { width: number; height: number }
  ): Promise<Blob> {
    const bitmap = await createImageBitmap(imageBlob);
    const { width: srcW, height: srcH } = bitmap;

    const scale = Math.min(
      targetSize.width / srcW,
      targetSize.height / srcH
    );
    const dstW = Math.round(srcW * scale);
    const dstH = Math.round(srcH * scale);

    const canvas = this.makeCanvas(targetSize.width, targetSize.height);
    const ctx = canvas.getContext('2d')!;
    // Center the image in the target canvas
    const offsetX = Math.round((targetSize.width - dstW) / 2);
    const offsetY = Math.round((targetSize.height - dstH) / 2);
    ctx.drawImage(bitmap, offsetX, offsetY, dstW, dstH);
    bitmap.close();

    return this.canvasToBlob(canvas);
  }

  // ── Auto-metadata heuristics ─────────────────────────────────

  /**
   * Suggest a category based on keywords in the prompt.
   */
  suggestCategory(prompt: string): AssetCategory {
    const lower = prompt.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (category === 'other') continue;
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          return category as AssetCategory;
        }
      }
    }

    return 'other';
  }

  /**
   * Suggest tags based on keywords found in the prompt.
   */
  suggestTags(prompt: string): string[] {
    const lower = prompt.toLowerCase();
    const tags: string[] = [];

    for (const tag of TAG_KEYWORDS) {
      if (lower.includes(tag)) {
        tags.push(tag);
      }
    }

    // Also extract the suggested category as a tag
    const category = this.suggestCategory(prompt);
    if (category !== 'other' && !tags.includes(category)) {
      tags.push(category);
    }

    return tags;
  }

  /**
   * Suggest a default collision shape based on asset category.
   */
  suggestCollisionShape(category: AssetCategory): CollisionShape {
    switch (category) {
      case 'character':
        return { type: 'circle', radius: 0.4 };
      case 'furniture':
        return { type: 'rect', width: 0.8, height: 0.8 };
      case 'wall':
        return { type: 'rect', width: 1.0, height: 0.3 };
      case 'floor':
        return { type: 'none' };
      case 'decoration':
        return { type: 'circle', radius: 0.3 };
      case 'item':
        return { type: 'circle', radius: 0.25 };
      case 'effect':
        return { type: 'none' };
      case 'tileset':
        return { type: 'none' };
      case 'audio':
        return { type: 'none' };
      default:
        return { type: 'rect', width: 0.5, height: 0.5 };
    }
  }

  /**
   * Suggest an anchor point based on the perspective.
   */
  suggestAnchor(perspective: AssetPerspective): { x: number; y: number } {
    switch (perspective) {
      case 'top-down':
        return { x: 0.5, y: 0.5 }; // center
      case 'isometric':
        return { x: 0.5, y: 0.75 }; // bottom-center offset for iso ground plane
      case 'side-view':
        return { x: 0.5, y: 1.0 }; // bottom-center (feet on ground)
      default:
        return { x: 0.5, y: 0.5 };
    }
  }

  // ── Convenience ──────────────────────────────────────────────

  /**
   * Generate an asset and immediately register it with the AssetManager.
   * @returns The new asset ID.
   */
  async generateAndRegister(
    request: GenerationRequest,
    assetManager: AssetManager
  ): Promise<string> {
    const result = await this.generate(request);
    const id = await assetManager.register(
      result.metadata as AssetMetadata,
      result.imageBlob
    );
    return id;
  }

  // ── Private helpers ──────────────────────────────────────────

  /**
   * Convert a user prompt to a human-readable asset name.
   * e.g. "a wooden table with carvings" => "Wooden Table With Carvings"
   */
  private promptToName(prompt: string): string {
    return prompt
      .replace(/^(a|an|the)\s+/i, '')
      .replace(/,.*$/, '') // drop everything after first comma
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .slice(0, 60); // reasonable name length cap
  }

  /**
   * Create either an OffscreenCanvas or fallback HTMLCanvasElement.
   */
  private makeCanvas(
    width: number,
    height: number
  ): OffscreenCanvas | HTMLCanvasElement {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * Convert a canvas to a PNG Blob.
   */
  private async canvasToBlob(
    canvas: OffscreenCanvas | HTMLCanvasElement
  ): Promise<Blob> {
    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type: 'image/png' });
    }
    return new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      }, 'image/png');
    });
  }
}
