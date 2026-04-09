/**
 * AI System — manages all FSMs and behavior trees in the game world.
 *
 * Call update(deltaTime) once per frame from the game loop to tick every
 * registered FSM and behavior tree.
 */

import type { FSMConfig } from './fsm-types.js';
import { FiniteStateMachine } from './fsm.js';
import type { BTNodeConfig } from './bt-types.js';
import { BehaviorTree } from './behavior-tree.js';

export class AISystem {
  private fsms: Map<string, FiniteStateMachine> = new Map();
  private behaviorTrees: Map<string, BehaviorTree> = new Map();

  // ── FSM management ────────────────────────────────────────────

  addFSM(entityId: string, config: FSMConfig): FiniteStateMachine {
    // Dispose existing if present
    const existing = this.fsms.get(entityId);
    if (existing) existing.dispose();

    const fsm = new FiniteStateMachine(config, entityId);
    this.fsms.set(entityId, fsm);
    return fsm;
  }

  removeFSM(entityId: string): void {
    const fsm = this.fsms.get(entityId);
    if (fsm) {
      fsm.dispose();
      this.fsms.delete(entityId);
    }
  }

  getFSM(entityId: string): FiniteStateMachine | undefined {
    return this.fsms.get(entityId);
  }

  // ── Behavior tree management ──────────────────────────────────

  addBehaviorTree(entityId: string, config: BTNodeConfig): BehaviorTree {
    // Dispose existing if present
    const existing = this.behaviorTrees.get(entityId);
    if (existing) existing.dispose();

    const bt = new BehaviorTree(config, entityId);
    this.behaviorTrees.set(entityId, bt);
    return bt;
  }

  removeBehaviorTree(entityId: string): void {
    const bt = this.behaviorTrees.get(entityId);
    if (bt) {
      bt.dispose();
      this.behaviorTrees.delete(entityId);
    }
  }

  getBehaviorTree(entityId: string): BehaviorTree | undefined {
    return this.behaviorTrees.get(entityId);
  }

  // ── Per-frame ─────────────────────────────────────────────────

  update(deltaTime: number): void {
    for (const fsm of this.fsms.values()) {
      fsm.update(deltaTime);
    }
    for (const bt of this.behaviorTrees.values()) {
      bt.tick(deltaTime);
    }
  }

  // ── Bulk operations ───────────────────────────────────────────

  clear(): void {
    for (const fsm of this.fsms.values()) fsm.dispose();
    this.fsms.clear();
    for (const bt of this.behaviorTrees.values()) bt.dispose();
    this.behaviorTrees.clear();
  }

  dispose(): void {
    this.clear();
  }
}
