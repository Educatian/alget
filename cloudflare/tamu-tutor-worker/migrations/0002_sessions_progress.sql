-- Sessions and per-student progress, moved from KV to D1: KV is eventually consistent, so a
-- session written at sign-in could look missing for up to a minute from another location
-- (signing the student out), and a stale progress copy could overwrite newer notes.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,        -- SHA-256 of the bearer token; the token itself is not stored
    student_id TEXT    NOT NULL,
    created    TEXT    NOT NULL,
    expires    INTEGER NOT NULL            -- unix seconds
);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions (student_id);

CREATE TABLE IF NOT EXISTS progress (
    student_id TEXT NOT NULL,
    key        TEXT NOT NULL,              -- browser storage key (see PROGRESS_KEY in src/accounts.js)
    value      TEXT NOT NULL,
    updated    TEXT NOT NULL,
    PRIMARY KEY (student_id, key)
);
