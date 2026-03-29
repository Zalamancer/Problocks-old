import { Gate, type GateType } from './gate.js';
import { Switch } from './switch.js';
import { LED } from './led.js';
import { Wire } from './wire.js';

/**
 * A complete digital logic circuit.
 * Add switches, gates, LEDs, and wire them together.
 * Call evaluate() to propagate signals through the circuit.
 */
export class Circuit {
  private gates: Map<string, Gate> = new Map();
  private switches: Map<string, Switch> = new Map();
  private leds: Map<string, LED> = new Map();
  private wires: Wire[] = [];
  private nextId = 1;

  /** Add an input switch */
  addSwitch(label: string, initialState = false): string {
    const id = `sw_${this.nextId++}`;
    this.switches.set(id, new Switch(id, label, initialState));
    return id;
  }

  /** Add a logic gate */
  addGate(type: GateType): string {
    const id = `gate_${this.nextId++}`;
    this.gates.set(id, new Gate(id, type));
    return id;
  }

  /** Add an LED output */
  addLED(label: string): string {
    const id = `led_${this.nextId++}`;
    this.leds.set(id, new LED(id, label));
    return id;
  }

  /** Connect source output port to destination input port */
  connect(sourceId: string, sourcePort: number, destId: string, destPort: number): string {
    const wireId = `wire_${this.nextId++}`;
    this.wires.push(new Wire(wireId, sourceId, sourcePort, destId, destPort));
    return wireId;
  }

  /** Toggle a switch by ID */
  toggleSwitch(id: string): void {
    this.switches.get(id)?.toggle();
  }

  /** Set a switch state */
  setSwitch(id: string, value: boolean): void {
    this.switches.get(id)?.set(value);
  }

  /** Get output value of any component */
  getOutput(id: string): boolean {
    const sw = this.switches.get(id);
    if (sw) return sw.state;
    const gate = this.gates.get(id);
    if (gate) return gate.output;
    const led = this.leds.get(id);
    if (led) return led.state;
    return false;
  }

  /**
   * Evaluate the entire circuit.
   * Propagates signals from switches through gates to LEDs.
   * Uses topological evaluation (multiple passes for cascaded gates).
   */
  evaluate(): void {
    // Multiple passes to handle cascaded gates
    for (let pass = 0; pass < 10; pass++) {
      let changed = false;

      for (const wire of this.wires) {
        // Get source output value
        let sourceValue = false;
        const sw = this.switches.get(wire.sourceId);
        if (sw) sourceValue = sw.state;
        const srcGate = this.gates.get(wire.sourceId);
        if (srcGate) sourceValue = srcGate.output;

        wire.active = sourceValue;

        // Set destination input
        const destGate = this.gates.get(wire.destId);
        if (destGate) {
          const prev = destGate.inputs[wire.destPort];
          destGate.setInput(wire.destPort, sourceValue);
          if (prev !== sourceValue) changed = true;
        }

        const destLed = this.leds.get(wire.destId);
        if (destLed) {
          const prev = destLed.state;
          destLed.setInput(sourceValue);
          if (prev !== sourceValue) changed = true;
        }
      }

      // Evaluate all gates
      for (const gate of this.gates.values()) {
        gate.evaluate();
      }

      if (!changed) break;
    }
  }

  /** Get all components for rendering */
  getState() {
    return {
      switches: Array.from(this.switches.values()).map(s => ({
        id: s.id, label: s.label, state: s.state,
      })),
      gates: Array.from(this.gates.values()).map(g => ({
        id: g.id, type: g.type, inputs: [...g.inputs], output: g.output,
      })),
      leds: Array.from(this.leds.values()).map(l => ({
        id: l.id, label: l.label, state: l.state,
      })),
      wires: this.wires.map(w => ({
        id: w.id, sourceId: w.sourceId, destId: w.destId, active: w.active,
      })),
    };
  }
}
