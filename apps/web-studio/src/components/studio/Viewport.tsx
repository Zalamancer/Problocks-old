import { useRef, useEffect, useState, useCallback } from 'react';
import { BabylonRenderer } from '@problocks/engine/renderer/babylon-renderer';
import { RapierPhysics } from '@problocks/engine/physics/rapier-physics';
import { SimulationLoop } from '@problocks/engine/core/simulation-loop';
import { TerrainComponent, VoxelTerrainComponent, WaterComponent } from '@problocks/engine/core/component';
import { TerrainBrushController, BrushCursor, WaterVoxelRenderer, GrassRenderer, CharacterController } from '@problocks/engine';
import type { CursorMode } from '@problocks/engine';
import { useStudio, StudioContext } from '@/store/studio-store';
import { useTerrainEditorOptional } from './terrain-editor/TerrainEditorContext';

/**
 * 3D Viewport — real Babylon.js + Rapier engine.
 */
export function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<{ renderer: BabylonRenderer; physics: RapierPhysics; sim: SimulationLoop } | null>(null);
  const [fps, setFps] = useState(0);
  const [ready, setReady] = useState(false);
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const { entities, selectedEntityId, selectEntity, isPlaying } = useStudio();
  const terrainEditor = useTerrainEditorOptional();
  const brushDraggingRef = useRef(false);
  const characterRef = useRef<CharacterController | null>(null);
  const characterObserverRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || engineRef.current) return;

    let disposed = false;

    async function initEngine() {
      if (!canvas || disposed) return;

      const renderer = new BabylonRenderer();
      await renderer.init({ mode: '3d', canvas, width: canvas.clientWidth, height: canvas.clientHeight });

      const physics = new RapierPhysics();
      await physics.init({ mode: '3d', gravity: { x: 0, y: -9.81, z: 0 } });

      const sim = new SimulationLoop(renderer, physics);

      if (disposed) {
        renderer.dispose();
        physics.dispose();
        return;
      }

      engineRef.current = { renderer, physics, sim };

      // Register sim with the store so RunScript can access it
      (window as any).__problocks_sim = sim;

      // Create terrain + water from store
      const terrainEntity = entities.find(e => e.type === 'terrain');
      const t = terrainEntity?.terrain;
      if (t) {
        if (t.mode === 'voxel') {
          const vt = new VoxelTerrainComponent();
          vt.enabled = true;
          vt.minX = t.minX ?? -128;
          vt.maxX = t.maxX ?? 128;
          vt.minY = t.minY ?? -32;
          vt.maxY = t.maxY ?? 64;
          vt.minZ = t.minZ ?? -128;
          vt.maxZ = t.maxZ ?? 128;
          vt.biomes = t.biomes ?? ['hills', 'plains'];
          vt.seed = t.seed;
          vt.biomeSize = t.biomeSize ?? 120;
          vt.blending = t.blending ?? 0.3;
          vt.caves = t.caves ?? true;
          sim.createVoxelTerrain(vt);
        } else {
          const terrain = new TerrainComponent();
          terrain.width = t.width;
          terrain.depth = t.depth;
          terrain.subdivisions = t.subdivisions;
          terrain.maxHeight = t.maxHeight;
          terrain.seed = t.seed;
          terrain.noiseScale = t.noiseScale;
          terrain.octaves = t.octaves;
          sim.createTerrain(terrain);

          const water = new WaterComponent();
          water.width = t.width;
          water.depth = t.depth;
          water.waterLevel = 2.5;
          water.buoyancy = 9.8;
          water.waterDrag = 0.8;
          sim.createWater(water);
        }
        lastTerrainKeyRef.current = JSON.stringify(t);
      }

      // Create all entities from store
      for (const entity of entities) {
        if (entity.shape) {
          sim.createEntity(entity.id, entity.shape, {
            width: entity.dimensions?.width,
            height: entity.dimensions?.height,
            depth: entity.dimensions?.depth,
            radius: entity.shape === 'sphere' ? (entity.dimensions?.width ?? 1) / 2 : undefined,
            color: entity.color,
            position: entity.position,
            mass: entity.physics?.mass ?? 1,
            isStatic: entity.physics?.isStatic ?? false,
            friction: entity.physics?.friction ?? 0.5,
            restitution: entity.physics?.restitution ?? 0.3,
          });
        }
      }

      // FPS counter
      const scene = renderer.getScene();
      setInterval(() => {
        if (!disposed) setFps(Math.round(scene.getEngine().getFps()));
      }, 500);

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        renderer.handleResize();
      });
      if (containerRef.current) resizeObserver.observe(containerRef.current);

      setReady(true);

      // Click to select entities (skipped when brush is active)
      scene.onPointerDown = (_evt, pickResult) => {
        if ((window as any).__problocks_brush_active) return;
        if (pickResult?.hit && pickResult.pickedMesh) {
          const meshName = pickResult.pickedMesh.name;
          // Skip internal meshes (ground, etc.)
          if (meshName.startsWith('__')) return;
          selectEntity(meshName);
        } else {
          selectEntity(null);
        }
      };

      // Hover detection (skipped when brush is active)
      scene.onPointerMove = (_evt, pickResult) => {
        if ((window as any).__problocks_brush_active) return;
        if (pickResult?.hit && pickResult.pickedMesh && !pickResult.pickedMesh.name.startsWith('__')) {
          setHoveredEntity(pickResult.pickedMesh.name);
          canvas!.style.cursor = 'pointer';
        } else {
          setHoveredEntity(null);
          // Don't reset cursor if gizmo is setting it (grab/grabbing)
          if (canvas!.style.cursor === 'pointer') {
            canvas!.style.cursor = 'default';
          }
        }
      };

      // Prevent Safari pinch-to-zoom on canvas only
      canvas!.addEventListener('gesturestart', (e: Event) => e.preventDefault());
      canvas!.addEventListener('gesturechange', (e: Event) => e.preventDefault());

      // Two-finger swipe → orbit, pinch → zoom
      const cam = scene.activeCamera as any;
      canvas!.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();

        if (e.ctrlKey) {
          // Pinch-to-zoom (trackpad sends ctrlKey + deltaY for pinch)
          const zoomDelta = e.deltaY * 0.01;
          cam.radius = Math.max(
            cam.lowerRadiusLimit ?? 2,
            Math.min(cam.upperRadiusLimit ?? 200, cam.radius * (1 + zoomDelta)),
          );
        } else {
          // Two-finger swipe → orbit around target
          cam.alpha += e.deltaX * 0.005;
          cam.beta += e.deltaY * 0.005;
          cam.beta = Math.max(0.05, Math.min(Math.PI - 0.05, cam.beta));
        }
      }, { passive: false });

      // Start render loop (physics only starts when Play is clicked)
      renderer.startRenderLoop();
    }

    initEngine().catch(err => {
      console.error('[Viewport] Engine init failed:', err);
    });

    return () => {
      disposed = true;
      if (engineRef.current) {
        engineRef.current.sim.stop();
        engineRef.current.renderer.dispose();
        engineRef.current.physics.dispose();
        engineRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start/stop physics when Play/Stop is toggled + spawn/despawn character
  useEffect(() => {
    if (!engineRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { renderer, sim } = engineRef.current;
    const scene = renderer.getScene();

    if (isPlaying) {
      renderer.stopRenderLoop(); // sim takes over rendering
      sim.start();

      // Spawn character controller
      const character = new CharacterController(scene);
      const originalCamera = scene.activeCamera!;
      character.activate(canvas);
      characterRef.current = character;

      // Update character every frame
      characterObserverRef.current = scene.onBeforeRenderObservable.add(() => {
        character.update();
      });
    } else {
      // Despawn character
      if (characterRef.current) {
        const originalCamera = scene.cameras.find(c => c.name === 'camera');
        if (originalCamera) {
          characterRef.current.deactivate(originalCamera, canvas);
        }
        if (characterObserverRef.current) {
          scene.onBeforeRenderObservable.remove(characterObserverRef.current);
          characterObserverRef.current = null;
        }
        characterRef.current.dispose();
        characterRef.current = null;
      }

      sim.stop();
      renderer.startRenderLoop(); // engine loop resumes
    }
  }, [isPlaying]);

  // Recreate terrain when terrain settings change in the store
  const lastTerrainKeyRef = useRef('');
  useEffect(() => {
    if (!engineRef.current || !ready) return;
    const terrainEntity = entities.find(e => e.type === 'terrain');
    if (!terrainEntity?.terrain) return;

    const key = JSON.stringify(terrainEntity.terrain);
    if (key === lastTerrainKeyRef.current) return;
    lastTerrainKeyRef.current = key;

    const t = terrainEntity.terrain;
    const sim = engineRef.current.sim;

    if (t.mode === 'voxel') {
      sim.disposeVoxelTerrain();
      const vt = new VoxelTerrainComponent();
      vt.enabled = true;
      vt.minX = t.minX ?? -128;
      vt.maxX = t.maxX ?? 128;
      vt.minY = t.minY ?? -32;
      vt.maxY = t.maxY ?? 64;
      vt.minZ = t.minZ ?? -128;
      vt.maxZ = t.maxZ ?? 128;
      vt.biomes = t.biomes ?? ['hills', 'plains'];
      vt.seed = t.seed;
      vt.biomeSize = t.biomeSize ?? 120;
      vt.blending = t.blending ?? 0.3;
      vt.caves = t.caves ?? true;
      sim.createVoxelTerrain(vt);
    } else {
      // Dispose voxel terrain if switching back to heightmap
      sim.disposeVoxelTerrain();

      const terrain = new TerrainComponent();
      terrain.width = t.width;
      terrain.depth = t.depth;
      terrain.subdivisions = t.subdivisions;
      terrain.maxHeight = t.maxHeight;
      terrain.seed = t.seed;
      terrain.noiseScale = t.noiseScale;
      terrain.octaves = t.octaves;
      sim.createTerrain(terrain);

      const water = new WaterComponent();
      water.width = t.width;
      water.depth = t.depth;
      water.waterLevel = 2.5;
      water.buoyancy = 9.8;
      water.waterDrag = 0.8;
      sim.createWater(water);
    }
  }, [entities, ready]);

  // Register BrushController + BrushCursor + renderers into TerrainEditorContext when voxel terrain exists
  const brushCtrlRef = useRef<TerrainBrushController | null>(null);
  const brushCursorRef = useRef<BrushCursor | null>(null);

  useEffect(() => {
    if (!engineRef.current || !ready || !terrainEditor) return;
    const sim = engineRef.current.sim;
    const grid = sim.getVoxelGrid();
    const cm = sim.getChunkManager();
    if (!grid || !cm) return;

    // Create brush controller and cursor
    const ctrl = new TerrainBrushController(grid, cm);
    const scene = engineRef.current.renderer.getScene();
    const cursor = new BrushCursor(scene);
    cursor.hide();

    // Create WaterVoxelRenderer — replace ChunkRenderer's default water material
    const waterRenderer = new WaterVoxelRenderer(scene);
    cm.setWaterMaterial(waterRenderer.getMaterial());

    // Create GrassRenderer — register with ChunkManager for per-chunk grass updates
    const grassRenderer = new GrassRenderer(scene);
    cm.setGrassRenderer(grassRenderer);

    brushCtrlRef.current = ctrl;
    brushCursorRef.current = cursor;
    terrainEditor.registerBrush(ctrl, cursor, cm, grid, waterRenderer, grassRenderer);

    return () => {
      cursor.dispose();
      waterRenderer.dispose();
      grassRenderer.dispose();
      brushCtrlRef.current = null;
      brushCursorRef.current = null;
      terrainEditor.unregisterBrush();
    };
  }, [ready, entities, terrainEditor?.registerBrush]);

  // Brush pointer event handler — raycast to terrain and drive brush controller
  useEffect(() => {
    if (!engineRef.current || !ready || !terrainEditor) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { brushActive, brushController, brushCursor, refreshUndoState } = terrainEditor;
    if (!brushActive || !brushController || !brushCursor) {
      brushCursorRef.current?.hide();
      return;
    }

    const sim = engineRef.current.sim;
    const scene = engineRef.current.renderer.getScene();
    const tp = sim.getTerrainPhysics();
    if (!tp) return;

    function getPickRay(evt: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      return scene.createPickingRay(x, y, null, scene.activeCamera);
    }

    function getCursorMode(): CursorMode {
      const tool = brushController!.config.tool;
      if (tool === 'paint') return 'paint';
      if (tool === 'smooth') return 'smooth';
      if (brushController!.config.drawMode === 'subtract') return 'subtract';
      return 'add';
    }

    const onPointerMove = (evt: PointerEvent) => {
      const ray = getPickRay(evt);
      const hit = tp!.raycast(
        { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z },
        { x: ray.direction.x, y: ray.direction.y, z: ray.direction.z },
        500,
      );

      if (!hit) {
        brushCursor!.hide();
        return;
      }

      brushCursor!.show();
      const cfg = {
        shape: brushController!.config.shape,
        size: brushController!.config.size,
        height: brushController!.config.height,
        strength: brushController!.config.strength,
        material: brushController!.config.material,
        pivot: brushController!.config.pivot,
        snapToVoxel: brushController!.config.snapToVoxel,
      };
      brushCursor!.update(hit.point, cfg, getCursorMode());

      if (brushDraggingRef.current) {
        brushController!.pointerMove(hit.point, evt.ctrlKey || evt.metaKey, evt.shiftKey);
      }
    };

    const onPointerDown = (evt: PointerEvent) => {
      if (evt.button !== 0) return; // left click only
      const ray = getPickRay(evt);
      const hit = tp!.raycast(
        { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z },
        { x: ray.direction.x, y: ray.direction.y, z: ray.direction.z },
        500,
      );
      if (!hit) return;

      brushDraggingRef.current = true;
      brushController!.pointerDown(hit.point, evt.ctrlKey || evt.metaKey, evt.shiftKey);
      canvas!.setPointerCapture(evt.pointerId);
    };

    const onPointerUp = (evt: PointerEvent) => {
      if (!brushDraggingRef.current) return;
      brushDraggingRef.current = false;
      brushController!.pointerUp();
      refreshUndoState();
      canvas!.releasePointerCapture(evt.pointerId);
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      brushCursor!.hide();
    };
  }, [ready, terrainEditor?.brushActive, terrainEditor?.brushController, terrainEditor?.brushCursor]);

  // Sync brushActive to window global so scene handlers can check it
  useEffect(() => {
    (window as any).__problocks_brush_active = terrainEditor?.brushActive ?? false;
  }, [terrainEditor?.brushActive]);

  // Undo/redo keyboard shortcuts
  useEffect(() => {
    if (!terrainEditor) return;
    const { brushActive, undo, redo } = terrainEditor;
    if (!brushActive) return;

    const onKeyDown = (evt: KeyboardEvent) => {
      const mod = evt.ctrlKey || evt.metaKey;
      if (!mod || evt.key.toLowerCase() !== 'z') return;
      evt.preventDefault();
      if (evt.shiftKey) {
        redo();
      } else {
        undo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [terrainEditor?.brushActive, terrainEditor?.undo, terrainEditor?.redo]);

  // Sync selected entity transform from store → engine when properties change
  useEffect(() => {
    if (!engineRef.current || !ready || isPlaying || !selectedEntityId) return;
    const entity = entities.find(e => e.id === selectedEntityId);
    if (!entity) return;

    if (entity.type === 'terrain') {
      engineRef.current.renderer.setTerrainTransform(entity.position, entity.rotation, entity.scale);
    } else if (entity.shape) {
      try {
        engineRef.current.sim.setEntityPosition(entity.id, entity.position);
      } catch {
        // Engine may not have this entity yet
      }
    }
  }, [entities, selectedEntityId, ready, isPlaying]);

  // Attach/detach gizmo when selection changes
  useEffect(() => {
    if (!engineRef.current || !ready) return;
    const renderer = engineRef.current.renderer;
    if (selectedEntityId) {
      renderer.attachGizmo(selectedEntityId);
    } else {
      renderer.detachGizmo();
    }
  }, [selectedEntityId, ready]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      {/* Viewport overlay */}
      <div className="absolute bottom-2 left-2 flex gap-2">
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">
          FPS: {ready ? fps : '--'}
        </span>
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">
          Entities: {entities.filter(e => e.type === 'entity').length}
        </span>
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">
          {isPlaying ? '▶ Playing' : '⏸ Paused'}
        </span>
        {selectedEntityId && (
          <span className="rounded bg-blue-600/70 px-2 py-0.5 text-[10px] text-white">
            Selected: {selectedEntityId}
          </span>
        )}
        {hoveredEntity && hoveredEntity !== selectedEntityId && (
          <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] text-gray-300">
            Hover: {hoveredEntity}
          </span>
        )}
      </div>
      {isPlaying && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-[11px] text-gray-300">
          WASD to move | Space to jump | Mouse to look
        </div>
      )}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <span className="text-sm text-gray-400">Loading engine...</span>
        </div>
      )}
    </div>
  );
}
