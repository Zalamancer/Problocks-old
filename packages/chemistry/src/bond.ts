export type BondType = 'single' | 'double' | 'triple' | 'ionic' | 'hydrogen';

export class Bond {
  readonly id: string;
  readonly atomA: string;
  readonly atomB: string;
  readonly type: BondType;
  readonly strength: number; // kJ/mol

  constructor(id: string, atomA: string, atomB: string, type: BondType = 'single') {
    this.id = id;
    this.atomA = atomA;
    this.atomB = atomB;
    this.type = type;
    this.strength = Bond.getStrength(type);
  }

  static getStrength(type: BondType): number {
    switch (type) {
      case 'single': return 347;
      case 'double': return 614;
      case 'triple': return 839;
      case 'ionic': return 500;
      case 'hydrogen': return 20;
    }
  }

  /** Number of electron pairs shared */
  get order(): number {
    switch (this.type) {
      case 'single': return 1;
      case 'double': return 2;
      case 'triple': return 3;
      default: return 1;
    }
  }
}
