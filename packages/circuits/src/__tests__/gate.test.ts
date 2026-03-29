import { describe, it, expect } from 'vitest';
import { Gate } from '../gate.js';

describe('Gate', () => {
  it('AND gate truth table', () => {
    const g = new Gate('g1', 'AND');
    g.setInput(0, false); g.setInput(1, false); expect(g.evaluate()).toBe(false);
    g.setInput(0, false); g.setInput(1, true);  expect(g.evaluate()).toBe(false);
    g.setInput(0, true);  g.setInput(1, false); expect(g.evaluate()).toBe(false);
    g.setInput(0, true);  g.setInput(1, true);  expect(g.evaluate()).toBe(true);
  });

  it('OR gate truth table', () => {
    const g = new Gate('g1', 'OR');
    g.setInput(0, false); g.setInput(1, false); expect(g.evaluate()).toBe(false);
    g.setInput(0, false); g.setInput(1, true);  expect(g.evaluate()).toBe(true);
    g.setInput(0, true);  g.setInput(1, false); expect(g.evaluate()).toBe(true);
    g.setInput(0, true);  g.setInput(1, true);  expect(g.evaluate()).toBe(true);
  });

  it('NOT gate truth table', () => {
    const g = new Gate('g1', 'NOT');
    expect(g.inputCount).toBe(1);
    g.setInput(0, false); expect(g.evaluate()).toBe(true);
    g.setInput(0, true);  expect(g.evaluate()).toBe(false);
  });

  it('XOR gate truth table', () => {
    const g = new Gate('g1', 'XOR');
    g.setInput(0, false); g.setInput(1, false); expect(g.evaluate()).toBe(false);
    g.setInput(0, false); g.setInput(1, true);  expect(g.evaluate()).toBe(true);
    g.setInput(0, true);  g.setInput(1, false); expect(g.evaluate()).toBe(true);
    g.setInput(0, true);  g.setInput(1, true);  expect(g.evaluate()).toBe(false);
  });

  it('NAND gate truth table', () => {
    const g = new Gate('g1', 'NAND');
    g.setInput(0, false); g.setInput(1, false); expect(g.evaluate()).toBe(true);
    g.setInput(0, true);  g.setInput(1, true);  expect(g.evaluate()).toBe(false);
  });

  it('NOR gate truth table', () => {
    const g = new Gate('g1', 'NOR');
    g.setInput(0, false); g.setInput(1, false); expect(g.evaluate()).toBe(true);
    g.setInput(0, true);  g.setInput(1, false); expect(g.evaluate()).toBe(false);
  });

  it('generates truth table', () => {
    const tt = Gate.truthTable('AND');
    expect(tt.inputs).toHaveLength(4);
    expect(tt.outputs).toEqual([false, false, false, true]);
  });
});
