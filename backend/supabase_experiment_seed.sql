-- ============================================================================
-- ALGET Summer 2026 Experiment Seed
-- Execute after supabase_research_schema.sql and social annotation schema.
-- ============================================================================

insert into model_registry (model_name, model_family, version, task, config)
values
  (
    'alget_tuned_bkt',
    'bayesian_knowledge_tracing',
    '2026-05-05-grid-v1',
    'learner_state_prediction',
    '{"calibration_source":"research/model_validation/learner_model_validation.json","selection_metric":"brier_then_ece_then_auc"}'::jsonb
  ),
  (
    'alget_annotation_signal_policy',
    'rule_based_recommender',
    '2026-05-05-v1',
    'adaptive_support_selection',
    '{"signals":["annotation_type","practice_correctness","confidence","support_request","revision_quality"],"actions":["explain","represent","practice","ask","advance"]}'::jsonb
  )
on conflict (model_name, version, task) do nothing;

insert into experiments (experiment_key, hypothesis, status)
values
  (
    'summer2026_annotation_adaptive_support',
    'Learners using social-annotation-informed adaptive support will show higher post-test gain, better calibration, and higher-quality artifact revision traces than learners using practice-only support.',
    'draft'
  )
on conflict (experiment_key) do nothing;

insert into experiment_arms (experiment_id, arm_key, description, policy_version)
select experiments.id, arms.arm_key, arms.description, arms.policy_version
from experiments
cross join (
  values
    ('comparison_practice_only', 'Practice and misconception feedback without annotation-informed support selection.', 'practice-only-2026-05-05'),
    ('treatment_annotation_adaptive', 'Adaptive support selection incorporates annotation type, quote hash overlap, support request, confidence, and revision quality.', 'annotation-adaptive-2026-05-05')
) as arms(arm_key, description, policy_version)
where experiments.experiment_key = 'summer2026_annotation_adaptive_support'
on conflict (experiment_id, arm_key) do nothing;

comment on function assign_experiment_arm(uuid, text, text, text, text, double precision)
is 'Deterministic course-blocked ALGET assignment: sha256(experiment_key, user_id, course_id, stratum_key, seed) with persisted allocation metadata.';

select 'ALGET Summer 2026 experiment seed ready' as status;
