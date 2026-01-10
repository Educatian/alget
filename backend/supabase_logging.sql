-- ============================================================================
-- ALGET Logging System - Supabase SQL
-- Execute this in Supabase SQL Editor
-- ============================================================================

-- 1. EVENT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    sequence_num INT NOT NULL,
    event_type TEXT NOT NULL,
    event_target TEXT,
    event_data JSONB DEFAULT '{}'::jsonb,
    section_id TEXT,
    client_ts TIMESTAMPTZ NOT NULL,
    server_ts TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, sequence_num)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_event_logs_user ON event_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_session ON event_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_section ON event_logs(section_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_client_ts ON event_logs(client_ts);

-- 2. USER SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_ms INT,
    total_events INT DEFAULT 0,
    device_info JSONB DEFAULT '{}'::jsonb,
    last_section_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON user_sessions(started_at);

-- 3. RLS POLICIES
-- ============================================================================
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
DROP POLICY IF EXISTS "Users can manage own event_logs" ON event_logs;
CREATE POLICY "Users can manage own event_logs" ON event_logs
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own sessions" ON user_sessions;
CREATE POLICY "Users can manage own sessions" ON user_sessions
    FOR ALL USING (auth.uid() = user_id);

-- 4. HELPER VIEW FOR SEQUENTIAL ANALYSIS
-- ============================================================================
CREATE OR REPLACE VIEW session_event_sequence AS
SELECT 
    s.id AS session_id,
    s.user_id,
    s.started_at AS session_start,
    e.sequence_num,
    e.event_type,
    e.event_target,
    e.event_data,
    e.section_id,
    e.client_ts,
    LAG(e.event_type) OVER (PARTITION BY s.id ORDER BY e.sequence_num) AS prev_event,
    LEAD(e.event_type) OVER (PARTITION BY s.id ORDER BY e.sequence_num) AS next_event,
    e.client_ts - LAG(e.client_ts) OVER (PARTITION BY s.id ORDER BY e.sequence_num) AS time_since_prev
FROM user_sessions s
JOIN event_logs e ON s.id = e.session_id
ORDER BY s.id, e.sequence_num;

GRANT SELECT ON session_event_sequence TO authenticated;

-- Success
SELECT 'Logging tables created successfully!' as status;
