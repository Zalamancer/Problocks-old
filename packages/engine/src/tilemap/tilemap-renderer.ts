/**
 * PixiJS tilemap renderer.
 *
 * Renders isometric / orthogonal / hex tilemaps using the PixiJS v8
 * sprite API.  Key design choices for Celeron N4000 / 4 GB targets:
 *
 *  - Viewport culling: only tiles visible on screen are rendered.
 *  - Sprite pooling: sprites are created once and recycled.
 *  - Texture caching: tileset sub-textures are created once via
 *    Texture constructor with frame rectangles.
 *  - Layers are separate PixiJS Containers with correct z-order.
 *  - Isometric layers render tiles back-to-front for proper overlap.
 */

import {
  Container,
  Sprite,
  Texture,
  Rectangle,
} from 'pixi.js';

import type {
  TilemapConfig,
  TilesetConfig,
  LayerConfig,
  Camera2D,
  GridType,
} from './types.js';
import { getDepthIndex, worldToScreenWithHeight } from './isometric.js';

// ── Internal sprite pool ─────────────────────────────────────────

/**
 * A minimal pool that recycles Sprite instances to avoid GC churn.
 */
class SpritePool {
  private pool: Sprite[] = [];

  acquire(): Sprite {
    const sprite = this.pool.pop();
    if (sprite) {
      sprite.visible = true;
      return sprite;
    }
    return new Sprite();
  }

  release(sprite: Sprite): void {
    sprite.visible = false;
    this.pool.push(sprite);
  }
}

// ── Tile texture cache ───────────────────────────────────────────

/**
 * Caches sub-textures carved from tileset source textures.
 * Key: "tilesetIndex:localTileId"
 */
type TextureCache = Map<string, Texture>;

// ── Renderer class ───────────────────────────────────────────────

export class TilemapRenderer {
  private root: Container;
  private layerContainers: Container[] = [];
  private spritePool = new SpritePool();
  private textureCache: TextureCache = new Map();

  /**
   * Sprites currently in use, keyed by "layer,x,y" so we can
   * diff between frames and only touch what changed.
   */
  private activeSprites: Map<string, Sprite> = new Map();

  /** Tileset base textures (loaded once). */
  private tilesetTextures: Map<number, Texture> = new Map();

  /**
   * @param parent  PixiJS container (or stage) to add the tilemap into.
   */
  constructor(parent: Container) {
    this.root = new Container();
    parent.addChild(this.root);
  }

  // ── Tileset loading ──────────────────────────────────────────

  /**
   * Pre-load tileset textures.  Call once (or when tilesets change).
   */
  loadTilesets(tilesets: ReadonlyArray<TilesetConfig>): void {
    this.textureCache.clear();
    this.tilesetTextures.clear();

    for (let i = 0; i < tilesets.length; i++) {
      const ts = tilesets[i];
      const baseTexture = Texture.from(ts.imageSource);
      this.tilesetTextures.set(i, baseTexture);
    }
  }

  /**
   * Get (or create and cache) the sub-texture for a global tile ID.
   */
  private getTileTexture(
    globalTileId: number,
    tilesets: ReadonlyArray<TilesetConfig>,
  ): Texture | null {
    if (globalTileId <= 0) return null;

    // Find which tileset this gid belongs to
    let tilesetIndex = -1;
    for (let i = tilesets.length - 1; i >= 0; i--) {
      if (globalTileId >= tilesets[i].firstGid) {
        tilesetIndex = i;
        break;
      }
    }
    if (tilesetIndex < 0) return null;

    const cacheKey = `${tilesetIndex}:${globalTileId}`;
    const cached = this.textureCache.get(cacheKey);
    if (cached) return cached;

    const ts = tilesets[tilesetIndex];
    const localId = globalTileId - ts.firstGid;
    if (localId < 0 || localId >= ts.tileCount) return null;

    const col = localId % ts.columns;
    const row = Math.floor(localId / ts.columns);

    const baseTexture = this.tilesetTextures.get(tilesetIndex);
    if (!baseTexture) return null;

    const frame = new Rectangle(
      col * ts.tileWidth,
      row * ts.tileHeight,
      ts.tileWidth,
      ts.tileHeight,
    );

    const subTexture = new Texture({
      source: baseTexture.source,
      frame,
    });

    this.textureCache.set(cacheKey, subTexture);
    return subTexture;
  }

  // ── Main render ──────────────────────────────────────────────

