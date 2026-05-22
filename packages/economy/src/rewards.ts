/**
 * Reward calculation for the economy system.
 *
 * Coins and XP are awarded based on question difficulty and correctness.
 * Level is derived from total XP: level = floor(sqrt(xp / 100)) + 1.
 */

import type { DifficultyLevel, Reward, RewardConfig } from './types.js';

// ── Default reward table ─────────────────────────────────────────────

export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  correctCoins: { 1: 5, 2: 8, 3: 12, 4: 16, 5: 20 },
  correctXP: { 1: 10, 2: 15, 3: 25, 4: 35, 5: 40 },
  incorrectXP: 5,
  incorrectCoins: 0,
};

// ── Reward calculation ───────────────────────────────────────────────

/**
 * Calculate reward for answering a question.
 *
 * @param difficulty — Question difficulty (1–5).
 * @param isCorrect — Whether the answer was correct.
 * @param config — Optional reward configuration.
 */
export function calculateReward(
  difficulty: DifficultyLevel,
  isCorrect: boolean,
  config: RewardConfig = DEFAULT_REWARD_CONFIG,
): Reward {
  if (isCorrect) {
    return {
      coins: config.correctCoins[difficulty] ?? 5,
      xp: config.correctXP[difficulty] ?? 10,
    };
  }
  return {
    coins: config.incorrectCoins,
    xp: config.incorrectXP,
  };
}

// ── Level calculation ────────────────────────────────────────────────

/** Calculate level from total XP. Level = floor(sqrt(xp / 100)) + 1. */
export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

/** Calculate XP required to reach a specific level. */
export function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 100;
}

/** Calculate progress toward next level (0–1). */
export function levelProgress(xp: number): number {
  const currentLevel = calculateLevel(xp);
  const currentLevelXP = xpForLevel(currentLevel);
  const nextLevelXP = xpForLevel(currentLevel + 1);
  const range = nextLevelXP - currentLevelXP;
  if (range <= 0) return 1;
  return (xp - currentLevelXP) / range;
}

// ── Daily login streak ───────────────────────────────────────────────

/**
 * Calculate updated login streak.
 * Returns the new streak count and any daily bonus.
 */
export function updateLoginStreak(
  lastLogin: string | null,
  currentStreak: number,
  now: Date = new Date(),
): { streak: number; dailyBonus: Reward } {
  if (!lastLogin) {
    return { streak: 1, dailyBonus: { coins: 10, xp: 5 } };
  }

  const last = new Date(lastLogin);
  const diffMs = now.getTime() - last.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Same day — no bonus
    return { streak: currentStreak, dailyBonus: { coins: 0, xp: 0 } };
  }

  if (diffDays === 1) {
    // Consecutive day — streak continues
    const newStreak = currentStreak + 1;
    const bonusMultiplier = Math.min(newStreak, 7); // Cap at 7x
    return {
      streak: newStreak,
      dailyBonus: { coins: 10 * bonusMultiplier, xp: 5 * bonusMultiplier },
    };
  }

  // Streak broken — reset to 1
  return { streak: 1, dailyBonus: { coins: 10, xp: 5 } };
}
