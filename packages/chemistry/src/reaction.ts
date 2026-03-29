/**
 * A chemical reaction with reactants, products, and balancing.
 */
export class Reaction {
  readonly reactants: { formula: string; coefficient: number }[];
  readonly products: { formula: string; coefficient: number }[];
  readonly type: 'synthesis' | 'decomposition' | 'combustion' | 'single-replacement' | 'double-replacement' | 'acid-base' | 'redox';

  constructor(
    reactants: { formula: string; coefficient: number }[],
    products: { formula: string; coefficient: number }[],
    type: Reaction['type'] = 'synthesis',
  ) {
    this.reactants = reactants;
    this.products = products;
    this.type = type;
  }

  /** Get balanced equation string */
  toString(): string {
    const lhs = this.reactants.map(r => (r.coefficient > 1 ? r.coefficient : '') + r.formula).join(' + ');
    const rhs = this.products.map(p => (p.coefficient > 1 ? p.coefficient : '') + p.formula).join(' + ');
    return `${lhs} → ${rhs}`;
  }

  /** Common reactions */
  static combustionOfMethane(): Reaction {
    return new Reaction(
      [{ formula: 'CH4', coefficient: 1 }, { formula: 'O2', coefficient: 2 }],
      [{ formula: 'CO2', coefficient: 1 }, { formula: 'H2O', coefficient: 2 }],
      'combustion',
    );
  }

  static waterFormation(): Reaction {
    return new Reaction(
      [{ formula: 'H2', coefficient: 2 }, { formula: 'O2', coefficient: 1 }],
      [{ formula: 'H2O', coefficient: 2 }],
      'synthesis',
    );
  }

  static rustFormation(): Reaction {
    return new Reaction(
      [{ formula: 'Fe', coefficient: 4 }, { formula: 'O2', coefficient: 3 }],
      [{ formula: 'Fe2O3', coefficient: 2 }],
      'synthesis',
    );
  }
}
