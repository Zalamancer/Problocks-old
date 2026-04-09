import { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { useStudio } from '@/store/studio-store';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────

type Badge = 'PRO' | 'NEW' | 'EXP' | 'API';

interface FieldDef {
  id: string;
  label: string;
  type: 'textarea' | 'text' | 'select' | 'number' | 'range' | 'dropzone';
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: string[];
  value?: number | string;
  min?: number;
  max?: number;
  unit?: string;
  labelMin?: string;
  labelMax?: string;
  showPreview?: boolean;
  max_files?: number;
  maxSize?: string;
}

interface ToolForm {
  title: string;
  badge?: Badge;
  cost?: number;
  desc?: string;
  fields: FieldDef[];
}

// ── Form definitions (ported from pro-light studio.html) ──────────────

const TOOL_FORMS: Record<string, ToolForm> = {
  'create-character': {
    title: 'Create Character', badge: 'API', cost: 20,
    desc: 'Generate character with all directional views',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'e.g. a knight in silver armor, Stardew Valley style',
        hint: 'Describe the character appearance and art style' },
      { id: 'style_refs', label: 'Style references (optional)', type: 'dropzone',
        hint: 'Upload up to 4 reference images to guide the style', max_files: 4, maxSize: '128x128' },
      { id: 'directions', label: 'Directions', type: 'select', options: ['8 directions', '4 directions'] },
      { id: 'size', label: 'Sprite size', type: 'select', options: ['32px', '48px', '64px'] },
    ],
  },
  'create-8dir-sprite': {
    title: 'Create 8-Dir Sprite', badge: 'PRO', cost: 20,
    desc: 'Generate 8 directional views',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'Describe the character or object' },
      { id: 'style_refs', label: 'Style references (optional)', type: 'dropzone', max_files: 4, maxSize: '128x128' },
      { id: 'size', label: 'Sprite size', type: 'select', options: ['32px', '48px', '64px', '96px'] },
    ],
  },
  'create-map-object': {
    title: 'Create Map Object', badge: 'API', cost: 10,
    desc: 'Trees, rocks, buildings, props',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'e.g. large oak tree with autumn leaves, pixel art',
        hint: 'Describe the object and desired art style' },
      { id: 'style_refs', label: 'Style references (optional)', type: 'dropzone', max_files: 4, maxSize: '128x128' },
      { id: 'width', label: 'Width (px)', type: 'number', value: 64 },
      { id: 'height', label: 'Height (px)', type: 'number', value: 64 },
      { id: 'view_angle', label: 'View angle', type: 'range',
        min: 0, max: 90, value: 70, unit: '°',
        labelMin: '0° side', labelMax: '90° top-down', showPreview: true },
      { id: 'outline', label: 'Outline mode', type: 'select',
        options: ['Outline (default)', 'Lineless', 'Thick outline'] },
    ],
  },
  'create-sm-image': {
    title: 'Create S-M Image', cost: 5, desc: 'Best for 16-64px',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'Describe the pixel art (16-64px)' },
      { id: 'size', label: 'Size', type: 'select',
        options: ['16x16', '24x24', '32x32', '48x48', '64x64'] },
      { id: 'outline', label: 'Outline mode', type: 'select',
        options: ['Outline (default)', 'Lineless', 'Thick outline'] },
    ],
  },
  'create-mxl-image': {
    title: 'Create M-XL Image', cost: 10, desc: 'Best for 64px and larger',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'Describe the pixel art (64px+)' },
      { id: 'size', label: 'Size', type: 'select',
        options: ['64x64', '96x96', '128x128', '192x192', '256x256'] },
      { id: 'outline', label: 'Outline mode', type: 'select',
        options: ['Outline (default)', 'Lineless', 'Thick outline'] },
    ],
  },
  'create-image-pro': {
    title: 'Create Image', badge: 'PRO', cost: 20, desc: 'High quality generation',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'High quality pixel art description' },
      { id: 'style_refs', label: 'Style references (optional)', type: 'dropzone', max_files: 4, maxSize: '128x128' },
      { id: 'size', label: 'Size', type: 'select',
        options: ['32x32', '48x48', '64x64', '96x96', '128x128', '256x256'] },
      { id: 'outline', label: 'Outline mode', type: 'select',
        options: ['Outline (default)', 'Lineless', 'Thick outline'] },
    ],
  },
  'image-to-pixel-art': {
    title: 'Image to Pixel Art', cost: 5, desc: 'Convert any image to pixel art',
    fields: [
      { id: 'image', label: 'Source image', type: 'dropzone', required: true,
        max_files: 1, maxSize: '512x512', hint: 'Upload the image to convert' },
      { id: 'pixel_size', label: 'Target pixel size', type: 'select',
        options: ['16x16', '32x32', '48x48', '64x64', '128x128'] },
      { id: 'outline', label: 'Outline mode', type: 'select',
        options: ['Outline (default)', 'Lineless', 'Thick outline'] },
    ],
  },
  'create-from-style': {
    title: 'Create from Style Reference', badge: 'PRO', cost: 20, desc: 'Match your art style',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'What to generate' },
      { id: 'style_ref', label: 'Style reference image', type: 'dropzone', required: true,
        max_files: 1, maxSize: '128x128', hint: 'Upload an image whose style to match' },
      { id: 'size', label: 'Size', type: 'select',
        options: ['32x32', '48x48', '64x64', '96x96', '128x128'] },
    ],
  },
  'create-ui-elements': {
    title: 'Create UI Elements', badge: 'PRO', cost: 20, desc: 'Create game UI components',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'e.g. health bar, inventory slot, button with gold border' },
      { id: 'style_refs', label: 'Style references (optional)', type: 'dropzone', max_files: 4, maxSize: '128x128' },
      { id: 'size', label: 'Size', type: 'select',
        options: ['32x32', '48x48', '64x64', '96x96', '128x128'] },
    ],
  },
  'create-ui-experimental': {
    title: 'Create UI Elements', badge: 'EXP', cost: 20, desc: 'Experimental - Tier 2 subscription',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'Describe the UI element' },
      { id: 'size', label: 'Size', type: 'select', options: ['32x32', '64x64', '128x128'] },
    ],
  },
  'create-tiles-pro': {
    title: 'Create Tiles', badge: 'PRO', cost: 20, desc: 'Generate tile variations for games',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'Rich, saturated colors with a warm, earthy tone.',
        hint: 'Describe each tile or give a general description for all' },
      { id: 'style_tiles', label: 'Style tiles (optional)', type: 'dropzone',
        hint: 'Upload up to 16 pixel art tiles to guide the art style', max_files: 16, maxSize: '128x128' },
      { id: 'n_tiles', label: 'Number of tiles', type: 'select', options: ['4', '8', '16', '24', '32'] },
      { id: 'tile_type', label: 'Tile type', type: 'select',
        options: ['Square top-down', 'Square side-view', 'Isometric', 'Hexagonal (flat-top)', 'Hexagonal (pointy-top)', 'Octagonal'] },
      { id: 'tile_size', label: 'Tile size', type: 'select', options: ['16px', '32px', '48px', '64px'] },
      { id: 'view_angle', label: 'View angle', type: 'range',
        min: 0, max: 90, value: 70, unit: '°', labelMin: '0° side', labelMax: '90° top-down', showPreview: true },
      { id: 'thickness', label: 'Thickness', type: 'range',
        min: 0, max: 100, value: 0, unit: '%', labelMin: '0%', labelMax: '100%',
        hint: 'Controls the depth/thickness of tile sides' },
      { id: 'outline', label: 'Outline mode', type: 'select',
        options: ['Outline (default)', 'Lineless', 'Thick outline'] },
    ],
  },
  'create-topdown-tileset': {
    title: 'Top-Down Wang Tileset', badge: 'API', cost: 20,
    desc: 'Wang tileset for seamless terrain transitions',
    fields: [
      { id: 'lower_prompt', label: 'Lower terrain', type: 'textarea', required: true,
        placeholder: 'e.g. warm golden sandy ground, Stardew Valley style',
        hint: 'The terrain that appears in transition gaps' },
      { id: 'upper_prompt', label: 'Upper terrain', type: 'textarea', required: true,
        placeholder: 'e.g. lush vibrant green grass, Stardew Valley style',
        hint: 'The terrain that expands over the lower' },
      { id: 'style_tiles', label: 'Style tiles (optional)', type: 'dropzone',
        hint: 'Upload reference tiles to guide the style', max_files: 16, maxSize: '128x128' },
      { id: 'tile_size', label: 'Tile size', type: 'select', options: ['16px', '32px'] },
      { id: 'view_angle', label: 'View angle', type: 'range',
        min: 0, max: 90, value: 90, unit: '°', labelMin: '0° side', labelMax: '90° top-down', showPreview: true },
      { id: 'outline', label: 'Outline mode', type: 'select',
        options: ['Lineless', 'Outline (default)', 'Thick outline'] },
    ],
  },
  'create-sidescroller-tileset': {
    title: 'Sidescroller Tileset', badge: 'API', cost: 20, desc: 'Platformer-style tilesets',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'e.g. mossy stone platform, underground cave dirt',
        hint: 'Describe the terrain style for the platformer tileset' },
      { id: 'style_tiles', label: 'Style tiles (optional)', type: 'dropzone', max_files: 16, maxSize: '128x128' },
      { id: 'tile_size', label: 'Tile size', type: 'select', options: ['16px', '32px'] },
      { id: 'thickness', label: 'Thickness', type: 'range',
        min: 0, max: 100, value: 30, unit: '%', labelMin: '0%', labelMax: '100%',
        hint: 'Controls the depth/thickness of platform edges' },
      { id: 'outline', label: 'Outline mode', type: 'select',
        options: ['Outline (default)', 'Lineless', 'Thick outline'] },
    ],
  },
  'create-isometric-tile': {
    title: 'Isometric Tile', badge: 'API', cost: 10, desc: 'Isometric perspective tiles',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'e.g. grassy hill, stone floor, water pool' },
      { id: 'style_tiles', label: 'Style tiles (optional)', type: 'dropzone', max_files: 4, maxSize: '128x128' },
      { id: 'tile_size', label: 'Tile size', type: 'select', options: ['32px', '64px'] },
      { id: 'thickness', label: 'Thickness', type: 'range',
        min: 0, max: 100, value: 20, unit: '%', labelMin: '0%', labelMax: '100%',
        hint: 'Controls the depth of the isometric tile sides' },
      { id: 'outline', label: 'Outline mode', type: 'select', options: ['Outline (default)', 'Lineless'] },
    ],
  },
  'animate-character': {
    title: 'Animate Character', badge: 'API', cost: 20,
    desc: 'Walk, run, idle animations for existing characters',
    fields: [
      { id: 'character_id', label: 'Character ID', type: 'text', required: true,
        placeholder: 'Paste character UUID',
        hint: 'The ID of a previously created character' },
      { id: 'animation', label: 'Animation type', type: 'select',
        options: ['walk', 'run', 'idle', 'attack', 'death', 'jump', 'cast'] },
      { id: 'frames', label: 'Frame count', type: 'select', options: ['4 frames', '6 frames', '8 frames'] },
      { id: 'directions', label: 'Directions', type: 'select', options: ['4 directions', '8 directions'] },
    ],
  },
  'animate-with-text': {
    title: 'Animate with Text', badge: 'NEW', cost: 5, desc: 'Generate animation from text',
    fields: [
      { id: 'prompt', label: 'Animation description', type: 'textarea', required: true,
        placeholder: 'e.g. a coin spinning and glowing' },
      { id: 'frames', label: 'Frame count', type: 'select',
        options: ['4 frames', '6 frames', '8 frames', '12 frames'] },
      { id: 'size', label: 'Size', type: 'select', options: ['16x16', '32x32', '48x48', '64x64'] },
    ],
  },
  'interpolate': {
    title: 'Interpolate', badge: 'NEW', cost: 5, desc: 'Animate between two frames',
    fields: [
      { id: 'frames_upload', label: 'Upload frames', type: 'dropzone', required: true,
        max_files: 2, maxSize: '128x128', hint: 'Upload exactly 2 frames (start and end)' },
      { id: 'frame_count', label: 'Intermediate frames', type: 'select',
        options: ['2 frames', '4 frames', '6 frames', '8 frames'] },
    ],
  },
  'create-animated-object': {
    title: 'Animated Object/Character', badge: 'PRO', cost: 20, desc: 'Generate animation from text',
    fields: [
      { id: 'prompt', label: 'Description', type: 'textarea', required: true,
        placeholder: 'e.g. a torch flickering with orange flames' },
      { id: 'style_refs', label: 'Style references (optional)', type: 'dropzone', max_files: 4, maxSize: '128x128' },
      { id: 'frames', label: 'Frame count', type: 'select',
        options: ['4 frames', '6 frames', '8 frames', '12 frames'] },
      { id: 'size', label: 'Size', type: 'select', options: ['32x32', '48x48', '64x64', '96x96'] },
    ],
  },
  'animate-with-text-pro': {
    title: 'Animate with Text', badge: 'PRO', cost: 20, desc: 'Add animation to existing image',
    fields: [
      { id: 'image', label: 'Source image', type: 'dropzone', required: true,
        max_files: 1, maxSize: '128x128', hint: 'The static image to animate' },
      { id: 'prompt', label: 'Animation description', type: 'textarea', required: true,
        placeholder: 'e.g. make the character wave their hand' },
      { id: 'frames', label: 'Frame count', type: 'select', options: ['4 frames', '6 frames', '8 frames'] },
    ],
  },
  'edit-animation': {
    title: 'Edit Animation', badge: 'PRO', cost: 20, desc: 'Modify frames of an animation',
    fields: [
      { id: 'frames_upload', label: 'Upload animation frames', type: 'dropzone', required: true,
        max_files: 16, maxSize: '128x128', hint: 'Upload the frames to modify' },
      { id: 'prompt', label: 'Edit instructions', type: 'textarea', required: true,
        placeholder: 'e.g. change the sword to a staff' },
    ],
  },
  'transfer-outfit': {
    title: 'Transfer Outfit to Animation', badge: 'PRO', cost: 20,
    desc: 'Apply outfit to another animation',
    fields: [
      { id: 'outfit', label: 'Outfit image', type: 'dropzone', required: true,
        max_files: 1, maxSize: '128x128', hint: 'The outfit/skin to transfer' },
      { id: 'anim_frames', label: 'Animation frames', type: 'dropzone', required: true,
        max_files: 16, maxSize: '128x128', hint: 'The animation to apply the outfit to' },
    ],
  },
  'interpolate-pro': {
    title: 'Interpolate', badge: 'PRO', cost: 20, desc: 'Smooth transitions between frames',
    fields: [
      { id: 'frames_upload', label: 'Upload frames', type: 'dropzone', required: true,
        max_files: 16, maxSize: '128x128', hint: 'Upload keyframes for smooth interpolation' },
      { id: 'frame_count', label: 'Output frames per gap', type: 'select',
        options: ['2 frames', '4 frames', '6 frames', '8 frames'] },
    ],
  },
  'image-to-image': {
    title: 'Image to Image', cost: 5, desc: 'Transform using depth guidance',
    fields: [
      { id: 'image', label: 'Source image', type: 'dropzone', required: true, max_files: 1, maxSize: '512x512' },
      { id: 'prompt', label: 'Transform description', type: 'textarea', required: true,
        placeholder: 'e.g. make it look like a medieval castle' },
      { id: 'strength', label: 'Transform strength', type: 'range',
        min: 0, max: 100, value: 50, unit: '%', labelMin: 'Subtle', labelMax: 'Strong' },
    ],
  },
  'edit-image': {
    title: 'Edit Image', cost: 5, desc: 'Edit parts of an existing image',
    fields: [
      { id: 'image', label: 'Image to edit', type: 'dropzone', required: true, max_files: 1, maxSize: '512x512' },
      { id: 'prompt', label: 'Edit instructions', type: 'textarea', required: true,
        placeholder: 'e.g. change the hat color to red' },
    ],
  },
  'edit-image-pro': {
    title: 'Edit Image', badge: 'PRO', cost: 20, desc: 'Advanced AI image editing',
    fields: [
      { id: 'image', label: 'Image to edit', type: 'dropzone', required: true, max_files: 1, maxSize: '512x512' },
      { id: 'prompt', label: 'Edit instructions', type: 'textarea', required: true,
        placeholder: 'Describe the edits in detail' },
      { id: 'mask', label: 'Mask (optional)', type: 'dropzone',
        max_files: 1, maxSize: '512x512', hint: 'Upload a mask to limit editing area' },
    ],
  },
  'unzoom': {
    title: 'Unzoom', badge: 'NEW', cost: 1, desc: 'Detect pixel scale and downscale',
    fields: [
      { id: 'image', label: 'Upload image', type: 'dropzone', required: true,
        max_files: 1, maxSize: '512x512', hint: 'Upload an upscaled pixel art image to detect and reduce to native resolution' },
    ],
  },
  'remove-background': {
    title: 'Remove Background', badge: 'NEW', cost: 1, desc: 'Remove background from image',
    fields: [
      { id: 'image', label: 'Upload image', type: 'dropzone', required: true, max_files: 1, maxSize: '512x512' },
    ],
  },
  'pixel-art-correction': {
    title: 'Pixel Art Correction', badge: 'NEW', cost: 1, desc: 'Clean up and refine pixel art',
    fields: [
      { id: 'image', label: 'Upload image', type: 'dropzone', required: true,
        max_files: 1, maxSize: '512x512', hint: 'Upload pixel art with artifacts, anti-aliasing, or other issues to clean up' },
    ],
  },
};

