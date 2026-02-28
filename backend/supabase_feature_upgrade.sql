-- ============================================================================
-- ALGET Feature Upgrades - Supabase SQL
-- Execute this in Supabase SQL Editor
-- ============================================================================

-- 1. HIGHLIGHTS TABLE (하이라이트 영속성)
-- ============================================================================
CREATE TABLE IF NOT EXISTS highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    start_offset INT NOT NULL DEFAULT 0,
    end_offset INT NOT NULL DEFAULT 0,
    text_content TEXT NOT NULL,
    color TEXT DEFAULT 'yellow',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_section ON highlights(section_id);
CREATE INDEX IF NOT EXISTS idx_highlights_text ON highlights(text_content);

-- RLS Policies
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own highlights" ON highlights;
CREATE POLICY "Users can manage own highlights" ON highlights
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can read all highlights" ON highlights;
CREATE POLICY "Authenticated users can read all highlights" ON highlights
    FOR SELECT TO authenticated USING (true);

-- 2. POPULAR HIGHLIGHTS VIEW (협업 하이라이트)
-- ============================================================================
CREATE OR REPLACE VIEW popular_highlights AS
SELECT 
    section_id,
    text_content,
    MIN(start_offset) AS start_offset,
    MAX(end_offset) AS end_offset,
    COUNT(DISTINCT user_id) AS highlight_count,
    ARRAY_AGG(DISTINCT user_id) AS user_ids
FROM highlights
GROUP BY section_id, text_content
HAVING COUNT(DISTINCT user_id) >= 2;

GRANT SELECT ON popular_highlights TO authenticated;

-- 3. CHAT HISTORY TABLE (대화 기록)
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_section ON chat_history(section_id);

ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own chat history" ON chat_history;
CREATE POLICY "Users can manage own chat history" ON chat_history
    FOR ALL USING (auth.uid() = user_id);

-- Success message
SELECT 'All tables created successfully!' as status;
