-- Privacy-safe Unity/Web simulation export for the engineering intervention.
-- Raw free-response fields are never selected. This is an offline research
-- export: only the service role may read it, and security_invoker ensures the
-- caller's underlying-table privileges/RLS semantics remain authoritative.

create or replace view public.engineering_sim_event_export
with (security_invoker = true) as
select
  pg_catalog.encode(extensions.digest('alget-engineering-sim-v1:' || events.user_id::text, 'sha256'), 'hex') as actor_hash,
  pg_catalog.encode(extensions.digest('alget-study-link-v1:' || lower(trim(learners.learner_hash)), 'sha256'), 'hex') as study_link_hash,
  arms.arm_key as assignment_arm,
  experiments.experiment_key,
  events.session_id,
  events.course_id,
  events.section_id,
  events.event_type,
  events.event_ts,
  events.client_seq,
  jsonb_strip_nulls(jsonb_build_object(
    'source_app', payload->'data'->>'source_app',
    'source_schema', payload->'data'->>'source_schema',
    'app_id', payload->'data'->>'app_id',
    'event_name', payload->'data'->>'event_name',
    'opportunity_index', case when payload->'data'->>'opportunity_index' ~ '^[0-9]+$' then (payload->'data'->>'opportunity_index')::int end,
    'opportunities_completed', case when payload->'data'->>'opportunities_completed' ~ '^[0-9]+$' then (payload->'data'->>'opportunities_completed')::int end,
    'opportunities_available', case when payload->'data'->>'opportunities_available' ~ '^[0-9]+$' then (payload->'data'->>'opportunities_available')::int end,
    'normalized_opportunity_progress', case when payload->'data'->>'normalized_opportunity_progress' ~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' then (payload->'data'->>'normalized_opportunity_progress')::numeric end,
    'input_name', case when payload->'data'->>'input_name' ~ '^[A-Za-z0-9_,.-]{1,160}$' then payload->'data'->>'input_name' end,
    'prediction', case when nullif(trim(payload->'data'->>'prediction'), '') is not null then pg_catalog.encode(extensions.digest('alget-sim-category-v1:' || lower(trim(payload->'data'->>'prediction')), 'sha256'), 'hex') end,
    'confidence', case when payload->'data'->>'confidence' ~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' and (payload->'data'->>'confidence')::numeric between 0 and 100 then (payload->'data'->>'confidence')::numeric end,
    'result', case when nullif(trim(payload->'data'->>'result'), '') is not null then pg_catalog.encode(extensions.digest('alget-sim-category-v1:' || lower(trim(payload->'data'->>'result')), 'sha256'), 'hex') end,
    'constraint_violation', case when nullif(trim(payload->'data'->>'constraint_flags'), '') is null or lower(trim(payload->'data'->>'constraint_flags')) in ('none', 'ok', 'pass') then false else true end,
    'revision_attempt', case when payload->'data'->>'revision_attempt' ~ '^[0-9]+$' then (payload->'data'->>'revision_attempt')::int end,
    'is_final_design', case when lower(payload->'data'->>'is_final_design') in ('true', 'false') then (payload->'data'->>'is_final_design')::boolean end,
    'competency_score', case when payload->'data'->>'competency_score' ~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' and (payload->'data'->>'competency_score')::numeric between 0 and 100 then (payload->'data'->>'competency_score')::numeric end
  )) as payload
from public.interaction_events events
join public.cohort_learners learners on learners.user_id = events.user_id
  and learners.cohort_id = 'bio-inspired-intervention-2026'
  and learners.course_id = 'bio-inspired'
left join public.experiment_assignments assignments on assignments.user_id = events.user_id
  and assignments.experiment_id = (
    select id from public.experiments where experiment_key = 'alget-bio-inspired-agentic-rct-v1'
  )
left join public.experiment_arms arms on arms.id = assignments.arm_id
left join public.experiments experiments on experiments.id = assignments.experiment_id
where events.course_id = 'bio-inspired'
  and (
    events.event_type like 'sim_unity_%'
    or events.event_type in ('sim_open', 'sim_close', 'sim_design', 'sim_mastery')
  );

comment on view public.engineering_sim_event_export is
  'Pseudonymized Bio-Inspired research-cohort simulation export with one study assignment per event. Choice labels are domain-separated hashes and constraint state is derived. Excludes input values, detail, finalDesign, free response, device data, names, contact data, nonstudy learners, other courses, and direct identifiers.';

revoke all on public.engineering_sim_event_export from public, anon, authenticated;
grant select on public.engineering_sim_event_export to service_role;
