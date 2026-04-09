import { useRef, useEffect, useState } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { useStudio, type TilemapTool } from '@/store/studio-store';
import type { TilemapConfig } from '@problocks/engine';

// ── Constants ────────────────────────────────────────────────────────

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_SPEED = 0.001;
const GRID_COLOR = 0xffffff;
const GRID_ALPHA = 0.08;
const CURSOR_COLOR = 0x3b82f6;
const CURSOR_ALPHA = 0.35;
const RECT_PREVIEW_COLOR = 0x3b82f6;
const RECT_PREVIEW_ALPHA = 0.25;
const FLOOD_FILL_CAP = 10000;

// ── Default tilemap ─────────────────────────────────────────────────

function createDefaultTilemapConfig(): TilemapConfig {
  const rows = 32;
  const cols = 32;
  return {
    gridType: 'orthogonal',
    tileWidth: 32,
    tileHeight: 32,
    mapWidth: cols,
    mapHeight: rows,
    layers: [
      {
        name: 'Ground',
        data: Array.from({ length: rows }, () => Array(cols).fill(0)),
        visible: true,
        opacity: 1,
      },
      {
        name: 'Objects',
        data: Array.from({ length: rows }, () => Array(cols).fill(0)),
        visible: true,
        opacity: 1,
      },
    ],
  };
}

// ── Flood fill (BFS) ────────────────────────────────────────────────

