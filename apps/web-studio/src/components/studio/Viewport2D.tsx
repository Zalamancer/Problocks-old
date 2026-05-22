import { useRef, useEffect, useState } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import RAPIER from '@dimforge/rapier2d-compat';

// ── Constants ────────────────────────────────────────────────────────

const PIXELS_PER_METER = 50;
const GROUND_Y = 500;
const GROUND_THICKNESS = 40;
const COLORS = [0xff4444, 0x44ff44, 0x4488ff, 0xffff44, 0xff44ff, 0x44ffff, 0xff8844, 0x88ff44];

interface Body2D {
  id: string;
  rigidBody: RAPIER.RigidBody;
  graphic: Graphics;
  shape: 'box' | 'circle';
  width: number;
  height: number;
  color: number;
}

export function Viewport2D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [fps, setFps] = useState(0);
  const [bodyCount, setBodyCount] = useState(0);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    let disposed = false;

    let app: Application;
    let world: RAPIER.World;
    let bodies: Body2D[] = [];
    let nextId = 0;
    let groundGraphic: Graphics;

    async function init() {
      // Init Rapier 2D
      await RAPIER.init();
      world = new RAPIER.World(new RAPIER.Vector2(0, 9.81));

      // Init PixiJS
      app = new Application();
      const w = containerRef.current!.clientWidth;
      const h = containerRef.current!.clientHeight;
      await app.init({
        canvas,
        width: w,
        height: h,
        backgroundColor: 0x1a1a2e,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      // Ground
      const groundDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
        w / 2 / PIXELS_PER_METER,
        GROUND_Y / PIXELS_PER_METER,
      );
      const groundBody = world.createRigidBody(groundDesc);
      const groundCollider = RAPIER.ColliderDesc.cuboid(
        w / 2 / PIXELS_PER_METER,
        GROUND_THICKNESS / 2 / PIXELS_PER_METER,
      );
      groundCollider.setFriction(0.8);
      groundCollider.setRestitution(0.2);
      world.createCollider(groundCollider, groundBody);

      groundGraphic = new Graphics();
      groundGraphic.roundRect(0, GROUND_Y - GROUND_THICKNESS / 2, w, GROUND_THICKNESS, 6);
      groundGraphic.fill(0x2a2a4e);
      groundGraphic.rect(0, GROUND_Y - GROUND_THICKNESS / 2, w, 2);
      groundGraphic.fill(0x4a4a7e);
      app.stage.addChild(groundGraphic);

      // Left wall
      const lwDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(-0.2, h / 2 / PIXELS_PER_METER);
      const lwBody = world.createRigidBody(lwDesc);
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, h / PIXELS_PER_METER), lwBody);

      // Right wall
      const rwDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(w / PIXELS_PER_METER + 0.2, h / 2 / PIXELS_PER_METER);
      const rwBody = world.createRigidBody(rwDesc);
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, h / PIXELS_PER_METER), rwBody);

      // Spawn some initial shapes
      for (let i = 0; i < 8; i++) {
        spawnShape(
          100 + Math.random() * (w - 200),
          50 + Math.random() * 200,
          Math.random() > 0.5 ? 'circle' : 'box',
        );
      }

      // Add static platforms
      addPlatform(w * 0.25, GROUND_Y - 180, 200, 14);
      addPlatform(w * 0.65, GROUND_Y - 300, 180, 14);
      addPlatform(w * 0.45, GROUND_Y - 120, 160, 14);

      setReady(true);
      setBodyCount(bodies.length);
    }

    function addPlatform(x: number, y: number, width: number, height: number) {
      const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(
        x / PIXELS_PER_METER,
        y / PIXELS_PER_METER,
      );
      const body = world.createRigidBody(desc);
      const collider = RAPIER.ColliderDesc.cuboid(
        width / 2 / PIXELS_PER_METER,
        height / 2 / PIXELS_PER_METER,
      );
      collider.setFriction(0.6);
      collider.setRestitution(0.3);
      world.createCollider(collider, body);

      const g = new Graphics();
      g.roundRect(-width / 2, -height / 2, width, height, 4);
      g.fill(0x3a3a5e);
      g.roundRect(-width / 2, -height / 2, width, 2, 1);
      g.fill(0x5a5a8e);
      g.position.set(x, y);
      app.stage.addChild(g);
    }

    function spawnShape(px: number, py: number, shape: 'box' | 'circle') {
      const color = COLORS[nextId % COLORS.length];
      const size = 20 + Math.random() * 30;
      const id = `body_${nextId++}`;

      const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
        px / PIXELS_PER_METER,
        py / PIXELS_PER_METER,
      );
      // Add some initial spin
      desc.setAngvel((Math.random() - 0.5) * 4);
      const rigidBody = world.createRigidBody(desc);

      let colliderDesc: RAPIER.ColliderDesc;
      if (shape === 'circle') {
        colliderDesc = RAPIER.ColliderDesc.ball(size / PIXELS_PER_METER);
      } else {
        colliderDesc = RAPIER.ColliderDesc.cuboid(
          size / PIXELS_PER_METER,
          size / PIXELS_PER_METER,
        );
      }
      colliderDesc.setFriction(0.5);
      colliderDesc.setRestitution(0.4);
      colliderDesc.setMass(1.0);
      world.createCollider(colliderDesc, rigidBody);

      const g = new Graphics();
      if (shape === 'circle') {
        g.circle(0, 0, size);
        g.fill(color);
        // Direction indicator
        g.moveTo(0, 0);
        g.lineTo(size * 0.8, 0);
        g.stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
      } else {
        g.roundRect(-size, -size, size * 2, size * 2, 3);
        g.fill(color);
        // Edge highlight
        g.roundRect(-size, -size, size * 2, 3, 1);
        g.fill({ color: 0xffffff, alpha: 0.15 });
      }
      app.stage.addChild(g);

      bodies.push({ id, rigidBody, graphic: g, shape, width: size, height: size, color });
    }

    // Click to spawn
    function onClick(e: MouseEvent) {
      if (disposed || !app) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width / (window.devicePixelRatio || 1));
      const y = (e.clientY - rect.top) * (canvas.height / rect.height / (window.devicePixelRatio || 1));
      const shape = e.shiftKey ? 'box' : 'circle';
      spawnShape(x, y, shape);
      setBodyCount(bodies.length);
    }

    canvas.addEventListener('click', onClick);

    // Physics + render loop
    let fc = 0, fa = 0, lt = performance.now();
    function animate() {
      if (disposed) return;

      // Step physics
      world.step();

      // Sync graphics to physics
      for (const b of bodies) {
        const pos = b.rigidBody.translation();
        const rot = b.rigidBody.rotation();
        b.graphic.position.set(pos.x * PIXELS_PER_METER, pos.y * PIXELS_PER_METER);
        b.graphic.rotation = rot;
      }

      // Remove bodies that fell way below
      const removeIds: string[] = [];
      for (const b of bodies) {
        if (b.rigidBody.translation().y > 20) {
          world.removeRigidBody(b.rigidBody);
          b.graphic.destroy();
          removeIds.push(b.id);
        }
      }
      if (removeIds.length) {
        bodies = bodies.filter(b => !removeIds.includes(b.id));
        setBodyCount(bodies.length);
      }

      // FPS counter
      const now = performance.now();
      fc++; fa += now - lt; lt = now;
      if (fa >= 500) { setFps(Math.round(fc / (fa / 1000))); fc = 0; fa = 0; }

      app.render();
      requestAnimationFrame(animate);
    }

    init().then(() => {
      if (!disposed) requestAnimationFrame(animate);
    });

    // Resize
    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !app) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      app.renderer.resize(w, h);
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      disposed = true;
      canvas.removeEventListener('click', onClick);
      ro.disconnect();
      for (const b of bodies) {
        try { world.removeRigidBody(b.rigidBody); } catch {}
        b.graphic.destroy();
      }
      bodies = [];
      try { world.free(); } catch {}
      try { app.destroy(true, { children: true }); } catch {}
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#1a1a2e]">
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* Bottom info */}
      <div className="absolute bottom-2 left-2 flex gap-2">
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">FPS: {ready ? fps : '--'}</span>
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">PixiJS + Rapier2D</span>
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">Bodies: {bodyCount}</span>
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">
          Click: spawn circle &bull; Shift+click: spawn box
        </span>
      </div>

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <span className="text-sm text-gray-400">Loading 2D engine...</span>
        </div>
      )}
    </div>
  );
}
