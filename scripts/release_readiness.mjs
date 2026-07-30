import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const failures = []

function read(path) {
  const absolute = join(root, path)
  if (!existsSync(absolute)) {
    failures.push(`missing required file: ${path}`)
    return ''
  }
  return readFileSync(absolute, 'utf8')
}

function requireText(content, text, label) {
  if (!content.includes(text)) failures.push(`${label} is missing: ${text}`)
}

function filesUnder(directory) {
  const absolute = join(root, directory)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = join(absolute, entry.name)
    return entry.isDirectory() ? filesUnder(relative(root, path)) : statSync(path).isFile() ? [path] : []
  })
}

const headers = read('frontend/public/_headers')
for (const header of ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'X-Frame-Options']) {
  requireText(headers, header, 'Cloudflare Pages security headers')
}

const redirects = read('frontend/public/_redirects')
requireText(redirects, '/*  /index.html  200', 'SPA fallback')

const worker = read('cloudflare/llm-proxy/src/index.js')
for (const safeguard of ['/health', 'adaptation_emergency_pause', '/(pause|resume)', "suppressionReason = 'emergency_pause'"]) {
  requireText(worker, safeguard, 'Worker release safeguard')
}

const migration = read('supabase/migrations/20260730090000_admin_control_plane.sql')
for (const table of ['instructor_profiles', 'managed_courses', 'content_ingestion_jobs', 'agent_control_runs', 'admin_audit_events']) {
  requireText(migration, `alter table public.${table} enable row level security`, `RLS for ${table}`)
}
requireText(migration, "auth.jwt() -> 'app_metadata'", 'role authorization')

const productionFrontendFiles = [
  ...filesUnder('frontend/src'),
  ...filesUnder('frontend/public'),
  ...filesUnder('frontend/dist'),
].filter((file) => /\.(?:js|jsx|ts|tsx|json|html|css|md|txt)$|_(?:headers|redirects)$/.test(file))
const forbiddenSecretPatterns = [
  /sb_secret_[A-Za-z0-9_-]+/,
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
]
for (const file of productionFrontendFiles) {
  const content = readFileSync(file, 'utf8')
  for (const pattern of forbiddenSecretPatterns) {
    if (pattern.test(content)) failures.push(`possible secret in ${relative(root, file)} (${pattern})`)
  }
}

const builtIndex = join(root, 'frontend/dist/index.html')
if (existsSync(builtIndex)) {
  for (const file of filesUnder('frontend/dist').filter((path) => /\.(?:js|html|css)$/.test(path))) {
    const content = readFileSync(file, 'utf8')
    if (content.includes('e2e@alget.test')) failures.push(`E2E authentication bypass leaked into ${relative(root, file)}`)
  }
}

if (failures.length) {
  console.error(`Release readiness failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Release readiness passed: security headers, SPA fallback, emergency pause, health endpoint, RLS declarations, and frontend secret scan are present.')
