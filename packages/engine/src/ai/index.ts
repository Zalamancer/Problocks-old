// ── FSM ─────────────────────────────────────────────────────────
export type {
  StateId,
  TransitionCondition,
  StateAction,
  FSMContext,
  FSMStateConfig,
  FSMTransitionConfig,
  FSMConfig,
} from './fsm-types.js';

export { FiniteStateMachine } from './fsm.js';
export { FSMComponent } from './fsm-component.js';

// ── Behavior Trees ──────────────────────────────────────────────
export type {
  BTStatus,
  BTContext,
  BTNodeType,
  BTNodeConfig,
} from './bt-types.js';

export {
  BTNode,
  SequenceNode,
  SelectorNode,
  ParallelNode,
  RandomSelectorNode,
  InverterNode,
  RepeaterNode,
  SucceederNode,
  FailerNode,
  CooldownNode,
  ActionNode,
  ConditionNode,
  WaitNode,
  buildNodeTree,
} from './bt-node.js';

export { BehaviorTree } from './behavior-tree.js';
export { BehaviorTreeComponent } from './bt-component.js';

// ── Pre-built behaviors ─────────────────────────────────────────
export {
  createPatrolBehavior,
  createChaseBehavior,
  createFleeBehavior,
  createWanderBehavior,
  createGuardBehavior,
  createFollowBehavior,
} from './behaviors/index.js';

// ── AI System ───────────────────────────────────────────────────
export { AISystem } from './ai-system.js';
