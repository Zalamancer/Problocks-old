/**
 * Behavior Tree runtime.
 *
 * Wraps a node tree built from BTNodeConfig. The game loop calls tick()
 * every frame; the tree evaluates top-down, returning 'running' when work
 * is in progress.
 */

import type { BTContext, BTNodeConfig, BTStatus } from './bt-types.js';
import { BTNode, buildNodeTree } from './bt-node.js';

export class BehaviorTree {
  private root: BTNode;
  private context: BTContext;

  constructor(config: BTNodeConfig, entityId: string) {
    this.root = buildNodeTree(config);
    this.context = {
      entityId,
      blackboard: new Map(),
      deltaTime: 0,
    };
  }

  // ── Per-frame ─────────────────────────────────────────────────

  tick(deltaTime: number): BTStatus {
    this.context.deltaTime = deltaTime;
    return this.root.tick(this.context);
  }

  // ── Context / blackboard ──────────────────────────────────────

  getContext(): BTContext {
    return this.context;
  }

  getBlackboard(): Map<string, any> {
    return this.context.blackboard;
  }

  set(key: string, value: any): void {
    this.context.blackboard.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.context.blackboard.get(key) as T | undefined;
  }

  // ── Reset ─────────────────────────────────────────────────────

  reset(): void {
    this.root.reset();
  }

  dispose(): void {
    this.root.reset();
    this.context.blackboard.clear();
  }
}
