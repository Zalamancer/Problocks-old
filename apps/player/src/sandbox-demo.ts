/**
 * Problocks Sandbox Demo
 *
 * FULL PIPELINE: Student TypeScript code runs inside QuickJS WASM sandbox,
 * controlling entities via host functions. Physics runs on host (Rapier).
 *
 * This is the core architecture of Problocks:
 *   Student code (sandbox) → host functions → engine (renderer + physics)
 */

import { BabylonRenderer, RapierPhysics, SimulationLoop, QuickJSRuntime } from '@problocks/engine';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

// This is what a student's simulation code would look like.
// It runs ENTIRELY inside the QuickJS sandbox — no DOM, no network, no filesystem.
const STUDENT_CODE = `
// ==========================================
// Student Simulation: Bouncing Ball Physics Lab
// ==========================================

// This code runs in a sandboxed environment.
// Available API: pb.createEntity, pb.applyForce, pb.applyImpulse,
//                pb.getPosition, pb.getVelocity, pb.removeEntity, pb.log

var ballCount = 0;
var time = 0;

function onStart() {
  pb.log("=== Bouncing Ball Physics Lab ===");
  pb.log("Watch balls spawn and bounce!");

  // Create initial balls at different heights
  for (var i = 0; i < 5; i++) {
    var id = "ball_" + ballCount++;
    var x = (i - 2) * 2;
    var y = 5 + i * 2;
    var colors = ["#ff4444", "#44ff44", "#4444ff", "#ffff44", "#ff44ff"];
    pb.createEntity(id, "sphere", JSON.stringify({
      radius: 0.4,
      position: { x: x, y: y, z: 0 },
      mass: 1.0,
      color: colors[i],
      restitution: 0.7,
      friction: 0.3
    }));
  }

  // Create some boxes as obstacles
  for (var j = 0; j < 3; j++) {
    pb.createEntity("obstacle_" + j, "box", JSON.stringify({
      width: 2, height: 0.3, depth: 2,
      position: { x: (j - 1) * 3, y: 1 + j * 0.5, z: 0 },
      isStatic: true,
      color: "#666688"
    }));
  }
}

function onTick(dt) {
  time += dt;

  // Every 3 seconds, spawn a new ball from a random position
  if (time > 3 && ballCount < 20) {
    time = 0;
    var id = "ball_" + ballCount++;
    var x = (Math.random() - 0.5) * 8;
    var z = (Math.random() - 0.5) * 4;
    var colors = ["#ff8844", "#8844ff", "#44ffff", "#ff4488", "#88ff44"];
    var color = colors[Math.floor(Math.random() * colors.length)];

    pb.createEntity(id, "sphere", JSON.stringify({
      radius: 0.3 + Math.random() * 0.3,
      position: { x: x, y: 10, z: z },
      mass: 0.5 + Math.random() * 2,
      color: color,
      restitution: 0.5 + Math.random() * 0.4,
      friction: 0.2
    }));

    pb.log("Spawned ball #" + ballCount + " at x=" + x.toFixed(1));
  }

  // Check ball positions — if any fell below -10, remove them
  for (var i = 0; i < ballCount; i++) {
    var posStr = pb.getPosition("ball_" + i);
    var pos = parseVec3(posStr);
    if (pos.y < -10) {
      pb.removeEntity("ball_" + i);
      pb.log("Ball " + i + " fell off! Removed.");
    }
  }
}
`;

async function main() {
  // Initialize renderer
  const renderer = new BabylonRenderer();
  await renderer.init({ mode: '3d', canvas, width: window.innerWidth, height: window.innerHeight });

  // Initialize physics on HOST (native WASM speed)
  const physics = new RapierPhysics();
  await physics.init({ mode: '3d', gravity: { x: 0, y: -9.81, z: 0 } });

  // Create simulation loop
  const sim = new SimulationLoop(renderer, physics);

  // Add ground
  sim.createEntity('ground', 'plane', {
    width: 50, height: 50, depth: 50,
    position: { x: 0, y: -0.05, z: 0 },
    isStatic: true,
    color: '#222230',
  });

  // Initialize QuickJS SANDBOX
  const sandbox = new QuickJSRuntime();
  await sandbox.init({ maxFrameMs: 100, maxMemoryBytes: 10 * 1024 * 1024, maxApiCallsPerSec: 60 });
  sandbox.bindSimulation(sim);

  // Load and execute student code in the sandbox
  await sandbox.loadSimulation(STUDENT_CODE);

  // Wire sandbox tick into simulation loop
  sim.onFrame((dt) => {
    sandbox.callTick(dt);
  });

  // Handle resize
  window.addEventListener('resize', () => renderer.handleResize());

  // Start
  sim.start();

  // Update UI
  const uiEl = document.getElementById('ui')!;
  uiEl.innerHTML = `
    <h2>Problocks Sandbox Demo</h2>
    <p style="color: #4f4; margin-bottom: 8px;">Student code running in QuickJS WASM sandbox</p>
    <p>Physics: Rapier (host, native speed)</p>
    <p>Rendering: Babylon.js (WebGL)</p>
    <p>Sandbox: QuickJS-in-WASM (zero ambient authority)</p>
    <p style="margin-top: 8px; color: #aaa;">Balls spawn every 3s. Orbit with mouse.</p>
    <p style="margin-top: 4px; color: #aaa;">Check console for sandbox logs.</p>
  `;
}

main().catch(console.error);
