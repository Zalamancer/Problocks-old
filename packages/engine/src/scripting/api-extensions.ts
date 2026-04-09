/**
 * QuickJS API extensions — exposes all engine systems to student scripts
 * via the `pb.*` global namespace.
 *
 * Every host function communicates exclusively through primitives (string, number).
 * Objects are serialized as JSON; tuples as comma-separated values;
 * booleans as 0/1 numbers.
 *
 * Missing dependencies are handled gracefully: functions become no-ops or
 * return sensible defaults (empty arrays, 0, etc.).
 */

import type { QuickJSRuntime } from './quickjs-runtime.js';
import type { Grid } from '../tilemap/grid.js';
import type { CameraController } from '../camera/camera-controller.js';
import type { AnimationController } from '../animation/animation-controller.js';
import type { AudioEngine } from '../audio/audio-engine.js';
import type { AudioChannel } from '../audio/types.js';
import type { LightingSystem } from '../lighting/lighting-system.js';
import type { LightConfig } from '../lighting/types.js';
import { LightComponent } from '../lighting/light-component.js';
import type { InputManager } from '../input/input-manager.js';
import type { NavigationGrid } from '../navigation/nav-grid.js';
import { findPath } from '../navigation/astar.js';
import { hasLineOfSight } from '../navigation/line-of-sight.js';
import { generateDungeon } from '../procgen/bsp-dungeon.js';
import { noise2D } from '../procgen/noise.js';
import { poissonDisk } from '../procgen/poisson.js';
import { FiniteStateMachine } from '../ai/fsm.js';
import type { FSMContext } from '../ai/fsm-types.js';
import type { AssetManager } from '../assets/asset-manager.js';
import type { AssetCategory } from '../assets/asset-schema.js';
import type { PrefabRegistry } from '../prefabs/prefab-registry.js';
import type { PrefabInstantiator } from '../prefabs/prefab-instantiator.js';
import type { Scene } from '../core/scene.js';

// ── Dependency interface ────────────────────────────────────────────

export interface APIExtensionDeps {
  grid?: Grid;
  cameraController?: CameraController;
  animationController?: AnimationController;
  audioEngine?: AudioEngine;
  lightingSystem?: LightingSystem;
  inputManager?: InputManager;
  navGrid?: NavigationGrid;
  assetManager?: AssetManager;
  prefabRegistry?: PrefabRegistry;
  prefabInstantiator?: PrefabInstantiator;
  scene?: Scene;
}

// ── FSM tracking for scripting layer ────────────────────────────────

/** Per-entity FSM instances managed through the scripting API. */
const scriptFSMs: Map<string, FiniteStateMachine> = new Map();

/** Pending asset generation requests. */
const pendingGenerations: Map<string, { status: 'pending' | 'complete' | 'error'; assetId?: string; error?: string }> = new Map();
let genRequestId = 0;

// ── Condition expression parser ─────────────────────────────────────

/**
 * Parse a simple comparison expression against a blackboard.
 * Supports: key < value, key > value, key === value, key !== value,
 *           key <= value, key >= value
 * Key is looked up in the blackboard; value is parsed as a number or string.
 */
