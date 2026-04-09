/**
 * Behavior Tree types.
 */

export type BTStatus = 'success' | 'failure' | 'running';

export interface BTContext {
  entityId: string;
  blackboard: Map<string, any>;
  deltaTime: number;
  [key: string]: any;
}

export type BTNodeType =
  | 'sequence'
  | 'selector'
  | 'parallel'
  | 'inverter'
  | 'repeater'
  | 'succeeder'
  | 'failer'
  | 'condition'
  | 'action'
  | 'wait'
  | 'random-selector'
  | 'cooldown';

export interface BTNodeConfig {
  type: BTNodeType;
  name?: string;
  children?: BTNodeConfig[];
  /** For action / condition leaf nodes. */
  action?: (context: BTContext) => BTStatus;
  /** For repeater: how many times to repeat (-1 = forever). */
  repeatCount?: number;
  /** For wait: duration in seconds. */
  duration?: number;
  /** For parallel: how many children must succeed (default: all). */
  successThreshold?: number;
  /** For cooldown: seconds to block after child succeeds. */
  cooldownTime?: number;
}