// ── API mapping ───────────────────────────────────────────────────────

const TOOL_API: Record<string, string> = {
  'create-character':            'create-character-with-8-directions',
  'create-8dir-sprite':          'generate-8-rotations-v2',
  'create-map-object':           'map-objects',
  'create-sm-image':             'create-image-bitforge',
  'create-mxl-image':            'create-image-pixflux',
  'create-image-pro':            'generate-image-v2',
  'image-to-pixel-art':          'image-to-pixelart',
  'create-from-style':           'generate-with-style-v2',
  'create-ui-elements':          'generate-ui-v2',
  'create-ui-experimental':      'generate-ui-v2',
  'create-tiles-pro':            'create-tiles-pro',
  'create-topdown-tileset':      'create-tileset',
  'create-sidescroller-tileset': 'create-tileset-sidescroller',
  'create-isometric-tile':       'create-isometric-tile',
  'animate-character':           'animate-character',
  'animate-with-text':           'animate-with-text',
  'interpolate':                 'interpolation-v2',
  'create-animated-object':      'animate-with-text-v2',
  'animate-with-text-pro':       'animate-with-text-v3',
  'edit-animation':              'edit-animation-v2',
  'transfer-outfit':             'transfer-outfit-v2',
  'interpolate-pro':             'interpolation-v2',
  'image-to-image':              'edit-image',
  'edit-image':                  'edit-image',
  'edit-image-pro':              'edit-images-v2',
  'unzoom':                      'resize',
  'remove-background':           'remove-background',
  'pixel-art-correction':        'resize',
};

