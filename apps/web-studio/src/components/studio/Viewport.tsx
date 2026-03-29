import { useRef, useEffect, useState, useContext } from 'react';
import { BabylonRenderer } from '@problocks/engine/renderer/babylon-renderer';
import { RapierPhysics } from '@problocks/engine/physics/rapier-physics';
import { SimulationLoop } from '@problocks/engine/core/simulation-loop';
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
  const { entities, selectedEntityId, isPlaying } = useStudio();

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

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="h-full w-full" />
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
      </div>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <span className="text-sm text-gray-400">Loading engine...</span>
        </div>
      )}
    </div>
  );
}
