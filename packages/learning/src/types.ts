/**
 * Adaptive learning system types.
 */

/** Difficulty levels (1–5). */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

/** Student mastery record for a subtopic. */
export interface MasteryRecord {
  /** Subtopic ID. */
  subtopicId: string;
  /** Subtopic display name. */
  subtopicName: string;
  /** Mastery percentage (0–100). */
  masteryPct: number;
  /** Current difficulty level. */
  difficultyLevel: DifficultyLevel;
  /** Number of correct answers. */
  correctCount: number;
  /** Number of incorrect answers. */
  incorrectCount: number;
  /** Last attempted timestamp (ISO string), or null if never attempted. */
  lastAttempted: string | null;
}

/** A question served to a student. */
export interface Question {
  /** Question cache ID. */
  questionId: string;
  /** Subtopic ID. */
  subtopicId: string;
  /** Subtopic display name. */
  subtopicName: string;
  /** Difficulty level of this question. */
  difficulty: DifficultyLevel;
  /** Question text. */
  question: string;
  /** Answer choices (array of strings). */
  choices: string[];
  /** Explanation shown after answering. */
  explanation: string;
}

/** Internal question with the correct answer (server-side only). */
export interface QuestionWithAnswer extends Question {
  /** Index of the correct choice (0-based). */
  correctIndex: number;
}

/** Student's answer submission. */
export interface AnswerSubmission {
  /** Question ID being answered. */
  questionId: string;
  /** Index of the chosen answer. */
  choiceIndex: number;
  /** Response time in milliseconds. */
  responseMs: number;
}

/** Result of grading an answer. */
export interface AnswerResult {
  /** Whether the answer was correct. */
  correct: boolean;
  /** Correct answer index. */
  correctIndex: number;
  /** Explanation text. */
  explanation: string;
  /** Coins earned. */
  coinsEarned: number;
  /** XP earned. */
  xpEarned: number;
}

/** Answer log entry. */
export interface AnswerLogEntry {
  /** User ID. */
  userId: string;
  /** Question ID. */
  questionId: string;
  /** Subtopic ID. */
  subtopicId: string;
  /** Whether the answer was correct. */
  isCorrect: boolean;
  /** Response time in ms. */
  responseMs: number;
  /** Coins earned. */
  coinsEarned: number;
  /** XP earned. */
  xpEarned: number;
  /** Timestamp. */
  answeredAt: string;
}

/** Subtopic selection strategy weights. */
export interface SelectionWeights {
  /** Weight for weakest subtopic (gap pushing). Default: 0.60. */
  gapPushing: number;
  /** Weight for recently attempted (reinforcement). Default: 0.25. */
  reinforcement: number;
  /** Weight for unattempted (exploration). Default: 0.15. */
  exploration: number;
}
