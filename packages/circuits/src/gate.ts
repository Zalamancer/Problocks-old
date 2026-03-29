/**
 * Logic gate types supported by the circuit module.
 */
export type GateType = 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR' | 'BUFFER';

/**
 * A logic gate with typed inputs and one output.
 */
export class Gate {
  readonly id: string;
  readonly type: GateType;
  readonly inputs: boolean[];
  output: boolean = false;
  readonly inputCount: number;

  constructor(id: string, type: GateType) {
    this.id = id;
    this.type = type;
    this.inputCount = type === 'NOT' || type === 'BUFFER' ? 1 : 2;
    this.inputs = new Array(this.inputCount).fill(false);
  }

  setInput(index: number, value: boolean): void {
    if (index >= 0 && index < this.inputCount) {
      this.inputs[index] = value;
    }
  }

  evaluate(): boolean {
    switch (this.type) {
      case 'AND':    this.output = this.inputs[0] && this.inputs[1]; break;
      case 'OR':     this.output = this.inputs[0] || this.inputs[1]; break;
      case 'NOT':    this.output = !this.inputs[0]; break;
      case 'XOR':    this.output = this.inputs[0] !== this.inputs[1]; break;
      case 'NAND':   this.output = !(this.inputs[0] && this.inputs[1]); break;
      case 'NOR':    this.output = !(this.inputs[0] || this.inputs[1]); break;
      case 'BUFFER': this.output = this.inputs[0]; break;
    }
    return this.output;
  }

  /** Truth table for this gate type */
  static truthTable(type: GateType): { inputs: boolean[][]; outputs: boolean[] } {
    const single = type === 'NOT' || type === 'BUFFER';
    if (single) {
      return {
        inputs: [[false], [true]],
        outputs: [
          type === 'NOT' ? true : false,
          type === 'NOT' ? false : true,
        ],
      };
    }
    const gate = new Gate('_tmp', type);
    const combos: boolean[][] = [[false, false], [false, true], [true, false], [true, true]];
    const outputs: boolean[] = [];
    for (const combo of combos) {
      gate.setInput(0, combo[0]);
      gate.setInput(1, combo[1]);
      outputs.push(gate.evaluate());
    }
    return { inputs: combos, outputs };
  }
}