const BADGE_STYLES: Record<string, string> = {
  PRO: 'bg-purple-500/20 text-purple-300',
  NEW: 'bg-emerald-500/20 text-emerald-300',
  EXP: 'bg-amber-500/15 text-amber-300',
  API: 'bg-sky-500/20 text-sky-300',
};

// ── Payload builder ───────────────────────────────────────────────────

function buildPayload(toolId: string, raw: Record<string, unknown>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (raw.prompt) p.description = raw.prompt;
  if (raw.lower_prompt) p.lower_description = raw.lower_prompt;
  if (raw.upper_prompt) p.upper_description = raw.upper_prompt;

  const tsRaw = (raw.tile_size as string) || (raw.size as string);
  if (tsRaw) {
    const m = tsRaw.match(/(\d+)/);
    if (m) p.tile_size = Number(m[1]);
  }
  if (raw.width) p.width = raw.width;
  if (raw.height) p.height = raw.height;

  if (raw.tile_type) {
    const tt = (raw.tile_type as string).toLowerCase();
    if (tt.includes('iso')) p.tile_type = 'isometric';
    else if (tt.includes('hex') && tt.includes('flat')) p.tile_type = 'hexagonal_flat';
    else if (tt.includes('hex') && tt.includes('pointy')) p.tile_type = 'hexagonal_pointy';
    else if (tt.includes('oct')) p.tile_type = 'octagonal';
    else if (tt.includes('side')) p.tile_type = 'square_side';
    else p.tile_type = 'square_topdown';
  }

  if (raw.view_angle !== undefined) {
    const a = Number(raw.view_angle);
    if (a >= 80) p.tile_view = 'top-down';
    else if (a >= 50) p.tile_view = 'low top-down';
    else if (a >= 20) p.tile_view = 'high side';
    else p.tile_view = 'side';
  }

  if (raw.character_id) p.character_id = raw.character_id;
  if (raw.animation) p.animation_type = raw.animation;
  if (raw.directions) p.directions = (raw.directions as string).includes('8') ? 8 : 4;
  if (raw.frames) p.frame_count = Number(raw.frames) || 6;
  if (raw.frame_count) {
    const m = (raw.frame_count as string).match(/(\d+)/);
    if (m) p.frame_count = Number(m[1]);
  }
  if (raw.strength !== undefined) p.strength = Number(raw.strength) / 100;

  if (toolId === 'create-tiles-pro') p.n_tiles = raw.n_tiles ? Number(raw.n_tiles) : 16;

  if (toolId === 'create-topdown-tileset' || toolId === 'create-sidescroller-tileset') {
    if (p.tile_size) p.tile_size = { width: p.tile_size, height: p.tile_size };
  }

  return p;
}

