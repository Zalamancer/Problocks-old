/**
 * Problocks Engine Demo
 *
 * Proves the full pipeline: Babylon.js rendering + Rapier physics + simulation loop.
 * Drop physics objects and watch them collide with gravity.
 */

import { BabylonRenderer, RapierPhysics, SimulationLoop } from '@problocks/engine';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

async function main() {
  // Initialize renderer
  const renderer = new BabylonRenderer();
  await renderer.init({ mode: '3d', canvas, width: window.innerWidth, height: window.innerHeight });

  // Initialize physics
  const physics = new RapierPhysics();
  await physics.init({ mode: '3d', gravity: { x: 0, y: -9.81, z: 0 } });

  // Create simulation loop
  const sim = new SimulationLoop(renderer, physics);

  // Add static ground
  sim.createEntity('ground', 'plane', {
    width: 50, height: 50, depth: 50,
    position: { x: 0, y: -0.05, z: 0 },
    isStatic: true,
    color: '#333340',
  });

  // Counter for unique entity IDs
  let entityCount = 0;
  const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8844', '#8844ff'];

  function dropObject(shape: 'box' | 'sphere' | 'cylinder') {
    const id = `obj_${entityCount++}`;
    const color = colors[entityCount % colors.length];
    const x = (Math.random() - 0.5) * 6;
    const z = (Math.random() - 0.5) * 6;
    const y = 8 + Math.random() * 4;

    const size = 0.3 + Math.random() * 0.7;

    sim.createEntity(id, shape, {
      width: size,
      height: size,
      depth: size,
      radius: size / 2,
      position: { x, y, z },
      mass: size * 2,
      color,
      friction: 0.6,
      restitution: 0.4,
    });
  }

  function reset() {
    // Remove all non-ground entities
    for (let i = 0; i < entityCount; i++) {
      sim.removeEntity(`obj_${i}`);
    }
    entityCount = 0;
  }

  // UI buttons
  document.getElementById('btn-box')!.addEventListener('click', () => dropObject('box'));
  document.getElementById('btn-sphere')!.addEventListener('click', () => dropObject('sphere'));
  document.getElementById('btn-cylinder')!.addEventListener('click', () => dropObject('cylinder'));
  document.getElementById('btn-reset')!.addEventListener('click', reset);

  // Handle resize
  window.addEventListener('resize', () => renderer.handleResize());

  // Drop a few initial objects
  for (let i = 0; i < 5; i++) {
    setTimeout(() => dropObject(['box', 'sphere', 'cylinder'][i % 3] as any), i * 300);
  }

  // Start the simulation
  sim.start();
}

main().catch(console.error);
