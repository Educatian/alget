-- Supabase may retain explicit default EXECUTE grants for anon even after a
-- PUBLIC revoke. Agentic workflow RPCs are authenticated APIs only.

revoke all on function public.transition_agent_workflow(uuid, text, text, jsonb) from public, anon;
revoke all on function public.create_learner_plan_workflow(text, text, date, numeric, integer, jsonb) from public, anon;
revoke all on function public.review_learner_plan(uuid, text) from public, anon;
revoke all on function public.create_instructor_intervention_workflow(text, text, text, jsonb, uuid[]) from public, anon;
revoke all on function public.review_instructor_intervention(uuid, text, text) from public, anon;

grant execute on function public.transition_agent_workflow(uuid, text, text, jsonb) to authenticated;
grant execute on function public.create_learner_plan_workflow(text, text, date, numeric, integer, jsonb) to authenticated;
grant execute on function public.review_learner_plan(uuid, text) to authenticated;
grant execute on function public.create_instructor_intervention_workflow(text, text, text, jsonb, uuid[]) to authenticated;
grant execute on function public.review_instructor_intervention(uuid, text, text) to authenticated;
