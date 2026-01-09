-- ALGET Supabase Schema
-- OpenStax-Style Intelligent Textbook Database

-- =============================================================================
-- CONCEPTS TABLE (잠금 데이터 - LLM이 수정 불가)
-- =============================================================================
CREATE TABLE IF NOT EXISTS concepts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    definition TEXT,
    formula TEXT,
    formula_latex TEXT,
    misconception_triggers TEXT[],  -- 흔한 오개념 패턴
    related_concepts TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Statics 기본 개념 삽입
INSERT INTO concepts (id, name, definition, formula, formula_latex, misconception_triggers, related_concepts) VALUES
    ('equilibrium', 'Equilibrium', 'A state where the net force on a body is zero', 'ΣF = 0', '\\sum \\vec{F} = 0', 
     ARRAY['confusing equilibrium with rest', 'forgetting reaction forces'], 
     ARRAY['sum_of_forces', 'fbd']),
    ('sum_of_forces', 'Sum of Forces', 'Vector addition of all forces acting on a body', 'ΣFx = 0, ΣFy = 0', '\\sum F_x = 0, \\sum F_y = 0',
     ARRAY['not breaking into components', 'wrong sign convention'],
     ARRAY['equilibrium', 'tension']),
    ('fbd', 'Free Body Diagram', 'A diagram showing all external forces on an isolated body', NULL, NULL,
     ARRAY['missing forces', 'including internal forces', 'wrong direction'],
     ARRAY['equilibrium', 'tension']),
    ('tension', 'Tension', 'A pulling force transmitted through a string, cable, or rope', 'T', 'T',
     ARRAY['confusing tension direction', 'assuming tension = weight always'],
     ARRAY['equilibrium', 'sum_of_forces'])
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SECTIONS TABLE (교재 섹션 메타데이터)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sections (
    id SERIAL PRIMARY KEY,
    course TEXT NOT NULL,
    chapter INT NOT NULL,
    section INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    concept_ids TEXT[],
    prereq_section_ids INT[],
    learning_objectives TEXT[],
    estimated_time_minutes INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course, chapter, section)
);

-- Statics 1.1 섹션 삽입
INSERT INTO sections (course, chapter, section, title, description, concept_ids, learning_objectives, estimated_time_minutes) VALUES
    ('statics', 1, 1, 'Equilibrium Conditions', 'Introduction to equilibrium for particles', 
     ARRAY['equilibrium', 'sum_of_forces', 'fbd', 'tension'],
     ARRAY['Define equilibrium for a particle', 'Apply ΣF = 0 to solve for unknown forces', 'Construct and interpret free body diagrams'],
     25)
ON CONFLICT (course, chapter, section) DO NOTHING;

