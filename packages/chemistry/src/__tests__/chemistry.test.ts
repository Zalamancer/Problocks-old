import { describe, it, expect } from 'vitest';
import { Atom } from '../atom.js';
import { Molecule } from '../molecule.js';
import { Bond } from '../bond.js';
import { Reaction } from '../reaction.js';
import { PeriodicTable } from '../periodic-table.js';

describe('Atom', () => {
  it('creates with correct element data', () => {
    const h = new Atom('a1', 'H');
    expect(h.element.name).toBe('Hydrogen');
    expect(h.element.atomicNumber).toBe(1);
    expect(h.element.maxBonds).toBe(1);
  });

  it('tracks bond capacity', () => {
    const h = new Atom('a1', 'H');
    expect(h.canBond()).toBe(true);
    h.bondCount = 1;
    expect(h.canBond()).toBe(false);
  });

  it('carbon allows 4 bonds', () => {
    const c = new Atom('a1', 'C');
    expect(c.element.maxBonds).toBe(4);
  });

  it('noble gases cannot bond', () => {
    const he = new Atom('a1', 'He');
    expect(he.canBond()).toBe(false);
  });
});

describe('Bond', () => {
  it('has correct strength by type', () => {
    expect(Bond.getStrength('single')).toBe(347);
    expect(Bond.getStrength('double')).toBe(614);
    expect(Bond.getStrength('triple')).toBe(839);
  });

  it('calculates bond order', () => {
    const s = new Bond('b1', 'a1', 'a2', 'single');
    expect(s.order).toBe(1);
    const d = new Bond('b2', 'a1', 'a2', 'double');
    expect(d.order).toBe(2);
  });
});

describe('Molecule', () => {
  it('builds water correctly', () => {
    const water = Molecule.water();
    expect(water.name).toBe('Water');
    expect(water.getFormula()).toBe('H2O');
    expect(water.atoms.size).toBe(3);
    expect(water.bonds).toHaveLength(2);
    expect(water.getMolecularMass()).toBeCloseTo(18.02, 1);
  });

  it('builds CO2 correctly', () => {
    const co2 = Molecule.carbonDioxide();
    expect(co2.getFormula()).toBe('CO2');
    expect(co2.atoms.size).toBe(3);
    expect(co2.bonds).toHaveLength(2);
    expect(co2.getMolecularMass()).toBeCloseTo(44.01, 1);
  });

  it('builds methane correctly', () => {
    const ch4 = Molecule.methane();
    expect(ch4.getFormula()).toBe('CH4');
    expect(ch4.atoms.size).toBe(5);
    expect(ch4.bonds).toHaveLength(4);
  });

  it('prevents over-bonding', () => {
    const m = new Molecule('test');
    const h1 = m.addAtom('H');
    const h2 = m.addAtom('H');
    const h3 = m.addAtom('H');
    m.addBond(h1, h2);
    expect(() => m.addBond(h1, h3)).toThrow('max bonds');
  });
});

describe('Reaction', () => {
  it('formats balanced equation', () => {
    const r = Reaction.waterFormation();
    expect(r.toString()).toBe('2H2 + O2 → 2H2O');
  });

  it('combustion of methane', () => {
    const r = Reaction.combustionOfMethane();
    expect(r.type).toBe('combustion');
    expect(r.toString()).toBe('CH4 + 2O2 → CO2 + 2H2O');
  });
});

describe('PeriodicTable', () => {
  it('identifies metals', () => {
    expect(PeriodicTable.isMetal('Fe')).toBe(true);
    expect(PeriodicTable.isMetal('Au')).toBe(true);
    expect(PeriodicTable.isMetal('O')).toBe(false);
  });

  it('identifies nonmetals', () => {
    expect(PeriodicTable.isNonmetal('O')).toBe(true);
    expect(PeriodicTable.isNonmetal('Fe')).toBe(false);
  });

  it('returns halogens', () => {
    const halogens = PeriodicTable.getHalogens();
    expect(halogens.map(h => h.symbol)).toContain('Cl');
  });
});
