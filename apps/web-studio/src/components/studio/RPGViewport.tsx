import { useRef, useEffect, useState, useCallback } from 'react';
import { Application, Container, Sprite, Graphics, RenderTexture, Texture } from 'pixi.js';
import {
  generateWorld,
  resolveWangTile,
  buildVertexGrid,
  normGrassTerrain,
  DEFAULT_TERRAIN_PRIORITY,
  DEFAULT_TRANSITIONS,
  DEFAULT_PURE_TILE_SOURCES,
  Player2D,
  NPCManager,
} from '@problocks/engine';
import type { WorldData, WangTileResult } from '@problocks/engine';

// ── Constants ────────────────────────────────────────────────────────

const TILE_SIZE = 16;
const DEFAULT_ZOOM = 3;
const MAP_WIDTH = 120;
const MAP_HEIGHT = 90;
const DEFAULT_SEED = 42;

// ── Tile color fallbacks (when tilesets aren't loaded) ───────────────

const TERRAIN_COLORS: Record<number, number> = {
  0: 0x4a8c3f, // grass
  1: 0x5a9c4f, // grass light
  2: 0x8b6d3f, // dirt
  3: 0x888888, // cobblestone
  4: 0x3366aa, // water
  5: 0xd4b96a, // sand
};

const ZONE_OVERLAY: Record<number, number> = {
  1: 0xffd700, // town
  2: 0x444444, // cave
  3: 0x88ccff, // beach
  4: 0x88aa44, // farm
  5: 0x226622, // forest
};

// ── Component ────────────────────────────────────────────────────────

