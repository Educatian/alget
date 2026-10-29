-- Section discussions (sites with the discussion feature): posts by students and instructors,
-- optionally anchored to a quoted passage, with one level of replies. Instructors can hide a post.
CREATE TABLE IF NOT EXISTS posts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id TEXT    NOT NULL,            -- e.g. ai-literacy/01/02
    parent_id  INTEGER,                     -- the post this replies to, or NULL for a new thread
    anchor     TEXT,                        -- quoted passage the thread is about, or NULL
    student_id TEXT    NOT NULL,            -- author's roster ID (instructors too)
    role       TEXT    NOT NULL DEFAULT 'student',
    body       TEXT    NOT NULL,
    created    TEXT    NOT NULL,
    hidden     INTEGER NOT NULL DEFAULT 0,
    hidden_by  TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_section ON posts (section_id, created);
