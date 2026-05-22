import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/problocks.db');

export function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function initDb(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      is_educator INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS simulations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'general',
      version TEXT NOT NULL DEFAULT '1.0.0',
      capabilities TEXT NOT NULL DEFAULT '["basic"]',
      thumbnail_url TEXT DEFAULT '',
      entry_file TEXT DEFAULT 'src/index.ts',
      source_code TEXT DEFAULT '',
      scene_data TEXT DEFAULT '{}',
      forked_from TEXT REFERENCES simulations(id),
      fork_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      plays INTEGER DEFAULT 0,
      rating_sum REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS simulation_versions (
      id TEXT PRIMARY KEY,
      simulation_id TEXT NOT NULL REFERENCES simulations(id),
      version TEXT NOT NULL,
      source_code TEXT NOT NULL,
      changelog TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(simulation_id, version)
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      simulation_id TEXT NOT NULL REFERENCES simulations(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
      review TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(simulation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      balance INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      total_spent INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT DEFAULT '',
      simulation_id TEXT REFERENCES simulations(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payout_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      stripe_payout_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS simulation_tags (
      simulation_id TEXT NOT NULL REFERENCES simulations(id),
      tag TEXT NOT NULL,
      PRIMARY KEY(simulation_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_tags_tag ON simulation_tags(tag);

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL REFERENCES users(id),
      simulation_id TEXT NOT NULL REFERENCES simulations(id),
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(user_id, simulation_id)
    );

    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      educator_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS classroom_members (
      classroom_id TEXT NOT NULL REFERENCES classrooms(id),
      student_id TEXT NOT NULL REFERENCES users(id),
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(classroom_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id),
      simulation_slug TEXT NOT NULL,
      simulation_version TEXT,
      title TEXT NOT NULL,
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assignment_completions (
      assignment_id TEXT NOT NULL REFERENCES assignments(id),
      student_id TEXT NOT NULL REFERENCES users(id),
      completed_at TEXT DEFAULT (datetime('now')),
      play_count INTEGER DEFAULT 1,
      PRIMARY KEY(assignment_id, student_id)
    );

    CREATE INDEX IF NOT EXISTS idx_simulations_category ON simulations(category);
    CREATE INDEX IF NOT EXISTS idx_simulations_plays ON simulations(plays DESC);
    CREATE INDEX IF NOT EXISTS idx_simulations_user ON simulations(user_id);

    -- Learning system tables
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL REFERENCES subjects(id),
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(subject_id, name)
    );

    CREATE TABLE IF NOT EXISTS subtopics (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES topics(id),
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(topic_id, name)
    );

    CREATE TABLE IF NOT EXISTS question_cache (
      id TEXT PRIMARY KEY,
      subtopic_id TEXT NOT NULL REFERENCES subtopics(id),
      difficulty_level INTEGER NOT NULL CHECK(difficulty_level BETWEEN 1 AND 5),
      question_text TEXT NOT NULL,
      choices_json TEXT NOT NULL,
      correct_index INTEGER NOT NULL,
      explanation TEXT DEFAULT '',
      encounter_type TEXT NOT NULL DEFAULT 'npc',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_question_cache_subtopic
      ON question_cache(subtopic_id, difficulty_level);

    CREATE TABLE IF NOT EXISTS player_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      coins INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      login_streak INTEGER DEFAULT 0,
      last_login TEXT,
      display_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS student_mastery (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      subtopic_id TEXT NOT NULL REFERENCES subtopics(id),
      mastery_pct REAL DEFAULT 0,
      difficulty_level INTEGER DEFAULT 1 CHECK(difficulty_level BETWEEN 1 AND 5),
      correct_count INTEGER DEFAULT 0,
      incorrect_count INTEGER DEFAULT 0,
      last_attempted TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, subtopic_id)
    );

    CREATE INDEX IF NOT EXISTS idx_student_mastery_user
      ON student_mastery(user_id);

    CREATE TABLE IF NOT EXISTS answer_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      question_id TEXT REFERENCES question_cache(id),
      subtopic_id TEXT NOT NULL REFERENCES subtopics(id),
      is_correct INTEGER NOT NULL,
      response_ms INTEGER DEFAULT 0,
      coins_earned INTEGER DEFAULT 0,
      xp_earned INTEGER DEFAULT 0,
      answered_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_answer_log_user_subtopic
      ON answer_log(user_id, subtopic_id);

    CREATE TABLE IF NOT EXISTS game_metadata (
      game_id TEXT PRIMARY KEY,
      engine_type TEXT NOT NULL CHECK(engine_type IN ('2d', '3d')),
      max_vertices INTEGER,
      has_low_poly_mode INTEGER DEFAULT 0,
      min_tier TEXT NOT NULL DEFAULT 'low' CHECK(min_tier IN ('low', 'mid', 'high')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: add scene_data column if DB already existed
  try {
    db.exec(`ALTER TABLE simulations ADD COLUMN scene_data TEXT DEFAULT '{}'`);
  } catch { /* column already exists */ }

  db.close();
}
