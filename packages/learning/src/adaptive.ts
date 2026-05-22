/**
 * Adaptive learning algorithms.
 *
 * - Subtopic selection: 60% weakest, 25% reinforcement, 15% exploration
 * - Difficulty adjustment: 3-streak correct → up, 3-streak wrong → down
 * - Mastery update: exponential moving average based on correctness
 */

import type { DifficultyLevel, MasteryRecord, SelectionWeights } from './types.js';

// ── Default config ───────────────────────────────────────────────────

export const DEFAULT_SELECTION_WEIGHTS: SelectionWeights = {
  gapPushing: 0.60,
  reinforcement: 0.25,
  exploration: 0.15,
};

/** Streak threshold for difficulty adjustment. */
const STREAK_THRESHOLD = 3;

/** Mastery update alpha (higher = faster change). */
const MASTERY_ALPHA = 0.2;

// ── Subtopic selection ───────────────────────────────────────────────

/**
 * Pick the next subtopic for a student based on mastery data.
 *
 * Strategy:
 * - 60% chance: weakest subtopic (gap pushing)
 * - 25% chance: recently attempted subtopic (reinforcement)
 * - 15% chance: unattempted subtopic (exploration)
 *
 * @param masteryData — Student's mastery records for all subtopics.
 * @param rng — Random number in [0, 1). Defaults to Math.random().
 * @param weights — Selection strategy weights.
 */
export function pickSubtopic(
  masteryData: MasteryRecord[],
  rng: number = Math.random(),
  weights: SelectionWeights = DEFAULT_SELECTION_WEIGHTS,
): MasteryRecord {
  if (masteryData.length === 0) throw new Error('No subtopics available');

  const sorted = [...masteryData].sort((a, b) => a.masteryPct - b.masteryPct);
  const attempted = sorted.filter((m) => m.lastAttempted !== null);
  const unattempted = sorted.filter((m) => m.lastAttempted === null);

  if (rng < weights.gapPushing) {
    // Gap pushing — weakest subtopic
    return sorted[0];
  }

  if (rng < weights.gapPushing + weights.reinforcement && attempted.length > 0) {
    // Reinforcement — recently attempted
    const recent = [...attempted].sort((a, b) =>
      new Date(b.lastAttempted!).getTime() - new Date(a.lastAttempted!).getTime(),
    );
    const pickIndex = Math.floor(Math.random() * Math.min(3, recent.length));
    return recent[pickIndex];
  }

  if (unattempted.length > 0) {
    // Exploration — new subtopic
    return unattempted[Math.floor(Math.random() * unattempted.length)];
  }

  // Fallback to weakest
  return sorted[0];
}

// ── Difficulty adjustment ────────────────────────────────────────────

/**
 * Adjust difficulty based on recent answer streaks.
 *
 * 3 correct in a row → difficulty up (max 5).
 * 3 wrong in a row → difficulty down (min 1).
 */
export function adjustDifficulty(
  currentLevel: DifficultyLevel,
  recentCorrectStreak: number,
  recentWrongStreak: number,
): DifficultyLevel {
  let level = currentLevel as number;
  if (recentCorrectStreak >= STREAK_THRESHOLD) level = Math.min(5, level + 1);
  if (recentWrongStreak >= STREAK_THRESHOLD) level = Math.max(1, level - 1);
  return level as DifficultyLevel;
}

/**
 * Calculate correct/wrong streaks from a list of recent answers.
 * Answers should be ordered most-recent-first.
 */
export function calculateStreaks(recentAnswers: boolean[]): {
  correctStreak: number;
  wrongStreak: number;
} {
  let correctStreak = 0;
  let wrongStreak = 0;

  for (const isCorrect of recentAnswers) {
    if (isCorrect) {
      correctStreak++;
      if (wrongStreak > 0) break;
    } else {
      wrongStreak++;
      if (correctStreak > 0) break;
    }
  }

  return { correctStreak, wrongStreak };
}

// ── Mastery update ───────────────────────────────────────────────────

/**
 * Update mastery percentage after an answer.
 *
 * Uses exponential moving average:
 * - Correct: mastery += alpha * (100 - mastery)
 * - Incorrect: mastery -= alpha * mastery
 *
 * Clamped to [0, 100].
 */
export function updateMastery(
  currentMastery: number,
  isCorrect: boolean,
  alpha: number = MASTERY_ALPHA,
): number {
  let newMastery: number;
  if (isCorrect) {
    newMastery = currentMastery + alpha * (100 - currentMastery);
  } else {
    newMastery = currentMastery - alpha * currentMastery;
  }
  return Math.max(0, Math.min(100, Math.round(newMastery * 100) / 100));
}
