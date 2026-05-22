-- Problocks Light integration: Learning + Economy schema
-- Designed for Supabase (PostgreSQL)

-- ══════════════════════════════════════════════════════════════════════
-- SUBJECTS & CURRICULUM
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subjects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS topics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, name)
);

CREATE TABLE IF NOT EXISTS subtopics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, name)
);

-- ══════════════════════════════════════════════════════════════════════
-- QUESTION CACHE
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS question_cache (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopic_id      uuid NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
  difficulty_level smallint NOT NULL CHECK (difficulty_level BETWEEN 1 AND 5),
  question_text    text NOT NULL,
  choices_json     jsonb NOT NULL,
  correct_index    smallint NOT NULL,
  explanation      text,
  encounter_type   text NOT NULL DEFAULT 'npc',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_cache_subtopic_diff
  ON question_cache(subtopic_id, difficulty_level);

-- ══════════════════════════════════════════════════════════════════════
-- PLAYER PROFILES (ECONOMY)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS player_profiles (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins        int NOT NULL DEFAULT 0,
  xp           int NOT NULL DEFAULT 0,
  level        int NOT NULL DEFAULT 1,
  login_streak int NOT NULL DEFAULT 0,
  last_login   timestamptz,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════════
-- STUDENT MASTERY
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS student_mastery (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subtopic_id      uuid NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
  mastery_pct      numeric(5,2) NOT NULL DEFAULT 0,
  difficulty_level smallint NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  correct_count    int NOT NULL DEFAULT 0,
  incorrect_count  int NOT NULL DEFAULT 0,
  last_attempted   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subtopic_id)
);

CREATE INDEX IF NOT EXISTS idx_student_mastery_user
  ON student_mastery(user_id);

-- ══════════════════════════════════════════════════════════════════════
-- ANSWER LOG
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS answer_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id  uuid REFERENCES question_cache(id) ON DELETE SET NULL,
  subtopic_id  uuid NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
  is_correct   boolean NOT NULL,
  response_ms  int,
  coins_earned int NOT NULL DEFAULT 0,
  xp_earned    int NOT NULL DEFAULT 0,
  answered_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_answer_log_user_subtopic
  ON answer_log(user_id, subtopic_id, answered_at DESC);

CREATE INDEX IF NOT EXISTS idx_answer_log_user_recent
  ON answer_log(user_id, answered_at DESC);

-- ══════════════════════════════════════════════════════════════════════
-- TRANSACTIONS (ECONOMY AUDIT TRAIL)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('question_reward', 'shop_purchase', 'daily_bonus', 'creator_payout')),
  coins      int NOT NULL DEFAULT 0,
  xp         int NOT NULL DEFAULT 0,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user
  ON transactions(user_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════
-- PLAYER POSITIONS (MAP STATE)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS player_positions (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  map_id     text NOT NULL,
  x          int NOT NULL,
  y          int NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, map_id)
);

-- ══════════════════════════════════════════════════════════════════════
-- GAME METADATA (MARKETPLACE FILTERING)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS game_metadata (
  game_id           uuid PRIMARY KEY,
  engine_type       text NOT NULL CHECK (engine_type IN ('2d', '3d')),
  max_vertices      int,
  has_low_poly_mode boolean NOT NULL DEFAULT false,
  min_tier          text NOT NULL DEFAULT 'low' CHECK (min_tier IN ('low', 'mid', 'high')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_positions ENABLE ROW LEVEL SECURITY;

-- Players can read/write their own data
CREATE POLICY "Users manage own profile"
  ON player_profiles FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own mastery"
  ON student_mastery FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users read own answers"
  ON answer_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own answers"
  ON answer_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own positions"
  ON player_positions FOR ALL
  USING (auth.uid() = user_id);

-- Questions readable by all authenticated users
ALTER TABLE question_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read questions"
  ON question_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Game metadata readable by all
ALTER TABLE game_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read game metadata"
  ON game_metadata FOR SELECT
  USING (true);

-- Subjects/topics/subtopics readable by all
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtopics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read subjects"
  ON subjects FOR SELECT USING (true);
CREATE POLICY "Anyone can read topics"
  ON topics FOR SELECT USING (true);
CREATE POLICY "Anyone can read subtopics"
  ON subtopics FOR SELECT USING (true);

-- ══════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_player_profiles_updated
  BEFORE UPDATE ON player_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_student_mastery_updated
  BEFORE UPDATE ON student_mastery
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_game_metadata_updated
  BEFORE UPDATE ON game_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
