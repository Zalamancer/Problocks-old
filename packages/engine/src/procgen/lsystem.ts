/**
 * L-System generator for vegetation, road networks, and fractal patterns.
 *
 * Supports:
 *  - Deterministic and stochastic (probabilistic) rules
 *  - Turtle graphics interpretation:
 *      F = move forward
 *      + = turn right
 *      - = turn left
 *      [ = push state
 *      ] = pop state
 *  - Seeded RNG for reproducible stochastic output
 */

import type { LSystemConfig, LSystemRule, LSystemResult } from './types.js';
import { createRNG } from './noise.js';

/**
 * Generate an L-System and interpret it as turtle graphics.
 */
export function generateLSystem(config: LSystemConfig): LSystemResult {
  const { axiom, rules, iterations, angle, stepLength, seed } = config;
  const rng = seed !== undefined ? createRNG(seed) : Math.random;

  // ── Step 1: Rewrite the axiom string ──────────────────────

  // Group rules by predecessor for O(1) lookup
  const ruleMap = new Map<string, LSystemRule[]>();
  for (const rule of rules) {
    const existing = ruleMap.get(rule.predecessor);
    if (existing) {
      existing.push(rule);
    } else {
      ruleMap.set(rule.predecessor, [rule]);
    }
  }

  let current = axiom;

  for (let iter = 0; iter < iterations; iter++) {
    let next = '';

    for (let i = 0; i < current.length; i++) {
      const ch = current[i];
      const matchingRules = ruleMap.get(ch);

      if (!matchingRules || matchingRules.length === 0) {
        // No rule — keep the symbol
        next += ch;
        continue;
      }

      if (matchingRules.length === 1 && (matchingRules[0].probability === undefined || matchingRules[0].probability >= 1)) {
        // Single deterministic rule
        next += matchingRules[0].successor;
        continue;
      }

      // Stochastic: pick a rule based on probability
      const roll = rng();
      let cumulative = 0;
      let applied = false;

      for (const rule of matchingRules) {
        cumulative += rule.probability ?? 1;
        if (roll < cumulative) {
          next += rule.successor;
          applied = true;
          break;
        }
      }

      // Fallback: if no rule was selected (probabilities don't sum to 1), keep symbol
      if (!applied) {
        next += ch;
      }
    }

    current = next;
  }

  // ── Step 2: Interpret as turtle graphics ──────────────────

  const angleRad = (angle * Math.PI) / 180;
  const points: Array<{ x: number; y: number }> = [];
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  // Turtle state
  let x = 0;
  let y = 0;
  let heading = -Math.PI / 2; // Start facing up

  // State stack for [ and ]
  const stack: Array<{ x: number; y: number; heading: number }> = [];

  // Record the starting position
  points.push({ x, y });

  for (let i = 0; i < current.length; i++) {
    const ch = current[i];

    switch (ch) {
      case 'F': {
        // Move forward, drawing a line
        const nx = x + Math.cos(heading) * stepLength;
        const ny = y + Math.sin(heading) * stepLength;
        segments.push({ x1: x, y1: y, x2: nx, y2: ny });
        x = nx;
        y = ny;
        points.push({ x, y });
        break;
      }

      case 'f': {
        // Move forward without drawing
        x += Math.cos(heading) * stepLength;
        y += Math.sin(heading) * stepLength;
        points.push({ x, y });
        break;
      }

      case '+': {
        // Turn right
        heading += angleRad;
        break;
      }

      case '-': {
        // Turn left
        heading -= angleRad;
        break;
      }

      case '[': {
        // Push current state
        stack.push({ x, y, heading });
        break;
      }

      case ']': {
        // Pop state
        const state = stack.pop();
        if (state) {
          x = state.x;
          y = state.y;
          heading = state.heading;
        }
        break;
      }

      // All other symbols are ignored during interpretation
      // (they exist for the rewriting phase only)
    }
  }

  return { points, segments, string: current };
}
