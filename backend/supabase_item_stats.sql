-- ============================================================================
-- ALGET Derived Per-Item Analytics (plan item 9)
-- Execute this in the Supabase SQL Editor AFTER supabase_logging.sql.
-- ============================================================================
--
-- Materializes cohort-calibrated per-problem statistics over the EXISTING
-- event_logs firehose (no new write path, no schema change to event_logs).
-- This mirrors the Runestone derived-item-stats discipline (pct_on_first /
-- attempt count / mean clicks-to-correct) so the fusion policy and authors get
-- fast per-item stats without re-aggregating the event log on every read.
--
-- Source rows: event_logs WHERE event_type = 'problem_attempt', whose JSONB
-- event_data is logged by frontend logProblemAttempt() as:
--     { "problem_id": <text>, "is_correct": <bool>,
--       "time_spent_ms": <int>, "hint_used": <bool> }
-- and whose section_id column carries the owning section slug.
--
-- The view is a plain (non-materialized) VIEW so it is always live and needs no
-- refresh job at 8 courses / 256 sections; swap to MATERIALIZED VIEW + a
-- scheduled REFRESH only if the firehose volume ever makes this expensive.
-- ============================================================================

-- 1. Normalized per-attempt projection.
--    Extracts the typed fields out of the JSONB event_data and assigns each
--    (user, problem) its attempt ordinal by sequence_num, so "first attempt"
--    is well-defined per learner. Keyed on the STABLE problem_id surrogate
--    carried in event_data (never on a mutable display name).
DROP VIEW IF EXISTS item_problem_attempts CASCADE;
CREATE OR REPLACE VIEW item_problem_attempts
WITH (security_invoker = true) AS
SELECT
    e.user_id,
    e.session_id,
    e.section_id,
    (e.event_data ->> 'problem_id')                         AS problem_id,
    (e.event_data ->> 'is_correct')::boolean                AS is_correct,
    NULLIF(e.event_data ->> 'time_spent_ms', '')::numeric   AS time_spent_ms,
    (e.event_data ->> 'hint_used')::boolean                 AS hint_used,
    e.client_ts,
    e.sequence_num,
    ROW_NUMBER() OVER (
        PARTITION BY e.user_id, (e.event_data ->> 'problem_id')
        ORDER BY e.sequence_num
    )                                                       AS attempt_ordinal
FROM event_logs e
WHERE e.event_type = 'problem_attempt'
  AND (e.event_data ->> 'problem_id') IS NOT NULL;

-- 2. Derived per-problem statistics.
--      * attempt_count                 — total logged attempts for the item.
--      * learner_count                 — distinct learners who attempted it.
--      * first_attempt_correct_rate    — fraction of learners correct on their
--                                        FIRST attempt (Runestone pct_on_first).
--      * correct_count                 — total correct attempts (any ordinal).
--      * overall_correct_rate          — correct attempts / all attempts.
--      * mean_time_to_correct_ms       — mean time_spent_ms over CORRECT attempts.
--      * mean_attempts_to_correct      — mean attempt_ordinal at first correct.
--    section_id is taken as the modal (most frequent) section for the item so a
--    single problem_id surfaces under one section even if logged from variants.
DROP VIEW IF EXISTS item_problem_stats CASCADE;
CREATE OR REPLACE VIEW item_problem_stats
WITH (security_invoker = true) AS
WITH first_attempts AS (
    SELECT problem_id, user_id, is_correct
    FROM item_problem_attempts
    WHERE attempt_ordinal = 1
),
first_correct AS (
    -- attempt_ordinal of each learner's earliest correct attempt on the item
    SELECT problem_id, user_id, MIN(attempt_ordinal) AS attempts_to_correct
    FROM item_problem_attempts
    WHERE is_correct IS TRUE
    GROUP BY problem_id, user_id
),
section_mode AS (
    SELECT DISTINCT ON (problem_id)
        problem_id,
        section_id
    FROM item_problem_attempts
    WHERE section_id IS NOT NULL
    GROUP BY problem_id, section_id
    ORDER BY problem_id, COUNT(*) DESC
)
SELECT
    a.problem_id,
    sm.section_id,
    COUNT(*)                                                       AS attempt_count,
    COUNT(DISTINCT a.user_id)                                      AS learner_count,
    COALESCE(
        AVG(CASE WHEN fa.is_correct THEN 1.0 ELSE 0.0 END),
        0
    )                                                              AS first_attempt_correct_rate,
    COUNT(*) FILTER (WHERE a.is_correct IS TRUE)                   AS correct_count,
    COALESCE(
        AVG(CASE WHEN a.is_correct THEN 1.0 ELSE 0.0 END),
        0
    )                                                              AS overall_correct_rate,
    AVG(a.time_spent_ms) FILTER (WHERE a.is_correct IS TRUE)       AS mean_time_to_correct_ms,
    (SELECT AVG(attempts_to_correct) FROM first_correct fc
        WHERE fc.problem_id = a.problem_id)                        AS mean_attempts_to_correct
FROM item_problem_attempts a
LEFT JOIN first_attempts fa
    ON fa.problem_id = a.problem_id AND fa.user_id = a.user_id
LEFT JOIN section_mode sm
    ON sm.problem_id = a.problem_id
GROUP BY a.problem_id, sm.section_id;

-- 3. RLS / access — consistent with the rest of the schema.
--    Both objects are security_invoker views, so the querying user's own RLS on
--    event_logs ("auth.uid() = user_id") is enforced transitively: a learner
--    sees only stats derived from their own rows; aggregate cohort reads require
--    a service-role/elevated context exactly as the other research views do.
--    Anon (public API key) is explicitly revoked so cohort aggregates never leak
--    to an unauthenticated client; authenticated clients receive SELECT.
REVOKE ALL ON item_problem_attempts FROM anon;
REVOKE ALL ON item_problem_stats FROM anon;

GRANT SELECT ON item_problem_attempts TO authenticated;
GRANT SELECT ON item_problem_stats TO authenticated;

-- Success
SELECT 'Item-stats views created successfully!' AS status;
