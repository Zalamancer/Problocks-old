/**
 * CRITICAL BENCHMARK: QuickJS-in-WASM vs Native V8
 *
 * Tests whether student simulation code can run at acceptable FPS
 * inside the QuickJS sandbox. This is a go/no-go decision gate.
 *
 * Test: N-body gravitational simulation (computationally intensive,
 * representative of physics simulations students would build).
 */

import { getQuickJS } from 'quickjs-emscripten';

// The physics simulation code that will run in BOTH environments
const SIMULATION_CODE = `
// N-body gravitational simulation
const G = 6.674e-11;
const SCALE = 1e10;
const NUM_BODIES = 50;
const STEPS = 1000;

function createBodies(n) {
  const bodies = [];
  for (let i = 0; i < n; i++) {
    bodies.push({
      x: (Math.random() - 0.5) * 1000,
      y: (Math.random() - 0.5) * 1000,
      z: (Math.random() - 0.5) * 1000,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      vz: (Math.random() - 0.5) * 2,
      mass: Math.random() * 1e12 + 1e10,
    });
  }
  return bodies;
}

function step(bodies, dt) {
  const n = bodies.length;
  // Calculate forces
  for (let i = 0; i < n; i++) {
    let fx = 0, fy = 0, fz = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = bodies[j].x - bodies[i].x;
      const dy = bodies[j].y - bodies[i].y;
      const dz = bodies[j].z - bodies[i].z;
      const distSq = dx * dx + dy * dy + dz * dz + 1e-10;
      const dist = Math.sqrt(distSq);
      const force = (G * SCALE * bodies[i].mass * bodies[j].mass) / distSq;
      fx += force * dx / dist;
      fy += force * dy / dist;
      fz += force * dz / dist;
    }
    // Update velocity
    bodies[i].vx += (fx / bodies[i].mass) * dt;
    bodies[i].vy += (fy / bodies[i].mass) * dt;
    bodies[i].vz += (fz / bodies[i].mass) * dt;
  }
  // Update positions
  for (let i = 0; i < n; i++) {
    bodies[i].x += bodies[i].vx * dt;
    bodies[i].y += bodies[i].vy * dt;
    bodies[i].z += bodies[i].vz * dt;
  }
}

const bodies = createBodies(NUM_BODIES);
const dt = 0.016; // ~60fps timestep
for (let s = 0; s < STEPS; s++) {
  step(bodies, dt);
}
bodies[0].x; // return something to prevent dead code elimination
`;

async function benchmarkNativeV8(): Promise<number> {
  const start = performance.now();
  // Run the same code natively in V8
  const fn = new Function(SIMULATION_CODE);
  fn();
  const elapsed = performance.now() - start;
  return elapsed;
}

async function benchmarkQuickJS(): Promise<number> {
  const QuickJS = await getQuickJS();
  const vm = QuickJS.newContext();

  const start = performance.now();
  const result = vm.evalCode(SIMULATION_CODE);

  if (result.error) {
    const err = vm.dump(result.error);
    result.error.dispose();
    vm.dispose();
    throw new Error(`QuickJS error: ${JSON.stringify(err)}`);
  }

  result.value.dispose();
  const elapsed = performance.now() - start;

  vm.dispose();
  return elapsed;
}

// Also test a simpler simulation: spring-mass system (more typical student sim)
const SPRING_MASS_CODE = `
const NUM_SPRINGS = 100;
const STEPS = 5000;
const dt = 0.001;
const k = 50.0;  // spring constant
const damping = 0.98;

const particles = [];
for (let i = 0; i < NUM_SPRINGS; i++) {
  particles.push({
    x: i * 0.1,
    y: Math.sin(i * 0.3) * 0.5,
    vx: 0,
    vy: 0,
    mass: 1.0
  });
}

for (let s = 0; s < STEPS; s++) {
  for (let i = 0; i < particles.length; i++) {
    let fx = 0, fy = -9.81 * particles[i].mass;

    // Spring to left neighbor
    if (i > 0) {
      const dx = particles[i-1].x - particles[i].x;
      const dy = particles[i-1].y - particles[i].y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const restLen = 0.1;
      const stretch = dist - restLen;
      fx += k * stretch * (dx / dist);
      fy += k * stretch * (dy / dist);
    }

    // Spring to right neighbor
    if (i < particles.length - 1) {
      const dx = particles[i+1].x - particles[i].x;
      const dy = particles[i+1].y - particles[i].y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const restLen = 0.1;
      const stretch = dist - restLen;
      fx += k * stretch * (dx / dist);
      fy += k * stretch * (dy / dist);
    }

    particles[i].vx = (particles[i].vx + fx / particles[i].mass * dt) * damping;
    particles[i].vy = (particles[i].vy + fy / particles[i].mass * dt) * damping;
  }

  for (let i = 1; i < particles.length; i++) {
    particles[i].x += particles[i].vx * dt;
    particles[i].y += particles[i].vy * dt;
  }
}
particles[50].y;
`;

