-- One row per learner action, ordered within a browser session by seq.
-- (session_id, seq) is unique so a batch resent after a network error is not stored twice.
CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT    NOT NULL,           -- TAMU-001 ...
    session_id TEXT    NOT NULL,           -- one per sign-in or page load
    seq        INTEGER NOT NULL,           -- order within the session, from 1
    client_ts  TEXT    NOT NULL,           -- ISO time in the browser
    server_ts  TEXT    NOT NULL,           -- ISO time the batch arrived
    event      TEXT    NOT NULL,           -- see docs/tamu-event-codebook.md
    section_id TEXT,                       -- ai-literacy/01/02 ...
    target     TEXT,                       -- item, element or concept the event is about
    data       TEXT,                       -- JSON details; never typed text
    UNIQUE (session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_events_student_time ON events (student_id, client_ts);
CREATE INDEX IF NOT EXISTS idx_events_event ON events (event);
