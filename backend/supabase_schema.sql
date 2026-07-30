-- ALGET Supabase Schema
-- OpenStax-style intelligent textbook database

-- =============================================================================
-- CONCEPTS TABLE (REFERENCE DATA - NOT EDITED BY THE LLM)
-- =============================================================================
CREATE TABLE IF NOT EXISTS concepts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    definition TEXT,
    formula TEXT,
    formula_latex TEXT,
    misconception_triggers TEXT[],  -- Common misconception patterns
    related_concepts TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed core statics concepts
INSERT INTO concepts (id, name, definition, formula, formula_latex, misconception_triggers, related_concepts) VALUES
    ('equilibrium', 'Equilibrium', 'A state where the net force on a body is zero', 'Sigma F = 0', '\\sum \\vec{F} = 0',
     ARRAY['confusing equilibrium with rest', 'forgetting reaction forces'],
     ARRAY['sum_of_forces', 'fbd']),
    ('sum_of_forces', 'Sum of Forces', 'Vector addition of all forces acting on a body', 'Sigma Fx = 0, Sigma Fy = 0', '\\sum F_x = 0, \\sum F_y = 0',
     ARRAY['not breaking into components', 'wrong sign convention'],
     ARRAY['equilibrium', 'tension']),
    ('fbd', 'Free Body Diagram', 'A diagram showing all external forces on an isolated body', NULL, NULL,
     ARRAY['missing forces', 'including internal forces', 'wrong direction'],
     ARRAY['equilibrium', 'tension']),
    ('tension', 'Tension', 'A pulling force transmitted through a string, cable, or rope', 'T', 'T',
     ARRAY['confusing tension direction', 'assuming tension equals weight in every case'],
     ARRAY['equilibrium', 'sum_of_forces'])
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SECTIONS TABLE (TEXTBOOK SECTION METADATA)
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

-- Seed statics section 1.1
INSERT INTO sections (course, chapter, section, title, description, concept_ids, learning_objectives, estimated_time_minutes) VALUES
    ('statics', 1, 1, 'Equilibrium Conditions', 'Introduction to equilibrium for particles',
     ARRAY['equilibrium', 'sum_of_forces', 'fbd', 'tension'],
     ARRAY['Define equilibrium for a particle', 'Apply Sigma F = 0 to solve for unknown forces', 'Construct and interpret free body diagrams'],
     25)
ON CONFLICT (course, chapter, section) DO NOTHING;

