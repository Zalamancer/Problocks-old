export type ElementSymbol = 'H' | 'He' | 'Li' | 'Be' | 'B' | 'C' | 'N' | 'O' | 'F' | 'Ne' |
  'Na' | 'Mg' | 'Al' | 'Si' | 'P' | 'S' | 'Cl' | 'Ar' | 'K' | 'Ca' | 'Fe' | 'Cu' | 'Zn' | 'Ag' | 'Au';

export interface ElementData {
  symbol: ElementSymbol;
  name: string;
  atomicNumber: number;
  atomicMass: number;
  color: string;
  radius: number; // van der Waals radius in pm, scaled
  electronegativity: number;
  maxBonds: number;
}

const ELEMENTS: Record<ElementSymbol, ElementData> = {
  H:  { symbol: 'H',  name: 'Hydrogen',   atomicNumber: 1,  atomicMass: 1.008,   color: '#ffffff', radius: 0.25, electronegativity: 2.20, maxBonds: 1 },
  He: { symbol: 'He', name: 'Helium',     atomicNumber: 2,  atomicMass: 4.003,   color: '#d9ffff', radius: 0.28, electronegativity: 0,    maxBonds: 0 },
  Li: { symbol: 'Li', name: 'Lithium',    atomicNumber: 3,  atomicMass: 6.941,   color: '#cc80ff', radius: 0.35, electronegativity: 0.98, maxBonds: 1 },
  Be: { symbol: 'Be', name: 'Beryllium',  atomicNumber: 4,  atomicMass: 9.012,   color: '#c2ff00', radius: 0.30, electronegativity: 1.57, maxBonds: 2 },
  B:  { symbol: 'B',  name: 'Boron',      atomicNumber: 5,  atomicMass: 10.81,   color: '#ffb5b5', radius: 0.32, electronegativity: 2.04, maxBonds: 3 },
  C:  { symbol: 'C',  name: 'Carbon',     atomicNumber: 6,  atomicMass: 12.01,   color: '#333333', radius: 0.30, electronegativity: 2.55, maxBonds: 4 },
  N:  { symbol: 'N',  name: 'Nitrogen',   atomicNumber: 7,  atomicMass: 14.01,   color: '#3050f8', radius: 0.28, electronegativity: 3.04, maxBonds: 3 },
  O:  { symbol: 'O',  name: 'Oxygen',     atomicNumber: 8,  atomicMass: 16.00,   color: '#ff0d0d', radius: 0.27, electronegativity: 3.44, maxBonds: 2 },
  F:  { symbol: 'F',  name: 'Fluorine',   atomicNumber: 9,  atomicMass: 19.00,   color: '#90e050', radius: 0.25, electronegativity: 3.98, maxBonds: 1 },
  Ne: { symbol: 'Ne', name: 'Neon',       atomicNumber: 10, atomicMass: 20.18,   color: '#b3e3f5', radius: 0.28, electronegativity: 0,    maxBonds: 0 },
  Na: { symbol: 'Na', name: 'Sodium',     atomicNumber: 11, atomicMass: 22.99,   color: '#ab5cf2', radius: 0.38, electronegativity: 0.93, maxBonds: 1 },
  Mg: { symbol: 'Mg', name: 'Magnesium',  atomicNumber: 12, atomicMass: 24.31,   color: '#8aff00', radius: 0.36, electronegativity: 1.31, maxBonds: 2 },
  Al: { symbol: 'Al', name: 'Aluminum',   atomicNumber: 13, atomicMass: 26.98,   color: '#bfa6a6', radius: 0.35, electronegativity: 1.61, maxBonds: 3 },
  Si: { symbol: 'Si', name: 'Silicon',    atomicNumber: 14, atomicMass: 28.09,   color: '#f0c8a0', radius: 0.33, electronegativity: 1.90, maxBonds: 4 },
  P:  { symbol: 'P',  name: 'Phosphorus', atomicNumber: 15, atomicMass: 30.97,   color: '#ff8000', radius: 0.31, electronegativity: 2.19, maxBonds: 5 },
  S:  { symbol: 'S',  name: 'Sulfur',     atomicNumber: 16, atomicMass: 32.07,   color: '#ffff30', radius: 0.31, electronegativity: 2.58, maxBonds: 6 },
  Cl: { symbol: 'Cl', name: 'Chlorine',   atomicNumber: 17, atomicMass: 35.45,   color: '#1ff01f', radius: 0.30, electronegativity: 3.16, maxBonds: 1 },
  Ar: { symbol: 'Ar', name: 'Argon',      atomicNumber: 18, atomicMass: 39.95,   color: '#80d1e3', radius: 0.30, electronegativity: 0,    maxBonds: 0 },
  K:  { symbol: 'K',  name: 'Potassium',  atomicNumber: 19, atomicMass: 39.10,   color: '#8f40d4', radius: 0.42, electronegativity: 0.82, maxBonds: 1 },
  Ca: { symbol: 'Ca', name: 'Calcium',    atomicNumber: 20, atomicMass: 40.08,   color: '#3dff00', radius: 0.39, electronegativity: 1.00, maxBonds: 2 },
  Fe: { symbol: 'Fe', name: 'Iron',       atomicNumber: 26, atomicMass: 55.85,   color: '#e06633', radius: 0.32, electronegativity: 1.83, maxBonds: 6 },
  Cu: { symbol: 'Cu', name: 'Copper',     atomicNumber: 29, atomicMass: 63.55,   color: '#c88033', radius: 0.32, electronegativity: 1.90, maxBonds: 4 },
  Zn: { symbol: 'Zn', name: 'Zinc',       atomicNumber: 30, atomicMass: 65.38,   color: '#7d80b0', radius: 0.33, electronegativity: 1.65, maxBonds: 2 },
  Ag: { symbol: 'Ag', name: 'Silver',     atomicNumber: 47, atomicMass: 107.87,  color: '#c0c0c0', radius: 0.36, electronegativity: 1.93, maxBonds: 4 },
  Au: { symbol: 'Au', name: 'Gold',       atomicNumber: 79, atomicMass: 196.97,  color: '#ffd123', radius: 0.36, electronegativity: 2.54, maxBonds: 4 },
};

export class Atom {
  readonly id: string;
  readonly element: ElementData;
  position: { x: number; y: number; z: number };
  bondCount: number = 0;

  constructor(id: string, symbol: ElementSymbol, position?: { x: number; y: number; z: number }) {
    this.id = id;
    this.element = ELEMENTS[symbol];
    this.position = position ?? { x: 0, y: 0, z: 0 };
  }

  canBond(): boolean {
    return this.bondCount < this.element.maxBonds;
  }

  static getElement(symbol: ElementSymbol): ElementData {
    return ELEMENTS[symbol];
  }

  static allElements(): ElementData[] {
    return Object.values(ELEMENTS);
  }
}
