import { Hono } from 'hono';
import { getDb } from '../db/schema.js';
import { nanoid } from 'nanoid';
import {
  pickSubtopic,
  adjustDifficulty,
  calculateStreaks,
  updateMastery,
} from '@problocks/learning';
import type { MasteryRecord, DifficultyLevel } from '@problocks/learning';
import { calculateReward, calculateLevel } from '@problocks/economy';
import { generateQuestion } from '../services/question-generator.js';

export const learningRouter = new Hono();

// ── GET /learning/profile/:userId — student learning profile ─────────

learningRouter.get('/profile/:userId', (c) => {
  const db = getDb();
  const userId = c.req.param('userId');

  const profile: any = db.prepare(`
    SELECT user_id, coins, xp, level, login_streak, last_login, display_name
    FROM player_profiles WHERE user_id = ?
  `).get(userId);

  if (!profile) {
    // Auto-create profile
    db.prepare(`
      INSERT OR IGNORE INTO player_profiles (user_id, display_name)
      VALUES (?, (SELECT display_name FROM users WHERE id = ?))
    `).run(userId, userId);

    db.close();
    return c.json({ coins: 0, xp: 0, level: 1, loginStreak: 0, lastLogin: null });
  }

  db.close();
  return c.json({
    coins: profile.coins,
    xp: profile.xp,
    level: profile.level,
    loginStreak: profile.login_streak,
    lastLogin: profile.last_login,
    displayName: profile.display_name,
  });
});

// ── POST /learning/encounter — get next adaptive question ────────────

