"""SQLite schema definition."""

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,
    sdk_session_id  TEXT,
    cwd             TEXT NOT NULL,
    name            TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'idle',
    permission_mode TEXT NOT NULL DEFAULT 'acceptEdits',
    model           TEXT DEFAULT NULL,
    allowed_tools   TEXT DEFAULT NULL,
    disallowed_tools TEXT DEFAULT NULL,
    system_prompt   TEXT DEFAULT NULL,
    max_turns       INTEGER DEFAULT NULL,
    max_budget_usd  REAL DEFAULT NULL,
    total_cost_usd  REAL NOT NULL DEFAULT 0.0,
    total_turns     INTEGER NOT NULL DEFAULT 0,
    message_count   INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    last_prompt     TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL,
    type        TEXT NOT NULL,
    data        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    UNIQUE(session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, seq);

CREATE TABLE IF NOT EXISTS projects (
    path        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    pinned      INTEGER NOT NULL DEFAULT 0,
    last_used   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    user_agent  TEXT DEFAULT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vapid_keys (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    private_key TEXT NOT NULL,
    public_key  TEXT NOT NULL
);
"""
