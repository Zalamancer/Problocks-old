/**
 * Asset manager — core registry for game assets with IndexedDB persistence,
 * PixiJS texture caching, search/filter, and sprite sheet import.
 */

import { Assets, Texture } from 'pixi.js';

import type {
  AssetCategory,
  AssetEntry,
  AssetMetadata,
  AssetPerspective,
} from './asset-schema.js';
import type { SpriteSheetConfig } from './sprite-sheet.js';
import { sliceGrid } from './sprite-sheet.js';

// ── IndexedDB constants ──────────────────────────────────────────

const DB_NAME = 'problocks-assets';
const DB_VERSION = 1;
const STORE_METADATA = 'metadata';
const STORE_BLOBS = 'blobs';

// ── Event types ──────────────────────────────────────────────────

export type AssetManagerEvent = 'registered' | 'unregistered' | 'loaded';

type EventCallback = (assetId: string) => void;

// ── AssetManager ─────────────────────────────────────────────────

/**
 * Central registry for all game assets.
 * Handles registration, retrieval, search, caching, and IndexedDB persistence.
 */
export class AssetManager {
  private registry: Map<string, AssetEntry> = new Map();
  private textureCache: Map<string, Texture> = new Map();
  private listeners: Map<AssetManagerEvent, Set<EventCallback>> = new Map();
  private db: IDBDatabase | null = null;

  // ── Registration ─────────────────────────────────────────────

  /**
   * Register a new asset with metadata and image source.
   * @param metadata — Full or partial metadata (id and createdAt auto-filled if missing).
   * @param source — Image URL string or Blob of the image data.
   * @returns The asset ID.
   */
  async register(
    metadata: AssetMetadata | Partial<AssetMetadata>,
    source: string | Blob
  ): Promise<string> {
    const id = (metadata as AssetMetadata).id || crypto.randomUUID();
    const now = Date.now();

    const fullMetadata: AssetMetadata = {
      id,
      name: metadata.name ?? 'Untitled Asset',
      category: metadata.category ?? 'other',
      tags: metadata.tags ?? [],
      style: metadata.style ?? '',
      perspective: metadata.perspective ?? 'any',
      collisionShape: metadata.collisionShape ?? { type: 'none' },
      placementRules: metadata.placementRules ?? [],
      anchor: metadata.anchor ?? { x: 0.5, y: 0.5 },
      size: metadata.size ?? { width: 64, height: 64 },
      variants: metadata.variants,
      source: metadata.source ?? 'imported',
      sourcePrompt: metadata.sourcePrompt,
      createdAt: metadata.createdAt ?? now,
      thumbnailUrl: metadata.thumbnailUrl,
    };

    const entry: AssetEntry = {
      metadata: fullMetadata,
      loaded: false,
    };

    if (typeof source === 'string') {
      // URL string
      entry.url = source;
      entry.loaded = true;
    } else {
      // Blob — create an object URL and also store a data URL for persistence
      entry.blobUrl = URL.createObjectURL(source);
      entry.dataUrl = await this.blobToDataUrl(source);
      entry.loaded = true;
    }

    this.registry.set(id, entry);
    this.emit('registered', id);

    return id;
  }

  /**
   * Unregister an asset and clean up its resources.
   */
  unregister(id: string): void {
    const entry = this.registry.get(id);
    if (!entry) return;

    // Revoke object URL if we created one
    if (entry.blobUrl) {
      URL.revokeObjectURL(entry.blobUrl);
    }

    // Destroy cached texture
    const cachedTexture = this.textureCache.get(id);
    if (cachedTexture) {
      cachedTexture.destroy(true);
      this.textureCache.delete(id);
    }

    this.registry.delete(id);
    this.emit('unregistered', id);
  }

  // ── Retrieval ────────────────────────────────────────────────

  /**
   * Get an asset entry by ID.
   */
  get(id: string): AssetEntry | undefined {
    return this.registry.get(id);
  }

  /**
   * Get (or create and cache) a PixiJS Texture for an asset.
   * Textures are cached so repeated calls return the same object.
   */
  async getTexture(id: string): Promise<Texture> {
    const cached = this.textureCache.get(id);
    if (cached) return cached;

    const entry = this.registry.get(id);
    if (!entry) {
      throw new Error(`Asset not found: ${id}`);
    }

    const url = entry.blobUrl ?? entry.dataUrl ?? entry.url;
    if (!url) {
      throw new Error(`Asset ${id} has no loadable source`);
    }

    // Use PixiJS Assets loader for proper texture creation
    const texture = await Assets.load<Texture>(url);
    this.textureCache.set(id, texture);
    this.emit('loaded', id);
    return texture;
  }

  /**
   * Get all registered asset entries.
   */
  getAll(): AssetEntry[] {
    return Array.from(this.registry.values());
  }

  // ── Search & Filter ──────────────────────────────────────────

