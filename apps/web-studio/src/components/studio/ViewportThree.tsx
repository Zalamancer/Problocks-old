import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RapierPhysics } from '@problocks/engine/physics/rapier-physics';
import { VoxelTerrainComponent } from '@problocks/engine/core/component';
import { VoxelGrid } from '@problocks/engine/terrain/voxel/voxel-grid';
import { ChunkMesher } from '@problocks/engine/terrain/meshing/chunk-mesher';
import { ChunkManager } from '@problocks/engine/terrain/voxel/chunk-manager';
import { TerrainGenerator } from '@problocks/engine/terrain/generation/terrain-generator';
import { TerrainPhysics } from '@problocks/engine/terrain/physics/terrain-physics';
import { ThreeChunkRenderer } from '@problocks/engine/terrain/rendering/three-chunk-renderer';
import { ThreeGrassRenderer } from '@problocks/engine/terrain/rendering/three-grass-renderer';
import type { TerrainRegion } from '@problocks/engine/terrain/generation/cave-generator';
import { useStudio } from '@/store/studio-store';

/**
 * Three.js Viewport — replaces Babylon.js Viewport.
 * Terrain rendering + grass with exact CodeSandbox grass shaders.
 */
export function ViewportThree() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    chunkManager: ChunkManager;
    grassRenderer: ThreeGrassRenderer;
    grid: VoxelGrid;
  } | null>(null);
  const [fps, setFps] = useState(0);
  const [ready, setReady] = useState(false);
  const { entities, isPlaying } = useStudio();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || engineRef.current) return;

    let disposed = false;

    async function init() {
      if (!canvas || disposed) return;

      // ── Three.js setup ──────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0.53, 0.72, 0.9);

      const camera = new THREE.PerspectiveCamera(
        60, canvas.clientWidth / canvas.clientHeight, 0.5, 2000,
      );
      camera.position.set(40, 60, 80);
      camera.lookAt(0, 10, 0);

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.maxPolarAngle = Math.PI / 2.1;
      controls.maxDistance = 300;
      controls.target.set(0, 10, 0);

      // Lights
      const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 0.9);
      scene.add(hemi);
      const dir = new THREE.DirectionalLight(0xffffff, 0.7);
      dir.position.set(-50, 100, 50);
      scene.add(dir);

      if (disposed) { renderer.dispose(); return; }

      // ── Terrain ─────────────────────────────────────────────────
      const terrainEntity = entities.find(e => e.type === 'terrain');
      const t = terrainEntity?.terrain;

      const grid = new VoxelGrid();
      const mesher = new ChunkMesher();
      const chunkRenderer = new ThreeChunkRenderer(scene);
      const chunkManager = new ChunkManager(grid, mesher, chunkRenderer as any);

      // Physics
      const physics = new RapierPhysics();
      await physics.init({ mode: '3d', gravity: { x: 0, y: -9.81, z: 0 } });
      const terrainPhysics = new TerrainPhysics(physics.getWorld(), grid);
      chunkManager.setTerrainPhysics(terrainPhysics);

      // Grass
      const grassRenderer = new ThreeGrassRenderer(scene);
      chunkManager.setGrassRenderer(grassRenderer as any);

      // Generate terrain
      if (t && t.mode === 'voxel') {
        const region: TerrainRegion = {
          minX: t.minX ?? -128, maxX: t.maxX ?? 128,
          minY: t.minY ?? -32, maxY: t.maxY ?? 64,
          minZ: t.minZ ?? -128, maxZ: t.maxZ ?? 128,
        };
        const generator = new TerrainGenerator();
        generator.generate(grid, region, {
          biomes: t.biomes ?? ['hills', 'plains'],
          seed: t.seed,
          biomeSize: t.biomeSize ?? 120,
          blending: t.blending ?? 0.3,
          caves: t.caves ?? true,
        });
        chunkManager.forceRemeshAll();
      }

      if (disposed) { renderer.dispose(); physics.dispose(); return; }

      engineRef.current = { renderer, scene, camera, controls, chunkManager, grassRenderer, grid };

      // ── Render loop ─────────────────────────────────────────────
      let lastTime = performance.now();
      let frameCount = 0;
      let fpsAccum = 0;

      function animate() {
        if (disposed) return;

        const now = performance.now();
        const dt = now - lastTime;
        lastTime = now;
        frameCount++;
        fpsAccum += dt;
        if (fpsAccum >= 500) {
          setFps(Math.round(frameCount / (fpsAccum / 1000)));
          frameCount = 0;
          fpsAccum = 0;
        }

        controls.update();

        // Update chunk manager (mesh terrain)
        const cam = camera.position;
        chunkManager.update({ x: cam.x, y: cam.y, z: cam.z });

        // Update grass wind animation
        grassRenderer.update(now);

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      }
      requestAnimationFrame(animate);

      // Resize
      const resizeObs = new ResizeObserver(() => {
        if (!containerRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      if (containerRef.current) resizeObs.observe(containerRef.current);

      setReady(true);

      return () => {
        disposed = true;
        resizeObs.disconnect();
        chunkRenderer.dispose();
        grassRenderer.dispose();
        renderer.dispose();
        physics.dispose();
      };
    }

    init().catch(err => console.error('[ViewportThree] init failed:', err));

    return () => { disposed = true; };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="absolute bottom-2 left-2 flex gap-2">
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">
          FPS: {ready ? fps : '--'}
        </span>
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">
          Three.js
        </span>
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">
          {isPlaying ? 'Playing' : 'Paused'}
        </span>
      </div>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <span className="text-sm text-gray-400">Loading Three.js engine...</span>
        </div>
      )}
    </div>
  );
}
