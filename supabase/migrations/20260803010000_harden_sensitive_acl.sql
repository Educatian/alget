-- Defense-in-depth ACL hardening for the admin, agentic, research, and
-- instructor control-plane surfaces. RLS remains the row-level boundary;
-- these explicit revokes ensure an anonymous PostgREST caller cannot reach a
-- sensitive relation at all, even if a future policy is accidentally broad.

revoke all on table
  public.instructor_profiles,
  public.managed_courses,
  public.content_ingestion_jobs,
  public.agent_control_runs,
  public.admin_audit_events,
  public.course_runtime_packages,
  public.agent_decision_ledger,
  public.roadmap_interop_events,
  public.agent_model_registry,
  public.roadmap_incidents,
  public.roadmap_privacy_requests,
  public.roadmap_evaluation_manifests,
  public.interaction_events
from public, anon;

revoke all on public.research_pilot_event_export from public, anon;

-- Preserve the least privileges expected by current clients after the revoke.
grant select, insert, update, delete on table public.instructor_profiles to authenticated;
grant select, insert, update, delete on table public.managed_courses to authenticated;
grant select, insert, update, delete on table public.content_ingestion_jobs to authenticated;
grant select, insert, update, delete on table public.agent_control_runs to authenticated;
grant select, insert on table public.admin_audit_events to authenticated;
grant select, insert, update on table public.course_runtime_packages to authenticated;
grant select, insert on table public.agent_decision_ledger to authenticated;
grant select, insert on table public.roadmap_interop_events to authenticated;
grant select, insert, update on table public.agent_model_registry to authenticated;
grant select, insert, update on table public.roadmap_incidents to authenticated;
grant select, insert, update on table public.roadmap_privacy_requests to authenticated;
grant select, insert, update on table public.roadmap_evaluation_manifests to authenticated;
grant select, insert, update on table public.interaction_events to authenticated;
grant select on public.research_pilot_event_export to authenticated;
