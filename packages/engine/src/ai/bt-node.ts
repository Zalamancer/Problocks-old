/**
 * Behavior Tree node implementations.
 *
 * Composite nodes (sequence, selector, parallel, random-selector) remember
 * which child was 'running' so they resume correctly on the next tick.
 */

import type { BTContext, BTNodeConfig, BTStatus } from './bt-types.js';

// ═══════════════════════════════════════════════════════════════
//  Abstract base
// ═══════════════════════════════════════════════════════════════

export abstract class BTNode {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract tick(context: BTContext): BTStatus;

  /** Reset any running / internal state so the node starts fresh. */
  reset(): void {
    // default no-op — overridden by stateful nodes
  }
}

// ═══════════════════════════════════════════════════════════════
//  Composite nodes
// ═══════════════════════════════════════════════════════════════

/**
 * Sequence: runs children left-to-right.
 * - Fails immediately if any child fails.
 * - Succeeds when all children succeed.
 * - Pauses on 'running' and resumes from that child next tick.
 */
export class SequenceNode extends BTNode {
  children: BTNode[];
  private runningIndex = 0;

  constructor(name: string, children: BTNode[]) {
    super(name);
    this.children = children;
  }

  tick(context: BTContext): BTStatus {
    for (let i = this.runningIndex; i < this.children.length; i++) {
      const status = this.children[i].tick(context);
      if (status === 'running') {
        this.runningIndex = i;
        return 'running';
      }
      if (status === 'failure') {
        this.runningIndex = 0;
        return 'failure';
      }
    }
    this.runningIndex = 0;
    return 'success';
  }

  override reset(): void {
    this.runningIndex = 0;
    for (const child of this.children) child.reset();
  }
}

/**
 * Selector: runs children left-to-right.
 * - Succeeds immediately if any child succeeds.
 * - Fails when all children fail.
 * - Pauses on 'running' and resumes from that child next tick.
 */
export class SelectorNode extends BTNode {
  children: BTNode[];
  private runningIndex = 0;

  constructor(name: string, children: BTNode[]) {
    super(name);
    this.children = children;
  }

  tick(context: BTContext): BTStatus {
    for (let i = this.runningIndex; i < this.children.length; i++) {
      const status = this.children[i].tick(context);
      if (status === 'running') {
        this.runningIndex = i;
        return 'running';
      }
      if (status === 'success') {
        this.runningIndex = 0;
        return 'success';
      }
    }
    this.runningIndex = 0;
    return 'failure';
  }

  override reset(): void {
    this.runningIndex = 0;
    for (const child of this.children) child.reset();
  }
}

/**
 * Parallel: ticks ALL children every frame.
 * - Succeeds when `successThreshold` children have succeeded.
 * - Fails when enough children have failed that the threshold can never be met.
 */
export class ParallelNode extends BTNode {
  children: BTNode[];
  private successThreshold: number;

  constructor(name: string, children: BTNode[], successThreshold?: number) {
    super(name);
    this.children = children;
    this.successThreshold = successThreshold ?? children.length;
  }

  tick(context: BTContext): BTStatus {
    let successes = 0;
    let failures = 0;

    for (const child of this.children) {
      const status = child.tick(context);
      if (status === 'success') successes++;
      else if (status === 'failure') failures++;
    }

    if (successes >= this.successThreshold) {
      return 'success';
    }

    const maxPossibleSuccesses = this.children.length - failures;
    if (maxPossibleSuccesses < this.successThreshold) {
      return 'failure';
    }

    return 'running';
  }

  override reset(): void {
    for (const child of this.children) child.reset();
  }
}

/**
 * RandomSelector: like selector but shuffles children order each time it
 * starts fresh (not while a child is running).
 */
export class RandomSelectorNode extends BTNode {
  children: BTNode[];
  private order: number[] = [];
  private runningIndex = 0;
  private shuffled = false;

  constructor(name: string, children: BTNode[]) {
    super(name);
    this.children = children;
    this.order = children.map((_, i) => i);
  }

