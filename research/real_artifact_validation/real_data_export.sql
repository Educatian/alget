-- ALGET real artifact-validation exports.
-- Run against the production/research Supabase database.
-- Export each SELECT result as CSV with the filenames listed below.
--
-- Privacy: keep these raw exports local. Derived publication files should use
-- anonymized IDs only.

-- File: raw_artifact_revision_scores.csv
select
  id,
  user_id,
  course_id,
  section_id,
  artifact_type,
  studio_mode,
  trace_event_id,
  judgment,
  trace_score,
  trace_denominator,
  claim_clarity,
  evidence_alignment,
  revision_depth,
  judgment_quality,
  transfer_readiness,
  specificity_delta,
  overall_revision_quality,
  diagnostics->>'submission_id' as submission_id,
  diagnostics->>'artifact_definition_id' as artifact_definition_id,
  diagnostics->>'artifact_family' as artifact_family,
  diagnostics->>'artifact_submission_spec_version' as artifact_submission_spec_version,
  diagnostics->'artifact_required_files' as artifact_required_files,
  diagnostics->'artifact_accepted_formats' as artifact_accepted_formats,
  diagnostics->>'artifact_naming_pattern' as artifact_naming_pattern,
  diagnostics->'artifact_required_sections' as artifact_required_sections,
  diagnostics->'source_text_metrics' as source_text_metrics,
  diagnostics->'raw_submission_privacy' as raw_submission_privacy,
  privacy_policy,
  created_at
from artifact_revision_scores
where privacy_policy = 'score-derived-only-v1'
order by created_at;

-- File: raw_human_ratings.csv
select
  id,
  target_type,
  target_id,
  rater_id,
  rubric_name,
  rating,
  created_at
from human_ratings
where target_type = 'artifact_revision_score'
  and rubric_name in ('artifact_revision_quality_v1', 'artifact_revision_quality')
order by target_id, created_at;

-- Optional file: raw_evaluation_runs.csv
select
  id,
  user_id,
  course_id,
  phase,
  form_key,
  experiment_arm_id,
  started_at,
  completed_at,
  score_raw,
  score_pct,
  delayed_days
from evaluation_runs
order by user_id, course_id, started_at;

-- Optional file: raw_experiment_assignments.csv
select
  assignments.user_id,
  assignments.course_id,
  assignments.stratum_key,
  assignments.assignment_seed,
  assignments.assignment_hash,
  arms.arm_key,
  assignments.assigned_at
from experiment_assignments assignments
join experiment_arms arms on arms.id = assignments.arm_id
order by assignments.assigned_at;