  /**
   * Render the tilemap.  Call once per frame.
   *
   * @param tilemap  Tilemap configuration (layers, dimensions, grid type).
   * @param camera   Camera state for viewport offset and zoom.
   * @param tilesets Tileset configurations for texture lookup.
   * @param viewportWidth   Viewport width in pixels.
   * @param viewportHeight  Viewport height in pixels.
   */
  render(
    tilemap: TilemapConfig,
    camera: Camera2D,
    tilesets: ReadonlyArray<TilesetConfig>,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    // Ensure we have the right number of layer containers
    this.syncLayerContainers(tilemap.layers.length);

    // Track which sprite keys survive this frame
    const survivingKeys = new Set<string>();

    for (let li = 0; li < tilemap.layers.length; li++) {
      const layer = tilemap.layers[li];
      const container = this.layerContainers[li];

      container.visible = layer.visible;
      container.alpha = layer.opacity;
      if (!layer.visible) continue;

      this.renderLayer(
        tilemap,
        layer,
        li,
        camera,
        tilesets,
        viewportWidth,
        viewportHeight,
        container,
        survivingKeys,
      );
    }

    // Reclaim sprites that are no longer visible
    for (const [key, sprite] of this.activeSprites) {
      if (!survivingKeys.has(key)) {
        sprite.parent?.removeChild(sprite);
        this.spritePool.release(sprite);
        this.activeSprites.delete(key);
      }
    }
  }

  // ── Per-layer render ─────────────────────────────────────────

  private renderLayer(
    tilemap: TilemapConfig,
    layer: LayerConfig,
    layerIndex: number,
    camera: Camera2D,
    tilesets: ReadonlyArray<TilesetConfig>,
    viewportWidth: number,
    viewportHeight: number,
    container: Container,
    survivingKeys: Set<string>,
  ): void {
    const { gridType, tileWidth, tileHeight, mapWidth, mapHeight } = tilemap;

    // Compute visible tile range based on camera
    const visibleRange = this.getVisibleRange(
      gridType,
      camera,
      tileWidth,
      tileHeight,
      mapWidth,
      mapHeight,
      viewportWidth,
      viewportHeight,
    );

    // For isometric: we need back-to-front ordering
    // Iterate y first (back to front), then x (left to right)
    if (gridType === 'isometric') {
      this.renderIsometricLayer(
        layer,
        layerIndex,
        camera,
        tilesets,
        tileWidth,
        tileHeight,
        container,
        survivingKeys,
        visibleRange,
      );
    } else {
      this.renderOrthogonalLayer(
        layer,
        layerIndex,
        camera,
        tilesets,
        tileWidth,
        tileHeight,
        container,
        survivingKeys,
        visibleRange,
      );
    }
  }

  private renderIsometricLayer(
    layer: LayerConfig,
    layerIndex: number,
    camera: Camera2D,
    tilesets: ReadonlyArray<TilesetConfig>,
    tileWidth: number,
    tileHeight: number,
    container: Container,
    survivingKeys: Set<string>,
    range: VisibleRange,
  ): void {
    // Collect tiles to render, then sort by depth
    const tilesToRender: Array<{
      x: number;
      y: number;
      tileId: number;
      depth: number;
    }> = [];

    for (let y = range.minY; y <= range.maxY; y++) {
      if (y < 0 || y >= layer.data.length) continue;
      const row = layer.data[y];
      for (let x = range.minX; x <= range.maxX; x++) {
        if (x < 0 || x >= row.length) continue;
        const tileId = row[x];
        if (tileId === 0) continue;
        tilesToRender.push({
          x,
          y,
          tileId,
          depth: getDepthIndex(x, y, layerIndex),
        });
      }
    }

    // Sort back-to-front
    tilesToRender.sort((a, b) => a.depth - b.depth);

    for (const tile of tilesToRender) {
      const texture = this.getTileTexture(tile.tileId, tilesets);
      if (!texture) continue;

      const key = `${layerIndex},${tile.x},${tile.y}`;
      survivingKeys.add(key);

      const screen = worldToScreenWithHeight(
        tile.x,
        tile.y,
        0,
        tileWidth,
        tileHeight,
      );

      let sprite = this.activeSprites.get(key);
      if (!sprite) {
        sprite = this.spritePool.acquire();
        container.addChild(sprite);
        this.activeSprites.set(key, sprite);
      }

      sprite.texture = texture;
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(
        (screen.screenX - camera.x) * camera.zoom + 0,
        (screen.screenY - camera.y) * camera.zoom + 0,
      );
      sprite.scale.set(camera.zoom, camera.zoom);

      // Ensure correct z-order within the container
      sprite.zIndex = tile.depth;
    }

    container.sortableChildren = true;
  }

