/**
 * Pre-built behavior tree presets for common NPC patterns.
 *
 * Each factory returns a BTNodeConfig that can be passed directly to the
 * BehaviorTree constructor. Behaviors communicate through the blackboard:
 *
 *   position      — { x, y } current entity position (read/written by movement)
 *   targetPosition — { x, y } where to chase / follow
 *   threatPosition — { x, y } position to flee from
 *   speed         — number, units per second
 *   wanderCenter  — { x, y } center of wander area
 *   currentWaypoint — number, index into waypoints array
 */

import type { BTContext, BTNodeConfig, BTStatus } from '../bt-types.js';

// ── Helpers ─────────────────────────────────────────────────────

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Returns a BTNodeConfig action that moves the entity toward a target
 * position on the blackboard. Returns 'running' while moving, 'success'
 * when within `arriveThreshold` of the target.
 */
function moveTowardAction(
  targetKey: string,
  arriveThreshold: number,
): (context: BTContext) => BTStatus {
  return (ctx) => {
    const pos = ctx.blackboard.get('position') as
      | { x: number; y: number }
      | undefined;
    const target = ctx.blackboard.get(targetKey) as
      | { x: number; y: number }
      | undefined;
    const speed = (ctx.blackboard.get('speed') as number) ?? 1;

    if (!pos || !target) return 'failure';

    const dist = distance(pos, target);
    if (dist <= arriveThreshold) return 'success';

    const step = Math.min(speed * ctx.deltaTime, dist);
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const invDist = 1 / dist;

    ctx.blackboard.set('position', {
      x: pos.x + dx * invDist * step,
      y: pos.y + dy * invDist * step,
    });

    return 'running';
  };
}

/**
 * Returns a BTNodeConfig action that moves the entity AWAY from a
 * position on the blackboard. Returns 'running' while fleeing, 'success'
 * once distance exceeds `safeDistance`.
 */
function moveAwayAction(
  threatKey: string,
  safeDistance: number,
): (context: BTContext) => BTStatus {
  return (ctx) => {
    const pos = ctx.blackboard.get('position') as
      | { x: number; y: number }
      | undefined;
    const threat = ctx.blackboard.get(threatKey) as
      | { x: number; y: number }
      | undefined;
    const speed = (ctx.blackboard.get('speed') as number) ?? 1;

    if (!pos || !threat) return 'failure';

    const dist = distance(pos, threat);
    if (dist >= safeDistance) return 'success';

    // Move directly away
    const step = speed * ctx.deltaTime;
    if (dist < 0.001) {
      // Overlapping — pick arbitrary direction
      ctx.blackboard.set('position', {
        x: pos.x + step,
        y: pos.y,
      });
    } else {
      const dx = pos.x - threat.x;
      const dy = pos.y - threat.y;
      const invDist = 1 / dist;
      ctx.blackboard.set('position', {
        x: pos.x + dx * invDist * step,
        y: pos.y + dy * invDist * step,
      });
    }

    return 'running';
  };
}

// ═══════════════════════════════════════════════════════════════
//  Patrol Behavior
// ═══════════════════════════════════════════════════════════════

/**
 * Move between waypoints in order, waiting at each.
 *
 * Blackboard inputs:  position, speed
 * Blackboard state:   currentWaypoint (index), _patrolTarget
 */
