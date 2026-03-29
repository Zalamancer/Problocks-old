/**
 * An input switch that can be toggled on/off.
 */
export class Switch {
  readonly id: string;
  readonly label: string;
  state: boolean;

  constructor(id: string, label: string, initialState = false) {
    this.id = id;
    this.label = label;
    this.state = initialState;
  }

  toggle(): void {
    this.state = !this.state;
  }

  set(value: boolean): void {
    this.state = value;
  }
}