  /**
   * Search assets by substring match on name and tags.
   */
  search(query: string): AssetEntry[] {
    const lower = query.toLowerCase();
    return this.filter((entry) => {
      const nameMatch = entry.metadata.name.toLowerCase().includes(lower);
      const tagMatch = entry.metadata.tags.some((tag) =>
        tag.toLowerCase().includes(lower)
      );
      return nameMatch || tagMatch;
    });
  }

  /**
   * Filter assets by category.
   */
  filterByCategory(category: AssetCategory): AssetEntry[] {
    return this.filter((entry) => entry.metadata.category === category);
  }

  /**
   * Filter assets that have ALL the specified tags.
   */
  filterByTags(tags: string[]): AssetEntry[] {
    const lowerTags = tags.map((t) => t.toLowerCase());
    return this.filter((entry) => {
      const entryTags = entry.metadata.tags.map((t) => t.toLowerCase());
      return lowerTags.every((tag) => entryTags.includes(tag));
    });
  }

  /**
   * Filter assets by art style.
   */
  filterByStyle(style: string): AssetEntry[] {
    const lower = style.toLowerCase();
    return this.filter(
      (entry) => entry.metadata.style.toLowerCase() === lower
    );
  }

  /**
   * Filter assets by perspective.
   */
  filterByPerspective(perspective: AssetPerspective): AssetEntry[] {
    return this.filter(
      (entry) =>
        entry.metadata.perspective === perspective ||
        entry.metadata.perspective === 'any'
    );
  }

  /**
   * Filter assets with a custom predicate.
   */
  filter(predicate: (entry: AssetEntry) => boolean): AssetEntry[] {
    const results: AssetEntry[] = [];
    for (const entry of this.registry.values()) {
      if (predicate(entry)) {
        results.push(entry);
      }
    }
    return results;
  }

  // ── Import ───────────────────────────────────────────────────

