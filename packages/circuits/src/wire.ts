/**
 * A wire connecting a source output to a destination input.
 */
export class Wire {
  readonly id: string;
  readonly sourceId: string;
  readonly sourcePort: number;
  readonly destId: string;
  readonly destPort: number;
  active: boolean = false;

  constructor(id: string, sourceId: string, sourcePort: number, destId: string, destPort: number) {
    this.id = id;
    this.sourceId = sourceId;
    this.sourcePort = sourcePort;
    this.destId = destId;
    this.destPort = destPort;
  }
}
