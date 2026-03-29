/**
 * BENCHMARK: Game logic only (what actually runs in the sandbox)
 *
 * Physics runs on the HOST (Rapier). Student sandbox code only does:
 * - Read positions/velocities from physics engine (via host functions)
 * - Decide what to do (game logic, scoring, triggers)
 * - Call host functions (apply force, create entity, update UI)
 *
 * This benchmark simulates that workload.
 */

import { getQuickJS } from 'quickjs-emscripten';

// Simulates typical student game logic per frame:
// - Check 50 entities' positions
// - Run scoring/trigger logic
// - Make API calls to host
const GAME_LOGIC_CODE = `
// Simulate reading entity positions (from host)
const entities = [];
for (let i = 0; i < 50; i++) {
  entities.push({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    z: Math.random() * 100,
    type: i % 3 === 0 ? 'sensor' : 'body',
    score: 0,
  });
}

// Per-frame game logic: collision checks, scoring, triggers
let totalScore = 0;
for (let frame = 0; frame < 60; frame++) { // 1 second of frames
  for (let i = 0; i < entities.length; i++) {
    // Update positions (simulating reading from host physics)
    entities[i].x += (Math.random() - 0.5) * 2;
    entities[i].y += (Math.random() - 0.5) * 2;

    // Simple distance checks (collision detection logic)
    for (let j = i + 1; j < entities.length; j++) {
      const dx = entities[i].x - entities[j].x;
      const dy = entities[i].y - entities[j].y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 5) {
        // Trigger: objects are close
        if (entities[i].type === 'sensor') {
          totalScore += 10;
        }
      }
    }

    // UI update logic
    if (entities[i].score > 100) {
      entities[i].score = 0; // reset
    }
  }
}
totalScore;
`;

// Circuit simulation logic (evaluating gates, not physics)
const CIRCUIT_LOGIC_CODE = `
// Simulate a circuit with 200 logic gates
const gates = [];
for (let i = 0; i < 200; i++) {
  gates.push({
    type: ['AND', 'OR', 'NOT', 'XOR', 'NAND'][i % 5],
    inputA: i > 0 ? Math.random() > 0.5 : true,
    inputB: Math.random() > 0.5,
    output: false,
  });
}

// Evaluate circuit for 100 clock cycles
for (let cycle = 0; cycle < 100; cycle++) {
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    switch (g.type) {
      case 'AND':  g.output = g.inputA && g.inputB; break;
      case 'OR':   g.output = g.inputA || g.inputB; break;
      case 'NOT':  g.output = !g.inputA; break;
      case 'XOR':  g.output = g.inputA !== g.inputB; break;
      case 'NAND': g.output = !(g.inputA && g.inputB); break;
    }
    // Propagate to next gate
    if (i + 1 < gates.length) {
      gates[i + 1].inputA = g.output;
    }
  }
}
gates[199].output;
`;

async function bench(name: string, code: string) {
  // V8 native
  const v8Start = performance.now();
  for (let i = 0; i < 10; i++) new Function(code)();
  const v8Time = (performance.now() - v8Start) / 10;

  // QuickJS
  const QuickJS = await getQuickJS();
  const vm = QuickJS.newContext();
  const qjsStart = performance.now();
  for (let i = 0; i < 10; i++) {
    const result = vm.evalCode(code);
    if (result.error) { result.error.dispose(); } else { result.value.dispose(); }
  }
  const qjsTime = (performance.now() - qjsStart) / 10;
  vm.dispose();

  const ratio = qjsTime / v8Time;
  const fitsInFrame = qjsTime < 16.67;

  console.log(`--- ${name} ---`);
  console.log(`  V8:      ${v8Time.toFixed(2)}ms`);
  console.log(`  QuickJS: ${qjsTime.toFixed(2)}ms`);
  console.log(`  Ratio:   ${ratio.toFixed(1)}x`);
  console.log(`  Fits in 16.67ms frame: ${fitsInFrame ? '✅ YES' : '❌ NO'}`);
  console.log();
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  GAME LOGIC BENCHMARK (what actually runs in sandbox)');
  console.log('═══════════════════════════════════════════════════════');
  console.log();

  await bench('Game Logic (50 entities, 60 frames of collision/scoring)', GAME_LOGIC_CODE);
  await bench('Circuit Evaluation (200 gates, 100 clock cycles)', CIRCUIT_LOGIC_CODE);

  console.log('═══════════════════════════════════════════════════════');
  console.log('  CONCLUSION');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  If game logic fits in a frame → QuickJS is viable.');
  console.log('  Physics runs on HOST (Rapier/matter.js), NOT in sandbox.');
  console.log('  Student code only handles logic, events, UI updates.');
  console.log();
}

main().catch(console.error);
