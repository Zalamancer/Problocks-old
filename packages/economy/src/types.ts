/**
 * Economy system types.
 */

/** Difficulty levels (1-5). */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

/** Reward result from answering a question. */
export interface Reward {
  /** Coins earned. */
  coins: number;
  /** XP earned. */
  xp: number;
}

/** Player economic profile. */
export interface PlayerEconomy {
  /** User ID. */
  userId: string;
  /** Current coin balance. */
  coins: number;
  /** Total XP earned. */
  xp: number;
  /** Current level. */
  level: number;
  /** Login streak (consecutive days). */
  loginStreak: number;
  /** Last login timestamp. */
  lastLogin: string | null;
}

/** Transaction record. */
export interface Transaction {
  /** Transaction ID. */
  id: string;
  /** User ID. */
  userId: string;
  /** Transaction type. */
  type: 'question_reward' | 'shop_purchase' | 'daily_bonus' | 'creator_payout';
  /** Amount (positive = credit, negative = debit). */
  coins: number;
  /** XP change (always non-negative). */
  xp: number;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
  /** Timestamp. */
  createdAt: string;
}

/** Reward configuration by difficulty. */
export interface RewardConfig {
  /** Coins for a correct answer at each difficulty. */
  correctCoins: Record<DifficultyLevel, number>;
  /** XP for a correct answer at each difficulty. */
  correctXP: Record<DifficultyLevel, number>;
  /** XP for an incorrect answer (flat). */
  incorrectXP: number;
  /** Coins for an incorrect answer (flat). */
  incorrectCoins: number;
}