async function benchmarkSpringV8(): Promise<number> {
  const start = performance.now();
  const fn = new Function(SPRING_MASS_CODE);
  fn();
  return performance.now() - start;
}

async function benchmarkSpringQuickJS(): Promise<number> {
  const QuickJS = await getQuickJS();
  const vm = QuickJS.newContext();

  const start = performance.now();
  const result = vm.evalCode(SPRING_MASS_CODE);
  if (result.error) {
    const err = vm.dump(result.error);
    result.error.dispose();
    vm.dispose();
    throw new Error(`QuickJS error: ${JSON.stringify(err)}`);
  }
  result.value.dispose();
  const elapsed = performance.now() - start;
  vm.dispose();
  return elapsed;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  PROBLOCKS SANDBOX BENCHMARK: QuickJS-in-WASM vs V8');
  console.log('═══════════════════════════════════════════════════════');
  console.log();

  // Warm up
  console.log('Warming up...');
  await benchmarkNativeV8();
  await benchmarkQuickJS();
  console.log();

  // N-body benchmark
  console.log('--- N-Body Simulation (50 bodies, 1000 steps) ---');
  const v8NBody = await benchmarkNativeV8();
  const qjsNBody = await benchmarkQuickJS();
  const ratioNBody = qjsNBody / v8NBody;
  console.log(`  V8 (native):     ${v8NBody.toFixed(2)}ms`);
  console.log(`  QuickJS (WASM):  ${qjsNBody.toFixed(2)}ms`);
  console.log(`  Ratio:           ${ratioNBody.toFixed(1)}x slower`);
  console.log(`  QuickJS FPS @60: ${(1000 / qjsNBody * 60).toFixed(1)} effective FPS at 1 step/frame`);
  console.log();

  // Spring-mass benchmark
  console.log('--- Spring-Mass System (100 particles, 5000 steps) ---');
  const v8Spring = await benchmarkSpringV8();
  const qjsSpring = await benchmarkSpringQuickJS();
  const ratioSpring = qjsSpring / v8Spring;
  console.log(`  V8 (native):     ${v8Spring.toFixed(2)}ms`);
  console.log(`  QuickJS (WASM):  ${qjsSpring.toFixed(2)}ms`);
  console.log(`  Ratio:           ${ratioSpring.toFixed(1)}x slower`);
  console.log(`  QuickJS FPS @60: ${(1000 / qjsSpring * 60).toFixed(1)} effective FPS at 1 step/frame`);
  console.log();

  // Verdict
  console.log('═══════════════════════════════════════════════════════');
  console.log('  VERDICT');
  console.log('═══════════════════════════════════════════════════════');
  const avgRatio = (ratioNBody + ratioSpring) / 2;
  if (avgRatio < 5) {
    console.log(`  ✅ PASS — Average ${avgRatio.toFixed(1)}x slowdown is acceptable.`);
    console.log('  QuickJS-in-WASM is viable for the sandbox.');
  } else if (avgRatio < 15) {
    console.log(`  ⚠️  MARGINAL — Average ${avgRatio.toFixed(1)}x slowdown.`);
    console.log('  May work for simple sims. Complex physics will struggle.');
    console.log('  Consider: offloading physics to host (Rapier), only sandbox game logic.');
  } else {
    console.log(`  ❌ FAIL — Average ${avgRatio.toFixed(1)}x slowdown is too high.`);
    console.log('  Need V8 isolates (isolated-vm) or Cloudflare Workers instead.');
  }
  console.log();
}

main().catch(console.error);