// ── Image helpers ─────────────────────────────────────────────────────

function rgbaToDataUrl(b64: string, w: number, h: number): string {
  const bytes = atob(b64);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(w, h);
  for (let i = 0; i < bytes.length; i++) imgData.data[i] = bytes.charCodeAt(i);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

function findImages(obj: unknown, found: string[] = []): string[] {
  if (!obj || typeof obj !== 'object') return found;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('/')) &&
        (val.includes('.png') || val.includes('.jpg') || val.includes('.webp') || val.includes('image'))) {
      found.push(val);
    } else if (typeof val === 'string' && key === 'image' && val.startsWith('data:')) {
      found.push(val);
    } else if (typeof val === 'object') {
      findImages(val, found);
    }
  }
  return found;
}

function findRgbaImages(obj: unknown): string[] {
  const results: string[] = [];
  function walk(o: unknown) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    const rec = o as Record<string, unknown>;
    if (rec.type === 'rgba_bytes' && rec.base64 && rec.width && rec.height) {
      results.push(rgbaToDataUrl(rec.base64 as string, rec.width as number, rec.height as number));
      return;
    }
    Object.values(rec).forEach(walk);
  }
  walk(obj);
  return results;
}

// ── Dropzone field ────────────────────────────────────────────────────

function DropzoneField({ field }: { field: FieldDef }) {
  const [thumbs, setThumbs] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => setThumbs((prev) => [...prev, e.target!.result as string]);
      reader.readAsDataURL(f);
    });
  };

  return (
    <div className="mb-4">
      <label className="block text-[13px] font-semibold text-zinc-300 mb-1.5">
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
          dragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-white/10 hover:border-white/20',
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <div className="text-lg opacity-40 mb-1">🖼️ ⬆️ 📋</div>
        <div className="text-[12px] text-zinc-500">Click to upload or drag and drop</div>
        {field.maxSize && <div className="text-[11px] text-emerald-700 mt-0.5">Max {field.maxSize}</div>}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={(field.max_files ?? 1) > 1}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>
      {thumbs.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {thumbs.map((src, i) => (
            <img key={i} src={src} alt="" className="w-10 h-10 object-contain rounded border border-white/10" style={{ imageRendering: 'pixelated' }} />
          ))}
        </div>
      )}
      {field.hint && <div className="text-[11px] text-zinc-600 mt-1 leading-snug">{field.hint}</div>}
    </div>
  );
}

