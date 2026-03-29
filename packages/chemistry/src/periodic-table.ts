import { Atom, type ElementSymbol } from './atom.js';

/**
 * Periodic table utilities.
 */
export class PeriodicTable {
  /** Get element data by symbol */
  static getElement(symbol: ElementSymbol) {
    return Atom.getElement(symbol);
  }

  /** Get all elements */
  static getAllElements() {
    return Atom.allElements();
  }

  /** Get elements by group */
  static getAlkaliMetals() {
    return (['Li', 'Na', 'K'] as ElementSymbol[]).map(s => Atom.getElement(s));
  }

  static getHalogens() {
    return (['F', 'Cl'] as ElementSymbol[]).map(s => Atom.getElement(s));
  }

  static getNobleGases() {
    return (['He', 'Ne', 'Ar'] as ElementSymbol[]).map(s => Atom.getElement(s));
  }

  /** Check if element is a metal */
  static isMetal(symbol: ElementSymbol): boolean {
    const metals: ElementSymbol[] = ['Li', 'Be', 'Na', 'Mg', 'Al', 'K', 'Ca', 'Fe', 'Cu', 'Zn', 'Ag', 'Au'];
    return metals.includes(symbol);
  }

  /** Check if element is a nonmetal */
  static isNonmetal(symbol: ElementSymbol): boolean {
    const nonmetals: ElementSymbol[] = ['H', 'He', 'C', 'N', 'O', 'F', 'Ne', 'P', 'S', 'Cl', 'Ar'];
    return nonmetals.includes(symbol);
  }
}