  /**
   * Import an asset from a URL.
   */
  async importFromUrl(
    url: string,
    metadata: Partial<AssetMetadata>
  ): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch asset from ${url}: ${response.status}`);
    }
    const blob = await response.blob();

    // Detect image dimensions
    const size = metadata.size ?? (await this.detectImageSize(blob));

    return this.register(
      {
        ...metadata,
        size,
        source: metadata.source ?? 'imported',
      },
      blob
    );
  }

  /**
   * Import an asset from a user-selected File.
   */
  async importFromFile(
    file: File,
    metadata: Partial<AssetMetadata>
  ): Promise<string> {
    const size = metadata.size ?? (await this.detectImageSize(file));
    const name = metadata.name ?? file.name.replace(/\.[^.]+$/, '');

    return this.register(
      {
        ...metadata,
        name,
        size,
        source: metadata.source ?? 'imported',
      },
      file
    );
  }

  /**
   * Import a sprite sheet and register each tile as a separate asset.
   * @returns Array of asset IDs for the individual tiles.
   */
  async importSpriteSheet(
    source: string | Blob,
    config: SpriteSheetConfig
  ): Promise<string[]> {
    // Load the source image
    let bitmap: ImageBitmap;
    if (typeof source === 'string') {
      const response = await fetch(source);
      const blob = await response.blob();
      bitmap = await createImageBitmap(blob);
    } else {
      bitmap = await createImageBitmap(source);
    }

    const tiles = await sliceGrid(bitmap, config);
    bitmap.close();

    const ids: string[] = [];
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      // Convert ImageBitmap to Blob
      const canvas = this.makeCanvas(config.tileWidth, config.tileHeight);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(tile, 0, 0);
      const blob = await this.canvasToBlob(canvas);
      tile.close();

      const row = Math.floor(i / config.columns);
      const col = i % config.columns;

      const id = await this.register(
        {
          name: `Tile (${row}, ${col})`,
          category: 'tileset',
          tags: ['tile', 'spritesheet'],
          size: { width: config.tileWidth, height: config.tileHeight },
          source: 'imported',
        },
        blob
      );
      ids.push(id);
    }

    return ids;
  }

  // ── Persistence (IndexedDB) ──────────────────────────────────

  /**
   * Persist the entire asset registry to IndexedDB.
   * Stores metadata and data URLs (for blob-based assets).
   */
  async save(): Promise<void> {
    const db = await this.openDB();

    // Save all metadata
    const metaTx = db.transaction(STORE_METADATA, 'readwrite');
    const metaStore = metaTx.objectStore(STORE_METADATA);

    // Clear existing data
    metaStore.clear();

    for (const entry of this.registry.values()) {
      const serialized = {
        id: entry.metadata.id,
        metadata: entry.metadata,
        dataUrl: entry.dataUrl,
        url: entry.url,
      };
      metaStore.put(serialized);
    }

    await this.txComplete(metaTx);

    // Save blobs separately for assets that have data URLs
    const blobTx = db.transaction(STORE_BLOBS, 'readwrite');
    const blobStore = blobTx.objectStore(STORE_BLOBS);
    blobStore.clear();

    for (const entry of this.registry.values()) {
      if (entry.dataUrl) {
        blobStore.put({
          id: entry.metadata.id,
          dataUrl: entry.dataUrl,
        });
      }
    }

    await this.txComplete(blobTx);
  }

  /**
   * Load the asset registry from IndexedDB.
   * Restores metadata and rebuilds object URLs from stored data.
   */
  async load(): Promise<void> {
    const db = await this.openDB();

    // Load metadata
    const metaTx = db.transaction(STORE_METADATA, 'readonly');
    const metaStore = metaTx.objectStore(STORE_METADATA);
    const allMeta = await this.getAllFromStore<{
      id: string;
      metadata: AssetMetadata;
      dataUrl?: string;
      url?: string;
    }>(metaStore);

    // Load blobs
    const blobTx = db.transaction(STORE_BLOBS, 'readonly');
    const blobStore = blobTx.objectStore(STORE_BLOBS);
    const allBlobs = await this.getAllFromStore<{
      id: string;
      dataUrl: string;
    }>(blobStore);

    const blobMap = new Map<string, string>();
    for (const blob of allBlobs) {
      blobMap.set(blob.id, blob.dataUrl);
    }

    // Rebuild registry
    for (const record of allMeta) {
      const entry: AssetEntry = {
        metadata: record.metadata,
        dataUrl: record.dataUrl ?? blobMap.get(record.id),
        url: record.url,
        loaded: true,
      };

      // Recreate object URL from data URL for efficient rendering
      if (entry.dataUrl) {
        const blob = await this.dataUrlToBlob(entry.dataUrl);
        entry.blobUrl = URL.createObjectURL(blob);
      }

      this.registry.set(record.id, entry);
    }
  }

  // ── Bulk operations ──────────────────────────────────────────

  /**
   * Import an asset pack from a URL.
   * Expects a JSON manifest at the URL with the format:
   * { assets: [{ metadata: AssetMetadata, url: string }] }
   *
   * @returns Array of registered asset IDs.
   */
  async importPack(packUrl: string): Promise<string[]> {
    const response = await fetch(packUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch asset pack: ${response.status}`);
    }

    const manifest = (await response.json()) as {
      assets: Array<{
        metadata: Partial<AssetMetadata>;
        url: string;
      }>;
    };

    if (!manifest.assets || !Array.isArray(manifest.assets)) {
      throw new Error(
        'Invalid asset pack manifest: missing "assets" array'
      );
    }

    const ids: string[] = [];
    for (const item of manifest.assets) {
      const id = await this.importFromUrl(item.url, item.metadata);
      ids.push(id);
    }

    return ids;
  }

  /**
   * Export selected assets as a JSON pack blob.
   * Returns a Blob containing a JSON manifest with embedded base64 data URLs.
   */
  async exportPack(assetIds: string[]): Promise<Blob> {
    const assets: Array<{
      metadata: AssetMetadata;
      dataUrl?: string;
      url?: string;
    }> = [];

    for (const id of assetIds) {
      const entry = this.registry.get(id);
      if (!entry) {
        throw new Error(`Asset not found for export: ${id}`);
      }

      assets.push({
        metadata: entry.metadata,
        dataUrl: entry.dataUrl,
        url: entry.url,
      });
    }

    const manifest = { version: 1, assets };
    const json = JSON.stringify(manifest, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  // ── Events ───────────────────────────────────────────────────

  /**
   * Subscribe to an asset manager event.
   */
  on(event: AssetManagerEvent, callback: EventCallback): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);
  }

  /**
   * Unsubscribe from an asset manager event.
   */
  off(event: AssetManagerEvent, callback: EventCallback): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  /**
   * Emit an event to all subscribers.
   */
  private emit(event: AssetManagerEvent, assetId: string): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(assetId);
      } catch {
        // Swallow listener errors so one bad callback doesn't break others
      }
    }
  }

  // ── IndexedDB helpers ────────────────────────────────────────

  /**
   * Open (or create) the IndexedDB database.
   */
  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(new Error(`IndexedDB open failed: ${request.error?.message}`));
      };
    });
  }

  /**
   * Wrap an IDBTransaction completion in a Promise.
   */
  private txComplete(tx: IDBTransaction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(new Error(`IndexedDB transaction failed: ${tx.error?.message}`));
    });
  }

  /**
   * Get all records from an object store.
   */
  private getAllFromStore<T>(store: IDBObjectStore): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () =>
        reject(
          new Error(`IndexedDB getAll failed: ${request.error?.message}`)
        );
    });
  }

  // ── Image helpers ────────────────────────────────────────────

  /**
   * Convert a Blob to a base64 data URL.
   */
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert a base64 data URL back to a Blob.
   */
  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  /**
   * Detect image dimensions from a Blob.
   */
  private async detectImageSize(
    blob: Blob
  ): Promise<{ width: number; height: number }> {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
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
