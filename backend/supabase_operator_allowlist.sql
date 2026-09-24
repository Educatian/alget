-- Allow named ALGET administrators to use verified Google/Supabase accounts.
-- Users cannot add or edit grants; each signed-in user can read only their own row.
CREATE TABLE IF NOT EXISTS public.alget_operator_allowlist (
    email text PRIMARY KEY,
    role text NOT NULL CHECK (role IN ('admin', 'course_admin')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (email = lower(btrim(email)) AND position('@' IN email) > 1)
);

ALTER TABLE public.alget_operator_allowlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.alget_operator_allowlist FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.alget_operator_allowlist TO authenticated;
DROP POLICY IF EXISTS "Users read only their own ALGET admin grant" ON public.alget_operator_allowlist;
CREATE POLICY "Users read only their own ALGET admin grant"
    ON public.alget_operator_allowlist FOR SELECT TO authenticated
    USING (email = lower(coalesce((SELECT auth.jwt() ->> 'email'), '')));

CREATE OR REPLACE FUNCTION public.is_alget_operator()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path TO pg_catalog, public, pg_temp
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'course_admin')
    OR EXISTS (
      SELECT 1 FROM public.alget_operator_allowlist a
      WHERE a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
        AND a.role IN ('admin', 'course_admin')
        AND a.status = 'active'
    ), false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_research_console()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path TO pg_catalog, public, pg_temp
AS $$ SELECT coalesce(public.is_alget_instructor(), false); $$;

REVOKE ALL ON FUNCTION public.is_alget_operator() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_research_console() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_alget_operator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_research_console() TO authenticated;

INSERT INTO public.alget_operator_allowlist (email, role, status)
VALUES
    ('seabu@crimson.ua.edu', 'admin', 'active'),
    ('idawoyemi@crimson.ua.edu', 'admin', 'active')
ON CONFLICT (email) DO UPDATE
SET role = EXCLUDED.role, status = EXCLUDED.status;
