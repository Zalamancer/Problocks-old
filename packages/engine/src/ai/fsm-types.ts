/**
 * Finite State Machine types for NPC/entity behavior.
 */

export type StateId = string;

export type TransitionCondition = (context: FSMContext) => boolean;

export type StateAction = (context: FSMContext, deltaTime: number) => void;

export interface FSMContext {
  entityId: string;
  blackboard: Map<string, any>;
  deltaTime: number;
  [key: string]: any;
}

export interface FSMStateConfig {
  id: StateId;
  onEnter?: StateAction;
  onUpdate?: StateAction;
  onExit?: StateAction;
  transitions: FSMTransitionConfig[];
}

export interface FSMTransitionConfig {
  to: StateId;
  condition: TransitionCondition;
  /** Higher priority transitions are checked first (default 0). */
  priority?: number;
}

export interface FSMConfig {
  initialState: StateId;
  states: FSMStateConfig[];
  /** Transitions checked from ANY state, before per-state transitions. */
  globalTransitions?: FSMTransitionConfig[];
}
