-- ============================================================================
-- ALGET Social Layer - Supabase SQL
-- Execute this in Supabase SQL Editor
-- ============================================================================

CREATE TABLE IF NOT EXISTS social_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    course TEXT,
    heading TEXT,
    concept_id TEXT,
    signal_type TEXT NOT NULL,
    signal_value TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_signals_section ON social_signals(section_id);
CREATE INDEX IF NOT EXISTS idx_social_signals_type ON social_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_social_signals_created ON social_signals(created_at DESC);

ALTER TABLE social_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own social signals" ON social_signals;
CREATE POLICY "Users can insert own social signals" ON social_signals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can read social signals" ON social_signals;
CREATE POLICY "Authenticated users can read social signals" ON social_signals
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can delete own social signals" ON social_signals;
CREATE POLICY "Users can delete own social signals" ON social_signals
    FOR DELETE USING (auth.uid() = user_id);

SELECT 'social_signals table ready' AS status;