// ── Range field ───────────────────────────────────────────────────────

function RangeField({ field, value, onChange }: { field: FieldDef; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[13px] font-semibold text-zinc-300">{field.label}</label>
        <span className="text-[12px] text-zinc-500 tabular-nums">{value}{field.unit ?? ''}</span>
      </div>
      <input
        type="range"
        min={field.min} max={field.max} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500"
      />
      <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
        <span>{field.labelMin ?? field.min}</span>
        <span>{field.labelMax ?? field.max}</span>
      </div>
      {field.showPreview && (
        <div className="flex justify-center my-2">
          <div
            className="w-10 h-10 bg-zinc-800 border-2 border-emerald-800 rounded"
            style={{ transform: `perspective(120px) rotateX(${value * 0.6}deg)` }}
          />
        </div>
      )}
      {field.hint && <div className="text-[11px] text-zinc-600 mt-1 leading-snug">{field.hint}</div>}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────

export function AIToolPanel() {
  const { selectedAITool, setSelectedAITool } = useStudio();
  const form = selectedAITool ? TOOL_FORMS[selectedAITool] : null;

  // Form state
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);

  const setField = useCallback((id: string, value: unknown) => {
    setFieldValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  // Poll async job
  const pollJob = useCallback(async (jobId: string) => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const resp = await fetch(`/api/pixellab/background-jobs/${jobId}`);
      const data = await resp.json();
      if (data.status === 'completed' || data.status === 'done') return data;
      if (data.status === 'failed' || data.status === 'error') throw new Error(data.error || 'Job failed');
      const pct = data.last_response?.progress;
      setStatus(pct ? `Generating... ${Math.round(pct * 100)}%` : 'Generating...');
    }
    throw new Error('Generation timed out after 3 minutes');
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedAITool || !form) return;
    const apiPath = TOOL_API[selectedAITool];
    if (!apiPath) { setStatus('No API mapping for this tool yet.'); return; }

    setGenerating(true);
    setStatus('Sending request...');
    setResults([]);
    setResultId(null);

    try {
      const payload = buildPayload(selectedAITool, fieldValues);
      const resp = await fetch(`/api/pixellab/${apiPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || data.detail || `API error ${resp.status}`);

      let result = data;
      if (resp.status === 202 || data.job_id || data.background_job_id) {
        const jobId = data.job_id || data.background_job_id || data.id;
        setStatus('Queued... polling for result');
        result = await pollJob(jobId);
      }

      const rgba = findRgbaImages(result);
      const urls = rgba.length > 0 ? rgba : findImages(result);
      setResults(urls);
      if (result.id || result.character_id || result.tileset_id) {
        setResultId(result.id || result.character_id || result.tileset_id);
      }
      setStatus('Done');
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }, [selectedAITool, form, fieldValues, pollJob]);

  if (!selectedAITool || !form) {
    return (
      <aside className="w-[300px] flex-shrink-0">
        <div className="h-full flex flex-col bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden items-center justify-center">
          <span className="text-[13px] text-zinc-600 px-4 text-center">Select a tool from the left panel</span>
        </div>
      </aside>
    );
  }

  const costText = form.cost ? ` · ${form.cost} generations` : '';

  return (
    <aside className="w-[300px] flex-shrink-0">
      <div className="h-full flex flex-col bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-semibold text-zinc-200 truncate">{form.title}</span>
            {form.badge && (
              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0', BADGE_STYLES[form.badge])}>
                {form.badge}
              </span>
            )}
          </div>
          <button
            onClick={() => setSelectedAITool(null)}
            className="shrink-0 ml-2 w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {/* Tool indicator */}
          {form.desc && (
            <div className="mb-3 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-zinc-500 leading-snug">
              {form.desc}
            </div>
          )}

          {/* Cost */}
          {form.cost && (
            <div className="mb-3 text-[11px] text-amber-400 flex items-center gap-1">
              ⚠ This tool costs {form.cost} generations.
            </div>
          )}

          {/* Fields */}
          {form.fields.map((field) => {
            if (field.type === 'dropzone') {
              return <DropzoneField key={field.id} field={field} />;
            }
            if (field.type === 'range') {
              const val = (fieldValues[field.id] as number) ?? (field.value as number) ?? field.min ?? 0;
              return (
                <RangeField
                  key={field.id}
                  field={field}
                  value={val}
                  onChange={(v) => setField(field.id, v)}
                />
              );
            }
            return (
              <div key={field.id} className="mb-4">
                <label className="block text-[13px] font-semibold text-zinc-300 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-lg text-zinc-200 text-[13px] outline-none focus:border-emerald-500/50 resize-none min-h-[72px]"
                    placeholder={field.placeholder ?? ''}
                    value={(fieldValues[field.id] as string) ?? ''}
                    onChange={(e) => setField(field.id, e.target.value)}
                  />
                ) : field.type === 'select' ? (
                  <select
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-lg text-zinc-200 text-[13px] outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
                    value={(fieldValues[field.id] as string) ?? (field.options?.[0] ?? '')}
                    onChange={(e) => setField(field.id, e.target.value)}
                  >
                    {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : field.type === 'number' ? (
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-lg text-zinc-200 text-[13px] outline-none focus:border-emerald-500/50"
                    value={(fieldValues[field.id] as number) ?? (field.value as number) ?? ''}
                    onChange={(e) => setField(field.id, Number(e.target.value))}
                  />
                ) : (
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-lg text-zinc-200 text-[13px] outline-none focus:border-emerald-500/50"
                    placeholder={field.placeholder ?? ''}
                    value={(fieldValues[field.id] as string) ?? ''}
                    onChange={(e) => setField(field.id, e.target.value)}
                  />
                )}
                {field.hint && <div className="text-[11px] text-zinc-600 mt-1 leading-snug">{field.hint}</div>}
              </div>
            );
          })}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-900 font-semibold text-[14px] transition-colors mt-1"
          >
            {generating ? 'Generating...' : `Generate${costText}`}
          </button>

          {/* Status */}
          {status && (
            <div className={cn('mt-3 text-[12px]', status === 'Done' ? 'text-emerald-400' : status.includes('error') || status.includes('Error') || status.includes('failed') ? 'text-red-400' : 'text-zinc-500')}>
              {status}
            </div>
          )}

          {/* Results gallery */}
          {results.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {results.map((src, i) => (
                <div key={i} className="aspect-square bg-zinc-800 border border-white/[0.06] rounded-lg overflow-hidden cursor-pointer hover:border-emerald-500/40 transition-colors">
                  <img src={src} alt="Generated" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                </div>
              ))}
            </div>
          )}

          {/* Result ID */}
          {resultId && (
            <div className="mt-2 text-[11px] text-zinc-600">
              ID: <code className="text-emerald-400 select-all">{resultId}</code>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
