import { describe, it, expect } from 'vitest';
import { Circuit } from '../circuit.js';

describe('Circuit', () => {
  it('builds and evaluates a simple AND circuit', () => {
    const circuit = new Circuit();
    const swA = circuit.addSwitch('A');
    const swB = circuit.addSwitch('B');
    const and = circuit.addGate('AND');
    const led = circuit.addLED('Output');

    circuit.connect(swA, 0, and, 0);
    circuit.connect(swB, 0, and, 1);
    circuit.connect(and, 0, led, 0);

    // A=0, B=0 → 0
    circuit.evaluate();
    expect(circuit.getOutput(led)).toBe(false);

    // A=1, B=0 → 0
    circuit.setSwitch(swA, true);
    circuit.evaluate();
    expect(circuit.getOutput(led)).toBe(false);

    // A=1, B=1 → 1
    circuit.setSwitch(swB, true);
    circuit.evaluate();
    expect(circuit.getOutput(led)).toBe(true);
  });

  it('builds cascaded gates: NOT(A) AND B', () => {
    const circuit = new Circuit();
    const swA = circuit.addSwitch('A');
    const swB = circuit.addSwitch('B');
    const not = circuit.addGate('NOT');
    const and = circuit.addGate('AND');
    const led = circuit.addLED('Out');

    circuit.connect(swA, 0, not, 0);   // A → NOT
    circuit.connect(not, 0, and, 0);   // NOT → AND input 0
    circuit.connect(swB, 0, and, 1);   // B → AND input 1
    circuit.connect(and, 0, led, 0);   // AND → LED

    // A=0, B=0 → NOT(0)=1, 1 AND 0 = 0
    circuit.evaluate();
    expect(circuit.getOutput(led)).toBe(false);

    // A=0, B=1 → NOT(0)=1, 1 AND 1 = 1
    circuit.setSwitch(swB, true);
    circuit.evaluate();
    expect(circuit.getOutput(led)).toBe(true);

    // A=1, B=1 → NOT(1)=0, 0 AND 1 = 0
    circuit.setSwitch(swA, true);
    circuit.evaluate();
    expect(circuit.getOutput(led)).toBe(false);
  });

  it('toggles switches', () => {
    const circuit = new Circuit();
    const sw = circuit.addSwitch('A');
    expect(circuit.getOutput(sw)).toBe(false);
    circuit.toggleSwitch(sw);
    expect(circuit.getOutput(sw)).toBe(true);
    circuit.toggleSwitch(sw);
    expect(circuit.getOutput(sw)).toBe(false);
  });

  it('returns complete state', () => {
    const circuit = new Circuit();
    circuit.addSwitch('A');
    circuit.addGate('AND');
    circuit.addLED('Out');

    const state = circuit.getState();
    expect(state.switches).toHaveLength(1);
    expect(state.gates).toHaveLength(1);
    expect(state.leds).toHaveLength(1);
  });
});
