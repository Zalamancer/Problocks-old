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
  `);

  db.close();
}