  tick(context: BTContext): BTStatus {
    if (!this.shuffled) {
      this.shuffle();
      this.shuffled = true;
    }

    for (let i = this.runningIndex; i < this.order.length; i++) {
      const status = this.children[this.order[i]].tick(context);
      if (status === 'running') {
        this.runningIndex = i;
        return 'running';
      }
      if (status === 'success') {
        this.runningIndex = 0;
        this.shuffled = false;
        return 'success';
      }
    }

    this.runningIndex = 0;
    this.shuffled = false;
    return 'failure';
  }

  override reset(): void {
    this.runningIndex = 0;
    this.shuffled = false;
    for (const child of this.children) child.reset();
  }

  /** Fisher-Yates shuffle. */
  private shuffle(): void {
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = this.order[i];
      this.order[i] = this.order[j];
      this.order[j] = tmp;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  Decorator nodes
// ═══════════════════════════════════════════════════════════════

/** Inverts child result: success <-> failure. Running passes through. */
export class InverterNode extends BTNode {
  child: BTNode;

  constructor(name: string, child: BTNode) {
    super(name);
    this.child = child;
  }

  tick(context: BTContext): BTStatus {
    const status = this.child.tick(context);
    if (status === 'success') return 'failure';
    if (status === 'failure') return 'success';
    return 'running';
  }

  override reset(): void {
    this.child.reset();
  }
}

/**
 * Repeater: runs child N times (or forever when repeatCount = -1).
 * Returns 'running' between iterations, 'success' when count is reached,
 * or 'failure' if the child fails during any iteration.
 */
export class RepeaterNode extends BTNode {
  child: BTNode;
  private repeatCount: number;
  private currentCount = 0;

  constructor(name: string, child: BTNode, repeatCount: number) {
    super(name);
    this.child = child;
    this.repeatCount = repeatCount;
  }

  tick(context: BTContext): BTStatus {
    const status = this.child.tick(context);

    if (status === 'running') {
      return 'running';
    }

    if (status === 'failure') {
      this.currentCount = 0;
      return 'failure';
    }

    // Child succeeded — count one iteration
    this.currentCount++;
    this.child.reset();

    if (this.repeatCount === -1) {
      // Infinite — always running
      return 'running';
    }

    if (this.currentCount >= this.repeatCount) {
      this.currentCount = 0;
      return 'success';
    }

    return 'running';
  }

  override reset(): void {
    this.currentCount = 0;
    this.child.reset();
  }
}

/** Always returns 'success' regardless of child result (running passes through). */
export class SucceederNode extends BTNode {
  child: BTNode;

  constructor(name: string, child: BTNode) {
    super(name);
    this.child = child;
  }

  tick(context: BTContext): BTStatus {
    const status = this.child.tick(context);
    if (status === 'running') return 'running';
    return 'success';
  }

  override reset(): void {
    this.child.reset();
  }
}

/** Always returns 'failure' regardless of child result (running passes through). */
export class FailerNode extends BTNode {
  child: BTNode;

  constructor(name: string, child: BTNode) {
    super(name);
    this.child = child;
  }

  tick(context: BTContext): BTStatus {
    const status = this.child.tick(context);
    if (status === 'running') return 'running';
    return 'failure';
  }

  override reset(): void {
    this.child.reset();
  }
}

/**
 * Cooldown: after the child succeeds, blocks for `cooldownTime` seconds
 * (returning 'failure' during that window).
 */
export class CooldownNode extends BTNode {
  child: BTNode;
  private cooldownTime: number;
  private elapsed = 0;
  private cooling = false;

  constructor(name: string, child: BTNode, cooldownTime: number) {
    super(name);
    this.child = child;
    this.cooldownTime = cooldownTime;
  }

  tick(context: BTContext): BTStatus {
    if (this.cooling) {
      this.elapsed += context.deltaTime;
      if (this.elapsed >= this.cooldownTime) {
        this.cooling = false;
        this.elapsed = 0;
      } else {
        return 'failure';
      }
    }

    const status = this.child.tick(context);

    if (status === 'success') {
      this.cooling = true;
      this.elapsed = 0;
      return 'success';
    }

    return status;
  }

  override reset(): void {
    this.cooling = false;
    this.elapsed = 0;
    this.child.reset();
  }
}

// ═══════════════════════════════════════════════════════════════
//  Leaf nodes
// ═══════════════════════════════════════════════════════════════

/** Calls the provided action function and returns its status. */
export class ActionNode extends BTNode {
  private actionFn: (context: BTContext) => BTStatus;

  constructor(name: string, actionFn: (context: BTContext) => BTStatus) {
    super(name);
    this.actionFn = actionFn;
  }

  tick(context: BTContext): BTStatus {
    return this.actionFn(context);
  }
}

/**
 * Condition: evaluates a boolean predicate.
 * Returns 'success' when the action returns 'success', 'failure' otherwise.
 * Never returns 'running'.
 */
export class ConditionNode extends BTNode {
  private conditionFn: (context: BTContext) => BTStatus;

  constructor(name: string, conditionFn: (context: BTContext) => BTStatus) {
    super(name);
    this.conditionFn = conditionFn;
  }

  tick(context: BTContext): BTStatus {
    const result = this.conditionFn(context);
    return result === 'success' ? 'success' : 'failure';
  }
}

/** Returns 'running' for `duration` seconds, then 'success'. */
export class WaitNode extends BTNode {
  private duration: number;
  private elapsed = 0;

  constructor(name: string, duration: number) {
    super(name);
    this.duration = duration;
  }

  tick(context: BTContext): BTStatus {
    this.elapsed += context.deltaTime;
    if (this.elapsed >= this.duration) {
      this.elapsed = 0;
      return 'success';
    }
    return 'running';
  }

  override reset(): void {
    this.elapsed = 0;
  }
}

// ═══════════════════════════════════════════════════════════════
//  Factory — builds a BTNode tree from a BTNodeConfig
// ═══════════════════════════════════════════════════════════════

export function buildNodeTree(config: BTNodeConfig): BTNode {
  const name = config.name ?? config.type;
  const children = (config.children ?? []).map(buildNodeTree);

  switch (config.type) {
    case 'sequence':
      return new SequenceNode(name, children);

    case 'selector':
      return new SelectorNode(name, children);

    case 'parallel':
      return new ParallelNode(name, children, config.successThreshold);

    case 'random-selector':
      return new RandomSelectorNode(name, children);

    case 'inverter': {
      if (children.length === 0) {
        throw new Error('InverterNode requires exactly one child');
      }
      return new InverterNode(name, children[0]);
    }

    case 'repeater': {
      if (children.length === 0) {
        throw new Error('RepeaterNode requires exactly one child');
      }
      return new RepeaterNode(name, children[0], config.repeatCount ?? -1);
    }

    case 'succeeder': {
      if (children.length === 0) {
        throw new Error('SucceederNode requires exactly one child');
      }
      return new SucceederNode(name, children[0]);
    }

    case 'failer': {
      if (children.length === 0) {
        throw new Error('FailerNode requires exactly one child');
      }
      return new FailerNode(name, children[0]);
    }

    case 'cooldown': {
      if (children.length === 0) {
        throw new Error('CooldownNode requires exactly one child');
      }
      return new CooldownNode(name, children[0], config.cooldownTime ?? 1);
    }

    case 'action': {
      if (!config.action) {
        throw new Error('ActionNode requires an action function');
      }
      return new ActionNode(name, config.action);
    }

    case 'condition': {
      if (!config.action) {
        throw new Error('ConditionNode requires an action (predicate) function');
      }
      return new ConditionNode(name, config.action);
    }

    case 'wait':
      return new WaitNode(name, config.duration ?? 1);

    default:
      throw new Error(`Unknown BTNode type: ${config.type}`);
  }
}
