/**
 * FSM component — attaches a finite state machine config to an entity.
 * The AISystem creates the runtime FiniteStateMachine instance.
 */

import { Component } from '../core/component.js';
import type { FSMConfig } from './fsm-types.js';
import type { FiniteStateMachine } from './fsm.js';

export class FSMComponent extends Component {
  readonly type = 'fsm';
  config: FSMConfig;
  /** Created at runtime by AISystem. */
  instance?: FiniteStateMachine;

  constructor(config: FSMConfig) {
    super();
    this.config = config;
  }
}
