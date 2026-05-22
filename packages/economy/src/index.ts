/**
 * @problocks/economy — Virtual economy system.
 *
 * Coin/XP rewards, level progression, login streaks, transactions.
 */

export type {
  DifficultyLevel,
  Reward,
  PlayerEconomy,
  Transaction,
  RewardConfig,
} from './types.js';

export {
  calculateReward,
  calculateLevel,
  xpForLevel,
  levelProgress,
  updateLoginStreak,
  DEFAULT_REWARD_CONFIG,
} from './rewards.js';
