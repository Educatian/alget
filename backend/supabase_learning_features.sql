-- ============================================================================
-- ALGET Learning Persistence + Social Analytics SQL
-- Execute after social_signals setup
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_progress (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    course TEXT NOT NULL,
    chapter TEXT NOT NULL,
    section TEXT NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_course_progress_course ON course_progress(course);
CREATE INDEX IF NOT EXISTS idx_course_progress_completed_at ON course_progress(completed_at DESC);

ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own course progress" ON course_progress;
CREATE POLICY "Users can manage own course progress" ON course_progress
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can read course progress" ON course_progress;
CREATE POLICY "Authenticated users can read course progress" ON course_progress
    FOR SELECT TO authenticated
    USING (true);


CREATE TABLE IF NOT EXISTS social_presence (
    presence_key TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    color_token TEXT,
    course TEXT,
    section_id TEXT NOT NULL,
    section_title TEXT,
    heading TEXT,
    concept_id TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_presence_last_seen ON social_presence(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_presence_section ON social_presence(section_id);

ALTER TABLE social_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own social presence" ON social_presence;
CREATE POLICY "Users can manage own social presence" ON social_presence
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can read social presence" ON social_presence;
CREATE POLICY "Authenticated users can read social presence" ON social_presence
    FOR SELECT TO authenticated
    USING (true);

SELECT 'course_progress and social_presence ready' AS status;
