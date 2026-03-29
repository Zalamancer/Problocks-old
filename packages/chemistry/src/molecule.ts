import { Atom, type ElementSymbol } from './atom.js';
import { Bond, type BondType } from './bond.js';

export class Molecule {
  readonly name: string;
  readonly atoms: Map<string, Atom> = new Map();
  readonly bonds: Bond[] = [];
  private nextId = 1;

  constructor(name: string) {
    this.name = name;
  }

  addAtom(symbol: ElementSymbol, position?: { x: number; y: number; z: number }): string {
    const id = `atom_${this.nextId++}`;
    this.atoms.set(id, new Atom(id, symbol, position));
    return id;
  }

  addBond(atomA: string, atomB: string, type: BondType = 'single'): string {
    const a = this.atoms.get(atomA);
    const b = this.atoms.get(atomB);
    if (!a || !b) throw new Error(`Atom not found: ${!a ? atomA : atomB}`);
    if (!a.canBond()) throw new Error(`${a.element.symbol} has reached max bonds`);
    if (!b.canBond()) throw new Error(`${b.element.symbol} has reached max bonds`);

    const id = `bond_${this.nextId++}`;
    const order = type === 'double' ? 2 : type === 'triple' ? 3 : 1;
    a.bondCount += order;
    b.bondCount += order;
    this.bonds.push(new Bond(id, atomA, atomB, type));
    return id;
  }

  /** Get molecular formula (e.g., H2O, CO2) */
  getFormula(): string {
    const counts: Record<string, number> = {};
    for (const atom of this.atoms.values()) {
      counts[atom.element.symbol] = (counts[atom.element.symbol] ?? 0) + 1;
    }
    // Standard ordering: C, H, then alphabetical
    const order = ['C', 'H'];
    const sorted = Object.keys(counts).sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
    return sorted.map(s => s + (counts[s] > 1 ? counts[s] : '')).join('');
  }

  /** Get total molecular mass */
  getMolecularMass(): number {
    let mass = 0;
    for (const atom of this.atoms.values()) {
      mass += atom.element.atomicMass;
    }
    return Math.round(mass * 100) / 100;
  }

  /** Create common molecules */
  static water(): Molecule {
    const m = new Molecule('Water');
    const o = m.addAtom('O', { x: 0, y: 0, z: 0 });
    const h1 = m.addAtom('H', { x: -0.76, y: 0.59, z: 0 });
    const h2 = m.addAtom('H', { x: 0.76, y: 0.59, z: 0 });
    m.addBond(o, h1);
    m.addBond(o, h2);
    return m;
  }

  static carbonDioxide(): Molecule {
    const m = new Molecule('Carbon Dioxide');
    const c = m.addAtom('C', { x: 0, y: 0, z: 0 });
    const o1 = m.addAtom('O', { x: -1.16, y: 0, z: 0 });
    const o2 = m.addAtom('O', { x: 1.16, y: 0, z: 0 });
    m.addBond(c, o1, 'double');
    m.addBond(c, o2, 'double');
    return m;
  }

  static methane(): Molecule {
    const m = new Molecule('Methane');
    const c = m.addAtom('C', { x: 0, y: 0, z: 0 });
    const h1 = m.addAtom('H', { x: 0.63, y: 0.63, z: 0.63 });
    const h2 = m.addAtom('H', { x: -0.63, y: -0.63, z: 0.63 });
    const h3 = m.addAtom('H', { x: -0.63, y: 0.63, z: -0.63 });
    const h4 = m.addAtom('H', { x: 0.63, y: -0.63, z: -0.63 });
    m.addBond(c, h1); m.addBond(c, h2); m.addBond(c, h3); m.addBond(c, h4);
    return m;
  }
}
