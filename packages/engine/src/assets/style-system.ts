/**
 * Style system — per-project art direction for consistent AI generation.
 */

import type { AssetPerspective } from './asset-schema.js';

export interface StyleConfig {
  name: string;
  /** Prepended to all generation prompts */
  promptPrefix: string;
  /** Appended to all generation prompts */
  promptSuffix: string;
  /** Always excluded from generation */
  negativePrompt: string;
  /** Hex color palette for reference */
  colorPalette?: string[];
  perspective: AssetPerspective;
  defaultSize: { width: number; height: number };
  /** Lighting angle in degrees for consistent shadows */
  lightingAngle?: number;
}

/**
 * Manages per-project art style configuration and prompt building.
 * Ensures consistent visual style across AI-generated assets.
 */
export class StyleSystem {
  private currentStyle: StyleConfig;
  private presets: Map<string, StyleConfig> = new Map();

  constructor() {
    this.loadPresets();
    // Default to Medieval Fantasy
    this.currentStyle = this.presets.get('medieval-fantasy')!;
  }

  /**
   * Load all built-in style presets.
   */
  loadPresets(): void {
    const presetList: StyleConfig[] = [
      {
        name: 'Medieval Fantasy',
        promptPrefix:
          'isometric view, fantasy RPG style, warm torchlight, hand-painted, detailed textures',
        promptSuffix: 'transparent background, game asset, clean edges, no text',
        negativePrompt:
          'blurry, low quality, watermark, text, modern, sci-fi, realistic photo, noisy, artifacts',
        colorPalette: ['#8B4513', '#DAA520', '#2E8B57', '#4A0E0E', '#D4AF37'],
        perspective: 'isometric',
        defaultSize: { width: 256, height: 256 },
        lightingAngle: 315,
      },
      {
        name: 'Sci-Fi Station',
        promptPrefix:
          'isometric view, sci-fi, clean metallic surfaces, neon accent lights, futuristic',
        promptSuffix: 'transparent background, game asset, sharp details, no text',
        negativePrompt:
          'blurry, low quality, watermark, text, medieval, fantasy, organic, noisy, artifacts',
        colorPalette: ['#0D1B2A', '#1B263B', '#00B4D8', '#90E0EF', '#CAF0F8'],
        perspective: 'isometric',
        defaultSize: { width: 256, height: 256 },
        lightingAngle: 270,
      },
      {
        name: 'Modern Interior',
        promptPrefix:
          'top-down view, modern minimalist, clean lines, neutral colors, architectural rendering',
        promptSuffix: 'transparent background, game asset, precise geometry, no text',
        negativePrompt:
          'blurry, low quality, watermark, text, fantasy, medieval, cluttered, noisy, artifacts',
        colorPalette: ['#F5F5F5', '#E0E0E0', '#9E9E9E', '#424242', '#212121'],
        perspective: 'top-down',
        defaultSize: { width: 256, height: 256 },
        lightingAngle: 0,
      },
      {
        name: 'Cartoon/Toon',
        promptPrefix:
          'isometric view, cartoon style, thick outlines, bright vibrant colors, cel-shaded',
        promptSuffix: 'transparent background, game asset, flat shading, no text',
        negativePrompt:
          'blurry, low quality, watermark, text, realistic, photographic, gritty, noisy, artifacts',
        colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
        perspective: 'isometric',
        defaultSize: { width: 256, height: 256 },
        lightingAngle: 315,
      },
      {
        name: 'Pixel Art HD',
        promptPrefix: 'pixel art style, 32-bit era, detailed sprites, clean pixels',
        promptSuffix: 'transparent background, game sprite, crisp edges, no anti-aliasing, no text',
        negativePrompt:
          'blurry, low quality, watermark, text, smooth gradients, realistic, 3D render, noisy, artifacts',
        colorPalette: ['#0F380F', '#306230', '#8BAC0F', '#9BBC0F', '#E0F8D0'],
        perspective: 'side-view',
        defaultSize: { width: 64, height: 64 },
        lightingAngle: 315,
      },
      {
        name: 'Nature/Outdoor',
        promptPrefix:
          'isometric view, natural environment, lush vegetation, realistic textures',
        promptSuffix: 'transparent background, game asset, detailed foliage, no text',
        negativePrompt:
          'blurry, low quality, watermark, text, urban, industrial, artificial, noisy, artifacts',
        colorPalette: ['#228B22', '#32CD32', '#8B4513', '#87CEEB', '#F0E68C'],
        perspective: 'isometric',
        defaultSize: { width: 256, height: 256 },
        lightingAngle: 315,
      },
    ];

    for (const preset of presetList) {
      const key = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      this.presets.set(key, preset);
    }
  }

  /**
   * Set the current art style from a full config.
   */
  setStyle(config: StyleConfig): void {
    this.currentStyle = config;
  }

  /**
   * Get the current art style config.
   */
  getStyle(): StyleConfig {
    return this.currentStyle;
  }

  /**
   * Set the current style from a built-in preset name.
   * @param presetName — slug like "medieval-fantasy" or "pixel-art-hd"
   */
  setFromPreset(presetName: string): void {
    const preset = this.presets.get(presetName);
    if (!preset) {
      const available = Array.from(this.presets.keys()).join(', ');
      throw new Error(
        `Unknown style preset "${presetName}". Available: ${available}`
      );
    }
    this.currentStyle = preset;
  }

  /**
   * Get all available style presets.
   */
  getPresets(): StyleConfig[] {
    return Array.from(this.presets.values());
  }

  /**
   * Get all preset names (slugs).
   */
  getPresetNames(): string[] {
    return Array.from(this.presets.keys());
  }

  /**
   * Save a custom preset for later use.
   */
  saveCustomPreset(name: string, config: StyleConfig): void {
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    this.presets.set(key, { ...config, name });
  }

  /**
   * Build a complete generation prompt by combining style prefix + user prompt + suffix.
   */
  buildPrompt(userPrompt: string): string {
    const parts: string[] = [];
    if (this.currentStyle.promptPrefix) {
      parts.push(this.currentStyle.promptPrefix);
    }
    parts.push(userPrompt);
    if (this.currentStyle.promptSuffix) {
      parts.push(this.currentStyle.promptSuffix);
    }
    return parts.join(', ');
  }

  /**
   * Build a complete negative prompt by combining style negative + user negative.
   */
  buildNegativePrompt(userNegative?: string): string {
    const parts: string[] = [];
    if (this.currentStyle.negativePrompt) {
      parts.push(this.currentStyle.negativePrompt);
    }
    if (userNegative) {
      parts.push(userNegative);
    }
    return parts.join(', ');
  }

  /**
   * Get a standard prompt that previews the current style.
   * Useful for generating a reference image when switching styles.
   */
  getPreviewPrompt(): string {
    return this.buildPrompt(
      'a small wooden treasure chest with gold coins, simple game prop'
    );
  }
}
