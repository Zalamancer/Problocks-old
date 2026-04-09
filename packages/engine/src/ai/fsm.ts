/**
 * Finite State Machine runtime.
 *
 * Each FSM instance drives one entity. The game loop calls update() every
 * frame; the machine checks transitions (global first, then per-state),
 * performs state changes, and ticks the current state's onUpdate callback.
 */

import type {
  FSMConfig,
  FSMContext,
  FSMStateConfig,
  FSMTransitionConfig,
  StateId,
} from './fsm-types.js';

export class FiniteStateMachine {
  private config: FSMConfig;
  private currentStateId: StateId;
  private context: FSMContext;
  private stateMap: Map<StateId, FSMStateConfig>;
  private sortedGlobalTransitions: FSMTransitionConfig[];

  constructor(config: FSMConfig, entityId: string) {
    this.config = config;

    // Build lookup map
    this.stateMap = new Map();
    for (const state of config.states) {
      this.stateMap.set(state.id, state);
      // Pre-sort each state's transitions by descending priority
      state.transitions.sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
      );
    }

    // Validate initial state exists
    if (!this.stateMap.has(config.initialState)) {
      throw new Error(
        `FSM: initial state "${config.initialState}" not found in config`,
      );
    }

    // Sort global transitions once
    this.sortedGlobalTransitions = [
      ...(config.globalTransitions ?? []),
    ].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Create context with shared blackboard
    this.context = {
      entityId,
      blackboard: new Map(),
      deltaTime: 0,
    };

    // Enter the initial state
    this.currentStateId = config.initialState;
    const initialState = this.stateMap.get(this.currentStateId)!;
    if (initialState.onEnter) {
      initialState.onEnter(this.context, 0);
    }
  }

  // ── Queries ───────────────────────────────────────────────────

  getCurrentState(): StateId {
    return this.currentStateId;
  }

  getContext(): FSMContext {
    return this.context;
  }

  getBlackboard(): Map<string, any> {
    return this.context.blackboard;
  }

  // ── Blackboard helpers ────────────────────────────────────────

  set(key: string, value: any): void {
    this.context.blackboard.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.context.blackboard.get(key) as T | undefined;
  }

  // ── Manual state change ───────────────────────────────────────

  forceTransition(stateId: StateId): void {
    if (!this.stateMap.has(stateId)) {
      throw new Error(`FSM: cannot transition to unknown state "${stateId}"`);
    }
    this.changeState(stateId);
  }

  // ── Per-frame update ──────────────────────────────────────────

  update(deltaTime: number): void {
    this.context.deltaTime = deltaTime;

    // 1. Check global transitions (highest priority first)
    const globalTarget = this.evaluateTransitions(
      this.sortedGlobalTransitions,
    );
    if (globalTarget !== null) {
      this.changeState(globalTarget);
    } else {
      // 2. Check current state's transitions
      const currentState = this.stateMap.get(this.currentStateId)!;
      const stateTarget = this.evaluateTransitions(currentState.transitions);
      if (stateTarget !== null) {
        this.changeState(stateTarget);
      }
    }

    // 3. Tick current state
    const active = this.stateMap.get(this.currentStateId)!;
    if (active.onUpdate) {
      active.onUpdate(this.context, deltaTime);
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────

  dispose(): void {
    // Exit current state cleanly
    const current = this.stateMap.get(this.currentStateId);
    if (current?.onExit) {
      current.onExit(this.context, 0);
    }
    this.context.blackboard.clear();
  }

  // ── Internals ─────────────────────────────────────────────────

  private evaluateTransitions(
    transitions: FSMTransitionConfig[],
  ): StateId | null {
    for (const t of transitions) {
      if (t.condition(this.context)) {
        return t.to;
      }
    }
    return null;
  }

  private changeState(nextId: StateId): void {
    if (nextId === this.currentStateId) return;

    const prev = this.stateMap.get(this.currentStateId)!;
    const next = this.stateMap.get(nextId)!;

    if (prev.onExit) {
      prev.onExit(this.context, this.context.deltaTime);
    }

    this.currentStateId = nextId;

    if (next.onEnter) {
      next.onEnter(this.context, this.context.deltaTime);
    }
  }
}