-- =============================================================================
-- PROBLEMS TABLE (문제 정의)
-- =============================================================================
CREATE TABLE IF NOT EXISTS problems (
    id TEXT PRIMARY KEY,
    section_id INT REFERENCES sections(id),
    problem_type TEXT NOT NULL DEFAULT 'numeric',  -- numeric, multiple_choice, free_response
    difficulty TEXT DEFAULT 'medium',  -- easy, medium, challenging
    statement TEXT NOT NULL,
    givens_schema JSONB,  -- {"mass": "50 kg", "angle": "45°"}
    solver_id TEXT,  -- Reference to solver function
    solver_params JSONB,  -- Parameters to pass to solver
    expected_value FLOAT,
    expected_unit TEXT,
    tolerance FLOAT DEFAULT 0.02,
    require_unit BOOLEAN DEFAULT TRUE,
    hint TEXT,
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 샘플 문제 삽입
INSERT INTO problems (id, section_id, problem_type, difficulty, statement, givens_schema, solver_id, solver_params, expected_value, expected_unit, tolerance, require_unit, hint) VALUES
    ('p001', 1, 'numeric', 'medium', 
     'A 50 kg object is suspended by a single cable at an angle of 45° from horizontal. Calculate the tension in the cable.',
     '{"mass": "50 kg", "angle": "45°", "g": "9.81 m/s²"}'::jsonb,
     'statics_tension_inclined',
     '{"mass": 50, "angle_deg": 45}'::jsonb,
     693.67, 'N', 0.02, TRUE,
     'Use ΣFy = 0. The vertical component of tension (T·sin(45°)) must equal the weight (mg).'),
    ('p002', 1, 'numeric', 'easy',
     'A 25 kg lamp hangs vertically from a single cable. What is the tension in the cable?',
     '{"mass": "25 kg", "g": "9.81 m/s²"}'::jsonb,
     'statics_tension_vertical',
     '{"mass": 25}'::jsonb,
     245.25, 'N', 0.01, TRUE,
     'For a vertically hanging object, the tension equals the weight.')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PROBLEM_STEPS TABLE (단계별 풀이)
-- =============================================================================
CREATE TABLE IF NOT EXISTS problem_steps (
    id SERIAL PRIMARY KEY,
    problem_id TEXT REFERENCES problems(id) ON DELETE CASCADE,
    step_index INT NOT NULL,
    step_type TEXT DEFAULT 'calculation',  -- calculation, diagram, explanation
    description TEXT NOT NULL,
    expected_value FLOAT,
    expected_unit TEXT,
    partial_credit_rule JSONB,  -- {"weight": 0.3, "accept_if_close": true}
    UNIQUE(problem_id, step_index)
);

-- p001 단계 삽입
INSERT INTO problem_steps (problem_id, step_index, step_type, description, expected_value, expected_unit) VALUES
    ('p001', 1, 'calculation', 'Calculate the weight W = mg', 490.5, 'N'),
    ('p001', 2, 'calculation', 'Apply ΣFy = 0 and solve for T', 693.67, 'N'),
    ('p002', 1, 'calculation', 'Calculate T = mg', 245.25, 'N')
ON CONFLICT (problem_id, step_index) DO NOTHING;

-- =============================================================================
-- ATTEMPTS TABLE (학생 답안 기록)
-- =============================================================================
CREATE TABLE IF NOT EXISTS attempts (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id TEXT REFERENCES problems(id),
    step_index INT,  -- NULL if answering final answer
    answer TEXT NOT NULL,
    answer_numeric FLOAT,  -- Parsed numeric value
    unit TEXT,
    is_correct BOOLEAN,
    is_unit_correct BOOLEAN,
    feedback TEXT,
    time_spent_seconds INT,
    hint_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_problem ON attempts(problem_id);
CREATE INDEX IF NOT EXISTS idx_attempts_created ON attempts(created_at);

-- =============================================================================
-- STUCK_EVENTS TABLE (막힘 이벤트)
-- =============================================================================
CREATE TABLE IF NOT EXISTS stuck_events (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    section_id INT REFERENCES sections(id),
    problem_id TEXT REFERENCES problems(id),
    reason TEXT NOT NULL,  -- 'consecutive_wrong', 'idle_timeout', 'unit_error', 'hint_requests'
    consecutive_wrong_count INT,
    idle_duration_seconds INT,
    context JSONB,  -- Additional context data
    rail_opened BOOLEAN DEFAULT FALSE,
    rail_action_taken TEXT,  -- 'explain', 'represent', 'practice', 'none'
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stuck_user ON stuck_events(user_id);
CREATE INDEX IF NOT EXISTS idx_stuck_section ON stuck_events(section_id);
CREATE INDEX IF NOT EXISTS idx_stuck_created ON stuck_events(created_at);

-- =============================================================================
-- MASTERY TABLE (개념 숙달도)
-- =============================================================================
CREATE TABLE IF NOT EXISTS mastery (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    concept_id TEXT REFERENCES concepts(id),
    mastery_score FLOAT DEFAULT 0.0,  -- 0.0 to 1.0
    attempts_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    last_practiced_at TIMESTAMPTZ,
    misconception_flags TEXT[],  -- Detected misconceptions
    confidence_level TEXT DEFAULT 'low',  -- low, medium, high
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, concept_id)
);

-- =============================================================================
-- LEARNING_SESSIONS TABLE (학습 세션)
-- =============================================================================
CREATE TABLE IF NOT EXISTS learning_sessions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    section_id INT REFERENCES sections(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INT,
    problems_attempted INT DEFAULT 0,
    problems_correct INT DEFAULT 0,
    stuck_events_count INT DEFAULT 0,
    rail_interactions_count INT DEFAULT 0,
    completion_status TEXT DEFAULT 'in_progress'  -- in_progress, completed, abandoned
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_section ON learning_sessions(section_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stuck_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own attempts" ON attempts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attempts" ON attempts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own stuck_events" ON stuck_events
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stuck_events" ON stuck_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own mastery" ON mastery
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own mastery" ON mastery
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own sessions" ON learning_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Public read access for reference data
CREATE POLICY "Public read concepts" ON concepts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read sections" ON sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read problems" ON problems FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read problem_steps" ON problem_steps FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- VIEWS FOR ANALYTICS
-- =============================================================================

-- User progress per section
CREATE OR REPLACE VIEW user_section_progress AS
SELECT 
    s.user_id,
    sec.id AS section_id,
    sec.course,
    sec.chapter,
    sec.section,
    sec.title,
    COUNT(DISTINCT a.problem_id) AS problems_attempted,
    COUNT(DISTINCT CASE WHEN a.is_correct THEN a.problem_id END) AS problems_correct,
    AVG(CASE WHEN a.is_correct THEN 1.0 ELSE 0.0 END) AS accuracy_rate,
    COUNT(DISTINCT se.id) AS stuck_events,
    MAX(a.created_at) AS last_activity
FROM learning_sessions s
JOIN sections sec ON s.section_id = sec.id
LEFT JOIN attempts a ON a.user_id = s.user_id AND a.problem_id IN (
    SELECT id FROM problems WHERE section_id = sec.id
)
LEFT JOIN stuck_events se ON se.user_id = s.user_id AND se.section_id = sec.id
GROUP BY s.user_id, sec.id, sec.course, sec.chapter, sec.section, sec.title;

-- Concept mastery summary
CREATE OR REPLACE VIEW concept_mastery_summary AS
SELECT 
    c.id AS concept_id,
    c.name,
    m.user_id,
    m.mastery_score,
    m.attempts_count,
    m.correct_count,
    m.confidence_level,
    m.misconception_flags,
    m.last_practiced_at
FROM concepts c
LEFT JOIN mastery m ON c.id = m.concept_id;

-- =============================================================================
-- HIGHLIGHTS TABLE (협업 하이라이팅)
-- =============================================================================
CREATE TABLE IF NOT EXISTS highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,           -- "statics/01/01"
    start_offset INT NOT NULL,          -- 시작 위치 (텍스트 오프셋)
    end_offset INT NOT NULL,            -- 끝 위치
    text_content TEXT NOT NULL,         -- 하이라이트된 텍스트 (검증 및 표시용)
    color TEXT DEFAULT 'yellow',        -- 하이라이트 색상
    note TEXT,                          -- 사용자 메모 (선택)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_section ON highlights(section_id);
CREATE INDEX IF NOT EXISTS idx_highlights_text ON highlights(text_content);

-- RLS 정책
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 하이라이트만 수정/삭제 가능
CREATE POLICY "Users can manage own highlights" ON highlights
    FOR ALL USING (auth.uid() = user_id);

-- 모든 인증된 사용자는 모든 하이라이트를 읽을 수 있음 (협업 기능을 위해)
CREATE POLICY "Authenticated users can read all highlights" ON highlights
    FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- POPULAR HIGHLIGHTS VIEW (인기 하이라이트 집계)
-- =============================================================================
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
HAVING COUNT(DISTINCT user_id) >= 2;  -- 2명 이상이 하이라이트한 것만

-- Grant access to view
GRANT SELECT ON popular_highlights TO authenticated;
