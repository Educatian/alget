param(
  [switch]$Linked = $true
)

$ErrorActionPreference = "Stop"

if (-not $Linked) {
  throw "This verifier is intentionally linked-project only. Use the Supabase CLI against the reviewed production project."
}

$sql = "select to_regclass('public.openstax_sections') as openstax_sections, to_regclass('public.course_runtime_packages') as course_runtime_packages, to_regclass('public.agent_decision_ledger') as agent_decision_ledger, to_regclass('public.research_pilot_event_export') as research_pilot_event_export, to_regprocedure('public.search_openstax_sections(text,integer,text[])') as search_openstax_sections, has_table_privilege('anon', 'public.instructor_profiles', 'select') as anon_instructor_profiles_select, has_table_privilege('anon', 'public.managed_courses', 'select') as anon_managed_courses_select, has_table_privilege('anon', 'public.content_ingestion_jobs', 'select') as anon_content_ingestion_jobs_select, has_table_privilege('anon', 'public.agent_control_runs', 'select') as anon_agent_control_runs_select, has_table_privilege('anon', 'public.admin_audit_events', 'select') as anon_admin_audit_events_select, has_table_privilege('anon', 'public.course_runtime_packages', 'select') as anon_course_runtime_packages_select, has_table_privilege('anon', 'public.agent_decision_ledger', 'select') as anon_decision_ledger_select, has_table_privilege('anon', 'public.roadmap_interop_events', 'select') as anon_roadmap_interop_events_select, has_table_privilege('anon', 'public.agent_model_registry', 'select') as anon_agent_model_registry_select, has_table_privilege('anon', 'public.roadmap_incidents', 'select') as anon_roadmap_incidents_select, has_table_privilege('anon', 'public.roadmap_privacy_requests', 'select') as anon_roadmap_privacy_requests_select, has_table_privilege('anon', 'public.roadmap_evaluation_manifests', 'select') as anon_roadmap_evaluation_manifests_select, has_table_privilege('anon', 'public.interaction_events', 'select') as anon_interaction_events_select, has_table_privilege('anon', 'public.research_pilot_event_export', 'select') as anon_pilot_export_select;"

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$raw = (& npx.cmd supabase db query --linked $sql 2>&1 | Out-String).Trim()
$ErrorActionPreference = $previousErrorActionPreference
$jsonStart = $raw.IndexOf('{')
if ($jsonStart -lt 0) {
  throw "Supabase CLI did not return a JSON query result. Check CLI authentication and linked project state."
}

try {
  $payload = $raw.Substring($jsonStart) | ConvertFrom-Json
} catch {
  throw "Could not parse Supabase CLI JSON output: $($_.Exception.Message)"
}

$row = $payload.rows | Select-Object -First 1
if (-not $row) {
  throw "Supabase schema query returned no rows."
}

$required = @(
  'openstax_sections',
  'course_runtime_packages',
  'agent_decision_ledger',
  'research_pilot_event_export',
  'search_openstax_sections'
)
$missing = [System.Collections.Generic.List[string]]::new()
foreach ($name in $required) {
  $value = $row.$name
  if ([string]::IsNullOrWhiteSpace([string]$value)) {
    [void]$missing.Add($name)
  }
}

if ($missing.Count -gt 0) {
  throw "Missing live migration contracts: $($missing -join ', ')"
}

$anonPrivileges = @(
  'anon_instructor_profiles_select',
  'anon_managed_courses_select',
  'anon_content_ingestion_jobs_select',
  'anon_agent_control_runs_select',
  'anon_admin_audit_events_select',
  'anon_course_runtime_packages_select',
  'anon_decision_ledger_select',
  'anon_roadmap_interop_events_select',
  'anon_agent_model_registry_select',
  'anon_roadmap_incidents_select',
  'anon_roadmap_privacy_requests_select',
  'anon_roadmap_evaluation_manifests_select',
  'anon_interaction_events_select',
  'anon_pilot_export_select'
) | Where-Object { [bool]$row.$_ }
if ($anonPrivileges.Count -gt 0) {
  throw "Anonymous ACL still grants sensitive live relations: $($anonPrivileges -join ', ')"
}

Write-Output "Live Supabase migration contracts verified: OpenStax reference index, roadmap runtime tables, search function, and sensitive anonymous ACL revokes."
