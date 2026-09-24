-- Privacy-preserving process and sequence mining for the Research Console.
-- The RPCs expose cohort aggregates only; raw event rows and learner IDs remain private.

CREATE TABLE IF NOT EXISTS public.process_mining_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filters jsonb NOT NULL DEFAULT '{}'::jsonb,
    summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    result jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'awaiting_review'
        CHECK (status IN ('awaiting_review', 'approved', 'revision_requested', 'rejected'))
);

CREATE TABLE IF NOT EXISTS public.process_mining_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.process_mining_runs(id) ON DELETE CASCADE,
    reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL CHECK (status IN ('approved', 'revision_requested', 'rejected')),
    checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
    notes text NOT NULL DEFAULT '',
    UNIQUE (run_id, reviewer_id)
);

ALTER TABLE public.process_mining_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_mining_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Instructors read process mining runs" ON public.process_mining_runs;
CREATE POLICY "Instructors read process mining runs" ON public.process_mining_runs
    FOR SELECT TO authenticated USING (public.is_alget_instructor());
DROP POLICY IF EXISTS "Instructors read process mining reviews" ON public.process_mining_reviews;
CREATE POLICY "Instructors read process mining reviews" ON public.process_mining_reviews
    FOR SELECT TO authenticated USING (public.is_alget_instructor());
REVOKE ALL ON public.process_mining_runs FROM anon, authenticated;
REVOKE ALL ON public.process_mining_reviews FROM anon, authenticated;
GRANT SELECT ON public.process_mining_runs, public.process_mining_reviews TO authenticated;