learningRouter.post('/encounter', async (c) => {
  const { userId, subject } = await c.req.json();
  if (!userId || !subject) {
    return c.json({ error: 'userId and subject required' }, 400);
  }

  const db = getDb();

  // 1. Get mastery data for all subtopics in this subject
  const rows: any[] = db.prepare(`
    SELECT s.id as subtopic_id, s.name as subtopic_name,
           COALESCE(sm.mastery_pct, 0) as mastery_pct,
           COALESCE(sm.difficulty_level, 1) as difficulty_level,
           COALESCE(sm.correct_count, 0) as correct_count,
           COALESCE(sm.incorrect_count, 0) as incorrect_count,
           sm.last_attempted
    FROM subtopics s
    JOIN topics t ON s.topic_id = t.id
    JOIN subjects sub ON t.subject_id = sub.id
    LEFT JOIN student_mastery sm ON sm.subtopic_id = s.id AND sm.user_id = ?
    WHERE sub.name = ?
  `).all(userId, subject);

  if (rows.length === 0) {
    db.close();
    return c.json({ error: 'No subtopics found for subject' }, 404);
  }

  // 2. Map to MasteryRecord
  const masteryData: MasteryRecord[] = rows.map((r) => ({
    subtopicId: r.subtopic_id,
    subtopicName: r.subtopic_name,
    masteryPct: r.mastery_pct,
    difficultyLevel: r.difficulty_level as DifficultyLevel,
    correctCount: r.correct_count,
    incorrectCount: r.incorrect_count,
    lastAttempted: r.last_attempted,
  }));

  // 3. Pick subtopic
  const target = pickSubtopic(masteryData);

  // 4. Get recent answers for streak calculation
  const recentAnswers: any[] = db.prepare(`
    SELECT is_correct FROM answer_log
    WHERE user_id = ? AND subtopic_id = ?
    ORDER BY answered_at DESC LIMIT 5
  `).all(userId, target.subtopicId);

  const streaks = calculateStreaks(recentAnswers.map((a) => !!a.is_correct));
  const difficulty = adjustDifficulty(
    target.difficultyLevel,
    streaks.correctStreak,
    streaks.wrongStreak,
  );

  // 5. Get cached question not yet answered by this student
  const cached: any = db.prepare(`
    SELECT id, question_text, choices_json, correct_index, explanation
    FROM question_cache
    WHERE subtopic_id = ? AND difficulty_level = ?
    AND id NOT IN (SELECT question_id FROM answer_log WHERE user_id = ? AND question_id IS NOT NULL)
    ORDER BY RANDOM() LIMIT 1
  `).get(target.subtopicId, difficulty, userId);

  db.close();

  if (cached) {
    db.close();
    return c.json({
      questionId: cached.id,
      subtopicId: target.subtopicId,
      subtopicName: target.subtopicName,
      difficulty,
      question: cached.question_text,
      choices: typeof cached.choices_json === 'string'
        ? JSON.parse(cached.choices_json)
        : cached.choices_json,
    });
  }

  // 6. Generate fresh question via AI
  try {
    const generated = await generateQuestion({
      subtopicName: target.subtopicName,
      difficultyLevel: difficulty,
    });

    // Cache it
    const qId = nanoid();
    db.prepare(`
      INSERT INTO question_cache (id, subtopic_id, difficulty_level, question_text, choices_json, correct_index, explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(qId, target.subtopicId, difficulty, generated.question, JSON.stringify(generated.choices), generated.correctIndex, generated.explanation);

    db.close();

    return c.json({
      questionId: qId,
      subtopicId: target.subtopicId,
      subtopicName: target.subtopicName,
      difficulty,
      question: generated.question,
      choices: generated.choices,
    });
  } catch (err) {
    db.close();
    return c.json({ error: 'Failed to generate question' }, 500);
  }
});

// ── POST /learning/answer — submit and grade an answer ───────────────

learningRouter.post('/answer', async (c) => {
  const { userId, questionId, choiceIndex, responseMs } = await c.req.json();
  if (!userId || !questionId || choiceIndex === undefined) {
    return c.json({ error: 'userId, questionId, and choiceIndex required' }, 400);
  }

  const db = getDb();

  // 1. Fetch question with correct answer
  const q: any = db.prepare(`
    SELECT subtopic_id, difficulty_level, correct_index, explanation
    FROM question_cache WHERE id = ?
  `).get(questionId);

  if (!q) {
    db.close();
    return c.json({ error: 'Question not found' }, 404);
  }

  // 2. Grade
  const isCorrect = choiceIndex === q.correct_index;
  const reward = calculateReward(q.difficulty_level as DifficultyLevel, isCorrect);

  // 3. Log answer
  db.prepare(`
    INSERT INTO answer_log (id, user_id, question_id, subtopic_id, is_correct, response_ms, coins_earned, xp_earned)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nanoid(), userId, questionId, q.subtopic_id, isCorrect ? 1 : 0, responseMs ?? 0, reward.coins, reward.xp);

  // 4. Update player profile
  db.prepare(`
    UPDATE player_profiles
    SET coins = coins + ?, xp = xp + ?,
        level = MAX(1, CAST(SQRT((xp + ?) / 100.0) AS INTEGER) + 1),
        updated_at = datetime('now')
    WHERE user_id = ?
  `).run(reward.coins, reward.xp, reward.xp, userId);

  // 5. Get current mastery for this subtopic
  const existing: any = db.prepare(`
    SELECT mastery_pct, difficulty_level, correct_count, incorrect_count
    FROM student_mastery WHERE user_id = ? AND subtopic_id = ?
  `).get(userId, q.subtopic_id);

  const currentMastery = existing?.mastery_pct ?? 0;
  const newMastery = updateMastery(currentMastery, isCorrect);

  // Calculate new difficulty from recent streaks
  const recentAnswers: any[] = db.prepare(`
    SELECT is_correct FROM answer_log
    WHERE user_id = ? AND subtopic_id = ?
    ORDER BY answered_at DESC LIMIT 5
  `).all(userId, q.subtopic_id);
  const streaks = calculateStreaks(recentAnswers.map((a) => !!a.is_correct));
  const newDifficulty = adjustDifficulty(
    (existing?.difficulty_level ?? 1) as DifficultyLevel,
    streaks.correctStreak,
    streaks.wrongStreak,
  );

  // 6. Upsert mastery
  db.prepare(`
    INSERT INTO student_mastery (id, user_id, subtopic_id, mastery_pct, difficulty_level, correct_count, incorrect_count, last_attempted)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT (user_id, subtopic_id) DO UPDATE SET
      mastery_pct = ?,
      difficulty_level = ?,
      correct_count = correct_count + ?,
      incorrect_count = incorrect_count + ?,
      last_attempted = datetime('now'),
      updated_at = datetime('now')
  `).run(
    nanoid(), userId, q.subtopic_id, newMastery, newDifficulty,
    isCorrect ? 1 : 0, isCorrect ? 0 : 1,
    newMastery, newDifficulty,
    isCorrect ? 1 : 0, isCorrect ? 0 : 1,
  );

  // 7. Get updated profile
  const profile: any = db.prepare(`
    SELECT coins, xp, level FROM player_profiles WHERE user_id = ?
  `).get(userId);

  db.close();

  return c.json({
    correct: isCorrect,
    correctIndex: q.correct_index,
    explanation: q.explanation,
    coinsEarned: reward.coins,
    xpEarned: reward.xp,
    newMastery,
    newDifficulty,
    profile: profile ? { coins: profile.coins, xp: profile.xp, level: profile.level } : null,
  });
});

// ── GET /learning/mastery/:userId — all mastery data for a student ───

learningRouter.get('/mastery/:userId', (c) => {
  const db = getDb();
  const userId = c.req.param('userId');
  const subject = c.req.query('subject');

  let query = `
    SELECT sm.subtopic_id, s.name as subtopic_name,
           sm.mastery_pct, sm.difficulty_level,
           sm.correct_count, sm.incorrect_count, sm.last_attempted
    FROM student_mastery sm
    JOIN subtopics s ON sm.subtopic_id = s.id
  `;
  const params: any[] = [userId];

  if (subject) {
    query += `
      JOIN topics t ON s.topic_id = t.id
      JOIN subjects sub ON t.subject_id = sub.id
      WHERE sm.user_id = ? AND sub.name = ?
    `;
    params.push(subject);
  } else {
    query += ` WHERE sm.user_id = ?`;
  }

  query += ` ORDER BY sm.mastery_pct ASC`;

  const rows = db.prepare(query).all(...params);
  db.close();

  return c.json({ mastery: rows });
});

// ── POST /learning/question/cache — cache a generated question ───────

learningRouter.post('/question/cache', async (c) => {
  const { subtopicId, difficulty, question, choices, correctIndex, explanation } = await c.req.json();
  if (!subtopicId || !question || !choices || correctIndex === undefined) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const db = getDb();
  const id = nanoid();

  db.prepare(`
    INSERT INTO question_cache (id, subtopic_id, difficulty_level, question_text, choices_json, correct_index, explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, subtopicId, difficulty, question, JSON.stringify(choices), correctIndex, explanation ?? '');

  db.close();

  return c.json({ questionId: id });
});