export function RPGViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [fps, setFps] = useState(0);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [worldReady, setWorldReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    let app: Application | null = null;
    let appReady = false;
    let world: WorldData;
    let player: Player2D;
    let npcManager: NPCManager;
    let worldContainer: Container;
    let mapContainer: Container;
    let playerSprite: Graphics;
    let npcSprites: Map<string, Graphics> = new Map();
    const keys: Record<string, boolean> = {};

    async function init() {
      // Generate world
      world = generateWorld(seed, MAP_WIDTH, MAP_HEIGHT);

      // Init PixiJS — let PIXI create its own canvas to avoid
      // React strict-mode double-mount fighting over a shared canvas ref
      app = new Application();
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      await app.init({
        width: w,
        height: h,
        backgroundColor: 0x87ceeb,
        antialias: false,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      if (disposed) { try { app.destroy(true); } catch {} return; }
      appReady = true;

      // Append PIXI-created canvas into the container
      app.canvas.style.imageRendering = 'pixelated';
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      container.appendChild(app.canvas);

      // Pixel-perfect rendering
      (Texture as any).defaultOptions = {
        ...(Texture as any).defaultOptions,
        scaleMode: 'nearest',
      };

      // World container with zoom
      worldContainer = new Container();
      worldContainer.scale.set(DEFAULT_ZOOM);
      app.stage.addChild(worldContainer);

      // Map container (ground + objects + NPCs + player)
      mapContainer = new Container();
      worldContainer.addChild(mapContainer);

      // Render ground using terrain colors (Wang textures would replace this)
      const groundGfx = new Graphics();
      const { ground } = world.layers;
      for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
          const terrain = ground[y][x];
          groundGfx.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          groundGfx.fill(TERRAIN_COLORS[terrain] ?? 0x333333);
        }
      }

      // Bake ground to texture for performance
      const groundTex = RenderTexture.create({
        width: world.width * TILE_SIZE,
        height: world.height * TILE_SIZE,
      });
      app.renderer.render({ container: groundGfx, target: groundTex });
      const groundSprite = new Sprite(groundTex);
      mapContainer.addChild(groundSprite);
      groundGfx.destroy();

      // Render objects as colored rectangles (sprites would replace this)
      const objContainer = new Container();
      const { objects } = world.layers;
      for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
          const objId = objects[y][x];
          if (objId === 0) continue;
          const obj = new Graphics();
          // Trees are green, buildings are brown, etc
          const color = objId <= 2 ? 0x2d5a1e : objId <= 5 ? 0x666666 : objId <= 12 ? 0x8b4513 : 0x555555;
          obj.rect(0, 0, TILE_SIZE, TILE_SIZE);
          obj.fill(color);
          obj.x = x * TILE_SIZE;
          obj.y = y * TILE_SIZE;
          objContainer.addChild(obj);
        }
      }
      mapContainer.addChild(objContainer);

      // Init player
      player = new Player2D(world.playerStart.x, world.playerStart.y, {
        tileSize: TILE_SIZE,
      });

      playerSprite = new Graphics();
      playerSprite.rect(0, 0, TILE_SIZE - 2, TILE_SIZE - 2);
      playerSprite.fill(0xff4444);
      playerSprite.rect(2, 2, TILE_SIZE - 6, TILE_SIZE - 6);
      playerSprite.fill(0xffcccc);
      mapContainer.addChild(playerSprite);

      // Init NPCs
      npcManager = new NPCManager();
      for (const npc of world.npcs) {
        npcManager.spawn({
          id: npc.id,
          name: npc.name,
          sprite: npc.sprite,
          x: npc.x,
          y: npc.y,
          interactionRadius: 2,
        });

        const npcGfx = new Graphics();
        npcGfx.circle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2 - 1);
        npcGfx.fill(0x4488ff);
        npcGfx.circle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2 - 3);
        npcGfx.fill(0x88bbff);
        npcGfx.x = npc.x * TILE_SIZE;
        npcGfx.y = npc.y * TILE_SIZE;
        mapContainer.addChild(npcGfx);
        npcSprites.set(npc.id, npcGfx);
      }

      setWorldReady(true);

      // Input
      const onKeyDown = (e: KeyboardEvent) => {
        keys[e.key.toLowerCase()] = true;
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
          e.preventDefault();
        }
      };
      const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      // Game loop
      app.ticker.add((ticker) => {
        if (disposed) return;
        const dt = ticker.deltaMS / 1000;

        // Input
        let dx = 0, dy = 0;
        if (keys['arrowup'] || keys['w']) dy = -1;
        if (keys['arrowdown'] || keys['s']) dy = 1;
        if (keys['arrowleft'] || keys['a']) dx = -1;
        if (keys['arrowright'] || keys['d']) dx = 1;

        // Update player
        player.update(dx, dy, dt, (tx, ty) => {
          const col = world.layers.collision;
          if (ty < 0 || ty >= col.length) return false;
          if (tx < 0 || tx >= col[0].length) return false;
          return col[ty][tx] === 0;
        });

        // Update player sprite
        playerSprite.x = Math.round(player.x);
        playerSprite.y = Math.round(player.y);

        // Center camera
        const screenW = app!.screen.width;
        const screenH = app!.screen.height;
        const z = DEFAULT_ZOOM;
        let camX = screenW / 2 / z - player.x - TILE_SIZE / 2;
        let camY = screenH / 2 / z - player.y - TILE_SIZE / 2;
        const mapW = world.width * TILE_SIZE;
        const mapH = world.height * TILE_SIZE;
        camX = Math.min(0, Math.max(screenW / z - mapW, camX));
        camY = Math.min(0, Math.max(screenH / z - mapH, camY));
        mapContainer.x = Math.round(camX);
        mapContainer.y = Math.round(camY);

        // NPC interaction
        if (keys['e'] || keys['enter']) {
          keys['e'] = false;
          keys['enter'] = false;
          const npc = npcManager.interact(player.tileX, player.tileY);
          if (npc) {
            console.log(`[RPG] Interacted with ${npc.config.name}`);
          }
        }

        // FPS
        setFps(Math.round(ticker.FPS));
        setPlayerPos({ x: player.tileX, y: player.tileY });
      });

      // Cleanup handler
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      };
    }

    let cleanup: (() => void) | undefined;
    init().then((c) => { cleanup = c; });

    return () => {
      disposed = true;
      cleanup?.();
      if (appReady && app) {
        try {
          if (app.canvas?.parentElement) app.canvas.remove();
          app.destroy(true);
        } catch {}
      }
    };
  }, [seed]);

  return (
    <div ref={containerRef} className="relative w-full h-full">

      {/* HUD overlay */}
      <div className="absolute top-2 left-2 flex gap-2">
        <span className="bg-black/60 text-white text-[10px] px-2 py-0.5 rounded font-mono">
          FPS: {fps}
        </span>
        <span className="bg-black/60 text-white text-[10px] px-2 py-0.5 rounded font-mono">
          Tile: {playerPos.x}, {playerPos.y}
        </span>
      </div>

      {/* Seed control */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value) || 0)}
          className="w-16 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded font-mono border border-white/10"
        />
        <span className="bg-black/60 text-white text-[10px] px-2 py-0.5 rounded font-mono">
          Seed
        </span>
      </div>

      {/* Controls help */}
      <div className="absolute bottom-2 left-2 bg-black/60 text-white/60 text-[9px] px-2 py-1 rounded font-mono">
        WASD/Arrows: Move | E: Interact with NPC
      </div>

      {!worldReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="text-white text-sm font-medium">Generating world...</span>
        </div>
      )}
    </div>
  );
}
