-- Instructor accounts: the role comes from the account record at sign-in and travels with the session.
ALTER TABLE sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'student';
CREATE INDEX IF NOT EXISTS idx_events_student_section ON events (student_id, section_id);
