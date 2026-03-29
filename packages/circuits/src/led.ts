/**
 * An LED output that lights up when its input is true.
 */
export class LED {
  readonly id: string;
  readonly label: string;
  state: boolean = false;

  constructor(id: string, label: string) {
    this.id = id;
    this.label = label;
  }

  setInput(value: boolean): void {
    this.state = value;
  }
}