-- =============================================================================
-- PROBLEMS TABLE (PROBLEM DEFINITIONS)
-- =============================================================================
CREATE TABLE IF NOT EXISTS problems (
    id TEXT PRIMARY KEY,
    section_id INT REFERENCES sections(id),
    problem_type TEXT NOT NULL DEFAULT 'numeric',  -- numeric, multiple_choice, free_response
    difficulty TEXT DEFAULT 'medium',  -- easy, medium, challenging
    statement TEXT NOT NULL,
    givens_schema JSONB,  -- Example: {"mass": "50 kg", "angle": "45 degrees"}
    solver_id TEXT,  -- Reference to solver function
    solver_params JSONB,  -- Parameters to pass to solver
    expected_value FLOAT,
    expected_unit TEXT,
    tolerance FLOAT DEFAULT 0.02,
    require_unit BOOLEAN DEFAULT TRUE,
    hint TEXT,
    explanation TEXT,
    q_matrix JSONB,  -- {"concept_id": weight} mappings for multidimensional grading
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed sample problems
INSERT INTO problems (id, section_id, problem_type, difficulty, statement, givens_schema, solver_id, solver_params, expected_value, expected_unit, tolerance, require_unit, hint) VALUES
    ('p001', 1, 'numeric', 'medium',
     'A 50 kg object is suspended by a single cable at an angle of 45 degrees from horizontal. Calculate the tension in the cable.',
     '{"mass": "50 kg", "angle": "45 degrees", "g": "9.81 m/s^2"}'::jsonb,
     'statics_tension_inclined',
     '{"mass": 50, "angle_deg": 45}'::jsonb,
     693.67, 'N', 0.02, TRUE,
     'Use Sigma Fy = 0. The vertical component of tension, T*sin(45 degrees), must equal the weight mg.'),
    ('p002', 1, 'numeric', 'easy',
     'A 25 kg lamp hangs vertically from a single cable. What is the tension in the cable?',
     '{"mass": "25 kg", "g": "9.81 m/s^2"}'::jsonb,
     'statics_tension_vertical',
     '{"mass": 25}'::jsonb,
     245.25, 'N', 0.01, TRUE,
     'For a vertically hanging object, the tension equals the weight.')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PROBLEM_STEPS TABLE (STEP-BY-STEP SOLUTION STRUCTURE)
-- =============================================================================
CREATE TABLE IF NOT EXISTS problem_steps (
    id SERIAL PRIMARY KEY,
    problem_id TEXT REFERENCES problems(id) ON DELETE CASCADE,
    step_index INT NOT NULL,
    step_type TEXT DEFAULT 'calculation',  -- calculation, diagram, explanation
    description TEXT NOT NULL,
    expected_value FLOAT,
    expected_unit TEXT,
    partial_credit_rule JSONB,  -- Example: {"weight": 0.3, "accept_if_close": true}
    UNIQUE(problem_id, step_index)
);

-- Seed problem steps for p001 and p002
INSERT INTO problem_steps (problem_id, step_index, step_type, description, expected_value, expected_unit) VALUES
    ('p001', 1, 'calculation', 'Calculate the weight W = mg', 490.5, 'N'),
    ('p001', 2, 'calculation', 'Apply Sigma Fy = 0 and solve for T', 693.67, 'N'),
    ('p002', 1, 'calculation', 'Calculate T = mg', 245.25, 'N')
ON CONFLICT (problem_id, step_index) DO NOTHING;

-- =============================================================================
-- ATTEMPTS TABLE (STUDENT ANSWER RECORDS)
-- =============================================================================
CREATE TABLE IF NOT EXISTS attempts (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id TEXT REFERENCES problems(id),
    step_index INT,  -- NULL when answering the final answer only
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

-- Attempt indexes
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_problem ON attempts(problem_id);
CREATE INDEX IF NOT EXISTS idx_attempts_created ON attempts(created_at);

-- =============================================================================
-- STUCK_EVENTS TABLE (LEARNER STRUGGLE SIGNALS)
-- =============================================================================
CREATE TABLE IF NOT EXISTS stuck_events (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    section_id INT REFERENCES sections(id),
    problem_id TEXT REFERENCES problems(id),
    reason TEXT NOT NULL,  -- consecutive_wrong, idle_timeout, unit_error, hint_requests
    consecutive_wrong_count INT,
    idle_duration_seconds INT,
    context JSONB,  -- Additional context data
    rail_opened BOOLEAN DEFAULT FALSE,
    rail_action_taken TEXT,  -- explain, represent, practice, none
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stuck_user ON stuck_events(user_id);
CREATE INDEX IF NOT EXISTS idx_stuck_section ON stuck_events(section_id);
CREATE INDEX IF NOT EXISTS idx_stuck_created ON stuck_events(created_at);

-- =============================================================================
-- MASTERY TABLE (CONCEPT MASTERY STATE)
-- =============================================================================
CREATE TABLE IF NOT EXISTS mastery (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    concept_id TEXT REFERENCES concepts(id),
    mastery_score FLOAT DEFAULT 0.0,  -- 0.0 to 1.0 (legacy or aggregate)
    p_known FLOAT DEFAULT 0.1,        -- BKT: probability the student knows the concept
    p_guess FLOAT DEFAULT 0.2,        -- BKT: probability of a correct answer without knowing
    p_slip FLOAT DEFAULT 0.1,         -- BKT: probability of an error despite knowing
    p_transit FLOAT DEFAULT 0.1,      -- BKT: probability of learning after an attempt
    attempts_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    last_practiced_at TIMESTAMPTZ,
    misconception_flags TEXT[],       -- Detected misconceptions
    confidence_level TEXT DEFAULT 'low',  -- low, medium, high
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, concept_id)
);

-- =============================================================================
-- LEARNING_SESSIONS TABLE (LEARNING SESSION LOG)
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

ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stuck_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;

-- Users can access only their own learner data
DROP POLICY IF EXISTS "Users can view own attempts" ON attempts;
CREATE POLICY "Users can view own attempts" ON attempts
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own attempts" ON attempts;
CREATE POLICY "Users can insert own attempts" ON attempts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own stuck_events" ON stuck_events;
CREATE POLICY "Users can view own stuck_events" ON stuck_events
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own stuck_events" ON stuck_events;
CREATE POLICY "Users can insert own stuck_events" ON stuck_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own mastery" ON mastery;
DROP POLICY IF EXISTS "Users can update own mastery" ON mastery;
DROP POLICY IF EXISTS "users read own mastery" ON mastery;
DROP POLICY IF EXISTS "users insert own mastery" ON mastery;
DROP POLICY IF EXISTS "users update own mastery" ON mastery;
CREATE POLICY "users read own mastery" ON mastery
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "users insert own mastery" ON mastery
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "users update own mastery" ON mastery
    FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE mastery FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE mastery TO authenticated;

DROP POLICY IF EXISTS "Users can manage own sessions" ON learning_sessions;
CREATE POLICY "Users can manage own sessions" ON learning_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Public read access for reference data
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read concepts" ON concepts;
CREATE POLICY "Public read concepts" ON concepts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read sections" ON sections;
CREATE POLICY "Public read sections" ON sections FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read problems" ON problems;
CREATE POLICY "Public read problems" ON problems FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read problem_steps" ON problem_steps;
CREATE POLICY "Public read problem_steps" ON problem_steps FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- VIEWS FOR ANALYTICS
-- =============================================================================

-- User progress per section
DROP VIEW IF EXISTS user_section_progress;
CREATE OR REPLACE VIEW user_section_progress WITH (security_invoker = true) AS
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
DROP VIEW IF EXISTS concept_mastery_summary;
CREATE OR REPLACE VIEW concept_mastery_summary WITH (security_invoker = true) AS
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
-- HIGHLIGHTS TABLE (COLLABORATIVE HIGHLIGHTING)
-- =============================================================================
CREATE TABLE IF NOT EXISTS highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,           -- Example: "statics/01/01"
    start_offset INT NOT NULL,          -- Start position in the source text
    end_offset INT NOT NULL,            -- End position in the source text
    text_content TEXT NOT NULL,         -- Highlighted text for display and verification
    color TEXT DEFAULT 'yellow',        -- Highlight color
    note TEXT,                          -- Optional learner note
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_section ON highlights(section_id);
CREATE INDEX IF NOT EXISTS idx_highlights_text ON highlights(text_content);

ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own highlights" ON highlights;
CREATE POLICY "Users can manage own highlights" ON highlights
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can read all highlights" ON highlights;
CREATE POLICY "Authenticated users can read all highlights" ON highlights
    FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- POPULAR HIGHLIGHTS VIEW (AGGREGATED SOCIAL HIGHLIGHTS)
-- =============================================================================
DROP VIEW IF EXISTS popular_highlights;
CREATE OR REPLACE VIEW popular_highlights WITH (security_invoker = true) AS
SELECT
    section_id,
    text_content,
    MIN(start_offset) AS start_offset,
    MAX(end_offset) AS end_offset,
    COUNT(DISTINCT user_id) AS highlight_count,
    ARRAY_AGG(DISTINCT user_id) AS user_ids
FROM highlights
GROUP BY section_id, text_content
HAVING COUNT(DISTINCT user_id) >= 2;  -- At least two learners highlighted the same text

REVOKE ALL ON user_section_progress, concept_mastery_summary, popular_highlights FROM anon;
GRANT SELECT ON user_section_progress, concept_mastery_summary, popular_highlights TO authenticated;