function floodFill(
  data: number[][],
  startX: number,
  startY: number,
  fillId: number,
  mapWidth: number,
  mapHeight: number,
): { x: number; y: number }[] {
  const targetId = data[startY]?.[startX];
  if (targetId === undefined || targetId === fillId) return [];

  const filled: { x: number; y: number }[] = [];
  const visited = new Set<string>();
  const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];
  visited.add(`${startX},${startY}`);

  while (queue.length > 0 && filled.length < FLOOD_FILL_CAP) {
    const { x, y } = queue.shift()!;

    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) continue;
    if (data[y][x] !== targetId) continue;

    filled.push({ x, y });

    const neighbors = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 },
    ];
    for (const n of neighbors) {
      const key = `${n.x},${n.y}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(n);
      }
    }
  }

  return filled;
}

// ── Component ───────────────────────────────────────────────────────

export function TilemapViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [cursorTile, setCursorTile] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);

  const {
    tilemapConfig,
    activeTilemapLayer,
    activeTileId,
    activeTilemapTool,
    loadedTilesets,
    setTilemapConfig,
    setActiveTileId,
  } = useStudio();

  // Refs to share mutable state across closures without re-creating the effect
  const storeRef = useRef({
    config: tilemapConfig,
    activeLayer: activeTilemapLayer,
    tileId: activeTileId,
    tool: activeTilemapTool as TilemapTool,
    tilesets: loadedTilesets,
    showGrid,
    setTilemapConfig,
    setActiveTileId,
  });

  // Keep the ref current
  storeRef.current = {
    config: tilemapConfig,
    activeLayer: activeTilemapLayer,
    tileId: activeTileId,
    tool: activeTilemapTool,
    tilesets: loadedTilesets,
    showGrid,
    setTilemapConfig,
    setActiveTileId,
  };

  // Initialize tilemap if needed
  useEffect(() => {
    if (!tilemapConfig) {
      setTilemapConfig(createDefaultTilemapConfig());
    }
  }, [tilemapConfig, setTilemapConfig]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const containerEl = containerRef.current;
    let disposed = false;

    let app: Application;
    let worldContainer: Container;
    let gridGraphics: Graphics;
    let tileGraphics: Graphics;
    let cursorGraphics: Graphics;
    let rectPreviewGraphics: Graphics;

    // Camera state
    let camX = 0;
    let camY = 0;
    let camZoom = 1;

    // Pan state
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let panCamStartX = 0;
    let panCamStartY = 0;

    // Tool state
    let isDrawing = false;
    let rectStartTile: { x: number; y: number } | null = null;
    let rectEndTile: { x: number; y: number } | null = null;

    // ── Coordinate helpers ──────────────────────────────────────

    function screenToWorld(sx: number, sy: number) {
      const rect = canvas.getBoundingClientRect();
      const pixelX = (sx - rect.left);
      const pixelY = (sy - rect.top);
      const worldX = (pixelX - containerEl.clientWidth / 2) / camZoom + camX;
      const worldY = (pixelY - containerEl.clientHeight / 2) / camZoom + camY;
      return { worldX, worldY };
    }

    function worldToTile(worldX: number, worldY: number, config: TilemapConfig) {
      const tileX = Math.floor(worldX / config.tileWidth);
      const tileY = Math.floor(worldY / config.tileHeight);
      return { tileX, tileY };
    }

    function screenToTile(sx: number, sy: number) {
      const config = storeRef.current.config;
      if (!config) return null;
      const { worldX, worldY } = screenToWorld(sx, sy);
      const { tileX, tileY } = worldToTile(worldX, worldY, config);
      if (tileX < 0 || tileX >= config.mapWidth || tileY < 0 || tileY >= config.mapHeight) return null;
      return { x: tileX, y: tileY };
    }

    // ── Tile mutation helpers ───────────────────────────────────

    function setTileAt(x: number, y: number, tileId: number) {
      const s = storeRef.current;
      const config = s.config;
      if (!config) return;
      const layer = config.layers[s.activeLayer];
      if (!layer) return;
      if (y < 0 || y >= config.mapHeight || x < 0 || x >= config.mapWidth) return;
      if (layer.data[y][x] === tileId) return;

      // Deep-clone the config to trigger React state update
      const newConfig = {
        ...config,
        layers: config.layers.map((l, i) => {
          if (i !== s.activeLayer) return l;
          const newData = l.data.map((row, ry) => {
            if (ry !== y) return row;
            const newRow = [...row];
            newRow[x] = tileId;
            return newRow;
          });
          return { ...l, data: newData };
        }),
      };
      s.setTilemapConfig(newConfig);
    }

    function applyTool(tx: number, ty: number, tool: TilemapTool) {
      const s = storeRef.current;
      const config = s.config;
      if (!config) return;

      switch (tool) {
        case 'paint':
          setTileAt(tx, ty, s.tileId);
          break;
        case 'erase':
          setTileAt(tx, ty, 0);
          break;
        case 'eyedropper': {
          const layer = config.layers[s.activeLayer];
          if (!layer) return;
          const id = layer.data[ty]?.[tx] ?? 0;
          if (id > 0) s.setActiveTileId(id);
          break;
        }
        case 'fill': {
          const layer = config.layers[s.activeLayer];
          if (!layer) return;
          const tiles = floodFill(layer.data, tx, ty, s.tileId, config.mapWidth, config.mapHeight);
          if (tiles.length === 0) return;

          const newConfig = {
            ...config,
            layers: config.layers.map((l, i) => {
              if (i !== s.activeLayer) return l;
              const newData = l.data.map(row => [...row]);
              for (const t of tiles) {
                newData[t.y][t.x] = s.tileId;
              }
              return { ...l, data: newData };
            }),
          };
          s.setTilemapConfig(newConfig);
          break;
        }
        // rect handled separately via mousedown/mouseup
        case 'rect':
          break;
      }
    }

    function applyRect(x1: number, y1: number, x2: number, y2: number) {
      const s = storeRef.current;
      const config = s.config;
      if (!config) return;

      const minX = Math.max(0, Math.min(x1, x2));
      const maxX = Math.min(config.mapWidth - 1, Math.max(x1, x2));
      const minY = Math.max(0, Math.min(y1, y2));
      const maxY = Math.min(config.mapHeight - 1, Math.max(y1, y2));

      const newConfig = {
        ...config,
        layers: config.layers.map((l, i) => {
          if (i !== s.activeLayer) return l;
          const newData = l.data.map(row => [...row]);
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              newData[y][x] = s.tileId;
            }
          }
          return { ...l, data: newData };
        }),
      };
      s.setTilemapConfig(newConfig);
    }

    // ── Drawing functions ───────────────────────────────────────

    function drawGrid() {
      gridGraphics.clear();
      if (!storeRef.current.showGrid) return;

      const config = storeRef.current.config;
      if (!config) return;

      const { tileWidth, tileHeight, mapWidth, mapHeight } = config;
      const totalW = mapWidth * tileWidth;
      const totalH = mapHeight * tileHeight;

      gridGraphics.setStrokeStyle({ width: 1 / camZoom, color: GRID_COLOR, alpha: GRID_ALPHA });

      // Vertical lines
      for (let x = 0; x <= mapWidth; x++) {
        gridGraphics.moveTo(x * tileWidth, 0);
        gridGraphics.lineTo(x * tileWidth, totalH);
      }
      // Horizontal lines
      for (let y = 0; y <= mapHeight; y++) {
        gridGraphics.moveTo(0, y * tileHeight);
        gridGraphics.lineTo(totalW, y * tileHeight);
      }
      gridGraphics.stroke();

      // Map border (slightly stronger)
      gridGraphics.setStrokeStyle({ width: 2 / camZoom, color: GRID_COLOR, alpha: GRID_ALPHA * 3 });
      gridGraphics.rect(0, 0, totalW, totalH);
      gridGraphics.stroke();
    }

    function drawTiles() {
      tileGraphics.clear();

      const config = storeRef.current.config;
      if (!config) return;

      const { tileWidth, tileHeight, mapWidth, mapHeight, layers } = config;

      // Simple color-based rendering (no tileset textures for now — colored squares)
      // When tileset sprites are loaded, TilemapRenderer handles the fancy rendering.
      // This draws a simpler view for the editor.
      for (let li = 0; li < layers.length; li++) {
        const layer = layers[li];
        if (!layer.visible) continue;

        for (let y = 0; y < mapHeight; y++) {
          const row = layer.data[y];
          if (!row) continue;
          for (let x = 0; x < mapWidth; x++) {
            const tileId = row[x];
            if (tileId === 0) continue;

            // Generate a stable color from tileId
            const hue = (tileId * 137.508) % 360;
            const color = hslToHex(hue, 60, 45 + li * 10);

            tileGraphics.rect(x * tileWidth, y * tileHeight, tileWidth, tileHeight);
            tileGraphics.fill({ color, alpha: layer.opacity });
          }
        }
      }
    }

    function drawCursor(tile: { x: number; y: number } | null) {
      cursorGraphics.clear();
      if (!tile) return;

      const config = storeRef.current.config;
      if (!config) return;

      const { tileWidth, tileHeight } = config;

      cursorGraphics.rect(tile.x * tileWidth, tile.y * tileHeight, tileWidth, tileHeight);
      cursorGraphics.fill({ color: CURSOR_COLOR, alpha: CURSOR_ALPHA });
      cursorGraphics.setStrokeStyle({ width: 2 / camZoom, color: CURSOR_COLOR, alpha: 0.8 });
      cursorGraphics.rect(tile.x * tileWidth, tile.y * tileHeight, tileWidth, tileHeight);
      cursorGraphics.stroke();
    }

    function drawRectPreview() {
      rectPreviewGraphics.clear();
      if (!rectStartTile || !rectEndTile) return;

      const config = storeRef.current.config;
      if (!config) return;

      const { tileWidth, tileHeight } = config;

      const minX = Math.min(rectStartTile.x, rectEndTile.x);
      const maxX = Math.max(rectStartTile.x, rectEndTile.x);
      const minY = Math.min(rectStartTile.y, rectEndTile.y);
      const maxY = Math.max(rectStartTile.y, rectEndTile.y);

      const rx = minX * tileWidth;
      const ry = minY * tileHeight;
      const rw = (maxX - minX + 1) * tileWidth;
      const rh = (maxY - minY + 1) * tileHeight;

      rectPreviewGraphics.rect(rx, ry, rw, rh);
      rectPreviewGraphics.fill({ color: RECT_PREVIEW_COLOR, alpha: RECT_PREVIEW_ALPHA });
      rectPreviewGraphics.setStrokeStyle({ width: 2 / camZoom, color: RECT_PREVIEW_COLOR, alpha: 0.7 });
      rectPreviewGraphics.rect(rx, ry, rw, rh);
      rectPreviewGraphics.stroke();
    }

    function applyCamera() {
      const w = containerEl.clientWidth;
      const h = containerEl.clientHeight;

      worldContainer.position.set(
        w / 2 - camX * camZoom,
        h / 2 - camY * camZoom,
      );
      worldContainer.scale.set(camZoom, camZoom);
    }

    function renderAll() {
      drawGrid();
      drawTiles();
      drawRectPreview();
      applyCamera();
    }

    // ── HSL helper ──────────────────────────────────────────────

    function hslToHex(h: number, s: number, l: number): number {
      s /= 100;
      l /= 100;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color);
      };
      return (f(0) << 16) + (f(8) << 8) + f(4);
    }

    // ── Event handlers ──────────────────────────────────────────

    function onMouseDown(e: MouseEvent) {
      if (disposed) return;

      // Middle mouse → pan
      if (e.button === 1) {
        e.preventDefault();
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panCamStartX = camX;
        panCamStartY = camY;
        canvas.style.cursor = 'grabbing';
        return;
      }

      // Left mouse → tool
      if (e.button === 0) {
        const tile = screenToTile(e.clientX, e.clientY);
        if (!tile) return;

        const tool = storeRef.current.tool;

        if (tool === 'rect') {
          rectStartTile = tile;
          rectEndTile = tile;
          isDrawing = true;
          drawRectPreview();
        } else if (tool === 'fill' || tool === 'eyedropper') {
          applyTool(tile.x, tile.y, tool);
        } else {
          // paint / erase — continuous
          isDrawing = true;
          applyTool(tile.x, tile.y, tool);
        }

        renderAll();
      }
    }

    function onMouseMove(e: MouseEvent) {
      if (disposed) return;

      // Update cursor tile
      const tile = screenToTile(e.clientX, e.clientY);
      setCursorTile(tile);
      drawCursor(tile);
      applyCamera();

      // Pan
      if (isPanning) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        camX = panCamStartX - dx / camZoom;
        camY = panCamStartY - dy / camZoom;
        renderAll();
        return;
      }

      // Drawing
      if (isDrawing && tile) {
        const tool = storeRef.current.tool;
        if (tool === 'rect') {
          rectEndTile = tile;
          drawRectPreview();
          applyCamera();
        } else if (tool === 'paint' || tool === 'erase') {
          applyTool(tile.x, tile.y, tool);
          renderAll();
        }
      }
    }

    function onMouseUp(e: MouseEvent) {
      if (disposed) return;

      if (e.button === 1) {
        isPanning = false;
        canvas.style.cursor = '';
        return;
      }

      if (e.button === 0 && isDrawing) {
        isDrawing = false;
        const tool = storeRef.current.tool;

        if (tool === 'rect' && rectStartTile && rectEndTile) {
          applyRect(rectStartTile.x, rectStartTile.y, rectEndTile.x, rectEndTile.y);
          rectStartTile = null;
          rectEndTile = null;
          renderAll();
        }
      }
    }

    function onWheel(e: WheelEvent) {
      if (disposed) return;
      e.preventDefault();

      const delta = -e.deltaY * ZOOM_SPEED;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camZoom * (1 + delta)));

      // Zoom toward mouse cursor
      const { worldX, worldY } = screenToWorld(e.clientX, e.clientY);
      camX = worldX - (worldX - camX) * (camZoom / newZoom);
      camY = worldY - (worldY - camY) * (camZoom / newZoom);
      camZoom = newZoom;

      renderAll();
      drawCursor(screenToTile(e.clientX, e.clientY));
      applyCamera();
    }

    function onDblClick(e: MouseEvent) {
      // Middle-button double-click → reset camera
      if (e.button === 1) {
        const config = storeRef.current.config;
        if (!config) return;
        camX = (config.mapWidth * config.tileWidth) / 2;
        camY = (config.mapHeight * config.tileHeight) / 2;
        camZoom = 1;
        renderAll();
      }
    }

    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
    }

    // ── Init ────────────────────────────────────────────────────

    async function init() {
      app = new Application();
      const w = containerEl.clientWidth;
      const h = containerEl.clientHeight;
      await app.init({
        canvas,
        width: w,
        height: h,
        backgroundColor: 0x111117,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      worldContainer = new Container();
      app.stage.addChild(worldContainer);

      tileGraphics = new Graphics();
      gridGraphics = new Graphics();
      cursorGraphics = new Graphics();
      rectPreviewGraphics = new Graphics();

      worldContainer.addChild(tileGraphics);
      worldContainer.addChild(gridGraphics);
      worldContainer.addChild(rectPreviewGraphics);
      worldContainer.addChild(cursorGraphics);

      // Center camera on the map
      const config = storeRef.current.config;
      if (config) {
        camX = (config.mapWidth * config.tileWidth) / 2;
        camY = (config.mapHeight * config.tileHeight) / 2;
      }

      renderAll();
      setReady(true);
    }

    // ── Attach events ───────────────────────────────────────────

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('contextmenu', onContextMenu);

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !app) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      app.renderer.resize(w, h);
      renderAll();
    });
    ro.observe(containerEl);

    init();

    // ── Re-render when tilemap state changes ────────────────────
    // We use a MutationObserver-like approach: set up an interval to
    // check if the tilemap config has changed and re-render.
    // (Better would be an event system, but this matches the existing
    // patterns where PixiJS lives outside React's render cycle.)
    let lastConfigRef = storeRef.current.config;
    let lastShowGrid = storeRef.current.showGrid;
    const pollId = setInterval(() => {
      if (disposed) return;
      const currentConfig = storeRef.current.config;
      const currentShowGrid = storeRef.current.showGrid;
      if (currentConfig !== lastConfigRef || currentShowGrid !== lastShowGrid) {
        lastConfigRef = currentConfig;
        lastShowGrid = currentShowGrid;
        renderAll();
      }
    }, 50);

    return () => {
      disposed = true;
      clearInterval(pollId);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      ro.disconnect();
      try { app.destroy(true, { children: true }); } catch {}
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#111117]">
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* Coordinate display */}
      <div className="absolute top-2 left-2 flex gap-2">
        {cursorTile && (
          <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400 tabular-nums font-mono">
            {cursorTile.x}, {cursorTile.y}
          </span>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-2 left-2 flex gap-2">
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">Tilemap Editor</span>
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">
          {tilemapConfig ? `${tilemapConfig.mapWidth}x${tilemapConfig.mapHeight}` : '--'}
        </span>
        <button
          onClick={() => setShowGrid(g => !g)}
          className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
            showGrid ? 'bg-blue-600/70 text-white' : 'bg-black/70 text-gray-500'
          }`}
        >
          Grid
        </button>
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">
          Scroll: zoom &bull; Middle-drag: pan
        </span>
      </div>

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <span className="text-sm text-gray-400">Loading tilemap editor...</span>
        </div>
      )}
    </div>
  );
}
