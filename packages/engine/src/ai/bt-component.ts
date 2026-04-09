/**
 * BehaviorTree component — attaches a behavior tree config to an entity.
 * The AISystem creates the runtime BehaviorTree instance.
 */

import { Component } from '../core/component.js';
import type { BTNodeConfig } from './bt-types.js';
import type { BehaviorTree } from './behavior-tree.js';

export class BehaviorTreeComponent extends Component {
  readonly type = 'behavior-tree';
  config: BTNodeConfig;
  /** Created at runtime by AISystem. */
  instance?: BehaviorTree;

  constructor(config: BTNodeConfig) {
    super();
    this.config = config;
  }
}