function evaluateCondition(
  expression: string,
  blackboard: Map<string, unknown>,
): boolean {
  const match = expression.match(
    /^\s*(\w+)\s*(===|!==|<=|>=|<|>)\s*(.+?)\s*$/,
  );
  if (!match) return false;

  const [, key, op, rawValue] = match;
  const bbValue = blackboard.get(key);
  if (bbValue === undefined) return false;

  // Parse the comparison value: try number first, then strip quotes for string
  let compareValue: number | string;
  const numVal = Number(rawValue);
  if (!isNaN(numVal) && rawValue.trim() !== '') {
    compareValue = numVal;
  } else {
    // Strip surrounding quotes if present
    compareValue = rawValue.replace(/^["']|["']$/g, '');
  }

  switch (op) {
    case '<':
      return (bbValue as number) < (compareValue as number);
    case '>':
      return (bbValue as number) > (compareValue as number);
    case '<=':
      return (bbValue as number) <= (compareValue as number);
    case '>=':
      return (bbValue as number) >= (compareValue as number);
    case '===':
      return bbValue === compareValue;
    case '!==':
      return bbValue !== compareValue;
    default:
      return false;
  }
}

// ── Registration ────────────────────────────────────────────────────

export function registerAPIExtensions(
  runtime: QuickJSRuntime,
  deps: APIExtensionDeps,
): void {
  // ── Tilemap API ────────────────────────────────────────────────

  runtime.registerHostFunction('tilemap.setTile', (...args: unknown[]) => {
    if (!deps.grid || args.length < 4) return;
    deps.grid.setTile(
      args[0] as number,
      args[1] as number,
      args[2] as number,
      args[3] as number,
    );
  });

  runtime.registerHostFunction('tilemap.getTile', (...args: unknown[]) => {
    if (!deps.grid || args.length < 3) return 0;
    return deps.grid.getTile(
      args[0] as number,
      args[1] as number,
      args[2] as number,
    );
  });

  runtime.registerHostFunction('tilemap.getMapSize', () => {
    // Grid uses chunk-based storage without a fixed size.
    // Return tile dimensions as a proxy (students can set their own logical bounds).
    if (!deps.grid) return '0,0';
    return `${deps.grid.tileWidth},${deps.grid.tileHeight}`;
  });

  runtime.registerHostFunction('tilemap.getTileSize', () => {
    if (!deps.grid) return '0,0';
    return `${deps.grid.tileWidth},${deps.grid.tileHeight}`;
  });

  runtime.registerHostFunction('tilemap.screenToTile', (...args: unknown[]) => {
    if (!deps.grid || args.length < 2) return '0,0';
    const result = deps.grid.screenToWorld(
      args[0] as number,
      args[1] as number,
    );
    return `${Math.floor(result.gridX)},${Math.floor(result.gridY)}`;
  });

  runtime.registerHostFunction('tilemap.tileToScreen', (...args: unknown[]) => {
    if (!deps.grid || args.length < 2) return '0,0';
    const result = deps.grid.worldToScreen(
      args[0] as number,
      args[1] as number,
    );
    return `${result.screenX},${result.screenY}`;
  });

  runtime.registerHostFunction('tilemap.setTileRegion', (...args: unknown[]) => {
    if (!deps.grid || args.length < 6) return;
    const layer = args[0] as number;
    const startX = args[1] as number;
    const startY = args[2] as number;
    const w = args[3] as number;
    const h = args[4] as number;
    const tileId = args[5] as number;
    for (let y = startY; y < startY + h; y++) {
      for (let x = startX; x < startX + w; x++) {
        deps.grid.setTile(layer, x, y, tileId);
      }
    }
  });

  // ── Camera API ─────────────────────────────────────────────────

  runtime.registerHostFunction('camera.setPosition', (...args: unknown[]) => {
    if (!deps.cameraController || args.length < 2) return;
    deps.cameraController.setPosition(
      args[0] as number,
      args[1] as number,
    );
  });

  runtime.registerHostFunction('camera.getPosition', () => {
    if (!deps.cameraController) return '0,0';
    // Camera position = midpoint of the visible world bounds.
    // getVisibleBounds() uses screenToWorld on all four viewport corners,
    // so the midpoint correctly yields the camera's world-space center.
    const bounds = deps.cameraController.getVisibleBounds();
    return `${(bounds.minX + bounds.maxX) / 2},${(bounds.minY + bounds.maxY) / 2}`;
  });

  runtime.registerHostFunction('camera.setZoom', (...args: unknown[]) => {
    if (!deps.cameraController || args.length < 1) return;
    deps.cameraController.setZoom(args[0] as number);
  });

  runtime.registerHostFunction('camera.getZoom', () => {
    if (!deps.cameraController) return 1;
    // Derive zoom from the worldToScreen scale factor.
    // worldToScreen(1,0).x - worldToScreen(0,0).x = zoom * cos(-rotation).
    // At rotation=0 this is exactly zoom. For non-zero rotations the
    // difference still gives the correct scale magnitude.
    const s0 = deps.cameraController.worldToScreen(0, 0);
    const s1 = deps.cameraController.worldToScreen(1, 0);
    const dx = s1.x - s0.x;
    const dy = s1.y - s0.y;
    return Math.sqrt(dx * dx + dy * dy);
  });

  runtime.registerHostFunction('camera.shake', (...args: unknown[]) => {
    if (!deps.cameraController || args.length < 2) return;
    deps.cameraController.shake(
      args[0] as number,
      args[1] as number,
    );
  });

  runtime.registerHostFunction('camera.follow', (...args: unknown[]) => {
    if (!deps.cameraController || args.length < 2) return;
    const target = { x: args[0] as number, y: args[1] as number };
    const smoothing = args.length >= 3 ? (args[2] as number) : undefined;
    deps.cameraController.follow(target, smoothing !== undefined ? { smoothing } : undefined);
  });

  runtime.registerHostFunction('camera.unfollow', () => {
    if (!deps.cameraController) return;
    deps.cameraController.unfollow();
  });

  runtime.registerHostFunction('camera.screenToWorld', (...args: unknown[]) => {
    if (!deps.cameraController || args.length < 2) return '0,0';
    const result = deps.cameraController.screenToWorld(
      args[0] as number,
      args[1] as number,
    );
    return `${result.x},${result.y}`;
  });

  runtime.registerHostFunction('camera.worldToScreen', (...args: unknown[]) => {
    if (!deps.cameraController || args.length < 2) return '0,0';
    const result = deps.cameraController.worldToScreen(
      args[0] as number,
      args[1] as number,
    );
    return `${result.x},${result.y}`;
  });

  // ── Animation API ──────────────────────────────────────────────

  runtime.registerHostFunction('anim.play', (...args: unknown[]) => {
    if (!deps.animationController || args.length < 2) return;
    deps.animationController.play(
      args[0] as string,
      args[1] as string,
    );
  });

  runtime.registerHostFunction('anim.stop', (...args: unknown[]) => {
    if (!deps.animationController || args.length < 1) return;
    deps.animationController.stop(args[0] as string);
  });

  runtime.registerHostFunction('anim.pause', (...args: unknown[]) => {
    if (!deps.animationController || args.length < 1) return;
    deps.animationController.pause(args[0] as string);
  });

  runtime.registerHostFunction('anim.resume', (...args: unknown[]) => {
    if (!deps.animationController || args.length < 1) return;
    deps.animationController.resume(args[0] as string);
  });

  runtime.registerHostFunction('anim.setSpeed', (...args: unknown[]) => {
    if (!deps.animationController || args.length < 2) return;
    deps.animationController.setSpeed(
      args[0] as string,
      args[1] as number,
    );
  });

  runtime.registerHostFunction('anim.isPlaying', (...args: unknown[]) => {
    if (!deps.animationController || args.length < 1) return 0;
    return deps.animationController.isPlaying(args[0] as string) ? 1 : 0;
  });

  runtime.registerHostFunction('anim.getCurrent', (...args: unknown[]) => {
    if (!deps.animationController || args.length < 1) return '';
    return deps.animationController.getCurrentAnimation(args[0] as string) ?? '';
  });

  // ── Audio API ──────────────────────────────────────────────────

  runtime.registerHostFunction('audio.playSound', (...args: unknown[]) => {
    if (!deps.audioEngine || args.length < 1) return '';
    const url = args[0] as string;
    const options = args.length >= 2 && args[1]
      ? JSON.parse(args[1] as string)
      : undefined;
    return deps.audioEngine.playSound(url, options);
  });

  runtime.registerHostFunction('audio.playSoundAt', (...args: unknown[]) => {
    if (!deps.audioEngine || args.length < 3) return '';
    const url = args[0] as string;
    const x = args[1] as number;
    const y = args[2] as number;
    const config = args.length >= 4 && args[3]
      ? JSON.parse(args[3] as string)
      : undefined;
    return deps.audioEngine.playSoundAt(url, x, y, config);
  });

  runtime.registerHostFunction('audio.stopSound', (...args: unknown[]) => {
    if (!deps.audioEngine || args.length < 1) return;
    deps.audioEngine.stopSound(args[0] as string);
  });

  runtime.registerHostFunction('audio.playMusic', (...args: unknown[]) => {
    if (!deps.audioEngine || args.length < 1) return;
    const url = args[0] as string;
    const options = args.length >= 2 && args[1]
      ? JSON.parse(args[1] as string)
      : {};
    // AudioEngine.playMusic expects MusicConfig which requires url
    deps.audioEngine.playMusic({ url, ...options });
  });

  runtime.registerHostFunction('audio.stopMusic', (...args: unknown[]) => {
    if (!deps.audioEngine) return;
    const fadeOut = args.length >= 1 ? (args[0] as number) : undefined;
    deps.audioEngine.stopMusic(fadeOut);
  });

  runtime.registerHostFunction('audio.setVolume', (...args: unknown[]) => {
    if (!deps.audioEngine || args.length < 2) return;
    deps.audioEngine.setVolume(
      args[0] as AudioChannel,
      args[1] as number,
    );
  });

  runtime.registerHostFunction('audio.getVolume', (...args: unknown[]) => {
    if (!deps.audioEngine || args.length < 1) return 1;
    return deps.audioEngine.getVolume(args[0] as AudioChannel);
  });

  runtime.registerHostFunction('audio.preload', (...args: unknown[]) => {
    if (!deps.audioEngine || args.length < 1) return;
    const urls: string[] = JSON.parse(args[0] as string);
    // Fire-and-forget: preload is async but host functions are sync
    deps.audioEngine.preload(urls);
  });

  // ── Lighting API ───────────────────────────────────────────────

  runtime.registerHostFunction('light.add', (...args: unknown[]) => {
    if (!deps.lightingSystem || args.length < 2) return;
    const id = args[0] as string;
    const config: LightConfig = JSON.parse(args[1] as string);
    const light = new LightComponent(config, 0, 0);
    deps.lightingSystem.addLight(id, light);
  });

  runtime.registerHostFunction('light.remove', (...args: unknown[]) => {
    if (!deps.lightingSystem || args.length < 1) return;
    deps.lightingSystem.removeLight(args[0] as string);
  });

  runtime.registerHostFunction('light.setPosition', (...args: unknown[]) => {
    if (!deps.lightingSystem || args.length < 3) return;
    const light = deps.lightingSystem.getLight(args[0] as string);
    if (light) {
      light.position.x = args[1] as number;
      light.position.y = args[2] as number;
    }
  });

  runtime.registerHostFunction('light.setIntensity', (...args: unknown[]) => {
    if (!deps.lightingSystem || args.length < 2) return;
    const light = deps.lightingSystem.getLight(args[0] as string);
    if (light) {
      light.config.intensity = args[1] as number;
    }
  });

  runtime.registerHostFunction('light.setColor', (...args: unknown[]) => {
    if (!deps.lightingSystem || args.length < 2) return;
    const light = deps.lightingSystem.getLight(args[0] as string);
    if (light) {
      light.config.color = args[1] as number;
    }
  });

  runtime.registerHostFunction('light.setAmbient', (...args: unknown[]) => {
    if (!deps.lightingSystem || args.length < 2) return;
    deps.lightingSystem.setAmbient({
      color: args[0] as number,
      intensity: args[1] as number,
    });
  });

  runtime.registerHostFunction('light.setTimeOfDay', (...args: unknown[]) => {
    if (!deps.lightingSystem || args.length < 1) return;
    deps.lightingSystem.setTimeOfDay(args[0] as number);
  });

  // ── Input API ──────────────────────────────────────────────────

  runtime.registerHostFunction('input.isKeyDown', (...args: unknown[]) => {
    if (!deps.inputManager || args.length < 1) return 0;
    return deps.inputManager.isKeyDown(args[0] as string) ? 1 : 0;
  });

  runtime.registerHostFunction('input.isKeyPressed', (...args: unknown[]) => {
    if (!deps.inputManager || args.length < 1) return 0;
    return deps.inputManager.isKeyPressed(args[0] as string) ? 1 : 0;
  });

  runtime.registerHostFunction('input.isKeyReleased', (...args: unknown[]) => {
    if (!deps.inputManager || args.length < 1) return 0;
    return deps.inputManager.isKeyReleased(args[0] as string) ? 1 : 0;
  });

  runtime.registerHostFunction('input.isActionDown', (...args: unknown[]) => {
    if (!deps.inputManager || args.length < 1) return 0;
    return deps.inputManager.isActionDown(args[0] as string) ? 1 : 0;
  });

  runtime.registerHostFunction('input.isActionPressed', (...args: unknown[]) => {
    if (!deps.inputManager || args.length < 1) return 0;
    return deps.inputManager.isActionPressed(args[0] as string) ? 1 : 0;
  });

  runtime.registerHostFunction('input.getMousePosition', () => {
    if (!deps.inputManager) return '0,0';
    const pos = deps.inputManager.getMousePosition();
    return `${pos.x},${pos.y}`;
  });

  runtime.registerHostFunction('input.isMouseDown', (...args: unknown[]) => {
    if (!deps.inputManager || args.length < 1) return 0;
    return deps.inputManager.isMouseButtonDown(args[0] as number) ? 1 : 0;
  });

  runtime.registerHostFunction('input.getMouseWheel', () => {
    if (!deps.inputManager) return 0;
    return deps.inputManager.getMouseWheelDelta();
  });

  runtime.registerHostFunction('input.bindAction', (...args: unknown[]) => {
    if (!deps.inputManager || args.length < 2) return;
    const action = args[0] as string;
    const keys: string[] = JSON.parse(args[1] as string);
    deps.inputManager.bindAction(action, keys);
  });

  // ── Navigation API ─────────────────────────────────────────────

  runtime.registerHostFunction('nav.findPath', (...args: unknown[]) => {
    if (!deps.navGrid || args.length < 4) return '[]';
    const result = findPath(
      deps.navGrid,
      Math.floor(args[0] as number),
      Math.floor(args[1] as number),
      Math.floor(args[2] as number),
      Math.floor(args[3] as number),
    );
    if (!result.found) return '[]';
    return JSON.stringify(result.path);
  });

  runtime.registerHostFunction('nav.hasLineOfSight', (...args: unknown[]) => {
    if (!deps.navGrid || args.length < 4) return 0;
    return hasLineOfSight(
      deps.navGrid,
      Math.floor(args[0] as number),
      Math.floor(args[1] as number),
      Math.floor(args[2] as number),
      Math.floor(args[3] as number),
    ) ? 1 : 0;
  });

  runtime.registerHostFunction('nav.isWalkable', (...args: unknown[]) => {
    if (!deps.navGrid || args.length < 2) return 0;
    return deps.navGrid.isWalkable(
      Math.floor(args[0] as number),
      Math.floor(args[1] as number),
    ) ? 1 : 0;
  });

  runtime.registerHostFunction('nav.setWalkable', (...args: unknown[]) => {
    if (!deps.navGrid || args.length < 3) return;
    deps.navGrid.setWalkable(
      Math.floor(args[0] as number),
      Math.floor(args[1] as number),
      (args[2] as number) !== 0,
    );
  });

  // ── Procedural Generation API ──────────────────────────────────

  runtime.registerHostFunction('procgen.generateDungeon', (...args: unknown[]) => {
    if (args.length < 2) return '{"rooms":[],"corridors":[],"tileMap":[],"width":0,"height":0}';
    const width = args[0] as number;
    const height = args[1] as number;
    const options = args.length >= 3 && args[2]
      ? JSON.parse(args[2] as string)
      : undefined;
    const result = generateDungeon(width, height, options);
    return JSON.stringify(result);
  });

  runtime.registerHostFunction('procgen.noise2D', (...args: unknown[]) => {
    if (args.length < 2) return 0;
    const x = args[0] as number;
    const y = args[1] as number;
    const seed = args.length >= 3 ? (args[2] as number) : 0;
    return noise2D(x, y, seed);
  });

  runtime.registerHostFunction('procgen.poissonDisk', (...args: unknown[]) => {
    if (args.length < 3) return '[]';
    const width = args[0] as number;
    const height = args[1] as number;
    const minDist = args[2] as number;
    const seed = args.length >= 4 ? (args[3] as number) : undefined;
    const points = poissonDisk(width, height, minDist, seed !== undefined ? { seed } : undefined);
    return JSON.stringify(points);
  });

  // ── AI API ─────────────────────────────────────────────────────

  runtime.registerHostFunction('ai.addFSM', (...args: unknown[]) => {
    if (args.length < 2) return;
    const entityId = args[0] as string;
    const configJson = JSON.parse(args[1] as string) as {
      initialState: string;
      states: Array<{
        id: string;
        transitions: Array<{
          to: string;
          condition: string;
          priority?: number;
        }>;
      }>;
      globalTransitions?: Array<{
        to: string;
        condition: string;
        priority?: number;
      }>;
    };

    // Build a real FSMConfig with condition functions parsed from string expressions
    const buildCondition = (expr: string) => {
      return (ctx: FSMContext) => evaluateCondition(expr, ctx.blackboard);
    };

    const fsmConfig = {
      initialState: configJson.initialState,
      states: configJson.states.map((s) => ({
        id: s.id,
        transitions: s.transitions.map((t) => ({
          to: t.to,
          condition: buildCondition(t.condition),
          priority: t.priority,
        })),
      })),
      globalTransitions: configJson.globalTransitions?.map((t) => ({
        to: t.to,
        condition: buildCondition(t.condition),
        priority: t.priority,
      })),
    };

    const fsm = new FiniteStateMachine(fsmConfig, entityId);
    scriptFSMs.set(entityId, fsm);
  });

  runtime.registerHostFunction('ai.removeFSM', (...args: unknown[]) => {
    if (args.length < 1) return;
    const entityId = args[0] as string;
    const fsm = scriptFSMs.get(entityId);
    if (fsm) {
      fsm.dispose();
      scriptFSMs.delete(entityId);
    }
  });

  runtime.registerHostFunction('ai.getFSMState', (...args: unknown[]) => {
    if (args.length < 1) return '';
    const fsm = scriptFSMs.get(args[0] as string);
    return fsm ? fsm.getCurrentState() : '';
  });

  runtime.registerHostFunction('ai.setBlackboard', (...args: unknown[]) => {
    if (args.length < 3) return;
    const fsm = scriptFSMs.get(args[0] as string);
    if (!fsm) return;
    const value = JSON.parse(args[2] as string);
    fsm.set(args[1] as string, value);
  });

  runtime.registerHostFunction('ai.getBlackboard', (...args: unknown[]) => {
    if (args.length < 2) return 'null';
    const fsm = scriptFSMs.get(args[0] as string);
    if (!fsm) return 'null';
    const value = fsm.get(args[1] as string);
    return JSON.stringify(value ?? null);
  });

  // ── Prefab API ─────────────────────────────────────────────────

  runtime.registerHostFunction('prefab.spawn', (...args: unknown[]) => {
    if (!deps.prefabInstantiator || !deps.scene || args.length < 3) return '';
    const prefabId = args[0] as string;
    const x = args[1] as number;
    const y = args[2] as number;
    const z = args.length >= 4 && args[3] !== undefined ? (args[3] as number) : 0;
    const overrides = args.length >= 5 && args[4]
      ? JSON.parse(args[4] as string)
      : undefined;

    try {
      const entity = deps.prefabInstantiator.instantiate(
        prefabId,
        deps.scene,
        { x, y, z },
        overrides,
      );
      return entity.id;
    } catch {
      return '';
    }
  });

  runtime.registerHostFunction('prefab.spawnBatch', (...args: unknown[]) => {
    if (!deps.prefabInstantiator || !deps.scene || args.length < 2) return '[]';
    const prefabId = args[0] as string;
    const positions: Array<{ x: number; y: number; z: number }> = JSON.parse(args[1] as string);

    try {
      const entities = deps.prefabInstantiator.instantiateBatch(
        prefabId,
        deps.scene,
        positions,
      );
      return JSON.stringify(entities.map((e) => e.id));
    } catch {
      return '[]';
    }
  });

  runtime.registerHostFunction('prefab.destroy', (...args: unknown[]) => {
    if (!deps.prefabInstantiator || !deps.scene || args.length < 1) return;
    deps.prefabInstantiator.destroyInstance(args[0] as string, deps.scene);
  });

  runtime.registerHostFunction('prefab.list', () => {
    if (!deps.prefabRegistry) return '[]';
    const all = deps.prefabRegistry.getAll();
    return JSON.stringify(
      all.map((p) => ({ id: p.id, name: p.name, tags: p.tags })),
    );
  });

  // ── Asset API ──────────────────────────────────────────────────

  runtime.registerHostFunction('assets.list', (...args: unknown[]) => {
    if (!deps.assetManager) return '[]';
    const category = args.length >= 1 ? (args[0] as string) : undefined;
    const entries = category
      ? deps.assetManager.filterByCategory(category as AssetCategory)
      : deps.assetManager.getAll();
    return JSON.stringify(
      entries.map((e) => ({
        id: e.metadata.id,
        name: e.metadata.name,
        category: e.metadata.category,
        tags: e.metadata.tags,
      })),
    );
  });

  runtime.registerHostFunction('assets.search', (...args: unknown[]) => {
    if (!deps.assetManager || args.length < 1) return '[]';
    const results = deps.assetManager.search(args[0] as string);
    return JSON.stringify(
      results.map((e) => ({
        id: e.metadata.id,
        name: e.metadata.name,
        category: e.metadata.category,
        tags: e.metadata.tags,
      })),
    );
  });

  runtime.registerHostFunction('assets.generate', (...args: unknown[]) => {
    if (args.length < 1) return '';
    const requestId = `gen_${++genRequestId}`;
    pendingGenerations.set(requestId, { status: 'pending' });
    // Queue the generation — actual execution happens async on the host side.
    // The student polls with assets.getGenerateStatus(requestId).
    // In a real integration, this would call AIGenerator.generate() in the
    // background. For now, we record the request so the host can process it.
    console.log(`[sandbox] Asset generation queued: ${requestId} — prompt: ${args[0] as string}`);
    return requestId;
  });

  runtime.registerHostFunction('assets.getGenerateStatus', (...args: unknown[]) => {
    if (args.length < 1) return 'error:invalid request';
    const requestId = args[0] as string;
    const entry = pendingGenerations.get(requestId);
    if (!entry) return 'error:unknown request';
    if (entry.status === 'pending') return 'pending';
    if (entry.status === 'complete') return `complete:${entry.assetId}`;
    return `error:${entry.error ?? 'unknown'}`;
  });
}

/**
 * Update a pending generation request's status.
 * Called by the host when an async asset generation completes.
 */
export function completeGeneration(
  requestId: string,
  assetId: string,
): void {
  pendingGenerations.set(requestId, { status: 'complete', assetId });
}

/**
 * Mark a pending generation request as failed.
 */
export function failGeneration(
  requestId: string,
  error: string,
): void {
  pendingGenerations.set(requestId, { status: 'error', error });
}

/**
 * Get all script-managed FSM instances (for the host to call update on each frame).
 */
export function getScriptFSMs(): Map<string, FiniteStateMachine> {
  return scriptFSMs;
}
