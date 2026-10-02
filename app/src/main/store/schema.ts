// 与架构文档 §3 的 DDL 逐字一致。
// 最重要的一条：Session 行只在用户按下保存之后才写入，未保存的会话只在内存里。
export const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS session (
  id                    TEXT PRIMARY KEY,
  input                 TEXT NOT NULL,
  selected_emotion      TEXT,
  selected_intensity    TEXT,
  mode                  TEXT NOT NULL CHECK (mode IN ('rest','reflect')),
  reflection_consent_at TEXT,
  status                TEXT NOT NULL,
  is_demo               INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reflection (
  session_id        TEXT PRIMARY KEY REFERENCES session(id) ON DELETE CASCADE,
  views             TEXT NOT NULL,
  quoted_input      TEXT NOT NULL,
  assumptions       TEXT,
  reframed_question TEXT,
  prompt_version    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ring (
  id               TEXT PRIMARY KEY,
  session_id       TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('support','action')),
  user_note        TEXT NOT NULL,
  save_original    INTEGER NOT NULL DEFAULT 0,
  original_text    TEXT,
  user_decision    TEXT,
  action           TEXT,
  criterion        TEXT,
  review_due       TEXT,
  created_at       TEXT NOT NULL,
  is_demo          INTEGER NOT NULL DEFAULT 0,
  idempotency_key  TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS ring_created_idx ON ring(created_at DESC);

CREATE TABLE IF NOT EXISTS review (
  id              TEXT PRIMARY KEY,
  ring_id         TEXT NOT NULL REFERENCES ring(id) ON DELETE CASCADE,
  executed        INTEGER,
  observed_result TEXT,
  premise_update  TEXT,
  next_step       TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS review_ring_idx ON review(ring_id);

CREATE TABLE IF NOT EXISTS interaction_event (
  anonymous_session_id TEXT NOT NULL,
  event_name           TEXT NOT NULL,
  mode                 TEXT,
  duration_ms          INTEGER,
  result_code          TEXT,
  created_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ie_name_idx ON interaction_event(event_name, created_at);
`
