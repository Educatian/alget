# Grant a Supabase user the course administrator role.
#
# Authorization is read from app_metadata.role, never from user-editable
# user_metadata. The role travels in the access token, so the account must sign
# out and back in before the new claim takes effect.
#
#   .\scripts\grant-course-admin.ps1 -Email you@example.com
#
# The service-role key is read from $env:SUPABASE_SERVICE_ROLE_KEY, or prompted
# for and held only in memory. It is never written to disk or echoed.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Email,
    [string]$ProjectUrl = "https://tyyjkkykcggukfbkwpia.supabase.co",
    [ValidateSet("course_admin", "admin", "instructor")][string]$Role = "course_admin"
)

$ErrorActionPreference = "Stop"

$key = $env:SUPABASE_SERVICE_ROLE_KEY
if ([string]::IsNullOrWhiteSpace($key)) {
    $secure = Read-Host -Prompt "Supabase service-role key" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $key = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if ([string]::IsNullOrWhiteSpace($key)) { throw "No service-role key supplied." }

$base = $ProjectUrl.TrimEnd("/")
$headers = @{ apikey = $key; Authorization = "Bearer $key" }

Write-Host "Looking up $Email ..."
$lookup = Invoke-RestMethod -Method Get -Headers $headers `
    -Uri "$base/auth/v1/admin/users?email=$([uri]::EscapeDataString($Email))"

# The admin users endpoint answers with either a collection or a single object
# depending on project version; accept both rather than guessing.
$user = if ($lookup.users) { $lookup.users | Select-Object -First 1 } else { $lookup }
if (-not $user -or -not $user.id) { throw "No Supabase user found for $Email." }

Write-Host "Found user $($user.id)"
Write-Host "Current app_metadata.role: $(if ($user.app_metadata.role) { $user.app_metadata.role } else { '(none)' })"

$body = @{ app_metadata = @{ role = $Role } } | ConvertTo-Json -Depth 3
$updated = Invoke-RestMethod -Method Put -Headers $headers -ContentType "application/json" `
    -Uri "$base/auth/v1/admin/users/$($user.id)" -Body $body

$applied = $updated.app_metadata.role
if ($applied -ne $Role) { throw "Update did not apply; app_metadata.role is '$applied'." }

Write-Host ""
Write-Host "app_metadata.role is now '$applied' for $Email." -ForegroundColor Green
Write-Host "Sign out and back in: the role travels in the access token, so an" -ForegroundColor Yellow
Write-Host "existing session still carries the old claim." -ForegroundColor Yellow
