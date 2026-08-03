-- Privacy-safe export surface for the ALGET pilot.
-- The operational event tables remain richer; this view is the only surface
-- intended for research exports and removes direct learner identifiers and
-- free-text payload keys.

create or replace view public.research_pilot_event_export
with (security_invoker = true) as
select
  id,
  encode(digest('alget-pilot-v1:' || user_id::text, 'sha256'), 'hex') as actor_hash,
  session_id,
  course_id,
  section_id,
  event_type,
  event_ts,
  client_seq,
  jsonb_strip_nulls(
    case event_type
      when 'section_opened' then jsonb_build_object('mode', payload->'data'->>'mode', 'device_class', payload->'data'->>'device_class')
      when 'section_completed' then jsonb_build_object('elapsed_bucket', payload->'data'->>'elapsed_bucket')
      when 'evidence_echo_opened' then jsonb_build_object('source_count', (payload->'data'->>'source_count')::int)
      when 'peer_pulse_seen' then jsonb_build_object('peer_count_bucket', payload->'data'->>'peer_count_bucket')
      when 'your_cue_selected' then jsonb_build_object('cue_type', payload->'data'->>'cue_type')
      when 'social_round_started' then jsonb_build_object('activity_type', payload->'data'->>'activity_type')
      when 'social_evidence_compared' then jsonb_build_object('evidence_submitted', (payload->'data'->>'evidence_submitted')::boolean, 'rubric_score', (payload->'data'->>'rubric_score')::numeric)
      when 'tutor_opened' then jsonb_build_object('intent', payload->'data'->>'intent')
      when 'tutor_source_opened' then jsonb_build_object('citation_id', payload->'data'->>'citation_id')
      when 'assessment_submitted' then jsonb_build_object('score', (payload->'data'->>'score')::numeric, 'attempt_bucket', payload->'data'->>'attempt_bucket')
      when 'artifact_trace_submitted' then jsonb_build_object('quality_score', (payload->'data'->>'quality_score')::numeric, 'trace_complete', (payload->'data'->>'trace_complete')::boolean)
      when 'instructor_reviewed_draft' then jsonb_build_object('decision', payload->'data'->>'decision', 'correction_count', (payload->'data'->>'correction_count')::int)
      when 'module_published' then jsonb_build_object('version', payload->'data'->>'version', 'source_count', (payload->'data'->>'source_count')::int)
      else '{}'::jsonb
    end
  ) as payload
from public.interaction_events
where event_type in (
  'section_opened', 'section_completed', 'evidence_echo_opened',
  'peer_pulse_seen', 'your_cue_selected', 'social_round_started',
  'social_evidence_compared', 'tutor_opened', 'tutor_source_opened',
  'assessment_submitted', 'artifact_trace_submitted',
  'instructor_reviewed_draft', 'module_published'
);

comment on view public.research_pilot_event_export is
  'Privacy-safe ALGET pilot export: hashed actor, allow-listed derived payloads, no raw text or direct identifiers.';

grant select on public.research_pilot_event_export to authenticated;
