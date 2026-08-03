param(
  [switch]$Linked = $true
)

$ErrorActionPreference = "Stop"

if (-not $Linked) {
  throw "This verifier is intentionally linked-project only. Use the Supabase CLI against the reviewed production project."
}

$sql = "select to_regclass('public.openstax_sections') as openstax_sections, to_regclass('public.course_runtime_packages') as course_runtime_packages, to_regclass('public.agent_decision_ledger') as agent_decision_ledger, to_regprocedure('public.search_openstax_sections(text,integer,text[])') as search_openstax_sections;"

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

Write-Output "Live Supabase migration contracts verified: OpenStax reference index, roadmap runtime tables, and search function."
