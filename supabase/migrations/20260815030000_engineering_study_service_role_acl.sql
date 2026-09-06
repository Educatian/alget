-- Trusted server-side access required by the engineering study operator and
-- synthetic QA harness. Browser clients never receive the service-role key;
-- authenticated and anonymous privileges remain governed separately by RLS.

grant select, insert, update, delete on table
  public.cohort_learners,
  public.engineering_study_allocation_schedule,
  public.experiment_assignments,
  public.interaction_events
to service_role;

grant select on table
  public.experiments,
  public.experiment_arms,
  public.engineering_sim_event_export
to service_role;

comment on table public.engineering_study_allocation_schedule is
  'Pre-provisioned engineering-study allocation schedule. Direct access is restricted to the trusted service role; learners claim assignments only through claim_engineering_study_assignment().';