CREATE OR REPLACE FUNCTION public.analyze_learning_sequences(
    p_course_id text DEFAULT NULL,
    p_module text DEFAULT NULL,
    p_from timestamptz DEFAULT NULL,
    p_to timestamptz DEFAULT NULL,
    p_event_types text[] DEFAULT NULL,
    p_min_learners integer DEFAULT 5,
    p_max_sequence_length integer DEFAULT 4
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_actor uuid := auth.uid();
    v_allowed text[] := ARRAY[
        'page_view','problem_attempt','hint_request','chat_message','stuck_event',
        'recommendation_decision','time_on_task','highlight_create','sim_open','sim_close',
        'support_request','support_tab_select','intervention_trace','evaluation_artifact',
        'assessment_generate_request','assessment_generate_success','inline_check_attempt',
        'structural_interaction','content_audit','learner_model_update'
    ];
    v_types text[];
    v_result jsonb;
    v_summary jsonb;
    v_total bigint;
    v_scoped bigint;
    v_learners bigint;
    v_sessions bigint;
    v_run_id uuid;
BEGIN
    IF v_actor IS NULL OR NOT public.is_alget_instructor() THEN
        RAISE EXCEPTION 'instructor_access_required' USING ERRCODE = '42501';
    END IF;
    IF p_min_learners IS NULL OR p_min_learners < 5 OR p_min_learners > 100 THEN
        RAISE EXCEPTION 'minimum_cohort_threshold_must_be_5_to_100' USING ERRCODE = '22023';
    END IF;
    IF p_max_sequence_length IS NULL OR p_max_sequence_length < 2 OR p_max_sequence_length > 6 THEN
        RAISE EXCEPTION 'sequence_length_must_be_2_to_6' USING ERRCODE = '22023';
    END IF;
    v_types := CASE WHEN p_event_types IS NULL OR cardinality(p_event_types) = 0
        THEN v_allowed
        ELSE ARRAY(SELECT unnest(p_event_types) INTERSECT SELECT unnest(v_allowed)) END;

    WITH all_events AS (
        SELECT e.* FROM public.event_logs e
        WHERE (p_from IS NULL OR e.client_ts >= p_from)
          AND (p_to IS NULL OR e.client_ts < p_to)
    ), scoped AS (
        SELECT e.*, split_part(e.section_id, '/', 1) AS course_id,
               split_part(e.section_id, '/', 2) AS module_id
        FROM all_events e
        WHERE e.section_id IS NOT NULL
          AND e.event_type = ANY(v_types)
          AND (p_course_id IS NULL OR split_part(e.section_id, '/', 1) = p_course_id)
          AND (p_module IS NULL OR split_part(e.section_id, '/', 2) = p_module)
    )
    SELECT (SELECT count(*) FROM all_events), (SELECT count(*) FROM scoped),
           (SELECT count(DISTINCT user_id) FROM scoped),
           (SELECT count(DISTINCT session_id) FROM scoped)
    INTO v_total, v_scoped, v_learners, v_sessions;

    IF v_learners < p_min_learners THEN
        v_summary := jsonb_build_object(
            'suppressed', true, 'minimumLearners', p_min_learners,
            'learnerCount', NULL, 'events', NULL, 'sessions', NULL,
            'scopedEvents', NULL, 'missingSectionPercent', NULL
        );
        v_result := jsonb_build_object('dataQuality', v_summary, 'directlyFollows', '[]'::jsonb,
            'variants', '[]'::jsonb, 'sequences', '[]'::jsonb);
    ELSE
        v_summary := jsonb_build_object(
            'suppressed', false, 'minimumLearners', p_min_learners,
            'learnerCount', v_learners, 'events', v_total, 'sessions', v_sessions,
            'scopedEvents', v_scoped,
            'missingSectionPercent', CASE WHEN v_total = 0 THEN 0 ELSE round(100.0 * (v_total -
                (SELECT count(*) FROM public.event_logs e WHERE e.section_id IS NOT NULL
                 AND (p_from IS NULL OR e.client_ts >= p_from) AND (p_to IS NULL OR e.client_ts < p_to))) / v_total, 1) END
        );
        WITH scoped AS (
            SELECT e.*, split_part(e.section_id, '/', 1) AS course_id,
                   split_part(e.section_id, '/', 2) AS module_id
            FROM public.event_logs e
            WHERE e.section_id IS NOT NULL AND e.event_type = ANY(v_types)
              AND (p_from IS NULL OR e.client_ts >= p_from) AND (p_to IS NULL OR e.client_ts < p_to)
              AND (p_course_id IS NULL OR split_part(e.section_id, '/', 1) = p_course_id)
              AND (p_module IS NULL OR split_part(e.section_id, '/', 2) = p_module)
        ), eligible AS (
            SELECT * FROM scoped WHERE user_id IN (SELECT DISTINCT user_id FROM scoped)
        ), ordered AS (
            SELECT *, lag(event_type) OVER (PARTITION BY session_id, section_id ORDER BY sequence_num) AS prev_type,
                lag(client_ts) OVER (PARTITION BY session_id, section_id ORDER BY sequence_num) AS prev_ts,
                row_number() OVER (PARTITION BY session_id, section_id ORDER BY sequence_num) AS pos
            FROM eligible
        ), dfg AS (
            SELECT prev_type AS source, event_type AS target, count(*) AS transitions,
                   count(DISTINCT user_id) AS learners,
                   percentile_cont(0.5) WITHIN GROUP (ORDER BY greatest(0, extract(epoch FROM client_ts - prev_ts))) AS median_seconds
            FROM ordered WHERE prev_type IS NOT NULL AND client_ts >= prev_ts
            GROUP BY prev_type, event_type HAVING count(DISTINCT user_id) >= p_min_learners
            ORDER BY transitions DESC LIMIT 25
        ), paths AS (
            SELECT session_id, section_id, user_id, array_agg(event_type ORDER BY sequence_num) AS path
            FROM eligible GROUP BY session_id, section_id, user_id
        ), variants AS (
            SELECT path, count(DISTINCT user_id) AS learners, count(*) AS cases
            FROM paths GROUP BY path HAVING count(DISTINCT user_id) >= p_min_learners
            ORDER BY learners DESC, cases DESC LIMIT 20
        ), ngrams AS (
            SELECT o.user_id, o.session_id, o.section_id, o.pos,
                   array_agg(n.event_type ORDER BY n.pos) AS sequence
            FROM ordered o JOIN ordered n ON n.session_id = o.session_id AND n.section_id = o.section_id
                AND n.pos BETWEEN o.pos AND o.pos + p_max_sequence_length - 1
            GROUP BY o.user_id, o.session_id, o.section_id, o.pos
            HAVING count(*) >= 2
        ), sequence_support AS (
            SELECT sequence, count(DISTINCT user_id) AS learners, count(*) AS occurrences
            FROM ngrams GROUP BY sequence HAVING count(DISTINCT user_id) >= p_min_learners
            ORDER BY learners DESC, occurrences DESC LIMIT 30
        )
        SELECT jsonb_build_object(
            'dataQuality', v_summary,
            'directlyFollows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'source', source, 'target', target, 'transitions', transitions, 'learners', learners,
                'medianSeconds', round(median_seconds::numeric, 1)) ORDER BY transitions DESC) FROM dfg), '[]'::jsonb),
            'variants', COALESCE((SELECT jsonb_agg(jsonb_build_object('events', path, 'learners', learners, 'cases', cases)
                ORDER BY learners DESC) FROM variants), '[]'::jsonb),
            'sequences', COALESCE((SELECT jsonb_agg(jsonb_build_object('events', sequence, 'learners', learners, 'occurrences', occurrences)
                ORDER BY learners DESC) FROM sequence_support), '[]'::jsonb)
        ) INTO v_result;
    END IF;

    INSERT INTO public.process_mining_runs(created_by, filters, summary, result)
    VALUES (v_actor, jsonb_build_object('courseId', p_course_id, 'module', p_module, 'from', p_from,
        'to', p_to, 'eventTypes', v_types, 'minimumLearners', p_min_learners,
        'maxSequenceLength', p_max_sequence_length), v_summary, v_result)
    RETURNING id INTO v_run_id;
    RETURN v_result || jsonb_build_object('runId', v_run_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_process_mining_run(
    p_run_id uuid, p_status text, p_checklist jsonb DEFAULT '{}'::jsonb, p_notes text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_actor uuid := auth.uid(); v_owner uuid;
BEGIN
    IF v_actor IS NULL OR NOT public.is_alget_instructor() THEN
        RAISE EXCEPTION 'instructor_access_required' USING ERRCODE = '42501';
    END IF;
    IF p_status NOT IN ('approved','revision_requested','rejected') THEN
        RAISE EXCEPTION 'invalid_review_status' USING ERRCODE = '22023';
    END IF;
    SELECT created_by INTO v_owner FROM public.process_mining_runs WHERE id = p_run_id FOR UPDATE;
    IF v_owner IS NULL THEN RAISE EXCEPTION 'run_not_found' USING ERRCODE = 'P0002'; END IF;
    IF v_owner = v_actor THEN RAISE EXCEPTION 'independent_review_required' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.process_mining_reviews(run_id, reviewer_id, status, checklist, notes)
    VALUES (p_run_id, v_actor, p_status, COALESCE(p_checklist, '{}'::jsonb), left(COALESCE(p_notes, ''), 2000))
    ON CONFLICT (run_id, reviewer_id) DO UPDATE SET status = EXCLUDED.status,
        checklist = EXCLUDED.checklist, notes = EXCLUDED.notes, created_at = now();
    UPDATE public.process_mining_runs SET status = p_status WHERE id = p_run_id;
    RETURN jsonb_build_object('runId', p_run_id, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_process_mining_runs(p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_alget_instructor() THEN
        RAISE EXCEPTION 'instructor_access_required' USING ERRCODE = '42501';
    END IF;
    RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'createdAt', r.created_at, 'status', r.status, 'filters', r.filters,
        'summary', r.summary, 'result', r.result, 'isOwner', r.created_by = auth.uid(),
        'reviews', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', v.status,
            'checklist', v.checklist, 'notes', v.notes, 'createdAt', v.created_at) ORDER BY v.created_at DESC)
            FROM public.process_mining_reviews v WHERE v.run_id = r.id), '[]'::jsonb),
        'reviewCount', (SELECT count(*) FROM public.process_mining_reviews v WHERE v.run_id = r.id)
    ) ORDER BY r.created_at DESC) FROM (
        SELECT * FROM public.process_mining_runs ORDER BY created_at DESC LIMIT greatest(1, least(p_limit, 50))
    ) r), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.analyze_learning_sequences(text,text,timestamptz,timestamptz,text[],integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_process_mining_run(uuid,text,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_process_mining_runs(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analyze_learning_sequences(text,text,timestamptz,timestamptz,text[],integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_process_mining_run(uuid,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_process_mining_runs(integer) TO authenticated;
