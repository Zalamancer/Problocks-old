/**
 * @problocks/learning — Adaptive learning system.
 *
 * Subtopic selection, difficulty adjustment, mastery tracking.
 */

export type {
  DifficultyLevel,
  MasteryRecord,
  Question,
  QuestionWithAnswer,
  AnswerSubmission,
  AnswerResult,
  AnswerLogEntry,
  SelectionWeights,
} from './types.js';

export {
  pickSubtopic,
  adjustDifficulty,
  calculateStreaks,
  updateMastery,
  DEFAULT_SELECTION_WEIGHTS,
} from './adaptive.js';
