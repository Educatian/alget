-- Faculty partnership records are never available to anonymous clients.
-- RLS remains enabled as a second authorization layer for signed-in users.

revoke all on table public.faculty_pilots from public, anon;
revoke all on table public.instructor_evidence_briefs from public, anon;
revoke all on table public.course_impact_reports from public, anon;

grant select, insert, update on table public.faculty_pilots to authenticated;
grant select, insert, update on table public.instructor_evidence_briefs to authenticated;
grant select, insert, update on table public.course_impact_reports to authenticated;
