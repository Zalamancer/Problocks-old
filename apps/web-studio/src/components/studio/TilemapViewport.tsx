/**
 * HexPainter viewport — ported from Problocks_Light hex-painter.html
 * Uses raw Canvas2D for hex grid rendering, painting, stacking, etc.
 */
import { useRef, useEffect, useCallback } from 'react';
import { useStudio } from '@/store/studio-store';
import type { HexMapData } from '@/store/studio-store';

// ── Hex math constants ─────────────────────────────────────────────

const S3 = Math.sqrt(3);

// ── Component ──────────────────────────────────────────────────────

export function TilemapViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ReturnType<typeof useStudio> | null>(null);
  const imgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const store = useStudio();
  stateRef.current = store;

  // Load Image objects from palette dataUrls
  const loadImages = useCallback(() => {
    const cache = imgCacheRef.current;
    const palette = stateRef.current?.hexPalette ?? [];
    for (const tile of palette) {
      if (!cache.has(tile.dataUrl)) {
        const img = new Image();
        img.src = tile.dataUrl;
        cache.set(tile.dataUrl, img);
      }
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [store.hexPalette, loadImages]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const container = containerRef.current;
    if (!canvasEl || !container) return;

    // Use local const to satisfy TypeScript narrowing in closures
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx = canvas.getContext('2d')!;
    let disposed = false;

    // ── Mutable state (mirrors hex-painter.html) ─────────────
    let hexR = 16;
    const viewAngle = 70;
    const yScale = Math.sin(viewAngle * Math.PI / 180);
    const cam = { x: 0, y: 0, zoom: 3 };
    let hover: { q: number; r: number } | null = null;
    let isDrawing: boolean | 'erase' = false;
    let isPanning = false;
    let panLast = { x: 0, y: 0 };
    let spaceHeld = false;
    const heightEdited = new Set<string>();

    // ── Hex math ─────────────────────────────────────────────

    function hexToPixel(q: number, r: number) {
      return { x: hexR * 1.5 * q, y: hexR * yScale * (S3 / 2 * q + S3 * r) };
    }

    function pixelToHex(wx: number, wy: number) {
      const fq = (2 / 3 * wx) / hexR;
      const fr = (-1 / 3 * wx + S3 / 3 * (wy / yScale)) / hexR;
      return hexRound(fq, fr);
    }

    function hexRound(fq: number, fr: number) {
      const fs = -fq - fr;
      let q = Math.round(fq), r = Math.round(fr), s = Math.round(fs);
      const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
      if (dq > dr && dq > ds) q = -r - s;
      else if (dr > ds) r = -q - s;
      return { q, r };
    }

    function hk(q: number, r: number) { return `${q},${r}`; }

    function hexNeighbors(q: number, r: number) {
      return [{ q: q + 1, r }, { q: q - 1, r }, { q, r: r + 1 }, { q, r: r - 1 }, { q: q + 1, r: r - 1 }, { q: q - 1, r: r + 1 }];
    }

    function getHexesInBrush(cq: number, cr: number) {
      const s = stateRef.current!;
      const brushSize = s.hexBrushSize;
      const brushShape = s.hexBrushShape;
      if (brushSize <= 1) return [{ q: cq, r: cr }];
      const rad = brushSize - 1;
      const all: { q: number; r: number }[] = [];
      for (let dq = -rad; dq <= rad; dq++) {
        for (let dr = Math.max(-rad, -dq - rad); dr <= Math.min(rad, -dq + rad); dr++) {
          all.push({ q: cq + dq, r: cr + dr });
        }
      }
      if (brushShape === 'ring') {
        return all.filter(h => {
          const dist = Math.max(Math.abs(h.q - cq), Math.abs(h.r - cr), Math.abs(-h.q - h.r + cq + cr));
          return dist === rad;
        });
      }
      if (brushShape === 'random') {
        return all.filter(() => Math.random() < 0.4);
      }
      return all;
    }

    function drawHexPath(cx: number, cy: number, r: number) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a) * yScale;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    // ── Camera ───────────────────────────────────────────────

    function screenToWorld(sx: number, sy: number) {
      const rect = canvas.getBoundingClientRect();
      const cx = (sx - rect.left) * (canvas.width / rect.width);
      const cy = (sy - rect.top) * (canvas.height / rect.height);
      return { x: (cx - canvas.width / 2) / cam.zoom + cam.x, y: (cy - canvas.height / 2) / cam.zoom + cam.y };
    }

    function canvasCoords(e: MouseEvent | WheelEvent) {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
    }

    // ── Helpers ───────────────────────────────────────────────

    function getPalImg(index: number): HTMLImageElement | null {
      const pal = stateRef.current?.hexPalette ?? [];
      const tile = pal[index];
      if (!tile) return null;
      return imgCacheRef.current.get(tile.dataUrl) ?? null;
    }

    function getMapData(): HexMapData {
      return stateRef.current?.hexMapData ?? { map: {}, rotMap: {}, flipMap: {}, heightMap: {} };
    }

    // ── Render ────────────────────────────────────────────────

    let rafId = 0;
    function scheduleRender() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(render);
    }

    function getVisibleHexes() {
      const hw = canvas.width / 2 / cam.zoom, hh = canvas.height / 2 / cam.zoom;
      const pad = hexR * 4;
      const x0 = cam.x - hw - pad, y0 = cam.y - hh - pad;
      const x1 = cam.x + hw + pad, y1 = cam.y + hh + pad;
      const qMin = Math.floor(x0 / (1.5 * hexR)) - 1, qMax = Math.ceil(x1 / (1.5 * hexR)) + 1;
      const out: { q: number; r: number }[] = [];
      const ys = hexR * yScale;
      for (let q = qMin; q <= qMax; q++) {
        const qy = S3 / 2 * ys * q;
        const rMin = Math.floor((y0 - qy) / (S3 * ys)) - 1;
        const rMax = Math.ceil((y1 - qy) / (S3 * ys)) + 1;
        for (let r = rMin; r <= rMax; r++) out.push({ q, r });
      }
      return out;
    }

    function render() {
      if (disposed) return;
      const s = stateRef.current!;
      const md = getMapData();
      const { map, rotMap, flipMap, heightMap } = md;
      const showGrid = s.hexShowGrid;
      const showCoords = s.hexShowCoords;
      const clipHex = s.hexClipToHex;
      const clipZoom = s.hexTileZoom;
      const yOff = s.hexYOffset;
      const tool = s.activeTilemapTool;
      const selTile = s.hexSelectedTile;

      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);
      ctx.imageSmoothingEnabled = false;

      const hexes = getVisibleHexes();

      // Origin marker
      const op = hexToPixel(0, 0);
      drawHexPath(op.x, op.y, hexR);
      ctx.fillStyle = 'rgba(110,231,183,0.04)';
      ctx.fill();

      // Tiles (sorted back->front)
      const painted: { q: number; r: number }[] = [];
      for (const h of hexes) { if (map[hk(h.q, h.r)] !== undefined) painted.push(h); }
      painted.sort((a, b) => {
        const pa = hexToPixel(a.q, a.r), pb = hexToPixel(b.q, b.r);
        return (pa.y - pb.y) || (pa.x - pb.x);
      });

      const tileSize = hexR * 2;
      const baseFaceH = Math.round(tileSize * S3 / 2 * yScale);
      const cosA = Math.cos(viewAngle * Math.PI / 180);
      const blockDepth = Math.round(tileSize * (1 - S3 / 2 * yScale));

      // Find max height
      let maxH = 1;
      for (const h of painted) { const ht = heightMap[hk(h.q, h.r)] || 1; if (ht > maxH) maxH = ht; }

      // Render layer by layer
      for (let layer = 0; layer < maxH; layer++) {
        for (const h of painted) {
          const k = hk(h.q, h.r);
          const stackH = heightMap[k] || 1;
          if (layer >= stackH) continue;

          const img = getPalImg(map[k]);
          if (!img || !img.complete) continue;
          const p = hexToPixel(h.q, h.r);
          const srcTopH = img.width * S3 / 2;
          const faceH = baseFaceH;
          const rot = rotMap[k] || 0;
          const flip = flipMap[k] || false;
          const needsTransform = rot || flip;
          const stackOffset = layer * blockDepth;
          const isTopBlock = (layer === stackH - 1);

          if (clipHex && isTopBlock) {
            const zoomFrac = clipZoom / 100;
            const inset = Math.round(img.width * zoomFrac);
            const insetY = Math.round(srcTopH * zoomFrac);
            const srcW = img.width - inset * 2;
            const srcFaceH = Math.round(srcTopH - insetY * 2);
            ctx.save();
            drawHexPath(p.x, p.y - stackOffset, hexR);
            ctx.clip();
            if (needsTransform) {
              ctx.translate(p.x, p.y - stackOffset);
              if (flip) ctx.scale(-1, 1);
              if (rot) ctx.rotate(rot);
              ctx.drawImage(img, inset, insetY, srcW, srcFaceH, -tileSize / 2, -faceH / 2, tileSize, faceH);
            } else {
              ctx.drawImage(img, inset, insetY, srcW, srcFaceH, p.x - tileSize / 2, p.y - stackOffset - faceH / 2, tileSize, faceH);
            }
            ctx.restore();
          } else {
            const srcThickness = img.height - srcTopH;
            const visibleThickness = srcThickness * cosA;
            const srcH = Math.round(srcTopH + srcThickness);
            const drawH = Math.round(faceH + visibleThickness * (tileSize / img.width) * yScale);
            if (needsTransform) {
              ctx.save();
              ctx.translate(p.x, p.y - stackOffset - faceH / 2 + yOff + drawH / 2);
              if (flip) ctx.scale(-1, 1);
              if (rot) ctx.rotate(rot);
              ctx.drawImage(img, 0, 0, img.width, srcH, -tileSize / 2, -drawH / 2, tileSize, drawH);
              ctx.restore();
            } else {
              ctx.drawImage(img, 0, 0, img.width, srcH, p.x - tileSize / 2, p.y - stackOffset - faceH / 2 + yOff, tileSize, drawH);
            }
          }
        }
      }

      // Grid
      if (showGrid && cam.zoom > 0.3) {
        const a = Math.min(1, (cam.zoom - 0.3) * 1.5);
        ctx.strokeStyle = `rgba(255,255,255,${(0.15 * a).toFixed(3)})`;
        ctx.lineWidth = 1 / cam.zoom;
        for (const h of hexes) {
          const p = hexToPixel(h.q, h.r);
          drawHexPath(p.x, p.y, hexR);
          ctx.stroke();
        }
      }

      // Coordinate labels
      if (showCoords && cam.zoom > 1.5) {
        const fa = Math.min(1, (cam.zoom - 1.5) * 1.5);
        ctx.fillStyle = `rgba(136,136,170,${(0.6 * fa).toFixed(3)})`;
        ctx.font = `${Math.max(6, 8 / cam.zoom)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const h of hexes) {
          const p = hexToPixel(h.q, h.r);
          ctx.fillText(`${h.q},${h.r}`, p.x, p.y);
        }
      }

      // Hover ghost
      if (hover) {
        const brushHexes = getHexesInBrush(hover.q, hover.r);
        const isErase = tool === 'erase';
        const isPaintLike = (tool === 'paint' || tool === 'raise') && selTile >= 0;
        const ghostImg = isPaintLike ? getPalImg(selTile) : null;

        if (isPaintLike && ghostImg?.complete) {
          ctx.globalAlpha = 0.5;
          for (const bh of brushHexes) {
            const bk = hk(bh.q, bh.r);
            const bp = hexToPixel(bh.q, bh.r);
            const srcTopH2 = ghostImg.width * S3 / 2;
            const faceH = baseFaceH;
            const stackH2 = heightMap[bk] || 1;
            const existingOffset = map[bk] !== undefined ? (tool === 'raise' ? stackH2 : (stackH2 - 1)) * blockDepth : 0;

            if (clipHex) {
              const zoomFrac = clipZoom / 100;
              const inset = Math.round(ghostImg.width * zoomFrac);
              const insetY = Math.round(srcTopH2 * zoomFrac);
              const srcW = ghostImg.width - inset * 2;
              const srcFaceH = Math.round(srcTopH2 - insetY * 2);
              ctx.save();
              drawHexPath(bp.x, bp.y - existingOffset, hexR);
              ctx.clip();
              ctx.drawImage(ghostImg, inset, insetY, srcW, srcFaceH, bp.x - tileSize / 2, bp.y - existingOffset - faceH / 2, tileSize, faceH);
              ctx.restore();
              ctx.globalAlpha = 0.5;
            } else {
              const srcThickness = ghostImg.height - srcTopH2;
              const visibleThickness = srcThickness * cosA;
              const srcH = Math.round(srcTopH2 + srcThickness);
              const drawH2 = Math.round(faceH + visibleThickness * (tileSize / ghostImg.width) * yScale);
              ctx.drawImage(ghostImg, 0, 0, ghostImg.width, srcH, bp.x - tileSize / 2, bp.y - existingOffset - faceH / 2 + yOff, tileSize, drawH2);
            }
          }
          ctx.globalAlpha = 1;
        } else if (isErase || tool === 'lower') {
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = isErase ? 'rgba(231,76,60,0.5)' : 'rgba(231,196,60,0.5)';
          for (const bh of brushHexes) {
            const bk = hk(bh.q, bh.r);
            if (map[bk] === undefined) continue;
            const bp = hexToPixel(bh.q, bh.r);
            const stackH2 = heightMap[bk] || 1;
            const topOffset = (stackH2 - 1) * blockDepth;
            drawHexPath(bp.x, bp.y - topOffset, hexR);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();

      // HUD overlay
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, H - 24, W, 24);
      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (hover) {
        const ht = heightMap[hk(hover.q, hover.r)] || 1;
        const hasBlock = map[hk(hover.q, hover.r)] !== undefined;
        ctx.fillText(`q:${hover.q} r:${hover.r}${hasBlock ? ' h:' + ht : ''}`, 12, H - 12);
      } else {
        ctx.fillText('--', 12, H - 12);
      }
      ctx.textAlign = 'right';
      ctx.fillText(cam.zoom.toFixed(1) + 'x', W - 12, H - 12);
    }

    // ── Tool application ─────────────────────────────────────

    function applyTool(h: { q: number; r: number }) {
      if (!h) return;
      const s = stateRef.current!;
      const tool = s.activeTilemapTool;
      const selTile = s.hexSelectedTile;
      const pal = s.hexPalette;
      const randomRotate = s.hexRandomRotation;
      const randomFlip = s.hexRandomFlip;
      const randomPalette = s.hexRandomPalette;
      const randomBrush = s.hexRandomBrushSize;

      s.hexUpdateMap(md => {
        const newMap = { ...md.map };
        const newRot = { ...md.rotMap };
        const newFlip = { ...md.flipMap };
        const newHeight = { ...md.heightMap };

        let brushSize = s.hexBrushSize;
        if (randomBrush) {
          brushSize = Math.floor(Math.random() * s.hexBrushSize) + 1;
        }

        // Temporarily override for getHexesInBrush call
        const brushHexes = getHexesInBrush(h.q, h.r);

        if (tool === 'paint') {
          if (selTile < 0 && !randomPalette) return md;
          for (const bh of brushHexes) {
            const k = hk(bh.q, bh.r);
            const tileIdx = randomPalette ? Math.floor(Math.random() * pal.length) : selTile;
            if (tileIdx < 0 || tileIdx >= pal.length) continue;
            newMap[k] = tileIdx;
            newRot[k] = randomRotate ? Math.floor(Math.random() * 6) * (Math.PI / 3) : 0;
            newFlip[k] = randomFlip ? Math.random() < 0.5 : false;
          }
        } else if (tool === 'erase') {
          for (const bh of brushHexes) {
            const k = hk(bh.q, bh.r);
            delete newMap[k]; delete newRot[k]; delete newFlip[k]; delete newHeight[k];
          }
        } else if (tool === 'fill') {
          if (selTile < 0) return md;
          // Flood fill
          const MAX = 500;
          const target = newMap[hk(h.q, h.r)] ?? -1;
          if (target === selTile) return md;
          const stack = [{ q: h.q, r: h.r }];
          const visited = new Set<string>();
          let n = 0;
          while (stack.length && n < MAX) {
            const { q, r } = stack.pop()!;
            const key = hk(q, r);
            if (visited.has(key)) continue;
            visited.add(key);
            if ((newMap[key] ?? -1) !== target) continue;
            newMap[key] = randomPalette ? Math.floor(Math.random() * pal.length) : selTile;
            newRot[key] = randomRotate ? Math.floor(Math.random() * 6) * (Math.PI / 3) : 0;
            newFlip[key] = randomFlip ? Math.random() < 0.5 : false;
            n++;
            for (const nb of hexNeighbors(q, r)) stack.push(nb);
          }
        } else if (tool === 'eyedropper') {
          const k = hk(h.q, h.r);
          const idx = newMap[k];
          if (idx !== undefined) {
            s.setHexSelectedTile(idx);
            s.setActiveTilemapTool('paint');
          }
          return md; // no map changes
        } else if (tool === 'raise') {
          for (const bh of brushHexes) {
            const k = hk(bh.q, bh.r);
            if (newMap[k] === undefined || heightEdited.has(k)) continue;
            newHeight[k] = (newHeight[k] || 1) + 1;
            heightEdited.add(k);
          }
        } else if (tool === 'lower') {
          for (const bh of brushHexes) {
            const k = hk(bh.q, bh.r);
            if (newMap[k] === undefined || heightEdited.has(k)) continue;
            newHeight[k] = Math.max(1, (newHeight[k] || 1) - 1);
            heightEdited.add(k);
          }
        }

        return { map: newMap, rotMap: newRot, flipMap: newFlip, heightMap: newHeight };
      });

      scheduleRender();
    }

    // ── Input handlers ───────────────────────────────────────

    function onMouseDown(e: MouseEvent) {
      if (disposed) return;
      if (e.button === 1 || (e.button === 0 && (spaceHeld || e.shiftKey))) {
        isPanning = true;
        panLast = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grab';
        e.preventDefault();
        return;
      }
      if (e.button === 2) {
        const w = screenToWorld(e.clientX, e.clientY);
        const h = pixelToHex(w.x, w.y);
        const brushHexes = getHexesInBrush(h.q, h.r);
        stateRef.current!.hexUpdateMap(md => {
          const newMap = { ...md.map };
          const newRot = { ...md.rotMap };
          const newFlip = { ...md.flipMap };
          const newHeight = { ...md.heightMap };
          for (const bh of brushHexes) {
            const k = hk(bh.q, bh.r);
            delete newMap[k]; delete newRot[k]; delete newFlip[k]; delete newHeight[k];
          }
          return { map: newMap, rotMap: newRot, flipMap: newFlip, heightMap: newHeight };
        });
        isDrawing = 'erase';
        scheduleRender();
        return;
      }
      if (e.button === 0) {
        isDrawing = true;
        heightEdited.clear();
        const w = screenToWorld(e.clientX, e.clientY);
        hover = pixelToHex(w.x, w.y);
        applyTool(hover);
      }
    }

    function onMouseMove(e: MouseEvent) {
      if (disposed) return;
      if (isPanning) {
        const dx = e.clientX - panLast.x, dy = e.clientY - panLast.y;
        cam.x -= dx / cam.zoom;
        cam.y -= dy / cam.zoom;
        panLast = { x: e.clientX, y: e.clientY };
        scheduleRender();
        return;
      }
      const w = screenToWorld(e.clientX, e.clientY);
      hover = pixelToHex(w.x, w.y);
      scheduleRender();
      if (isDrawing === true) applyTool(hover);
      else if (isDrawing === 'erase' && hover) {
        const brushHexes = getHexesInBrush(hover.q, hover.r);
        stateRef.current!.hexUpdateMap(md => {
          const newMap = { ...md.map };
          const newRot = { ...md.rotMap };
          const newFlip = { ...md.flipMap };
          const newHeight = { ...md.heightMap };
          for (const bh of brushHexes) {
            const k = hk(bh.q, bh.r);
            delete newMap[k]; delete newRot[k]; delete newFlip[k]; delete newHeight[k];
          }
          return { map: newMap, rotMap: newRot, flipMap: newFlip, heightMap: newHeight };
        });
        scheduleRender();
      }
    }

    function onMouseUp() {
      if (disposed) return;
      isDrawing = false;
      isPanning = false;
      canvas.style.cursor = 'crosshair';
    }

    function onMouseLeave() {
      hover = null;
      isDrawing = false;
      isPanning = false;
      canvas.style.cursor = 'crosshair';
      scheduleRender();
    }

    function onWheel(e: WheelEvent) {
      if (disposed) return;
      e.preventDefault();
      const cc = canvasCoords(e);
      const wxBefore = (cc.x - canvas.width / 2) / cam.zoom + cam.x;
      const wyBefore = (cc.y - canvas.height / 2) / cam.zoom + cam.y;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      cam.zoom = Math.max(0.3, Math.min(30, cam.zoom * factor));
      cam.x = wxBefore - (cc.x - canvas.width / 2) / cam.zoom;
      cam.y = wyBefore - (cc.y - canvas.height / 2) / cam.zoom;
      scheduleRender();
    }

    function onContextMenu(e: MouseEvent) { e.preventDefault(); }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') { spaceHeld = true; e.preventDefault(); }
      const s = stateRef.current!;
      if (e.key === '1') s.setActiveTilemapTool('paint');
      if (e.key === '2') s.setActiveTilemapTool('erase');
      if (e.key === '3') s.setActiveTilemapTool('fill');
      if (e.key === '4') s.setActiveTilemapTool('eyedropper');
      if (e.key === '[') { s.setHexBrushSize(Math.max(1, s.hexBrushSize - 1)); scheduleRender(); }
      if (e.key === ']') { s.setHexBrushSize(Math.min(256, s.hexBrushSize + 1)); scheduleRender(); }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') spaceHeld = false;
    }

    // ── Resize ───────────────────────────────────────────────

    function resizeCanvas() {
      if (!container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      scheduleRender();
    }

    // ── Init ─────────────────────────────────────────────────

    resizeCanvas();

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(container);

    // Poll for state changes (settings, palette, map updates)
    let lastPal = stateRef.current?.hexPalette;
    let lastMap = stateRef.current?.hexMapData;
    let lastSettings = '';
    const pollId = setInterval(() => {
      if (disposed) return;
      const s = stateRef.current!;
      const settingsKey = `${s.hexShowGrid}|${s.hexShowCoords}|${s.hexClipToHex}|${s.hexTileZoom}|${s.hexYOffset}|${s.hexBrushSize}|${s.hexBrushShape}|${s.hexSelectedTile}|${s.activeTilemapTool}`;
      if (s.hexPalette !== lastPal || s.hexMapData !== lastMap || settingsKey !== lastSettings) {
        lastPal = s.hexPalette;
        lastMap = s.hexMapData;
        lastSettings = settingsKey;
        scheduleRender();
      }
    }, 50);

    return () => {
      disposed = true;
      clearInterval(pollId);
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ background: '#2a3a1a' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated', cursor: 'crosshair' }}
      />
    </div>
  );
}
