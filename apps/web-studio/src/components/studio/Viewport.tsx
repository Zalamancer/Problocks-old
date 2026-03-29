import { useRef, useEffect, useState, useContext, useCallback } from 'react';
import { BabylonRenderer } from '@problocks/engine/renderer/babylon-renderer';
import { RapierPhysics } from '@problocks/engine/physics/rapier-physics';
import { SimulationLoop } from '@problocks/engine/core/simulation-loop';
import { TerrainComponent, WaterComponent } from '@problocks/engine/core/component';
import { useStudio, StudioContext } from '@/store/studio-store';

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

      // Create terrain + water
      const terrain = new TerrainComponent();
      terrain.width = 100;
      terrain.depth = 100;
      terrain.subdivisions = 128;
      terrain.maxHeight = 10;
      terrain.seed = 42;
      terrain.noiseScale = 0.03;
      sim.createTerrain(terrain);

      const water = new WaterComponent();
      water.width = 100;
      water.depth = 100;
      water.waterLevel = 2.5;
      water.buoyancy = 9.8;
      water.waterDrag = 0.8;
      sim.createWater(water);

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

      // Click to select entities
      scene.onPointerDown = (_evt, pickResult) => {
        if (pickResult?.hit && pickResult.pickedMesh) {
          const meshName = pickResult.pickedMesh.name;
          // Skip internal meshes (ground, etc.)
          if (meshName.startsWith('__')) return;
          selectEntity(meshName);
        } else {
          selectEntity(null);
        }
      };

      // Hover detection
      scene.onPointerMove = (_evt, pickResult) => {
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

      // Two-finger scroll → orbit (spin), pinch → zoom
      const cam = scene.activeCamera as any;
      canvas!.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();

        if (e.ctrlKey) {
          // Pinch-to-zoom (trackpad sends ctrlKey + deltaY for pinch)
          const zoomDelta = e.deltaY * 0.01;
          cam.radius = Math.max(
            cam.lowerRadiusLimit ?? 2,
            Math.min(cam.upperRadiusLimit ?? 100, cam.radius * (1 + zoomDelta)),
          );
        } else {
          // Two-finger swipe → orbit/spin in both directions
          const orbitSpeed = 0.005;
          cam.alpha -= e.deltaX * orbitSpeed;
          cam.beta -= e.deltaY * orbitSpeed;
          // Clamp beta to prevent flipping (keep between ~5° and ~175°)
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

  // Start/stop physics when Play/Stop is toggled
  useEffect(() => {
    if (!engineRef.current) return;
    if (isPlaying) {
      engineRef.current.sim.start();
    } else {
      engineRef.current.sim.stop();
    }
  }, [isPlaying]);

  // Sync selected entity transform from store → engine when properties change
  useEffect(() => {
    if (!engineRef.current || !ready || isPlaying || !selectedEntityId) return;
    const entity = entities.find(e => e.id === selectedEntityId);
    if (entity?.shape) {
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
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <span className="text-sm text-gray-400">Loading engine...</span>
        </div>
      )}
    </div>
  );
}
