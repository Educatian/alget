param(
    [string]$MigrationPath = "supabase\migrations\20260531234000_provision_optional_research_tables.sql",
    [string]$ServiceRolePath = "C:\Users\jewoo\Desktop\supabase_alget_servicerole.txt"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $MigrationPath)) {
    throw "Migration file not found: $MigrationPath"
}

if ($env:SUPABASE_DB_URL) {
    npx.cmd supabase db query --db-url $env:SUPABASE_DB_URL --file $MigrationPath
} else {
    if (-not $env:SUPABASE_ACCESS_TOKEN) {
        throw "Set SUPABASE_ACCESS_TOKEN or SUPABASE_DB_URL before provisioning live Supabase tables. SUPABASE_SERVICE_ROLE_KEY is intentionally not enough for DDL; it only verifies REST data access."
    }

    $supabaseUrlLine = Get-Content -LiteralPath "frontend\.env" |
        Where-Object { $_ -match "^VITE_SUPABASE_URL=" } |
        Select-Object -First 1

    if (-not $supabaseUrlLine) {
        throw "VITE_SUPABASE_URL not found in frontend\.env"
    }

    $supabaseUrl = $supabaseUrlLine -replace "^VITE_SUPABASE_URL=", ""
    $projectRef = ([uri]$supabaseUrl).Host.Split(".")[0]

    npx.cmd supabase link --project-ref $projectRef --workdir supabase
    npx.cmd supabase db query --linked --file $MigrationPath
}

if (Test-Path -LiteralPath $ServiceRolePath) {
    $env:SUPABASE_SERVICE_ROLE_KEY = (Get-Content -Raw -LiteralPath $ServiceRolePath).Trim()
}

node scripts/live_research_smoke.mjs --require-access --require-provenance --require-tables --probe-optional-writes