  private renderOrthogonalLayer(
    layer: LayerConfig,
    layerIndex: number,
    camera: Camera2D,
    tilesets: ReadonlyArray<TilesetConfig>,
    tileWidth: number,
    tileHeight: number,
    container: Container,
    survivingKeys: Set<string>,
    range: VisibleRange,
  ): void {
    for (let y = range.minY; y <= range.maxY; y++) {
      if (y < 0 || y >= layer.data.length) continue;
      const row = layer.data[y];
      for (let x = range.minX; x <= range.maxX; x++) {
        if (x < 0 || x >= row.length) continue;
        const tileId = row[x];
        if (tileId === 0) continue;

        const texture = this.getTileTexture(tileId, tilesets);
        if (!texture) continue;

        const key = `${layerIndex},${x},${y}`;
        survivingKeys.add(key);

        const screenX = x * tileWidth;
        const screenY = y * tileHeight;

        let sprite = this.activeSprites.get(key);
        if (!sprite) {
          sprite = this.spritePool.acquire();
          container.addChild(sprite);
          this.activeSprites.set(key, sprite);
        }

        sprite.texture = texture;
        sprite.anchor.set(0, 0);
        sprite.position.set(
          (screenX - camera.x) * camera.zoom,
          (screenY - camera.y) * camera.zoom,
        );
        sprite.scale.set(camera.zoom, camera.zoom);
      }
    }
  }

  // ── Viewport culling ─────────────────────────────────────────

  private getVisibleRange(
    gridType: GridType,
    camera: Camera2D,
    tileWidth: number,
    tileHeight: number,
    mapWidth: number,
    mapHeight: number,
    viewportWidth: number,
    viewportHeight: number,
  ): VisibleRange {
    // Extra margin (in tiles) to avoid popping at edges
    const margin = 2;
    const invZoom = 1 / camera.zoom;

    if (gridType === 'isometric') {
      // For isometric, the visible region in grid space is a rotated
      // rectangle.  We over-estimate by using the full map bounds
      // intersected with an approximate screen-to-grid conversion.
      const halfVW = (viewportWidth * invZoom) / 2;
      const halfVH = (viewportHeight * invZoom) / 2;

      // Screen corners in world space (approximate — we use the
      // center of the viewport offset by camera)
      const cx = camera.x;
      const cy = camera.y;

      const halfW = tileWidth / 2;
      const halfH = tileHeight / 2;

      // Convert viewport corners to grid coords
      const corners = [
        { sx: cx - halfVW, sy: cy - halfVH },
        { sx: cx + halfVW, sy: cy - halfVH },
        { sx: cx - halfVW, sy: cy + halfVH },
        { sx: cx + halfVW, sy: cy + halfVH },
      ];

      let gMinX = Infinity;
      let gMinY = Infinity;
      let gMaxX = -Infinity;
      let gMaxY = -Infinity;

      for (const c of corners) {
        const gx = (c.sx / halfW + c.sy / halfH) / 2;
        const gy = (c.sy / halfH - c.sx / halfW) / 2;
        gMinX = Math.min(gMinX, gx);
        gMinY = Math.min(gMinY, gy);
        gMaxX = Math.max(gMaxX, gx);
        gMaxY = Math.max(gMaxY, gy);
      }

      return {
        minX: Math.max(0, Math.floor(gMinX) - margin),
        minY: Math.max(0, Math.floor(gMinY) - margin),
        maxX: Math.min(mapWidth - 1, Math.ceil(gMaxX) + margin),
        maxY: Math.min(mapHeight - 1, Math.ceil(gMaxY) + margin),
      };
    }

    // Orthogonal / hex: straightforward screen-to-tile
    const minTileX = Math.floor((camera.x * invZoom) / tileWidth) - margin;
    const minTileY = Math.floor((camera.y * invZoom) / tileHeight) - margin;
    const tilesAcrossX = Math.ceil(viewportWidth * invZoom / tileWidth) + margin * 2;
    const tilesAcrossY = Math.ceil(viewportHeight * invZoom / tileHeight) + margin * 2;

    return {
      minX: Math.max(0, minTileX),
      minY: Math.max(0, minTileY),
      maxX: Math.min(mapWidth - 1, minTileX + tilesAcrossX),
      maxY: Math.min(mapHeight - 1, minTileY + tilesAcrossY),
    };
  }

  // ── Layer container management ───────────────────────────────

  private syncLayerContainers(count: number): void {
    // Add containers if needed
    while (this.layerContainers.length < count) {
      const c = new Container();
      this.root.addChild(c);
      this.layerContainers.push(c);
    }
    // Hide excess containers
    for (let i = count; i < this.layerContainers.length; i++) {
      this.layerContainers[i].visible = false;
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────

  /**
   * Destroy all PixiJS objects owned by this renderer.
   */
  dispose(): void {
    for (const [, sprite] of this.activeSprites) {
      sprite.destroy();
    }
    this.activeSprites.clear();

    for (const container of this.layerContainers) {
      container.destroy({ children: true });
    }
    this.layerContainers = [];

    this.root.destroy({ children: true });
    this.textureCache.clear();
    this.tilesetTextures.clear();
  }

  /**
   * Get the root container (e.g. to reposition the entire tilemap).
   */
  getRoot(): Container {
    return this.root;
  }
}

// ── Internal types ───────────────────────────────────────────────

interface VisibleRange {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
