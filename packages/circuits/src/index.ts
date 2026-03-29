/**
 * @problocks/circuits
 *
 * Digital logic circuit simulation module.
 * Students import this to build interactive circuit simulations.
 *
 * Usage:
 *   import { Circuit, Gate, Wire, Switch, LED } from '@problocks/circuits';
 *
 *   const circuit = new Circuit();
 *   const sw1 = circuit.addSwitch('A');
 *   const sw2 = circuit.addSwitch('B');
 *   const and = circuit.addGate('AND');
 *   const led = circuit.addLED('Output');
 *   circuit.connect(sw1, 0, and, 0);
 *   circuit.connect(sw2, 0, and, 1);
 *   circuit.connect(and, 0, led, 0);
 *   circuit.evaluate();
 */

export { Circuit } from './circuit.js';
export { Gate, GateType } from './gate.js';
export { Switch } from './switch.js';
export { LED } from './led.js';
export { Wire } from './wire.js';