export function createPatrolBehavior(
  waypoints: Array<{ x: number; y: number }>,
  waitTime = 1,
): BTNodeConfig {
  if (waypoints.length === 0) {
    throw new Error('Patrol behavior requires at least one waypoint');
  }

  return {
    type: 'repeater',
    name: 'patrol-loop',
    repeatCount: -1,
    children: [
      {
        type: 'sequence',
        name: 'patrol-step',
        children: [
          // Set the next waypoint as target
          {
            type: 'action',
            name: 'set-patrol-target',
            action: (ctx) => {
              let idx =
                (ctx.blackboard.get('currentWaypoint') as number) ?? 0;
              if (idx >= waypoints.length) idx = 0;
              ctx.blackboard.set('_patrolTarget', waypoints[idx]);
              return 'success';
            },
          },
          // Move to waypoint
          {
            type: 'action',
            name: 'move-to-waypoint',
            action: moveTowardAction('_patrolTarget', 0.5),
          },
          // Advance waypoint index
          {
            type: 'action',
            name: 'advance-waypoint',
            action: (ctx) => {
              let idx =
                (ctx.blackboard.get('currentWaypoint') as number) ?? 0;
              idx = (idx + 1) % waypoints.length;
              ctx.blackboard.set('currentWaypoint', idx);
              return 'success';
            },
          },
          // Wait at waypoint
          {
            type: 'wait',
            name: 'wait-at-waypoint',
            duration: waitTime,
          },
        ],
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
//  Chase Behavior
// ═══════════════════════════════════════════════════════════════

/**
 * Move toward targetPosition when within chaseRange, stop when within
 * stopRange.
 *
 * Blackboard inputs:  position, targetPosition, speed
 */
export function createChaseBehavior(
  chaseRange: number,
  stopRange: number,
): BTNodeConfig {
  return {
    type: 'sequence',
    name: 'chase',
    children: [
      // Only chase if target is within chase range
      {
        type: 'condition',
        name: 'target-in-chase-range',
        action: (ctx) => {
          const pos = ctx.blackboard.get('position') as
            | { x: number; y: number }
            | undefined;
          const target = ctx.blackboard.get('targetPosition') as
            | { x: number; y: number }
            | undefined;
          if (!pos || !target) return 'failure';
          return distance(pos, target) <= chaseRange ? 'success' : 'failure';
        },
      },
      // Don't move if already close enough
      {
        type: 'inverter',
        name: 'not-already-close',
        children: [
          {
            type: 'condition',
            name: 'within-stop-range',
            action: (ctx) => {
              const pos = ctx.blackboard.get('position') as
                | { x: number; y: number }
                | undefined;
              const target = ctx.blackboard.get('targetPosition') as
                | { x: number; y: number }
                | undefined;
              if (!pos || !target) return 'failure';
              return distance(pos, target) <= stopRange
                ? 'success'
                : 'failure';
            },
          },
        ],
      },
      // Move toward target
      {
        type: 'action',
        name: 'move-to-target',
        action: moveTowardAction('targetPosition', stopRange),
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
//  Flee Behavior
// ═══════════════════════════════════════════════════════════════

/**
 * Move away from threatPosition when it's within fleeRange.
 * Succeeds once the entity reaches safeRange distance.
 *
 * Blackboard inputs:  position, threatPosition, speed
 */
export function createFleeBehavior(
  fleeRange: number,
  safeRange: number,
): BTNodeConfig {
  return {
    type: 'sequence',
    name: 'flee',
    children: [
      // Only flee if threat is close
      {
        type: 'condition',
        name: 'threat-in-flee-range',
        action: (ctx) => {
          const pos = ctx.blackboard.get('position') as
            | { x: number; y: number }
            | undefined;
          const threat = ctx.blackboard.get('threatPosition') as
            | { x: number; y: number }
            | undefined;
          if (!pos || !threat) return 'failure';
          return distance(pos, threat) <= fleeRange ? 'success' : 'failure';
        },
      },
      // Move away
      {
        type: 'action',
        name: 'run-away',
        action: moveAwayAction('threatPosition', safeRange),
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
//  Wander Behavior
// ═══════════════════════════════════════════════════════════════

/**
 * Picks a random point within wanderRadius of wanderCenter, moves there,
 * waits, then picks a new point. Loops forever.
 *
 * Blackboard inputs:  position, speed, wanderCenter
 */
export function createWanderBehavior(
  wanderRadius: number,
  waitTime = 2,
): BTNodeConfig {
  return {
    type: 'repeater',
    name: 'wander-loop',
    repeatCount: -1,
    children: [
      {
        type: 'sequence',
        name: 'wander-step',
        children: [
          // Pick a random destination
          {
            type: 'action',
            name: 'pick-wander-target',
            action: (ctx) => {
              const center = ctx.blackboard.get('wanderCenter') as
                | { x: number; y: number }
                | undefined;
              const pos = ctx.blackboard.get('position') as
                | { x: number; y: number }
                | undefined;
              const origin = center ?? pos ?? { x: 0, y: 0 };

              // Random point in circle
              const angle = Math.random() * Math.PI * 2;
              const r = Math.random() * wanderRadius;
              ctx.blackboard.set('_wanderTarget', {
                x: origin.x + Math.cos(angle) * r,
                y: origin.y + Math.sin(angle) * r,
              });
              return 'success';
            },
          },
          // Move to it
          {
            type: 'action',
            name: 'move-to-wander-target',
            action: moveTowardAction('_wanderTarget', 0.5),
          },
          // Wait
          {
            type: 'wait',
            name: 'wander-pause',
            duration: waitTime,
          },
        ],
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
//  Guard Behavior
// ═══════════════════════════════════════════════════════════════

/**
 * Stand at post. If a threat enters detectRange, chase it up to chaseRange.
 * When the threat escapes or is lost, return to the guard post.
 *
 * Blackboard inputs:  position, threatPosition (or undefined), speed
 */
export function createGuardBehavior(
  postPosition: { x: number; y: number },
  detectRange: number,
  chaseRange: number,
): BTNodeConfig {
  return {
    type: 'selector',
    name: 'guard',
    children: [
      // Branch 1: threat detected and within chase range — chase it
      {
        type: 'sequence',
        name: 'guard-chase',
        children: [
          {
            type: 'condition',
            name: 'threat-detected',
            action: (ctx) => {
              const pos = ctx.blackboard.get('position') as
                | { x: number; y: number }
                | undefined;
              const threat = ctx.blackboard.get('threatPosition') as
                | { x: number; y: number }
                | undefined;
              if (!pos || !threat) return 'failure';
              const dist = distance(pos, threat);
              // Detect within detectRange, keep chasing within chaseRange
              return dist <= chaseRange ? 'success' : 'failure';
            },
          },
          {
            type: 'condition',
            name: 'threat-in-detect-zone',
            action: (ctx) => {
              const threat = ctx.blackboard.get('threatPosition') as
                | { x: number; y: number }
                | undefined;
              if (!threat) return 'failure';
              const dist = distance(postPosition, threat);
              return dist <= detectRange + chaseRange
                ? 'success'
                : 'failure';
            },
          },
          {
            type: 'action',
            name: 'chase-threat',
            action: moveTowardAction('threatPosition', 1.0),
          },
        ],
      },
      // Branch 2: no threat (or out of range) — return to post
      {
        type: 'sequence',
        name: 'return-to-post',
        children: [
          {
            type: 'condition',
            name: 'not-at-post',
            action: (ctx) => {
              const pos = ctx.blackboard.get('position') as
                | { x: number; y: number }
                | undefined;
              if (!pos) return 'failure';
              return distance(pos, postPosition) > 0.5
                ? 'success'
                : 'failure';
            },
          },
          {
            type: 'action',
            name: 'set-post-target',
            action: (ctx) => {
              ctx.blackboard.set('_guardPostTarget', postPosition);
              return 'success';
            },
          },
          {
            type: 'action',
            name: 'move-to-post',
            action: moveTowardAction('_guardPostTarget', 0.5),
          },
        ],
      },
      // Branch 3: at post, no threat — idle success
      {
        type: 'action',
        name: 'guard-idle',
        action: () => 'success',
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
//  Follow Behavior
// ═══════════════════════════════════════════════════════════════

/**
 * Follow a target entity, maintaining followDistance. Stop moving when
 * within stopDistance.
 *
 * Blackboard inputs:  position, targetPosition, speed
 */
export function createFollowBehavior(
  followDistance: number,
  stopDistance: number,
): BTNodeConfig {
  return {
    type: 'selector',
    name: 'follow',
    children: [
      // Branch 1: too far — move closer
      {
        type: 'sequence',
        name: 'follow-move',
        children: [
          {
            type: 'condition',
            name: 'target-too-far',
            action: (ctx) => {
              const pos = ctx.blackboard.get('position') as
                | { x: number; y: number }
                | undefined;
              const target = ctx.blackboard.get('targetPosition') as
                | { x: number; y: number }
                | undefined;
              if (!pos || !target) return 'failure';
              return distance(pos, target) > followDistance
                ? 'success'
                : 'failure';
            },
          },
          {
            type: 'action',
            name: 'move-toward-target',
            action: moveTowardAction('targetPosition', stopDistance),
          },
        ],
      },
      // Branch 2: within acceptable range — idle
      {
        type: 'action',
        name: 'follow-idle',
        action: () => 'success',
      },
    ],
  };
}
