import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
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

const contentFiles = filesUnder('frontend/content').filter((file) => file.endsWith('.mdx'))
const forbiddenCitationIdentifiers = [
  '10.4324/9781315670160',
  '10.1016/j.learninstruc.2009.12.009',
]
for (const file of contentFiles) {
  const content = readFileSync(file, 'utf8')
  for (const identifier of forbiddenCitationIdentifiers) {
    if (content.includes(identifier)) {
      failures.push(`invalid citation identifier in ${relative(root, file)} (${identifier})`)
    }
  }
}

const manifestModule = await import('../frontend/src/generated/contentManifest.js')
const actualCounts = {}
for (const file of contentFiles) {
  const parts = relative(join(root, 'frontend/content'), file).split(/[\\/]/)
  const [course, chapter] = parts
  actualCounts[course] ||= { chapters: new Set(), sections: 0 }
  actualCounts[course].chapters.add(chapter)
  actualCounts[course].sections += 1
}
for (const [course, actual] of Object.entries(actualCounts)) {
  const generated = manifestModule.CONTENT_COUNTS[course]
  if (!generated || generated.chapters !== actual.chapters.size || generated.sections !== actual.sections) {
    failures.push(
      `content manifest mismatch for ${course}: generated ${JSON.stringify(generated)} vs ` +
      `actual ${actual.chapters.size} chapters/${actual.sections} sections`,
    )
  }
}

const referenceManifestText = read('frontend/public/course-art/reference-manifest.json')
if (referenceManifestText) {
  let referenceManifest
  try {
    referenceManifest = JSON.parse(referenceManifestText)
  } catch (error) {
    failures.push(`reference image manifest is not valid JSON: ${error.message}`)
  }

  if (referenceManifest) {
    const figures = Array.isArray(referenceManifest.figures) ? referenceManifest.figures : []
    if (referenceManifest.figure_count !== figures.length || figures.length !== 210) {
      failures.push(`reference image manifest count mismatch: declared ${referenceManifest.figure_count}, actual ${figures.length}, expected 210`)
    }
    const paths = new Set()
    const sections = new Set()
    for (const figure of figures) {
      if (!figure.path || !figure.section_id || !figure.alt || !figure.caption || !figure.source || !figure.license || !figure.sha256) {
        failures.push(`incomplete reference image metadata for ${figure.section_id || figure.path || 'unknown figure'}`)
        continue
      }
      if (paths.has(figure.path)) failures.push(`duplicate reference image path: ${figure.path}`)
      if (sections.has(figure.section_id)) failures.push(`duplicate reference image section: ${figure.section_id}`)
      paths.add(figure.path)
      sections.add(figure.section_id)

      const absolute = join(root, 'frontend/public', figure.path.replace(/^\//, ''))
      if (!existsSync(absolute)) {
        failures.push(`missing reference image asset: ${figure.path}`)
        continue
      }
      const digest = createHash('sha256').update(readFileSync(absolute)).digest('hex')
      if (digest !== figure.sha256) failures.push(`reference image integrity mismatch: ${figure.path}`)

      const [course, chapter, section] = figure.section_id.split('/')
      const mdxPath = join(root, 'frontend/content', course, chapter, `${section}.mdx`)
      const metaPath = join(root, 'frontend/content', course, chapter, `${section}.meta.json`)
      if (!existsSync(mdxPath) || !readFileSync(mdxPath, 'utf8').includes(figure.path)) {
        failures.push(`reference image is not linked from its section: ${figure.section_id}`)
      }
      if (figure.learning_objective_id && existsSync(metaPath)) {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
        const objectiveIds = new Set((meta.learning_objectives || []).map((objective) => objective?.id).filter(Boolean))
        if (!objectiveIds.has(figure.learning_objective_id)) {
          failures.push(`reference image objective mismatch: ${figure.section_id}/${figure.learning_objective_id}`)
        }
      }
    }
  }
}

const instructionalVisualPattern = /!\[[^\]]*\]\([^)]+\)|<[a-z-]*diagram\b|<concept-diagram\b|<figure-block\b|<youtube-embed\b|<remotion-clip\b/i
for (const file of contentFiles) {
  const content = readFileSync(file, 'utf8')
  if (!instructionalVisualPattern.test(content)) {
    failures.push(`section has no instructional visual: ${relative(root, file)}`)
  }
  for (const figureMatch of content.matchAll(/<figure-block\b[^>]*>[\s\S]*?<\/figure-block>/gi)) {
    for (const match of figureMatch[0].matchAll(/<img\b[^>]*>/gi)) {
      if (!/\balt="[^"]+"/i.test(match[0])) failures.push(`figure image missing descriptive alt text: ${relative(root, file)}`)
    }
  }
}

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

console.log('Release readiness passed: security headers, SPA fallback, emergency pause, health endpoint, RLS declarations, citations, catalog counts, reference-image coverage/integrity, and frontend secret scan are valid.')
