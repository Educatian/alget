import { extractText, getDocumentProxy } from 'unpdf'

// Cloudflare Worker: alget-llm  (OpenRouter-backed)
//
// The ENTIRE dynamic AI/compute layer for ALGET — no FastAPI/onrender backend.
//   - LLM (BigAL rail explain/represent, chat, Knowledge Check generate/grade)
//     -> OpenRouter directly.
//   - Deterministic, ported from the Python backend (parity-verified): BKT
//     grade + telemetry_fusion, practice grade/{id} (reads static practice),
//     artifact-revision score, research-evaluation validate, concept-origin +
//     mastery_graph (from baked static indexes), governed agentic planning,
//     adaptive_recommendation
//     (policy via the alget-adaptive-recommendation Worker, service-bound).
//   - Static content/diagnostic/indexes are served by Cloudflare Pages.
//
// SECRET (set via wrangler, NOT committed):
//   wrangler secret put OPENROUTER_API_KEY
// Optional [vars]:
//   OPENROUTER_MODEL  (default google/gemini-2.0-flash-001)
//   STATIC_API_BASE   (default the Pages /api origin)
//   SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY (admin identity and invitation bridge)

const DEFAULT_MODEL = 'google/gemini-2.5-flash'
// Static content (Pages) the Worker reads for deterministic grading/graphs.
const DEFAULT_STATIC_BASE = 'https://alget.pages.dev/api'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MAX_PDF_BYTES = 25 * 1024 * 1024
const MAX_PDF_PAGES = 500
const MAX_GOOGLE_DOC_CHARACTERS = 250000
const RELEASE_SCHEMA_VERSION = '2026-07-30'
const GENERATION_TRACE_SCHEMA_VERSION = 'generation-trace-v1'
const ROADMAP_CONTRACT_VERSION = 'roadmap-runtime-v1'
const ROADMAP_MODELS = new Map()
const ROADMAP_INCIDENTS = new Map()

function cleanExcerpt(value, limit = 280) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function normalizeContentVersion(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  return value.content_version || value.hash || null
}

async function buildGenerationTrace({
  body = {},
  output = '',
  model = DEFAULT_MODEL,
  promptVersion,
  sourceKind = 'course_section',
  sourceText = '',
  sourceTitle = '',
  sourceLocator = '',
  reviewStatus = 'not_human_reviewed',
}) {
  const normalizedOutput = typeof output === 'string' ? output : JSON.stringify(output)
  const outputHash = await sha256Hex(new TextEncoder().encode(normalizedOutput))
  const excerpt = cleanExcerpt(sourceText || body.current_content || body.page_content)
  const sectionId = body.section_id || null
  const locator = sourceLocator || sectionId || null
  const sources = excerpt || locator
    ? [{
        source_id: sectionId || `${sourceKind}:provided-context`,
        kind: sourceKind,
        title: sourceTitle || body.section_title || sectionId || 'Provided generation context',
        locator,
        excerpt: excerpt || null,
        verification_status: 'context_attached',
      }]
    : []

  return {
    schema_version: GENERATION_TRACE_SCHEMA_VERSION,
    trace_id: crypto.randomUUID(),
    generated_at: new Date().toISOString(),
    provider: 'openrouter',
    model,
    prompt_version: promptVersion,
    output_hash: outputHash,
    section_id: sectionId,
    content_version: normalizeContentVersion(body.content_version),
    source_status: sources.length ? 'context_attached' : 'no_source_context',
    sources,
    verification: {
      status: sources.length ? 'context_attached' : 'unverified',
      claim_level_citations: false,
    },
    review: { status: reviewStatus },
    limitations: sources.length
      ? ['The current section context was supplied, but individual claims were not independently citation-verified.']
      : ['No source context was attached. Treat this output as an unverified AI draft.'],
  }
}

const DEFAULT_ADAPTATION_POLICY = {
  mastery_support_threshold: 0.58,
  friction_support_threshold: 0.35,
  calibration_support_threshold: 0.25,
  forgetting_risk_threshold: 0.55,
  cooldown_minutes: 8,
  max_interventions_per_session: 4,
  fade_mastery_threshold: 0.8,
  fade_stability_threshold: 0.7,
  show_why_now: true,
  require_human_approval: true,
}

const ADMIN_AGENTS = [
  { id: 'curriculum', name: 'Curriculum Agent', stage: 'structure', approval: 'required', can_publish: false },
  { id: 'extraction', name: 'Document Extraction Agent', stage: 'ingestion', approval: 'automatic', can_publish: false },
  { id: 'alignment', name: 'Outcome Alignment Agent', stage: 'curriculum', approval: 'required', can_publish: false },
  { id: 'assessment', name: 'Assessment Agent', stage: 'assessment', approval: 'required', can_publish: false },
  { id: 'accessibility', name: 'Accessibility Agent', stage: 'quality', approval: 'automatic', can_publish: false },
  { id: 'validation', name: 'Validation Agent', stage: 'quality', approval: 'required', can_publish: false },
  { id: 'release', name: 'Release Agent', stage: 'release', approval: 'required', can_publish: true },
]

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-alget-admin-token',
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

function supabaseHeaders(env, authorization = '') {
  return {
    apikey: env.SUPABASE_PUBLISHABLE_KEY || '',
    ...(authorization ? { Authorization: authorization } : {}),
    'content-type': 'application/json',
  }
}

async function persistRoadmapRow(env, authorization, table, row) {
  if (!env.SUPABASE_URL || !authorization) return { persisted: false, reason: 'supabase_session_required' }
  try {
    const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...supabaseHeaders(env, authorization), Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    })
    if (!response.ok) return { persisted: false, reason: `supabase_${response.status}` }
    return { persisted: true, table }
  } catch {
    return { persisted: false, reason: 'supabase_unavailable' }
  }
}

function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ''))
  const b = new TextEncoder().encode(String(right || ''))
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index]
  return difference === 0
}

async function requireCourseAdmin(request, env) {
  const adminToken = request.headers.get('x-alget-admin-token') || ''
  if (env.ALGET_ADMIN_TOKEN && adminToken && constantTimeEqual(env.ALGET_ADMIN_TOKEN, adminToken)) {
    return { authorization: '', operator: { role: 'admin', subject: 'server-token' } }
  }
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.toLowerCase().startsWith('bearer ') || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return { error: json({ detail: 'Administrator authentication required' }, 401) }
  }
  let response
  try {
    response = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/auth/v1/user`, {
      headers: supabaseHeaders(env, authorization),
    })
  } catch {
    return { error: json({ detail: 'Identity provider unavailable' }, 503) }
  }
  if (!response.ok) return { error: json({ detail: 'Invalid or expired administrator session' }, 401) }
  const user = await response.json()
  const role = user?.app_metadata?.role
  if (!['admin', 'course_admin'].includes(role)) {
    return { error: json({ detail: 'Course administrator role required' }, 403) }
  }
  return { authorization, operator: { role, subject: user.id } }
}

async function requireFacultyInstructor(request, env) {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.toLowerCase().startsWith('bearer ') || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return { error: json({ detail: 'Instructor authentication required' }, 401) }
  }
  let response
  try {
    response = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/auth/v1/user`, {
      headers: supabaseHeaders(env, authorization),
    })
  } catch {
    return { error: json({ detail: 'Identity provider unavailable' }, 503) }
  }
  if (!response.ok) return { error: json({ detail: 'Invalid or expired instructor session' }, 401) }
  const user = await response.json()
  const role = user?.app_metadata?.role
  if (!['instructor', 'admin', 'course_admin'].includes(role)) return { error: json({ detail: 'Instructor role required' }, 403) }
  return { authorization, operator: { role, subject: user.id } }
}

function governedCoursePlan(courseId, sourceId) {
  return {
    course_id: courseId,
    source_id: sourceId,
    status: 'planned',
    release_gate: 'human_approval_required',
    stages: ADMIN_AGENTS.map((agent, index) => ({
      order: index + 1,
      agent_id: agent.id,
      agent_name: agent.name,
      status: 'waiting',
      approval: agent.approval,
      can_publish: agent.can_publish,
    })),
  }
}

function cleanPdfText(value) {
  return String(value || '').replace(/\0/g, '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function pdfHeadingCandidates(text) {
  const headings = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line.length < 4 || line.length > 120 || /[.?!]$/.test(line)) continue
    const words = line.split(/\s+/)
    if (words.length > 14) continue
    const capitalized = words.filter((word) => /^[A-Z]/.test(word)).length
    const titleLike = line === line.toUpperCase() || capitalized >= Math.max(1, Math.floor(words.length / 2))
    if (titleLike || /^(chapter|module|unit|section|\d+(?:\.\d+)*)\b/i.test(line)) headings.push(line)
    if (headings.length === 4) break
  }
  return headings
}

function extractGoogleDocId(value) {
  const match = String(value || '').trim().match(/^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]{20,})\/(?:edit|view)(?:[?#].*)?$/)
  if (!match) throw new Error('Enter a standard Google Docs document link')
  return match[1]
}

function buildGoogleDocCourseDraft(text, documentId, title = '') {
  const cleaned = cleanPdfText(text).slice(0, MAX_GOOGLE_DOC_CHARACTERS)
  if (cleaned.length < 80) throw new Error('Google Doc contains too little readable course material')
  const headings = pdfHeadingCandidates(cleaned)
  if (!headings.length) headings.push(String(title || cleaned.split('\n').find(Boolean) || 'Course module').slice(0, 100))
  const sections = headings.slice(0, 8).map((heading, index) => {
    const start = Math.max(0, cleaned.toLowerCase().indexOf(heading.toLowerCase()))
    const next = headings[index + 1]
    const nextIndex = next ? cleaned.toLowerCase().indexOf(next.toLowerCase(), start + heading.length) : cleaned.length
    const end = nextIndex > start ? nextIndex : Math.min(cleaned.length, start + 5000)
    const excerpt = (cleaned.slice(start + heading.length, end).trim() || cleaned.slice(start, start + 1200)).slice(0, 1200)
    const runtime = {
      tutor: {
        persona: 'BigAL source-grounded course tutor',
        objective: `Help learners explain and apply ${heading} without giving away active assessment answers.`,
        hint_ladder: ['diagnose misconception', 'ask a guiding question', 'offer one conceptual cue', 'give one micro-step', 'check transfer'],
        source_scope: 'published-section-only',
      },
      analytics: {
        events: ['section_view', 'reading_progress', 'activity_attempt', 'simulation_prediction', 'tutor_help', 'social_checkin', 'section_complete'],
        mastery_concepts: [heading.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')],
        intervention_triggers: { low_mastery: 0.58, repeated_help: 3, stalled_minutes: 8 },
      },
      social_dynamics: {
        cues: ['peer_presence', 'same_concept_peers', 'share_one_evidence_based_revision'],
        prompts: [`Compare your interpretation of ${heading} with one peer and name the evidence that changed your view.`],
        rounds: [{ type: 'evidence_compare', min_peers: 1, prompt: `Peer round: compare one evidence-based revision about ${heading}.` }],
        privacy: 'pseudonymous-cohort-aggregate',
      },
    }
    return {
      section_id: `draft-${String(index + 1).padStart(2, '0')}`,
      title: heading,
      source_excerpt: excerpt,
      reading: { estimated_minutes: Math.max(4, Math.min(18, Math.round(excerpt.split(/\s+/).length / 180))), purpose: `Build source-grounded understanding of ${heading}.` },
      activity: {
        type: 'claim-evidence-revision',
        prompt: `Identify one claim about ${heading}, attach evidence from the reading, and revise the claim after critique.`,
        evidence_collected: ['initial_claim', 'source_evidence', 'revision_rationale'],
      },
      simulation: {
        status: 'proposed', concept: heading,
        interaction: 'Change one input, predict the effect, observe the response, and explain the discrepancy.',
        variables: ['input', 'response', 'constraint'], evidence_collected: ['prediction', 'observation', 'explanation'],
      },
      ...runtime,
    }
  })
  return {
    schema_version: 'google-doc-course-runtime-package-v1',
    source: { kind: 'google_doc', document_id: documentId, title: title || headings[0], characters: cleaned.length },
    learning_objectives: headings.slice(0, 5).map((heading) => `Explain and apply the central ideas in ${heading}.`),
    sections,
    runtime_package: { version: 'course-runtime-v1', generated: ['reading', 'activity', 'simulation', 'tutor', 'analytics', 'social_dynamics'], approval_required: true },
    quality: {
      source_grounded: true, citation_verification: 'not-verified', human_approval_required: true, student_visible: false, automatic_publish: false,
      warnings: sections.length >= 2 ? [] : ['Only one section was detected; review the document heading structure.'],
    },
  }
}

function normalizeGeneratedCourseDraft(generated, fallback) {
  const candidateSections = Array.isArray(generated?.sections) ? generated.sections : []
  if (!candidateSections.length) return fallback
  const byTitle = new Map(fallback.sections.map((section) => [section.title.toLowerCase(), section]))
  const sections = candidateSections.slice(0, 8).map((section, index) => {
    const fallbackSection = byTitle.get(String(section.title || '').toLowerCase()) || fallback.sections[index] || fallback.sections[0]
    return {
      ...fallbackSection,
      title: cleanExcerpt(section.title || fallbackSection.title, 120),
      source_excerpt: fallbackSection.source_excerpt,
      reading: { ...fallbackSection.reading, ...(section.reading || {}) },
      activity: { ...fallbackSection.activity, ...(section.activity || {}) },
      simulation: { ...fallbackSection.simulation, ...(section.simulation || {}), status: 'proposed' },
      tutor: { ...fallbackSection.tutor, ...(section.tutor || {}) },
      analytics: { ...fallbackSection.analytics, ...(section.analytics || {}) },
      social_dynamics: { ...fallbackSection.social_dynamics, ...(section.social_dynamics || {}) },
    }
  })
  return {
    ...fallback,
    learning_objectives: Array.isArray(generated.learning_objectives) ? generated.learning_objectives.slice(0, 8).map((item) => cleanExcerpt(item, 220)).filter(Boolean) : fallback.learning_objectives,
    sections,
    runtime_package: generated.runtime_package || fallback.runtime_package,
  }
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('')
}

async function convertPdfAtEdge(request) {
  let form
  try { form = await request.formData() } catch { return json({ detail: 'Invalid multipart PDF upload' }, 400) }
  const file = form.get('file')
  const courseId = String(form.get('course_id') || '').trim()
  if (!file || typeof file.arrayBuffer !== 'function') return json({ detail: 'PDF file is required' }, 422)
  if (courseId.length < 2 || courseId.length > 80) return json({ detail: 'Valid course_id is required' }, 422)
  if (file.size < 1 || file.size > MAX_PDF_BYTES) return json({ detail: `PDF must be between 1 byte and ${MAX_PDF_BYTES} bytes` }, 413)

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return json({ detail: 'File signature is not a PDF' }, 422)
  const hash = await sha256Hex(buffer)

  let document
  let extracted
  try {
    document = await getDocumentProxy(bytes)
    if (!document.numPages) return json({ detail: 'PDF contains no pages' }, 422)
    if (document.numPages > MAX_PDF_PAGES) return json({ detail: `PDF exceeds the ${MAX_PDF_PAGES}-page ingestion limit` }, 422)
    extracted = await extractText(document, { mergePages: false })
  } catch {
    return json({ detail: 'PDF could not be parsed; encrypted PDFs must be unlocked before ingestion' }, 422)
  }

  const rawPages = Array.isArray(extracted?.text) ? extracted.text : [extracted?.text || '']
  const warnings = []
  const pages = Array.from({ length: document.numPages }, (_, index) => {
    const text = cleanPdfText(rawPages[index] || '')
    if (text.length < 24) warnings.push(`Page ${index + 1}: little or no extractable text; OCR review recommended`)
    return { page: index + 1, characters: text.length, heading_candidates: pdfHeadingCandidates(text), text }
  })
  const extractablePages = pages.filter((page) => page.characters >= 24).length
  const filename = String(file.name || 'course-source.pdf').split(/[\\/]/).pop()
  const markdown = pages.map((page) => `## Page ${page.page}\n\n${page.text || '[No extractable text]'}`).join('\n\n')
  let runtimeDraft = null
  try { runtimeDraft = buildGoogleDocCourseDraft(markdown, `pdf:${hash.slice(0, 24)}`, filename) } catch { /* extraction remains usable; faculty can review before generation */ }
  return json({
    status: warnings.length ? 'needs_review' : 'converted',
    filename,
    sha256: hash,
    page_count: pages.length,
    total_characters: pages.reduce((sum, page) => sum + page.characters, 0),
    metadata: {},
    pages,
    markdown,
    runtime_draft: runtimeDraft,
    warnings,
    quality: {
      extractable_page_ratio: Number((extractablePages / pages.length).toFixed(4)),
      requires_ocr: warnings.length > 0,
      human_approval_required: true,
    },
    course_id: courseId,
    source_id: `pdf:${hash.slice(0, 16)}`,
  })
}

async function handleAdminRequest(request, env, path) {
  const auth = await requireCourseAdmin(request, env)
  if (auth.error) return auth.error

  if (path === '/admin/system/summary' && request.method === 'GET') {
    return json({
      status: 'ready', operator: auth.operator, agent_count: ADMIN_AGENTS.length,
      pdf_limit_bytes: MAX_PDF_BYTES, release_policy: 'human_approval_required', runtime: 'cloudflare',
      safeguards: {
        adaptation_emergency_pause: Boolean(env.ADAPTATION_POLICIES),
        adaptation_runtime: Boolean(env.ADAPTIVE),
        administrator_identity: Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY),
      },
      release_schema_version: RELEASE_SCHEMA_VERSION,
    })
  }
  if (path === '/admin/agents' && request.method === 'GET') {
    return json({ agents: ADMIN_AGENTS, release_policy: 'human_approval_required' })
  }
  if (path === '/admin/adaptation/policies' && request.method === 'GET') {
    if (!env.ADAPTATION_POLICIES) return json({ detail: 'Adaptation policy storage is unavailable' }, 503)
    const courseId = new URL(request.url).searchParams.get('course_id')
    if (courseId) {
      const policies = await env.ADAPTATION_POLICIES.get(`policy:${courseId}:history`, 'json') || []
      return json({ policies })
    }
    const listed = await env.ADAPTATION_POLICIES.list({ prefix: 'policy:' })
    const historyKeys = listed.keys.filter((item) => item.name.endsWith(':history')).slice(0, 100)
    const histories = await Promise.all(historyKeys.map((item) => env.ADAPTATION_POLICIES.get(item.name, 'json')))
    const courseIds = historyKeys.map((item) => item.name.replace(/^policy:/, '').replace(/:history$/, ''))
    const controlEntries = await Promise.all(courseIds.map(async (id) => [id, await env.ADAPTATION_POLICIES.get(`policy:${id}:control`, 'json')]))
    return json({
      policies: histories.flatMap((items) => Array.isArray(items) ? items : []),
      controls: Object.fromEntries(controlEntries.filter(([, control]) => control)),
    })
  }
  if (path === '/admin/adaptation/policies' && request.method === 'POST') {
    if (!env.ADAPTATION_POLICIES) return json({ detail: 'Adaptation policy storage is unavailable' }, 503)
    const payload = await request.json().catch(() => ({}))
    const courseId = String(payload.course_id || '').trim()
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(courseId)) return json({ detail: 'A valid course identifier is required' }, 422)
    const policy = validateAdaptationPolicy(payload.policy)
    if (!policy) return json({ detail: 'Adaptation policy values are invalid' }, 422)
    const historyKey = `policy:${courseId}:history`
    const history = await env.ADAPTATION_POLICIES.get(historyKey, 'json') || []
    const record = {
      id: crypto.randomUUID(), course_id: courseId, version: Math.max(0, ...history.map((item) => Number(item.version) || 0)) + 1,
      name: String(payload.name || 'Course adaptation policy').trim().slice(0, 120), status: 'draft', policy,
      notes: String(payload.notes || '').trim().slice(0, 500), created_by: auth.operator.subject, created_at: new Date().toISOString(),
    }
    const nextHistory = [record, ...history].slice(0, 30)
    await env.ADAPTATION_POLICIES.put(historyKey, JSON.stringify(nextHistory))
    return json({ policy: record }, 201)
  }
  const adaptationAction = path.match(/^\/admin\/adaptation\/policies\/([^/]+)\/(activate|rollback)$/)
  if (adaptationAction && request.method === 'POST') {
    if (!env.ADAPTATION_POLICIES) return json({ detail: 'Adaptation policy storage is unavailable' }, 503)
    const payload = await request.json().catch(() => ({}))
    const courseId = String(payload.course_id || '').trim()
    const historyKey = `policy:${courseId}:history`
    const history = await env.ADAPTATION_POLICIES.get(historyKey, 'json') || []
    const source = history.find((item) => item.id === adaptationAction[1])
    if (!source) return json({ detail: 'Policy version not found' }, 404)
    if (adaptationAction[2] === 'rollback') {
      const record = {
        ...source, id: crypto.randomUUID(), version: Math.max(0, ...history.map((item) => Number(item.version) || 0)) + 1,
        name: `${source.name} rollback`, status: 'draft', rollback_of: source.id, created_by: auth.operator.subject,
        created_at: new Date().toISOString(), activated_at: null, activated_by: null,
      }
      await env.ADAPTATION_POLICIES.put(historyKey, JSON.stringify([record, ...history].slice(0, 30)))
      return json({ policy: record }, 201)
    }
    const activatedAt = new Date().toISOString()
    const nextHistory = history.map((item) => item.id === source.id
      ? { ...item, status: 'active', activated_at: activatedAt, activated_by: auth.operator.subject }
      : item.status === 'active' ? { ...item, status: 'retired' } : item)
    const active = nextHistory.find((item) => item.id === source.id)
    await Promise.all([
      env.ADAPTATION_POLICIES.put(historyKey, JSON.stringify(nextHistory.slice(0, 30))),
      env.ADAPTATION_POLICIES.put(`policy:${courseId}:active`, JSON.stringify(active)),
    ])
    return json({ policy: active })
  }
  const adaptationControl = path.match(/^\/admin\/adaptation\/courses\/([a-z0-9][a-z0-9-]{1,79})\/(pause|resume)$/)
  if (adaptationControl && request.method === 'POST') {
    if (!env.ADAPTATION_POLICIES) return json({ detail: 'Adaptation policy storage is unavailable' }, 503)
    const courseId = adaptationControl[1]
    const payload = await request.json().catch(() => ({}))
    const paused = adaptationControl[2] === 'pause'
    const control = {
      course_id: courseId,
      enabled: !paused,
      reason: paused ? String(payload.reason || 'Emergency pause by course administrator').trim().slice(0, 240) : '',
      updated_at: new Date().toISOString(),
      updated_by: auth.operator.subject,
    }
    await env.ADAPTATION_POLICIES.put(`policy:${courseId}:control`, JSON.stringify(control))
    return json({ control })
  }
  if (path === '/admin/course-plan' && request.method === 'POST') {
    const payload = await request.json().catch(() => ({}))
    const courseId = String(payload.course_id || '')
    const sourceId = String(payload.source_id || '')
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(courseId) || sourceId.length < 2 || sourceId.length > 128) return json({ detail: 'Invalid course or source identifier' }, 422)
    return json(governedCoursePlan(courseId, sourceId))
  }
  if (path === '/admin/pdf/convert' && request.method === 'POST') return convertPdfAtEdge(request)
  if (path === '/admin/instructors/invite' && request.method === 'POST') {
    if (!auth.authorization) return json({ detail: 'Instructor invitations require an interactive administrator session' }, 401)
    if (!env.SUPABASE_URL) return json({ detail: 'Instructor invitations are not configured' }, 503)
    const edgeUrl = `${String(env.SUPABASE_URL).replace(/\/$/, '')}/functions/v1/admin-instructor-invite`
    const proxied = await fetch(edgeUrl, {
      method: 'POST',
      headers: supabaseHeaders(env, auth.authorization),
      body: await request.text(),
    })
    return new Response(proxied.body, { status: proxied.status, headers: { ...CORS, 'content-type': proxied.headers.get('content-type') || 'application/json' } })
  }
  if (path === '/admin/instructors/review' && request.method === 'POST') {
    if (!auth.authorization) return json({ detail: 'Instructor review requires an interactive administrator session' }, 401)
    if (!env.SUPABASE_URL) return json({ detail: 'Instructor review is not configured' }, 503)
    const edgeUrl = `${String(env.SUPABASE_URL).replace(/\/$/, '')}/functions/v1/admin-review-instructor`
    const proxied = await fetch(edgeUrl, { method: 'POST', headers: supabaseHeaders(env, auth.authorization), body: await request.text() })
    return new Response(proxied.body, { status: proxied.status, headers: { ...CORS, 'content-type': proxied.headers.get('content-type') || 'application/json' } })
  }
  return json({ detail: `Unknown admin endpoint: ${path}` }, 404)
}

async function handleFacultyRequest(request, env, path) {
  const auth = await requireFacultyInstructor(request, env)
  if (auth.error) return auth.error
  if (path === '/faculty/learners/invite' && request.method === 'POST') {
    if (!env.SUPABASE_URL) return json({ detail: 'Learner invitations are not configured' }, 503)
    const edgeUrl = `${String(env.SUPABASE_URL).replace(/\/$/, '')}/functions/v1/faculty-learner-invite`
    const proxied = await fetch(edgeUrl, {
      method: 'POST',
      headers: supabaseHeaders(env, auth.authorization),
      body: await request.text(),
    })
    return new Response(proxied.body, { status: proxied.status, headers: { ...CORS, 'content-type': proxied.headers.get('content-type') || 'application/json' } })
  }
  if (path === '/faculty/pdf/import' && request.method === 'POST') {
    let form
    try { form = await request.formData() } catch { return json({ detail: 'Invalid multipart PDF upload' }, 400) }
    const file = form.get('file')
    const pdfCourseId = String(form.get('course_id') || '').trim()
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(pdfCourseId)) return json({ detail: 'A valid course identifier is required' }, 422)
    if (!file || typeof file.arrayBuffer !== 'function') return json({ detail: 'PDF file is required' }, 422)
    if (file.size < 1 || file.size > MAX_PDF_BYTES) return json({ detail: `PDF must be between 1 byte and ${MAX_PDF_BYTES} bytes` }, 413)

    let source
    try { source = await readPdfSourceText(file) } catch (error) { return json({ detail: error.message || 'PDF could not be parsed' }, 422) }
    const filename = String(file.name || 'course-source.pdf').split(/[\\/]/).pop()
    let pdfDraft
    try { pdfDraft = buildGoogleDocCourseDraft(source.text, `pdf:${source.sha256.slice(0, 24)}`, filename) } catch (error) { return json({ detail: error.message }, 422) }
    pdfDraft.source.sha256 = source.sha256
    pdfDraft.source.page_count = source.pageCount
    pdfDraft.source.title = filename
    pdfDraft = await enrichCourseDraft(env, pdfCourseId, source.text, pdfDraft)
    pdfDraft = await groundDraftInOpenStax(env, auth.authorization, pdfDraft)
    return json({ course_id: pdfCourseId, status: 'shadow_draft', operator: auth.operator, draft: pdfDraft }, 201)
  }
  if (path !== '/faculty/google-docs/import' || request.method !== 'POST') return json({ detail: `Unknown faculty endpoint: ${path}` }, 404)

  const payload = await request.json().catch(() => ({}))
  const courseId = String(payload.course_id || '').trim()
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(courseId)) return json({ detail: 'A valid course identifier is required' }, 422)
  let documentId
  try { documentId = extractGoogleDocId(payload.document_url) } catch (error) { return json({ detail: error.message }, 422) }

  let response
  try {
    response = await fetch(`https://docs.google.com/document/d/${documentId}/export?format=txt`, { redirect: 'follow' })
  } catch {
    return json({ detail: 'Google Docs is temporarily unavailable' }, 503)
  }
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || contentType.includes('text/html') || response.url.includes('accounts.google.com')) {
    return json({ detail: 'The document could not be read. Share it as “Anyone with the link can view,” then try again.' }, 403)
  }
  const sourceText = (await response.text()).slice(0, MAX_GOOGLE_DOC_CHARACTERS + 1)
  if (sourceText.length > MAX_GOOGLE_DOC_CHARACTERS) return json({ detail: 'Google Doc exceeds the 250,000-character import limit' }, 413)
  const title = cleanExcerpt(sourceText.split('\n').find((line) => line.trim()) || 'Google Docs course source', 120)
  let draft
  try { draft = buildGoogleDocCourseDraft(sourceText, documentId, title) } catch (error) { return json({ detail: error.message }, 422) }
  draft.source.sha256 = await sha256Hex(new TextEncoder().encode(cleanPdfText(sourceText)))
  draft.source.canonical_url = `https://docs.google.com/document/d/${documentId}/edit`

  draft = await enrichCourseDraft(env, courseId, sourceText, draft)
  draft = await groundDraftInOpenStax(env, auth.authorization, draft)
  return json({ course_id: courseId, status: 'shadow_draft', operator: auth.operator, draft }, 201)
}

/**
 * Open textbook passages related to a draft, for citation alongside it.
 *
 * Lexical search over the OpenStax index; the caller's own session authorises
 * the read, so a draft can only be grounded by someone entitled to the course.
 * Retrieval failure is not draft failure — an ungrounded draft is still usable.
 */
// Terms that carry no topical signal, so an OR query is not dragged toward
// whichever section happens to use the most connective prose.
const REFERENCE_STOPWORDS = new Set([
  'about', 'after', 'against', 'because', 'been', 'before', 'being', 'between', 'build',
  'course', 'from', 'generation', 'have', 'into', 'introduction', 'learn', 'module',
  'over', 'section', 'source', 'student', 'students', 'their', 'them', 'then', 'these',
  'they', 'this', 'through', 'understand', 'using', 'what', 'when', 'where', 'which',
  'while', 'with', 'within', 'would', 'your',
])

// Measured against the live index: queries whose topic the corpus really covers
// rank 0.35-0.50, while queries on absent topics top out around 0.29 on shared
// vocabulary alone. Citing that second group would mislead a reader, so a
// section with nothing genuinely related is better left uncited.
const MIN_REFERENCE_RANK = 0.33

/**
 * websearch_to_tsquery conjoins its terms, so a whole sentence matches almost
 * nothing. Reduce the phrase to its distinctive words and join them with `or`,
 * leaving ts_rank to order what comes back.
 */
function toReferenceQuery(text) {
  const words = String(text || '').toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []
  const terms = [...new Set(words)].filter((word) => !REFERENCE_STOPWORDS.has(word)).slice(0, 12)
  return terms.join(' or ')
}

async function findOpenStaxReferences(env, authorization, query, limit = 4) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !authorization) return []
  const search = toReferenceQuery(query)
  if (search.length < 4) return []
  try {
    const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/rest/v1/rpc/search_openstax_sections`, {
      method: 'POST',
      headers: supabaseHeaders(env, authorization),
      body: JSON.stringify({ p_query: search, p_limit: limit * 3 }),
    })
    if (!response.ok) return []
    const rows = await response.json()
    if (!Array.isArray(rows)) return []
    return rows
      .filter((row) => Number(row.rank) >= MIN_REFERENCE_RANK)
      .slice(0, limit)
      .map((row) => ({
        title: row.title,
        url: row.url,
        book: row.book_title,
        license_url: row.license_url,
        excerpt: cleanExcerpt(row.excerpt || '', 400),
      }))
  } catch {
    return []
  }
}

/**
 * Attach open-textbook references to each generated section, and to the module.
 *
 * Only the citation and a short excerpt travel with the draft. Bulk reuse of a
 * section's prose is a licensing decision, not a retrieval one, so the licence
 * of every cited passage rides along for the caller to honour.
 */
async function groundDraftInOpenStax(env, authorization, draft) {
  const sections = Array.isArray(draft?.sections) ? draft.sections : []
  if (!sections.length) return draft
  const seen = new Set()
  const moduleReferences = []
  for (const section of sections) {
    const query = [section.title, section.reading?.purpose].filter(Boolean).join(' ')
    const references = await findOpenStaxReferences(env, authorization, query)
    if (!references.length) continue
    section.references = references
    for (const reference of references) {
      if (seen.has(reference.url)) continue
      seen.add(reference.url)
      moduleReferences.push(reference)
    }
  }
  if (moduleReferences.length) {
    draft.references = moduleReferences
    draft.quality.citation_verification = 'openstax-retrieved'
    draft.quality.warnings.push(`${moduleReferences.length} open textbook passages cited; honour each passage's licence before reusing its text.`)
  } else {
    draft.quality.citation_verification = 'not-verified'
    draft.quality.warnings.push('No independent OpenStax passages were retrieved; an instructor must verify claims before approval.')
  }
  return draft
}

/** Plain source text from an uploaded PDF, for faculty course drafting. */
async function readPdfSourceText(file) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new Error('File signature is not a PDF')
  // Digest before parsing: the PDF reader detaches the buffer, which would
  // leave the checksum computed over zero bytes.
  const sha256 = await sha256Hex(bytes.slice())
  const document = await getDocumentProxy(bytes)
  if (!document.numPages) throw new Error('PDF contains no pages')
  if (document.numPages > MAX_PDF_PAGES) throw new Error(`PDF exceeds the ${MAX_PDF_PAGES}-page ingestion limit`)
  const extracted = await extractText(document, { mergePages: false })
  const rawPages = Array.isArray(extracted?.text) ? extracted.text : [extracted?.text || '']
  // Page markers are ingestion scaffolding and would be read as course headings.
  const text = rawPages.map((value) => cleanPdfText(value || '')).filter(Boolean).join('\n\n')
  return { text, pageCount: document.numPages, sha256 }
}

/**
 * Raise a deterministic source-grounded draft into a teachable module. Shared by
 * every faculty source type, so a PDF and a Google Doc yield the same quality of
 * structure. Without a provider key the deterministic draft stands on its own.
 */
async function enrichCourseDraft(env, courseId, sourceText, draft) {
  const key = env.OPENROUTER_API_KEY || ''
  if (!key) {
    draft.quality.warnings.push('AI enrichment is not configured; a deterministic source-grounded draft was created instead.')
    return draft
  }
  try {
    const generated = await openrouterJSON(key, [
      {
        role: 'system',
        content: 'You are a higher-education curriculum designer. Return JSON only. Convert the supplied course document into a source-grounded module draft. Preserve the source meaning. Every section needs title, reading {purpose, estimated_minutes, content}, activity {type, prompt, evidence_collected}, and simulation {concept, interaction, variables, evidence_collected}. reading.content is the lesson a learner actually reads: 200-350 words of markdown drawn from the source, teaching the section rather than summarising it. Simulations must be pedagogically useful and feasible as interactive parameter explorations. Ignore front matter such as journal mastheads, running headers, page numbers, author affiliation blocks, and reference lists. Do not invent citations, grades, or publication status.',
      },
      {
        role: 'user',
        content: `Course: ${courseId}\n\nReturn EXACTLY this JSON shape, with 4-8 entries in each array:\n{"learning_objectives":["measurable objective", "..."],"sections":[{"title":"...","reading":{"purpose":"...","estimated_minutes":8,"content":"200-350 words of markdown teaching this section"},"activity":{"type":"claim-evidence-revision","prompt":"...","evidence_collected":"..."},"simulation":{"concept":"...","interaction":"...","variables":["..."],"evidence_collected":"..."}}]}\n\nTitles must name what the section teaches, never the document's front matter.\n\nSOURCE DOCUMENT:\n${sourceText.slice(0, 24000)}`,
      },
      // Eight sections of lesson prose do not fit the previous 3,600-token
      // ceiling; a truncated body fails JSON.parse and drops the whole draft.
    ], { model: env.OPENROUTER_MODEL || DEFAULT_MODEL, temperature: 0.25, maxTokens: 16000 })
    const enriched = normalizeGeneratedCourseDraft(generated, draft)
    // The normalizer returns the fallback unchanged when the model answered
    // without usable sections. Say so rather than presenting it as generated.
    if (enriched === draft) draft.quality.warnings.push('AI enrichment returned no usable sections; the deterministic source-grounded draft was kept.')
    return enriched
  } catch {
    draft.quality.warnings.push('AI enrichment was unavailable; a deterministic source-grounded draft was created instead.')
    return draft
  }
}

function validateAdaptationPolicy(input) {
  const source = input && typeof input === 'object' ? input : {}
  const ratioKeys = ['mastery_support_threshold', 'friction_support_threshold', 'calibration_support_threshold', 'forgetting_risk_threshold', 'fade_mastery_threshold', 'fade_stability_threshold']
  const policy = { ...DEFAULT_ADAPTATION_POLICY, ...source }
  for (const key of ratioKeys) {
    const value = Number(policy[key])
    if (!Number.isFinite(value) || value < 0 || value > 1) return null
    policy[key] = Math.round(value * 100) / 100
  }
  policy.cooldown_minutes = Math.round(Number(policy.cooldown_minutes))
  policy.max_interventions_per_session = Math.round(Number(policy.max_interventions_per_session))
  if (policy.cooldown_minutes < 0 || policy.cooldown_minutes > 120 || policy.max_interventions_per_session < 1 || policy.max_interventions_per_session > 20) return null
  policy.show_why_now = policy.show_why_now !== false
  policy.require_human_approval = policy.require_human_approval !== false
  return policy
}

async function openrouter(key, messages, { model, temperature = 0.7, maxTokens = 600 } = {}) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      // OpenRouter attribution headers (optional but recommended).
      'HTTP-Referer': 'https://alget.pages.dev',
      'X-Title': 'ALGET Intelligent Textbook',
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `OpenRouter ${res.status}`)
  return (data?.choices?.[0]?.message?.content || '').trim()
}

// OpenRouter call constrained to a JSON object response (for structured
// endpoints). Strips markdown fences defensively before parsing.
async function openrouterJSON(key, messages, { model, temperature = 0.4, maxTokens = 1400 } = {}) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      'HTTP-Referer': 'https://alget.pages.dev',
      'X-Title': 'ALGET Intelligent Textbook',
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `OpenRouter ${res.status}`)
  let txt = (data?.choices?.[0]?.message?.content || '').trim()
  txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(txt)
}

// --- Bayesian Knowledge Tracing (ported from backend/knowledge_tracing.py) ---
// Deterministic math; no LLM needed.
function bktUpdate(pKnown, isCorrect, guess = 0.2, slip = 0.1, transit = 0.1) {
  let posterior
  if (isCorrect) {
    const ev = pKnown * (1 - slip) + (1 - pKnown) * guess
    posterior = ev <= 0 ? 0 : (pKnown * (1 - slip)) / ev
  } else {
    const ev = pKnown * slip + (1 - pKnown) * (1 - guess)
    posterior = ev <= 0 ? 0 : (pKnown * slip) / ev
  }
  const next = posterior + (1 - posterior) * transit
  return Math.max(0.0001, Math.min(0.9999, next))
}
function processQMatrix(currentStates, qMatrix, isCorrect) {
  const out = {}
  for (const [cid, weight] of Object.entries(qMatrix || {})) {
    const cur = currentStates && currentStates[cid] != null ? Number(currentStates[cid]) : 0.1
    const full = bktUpdate(cur, isCorrect)
    out[cid] = cur + Number(weight) * (full - cur) // weight-blended (partial Q-mapping)
  }
  return out
}
function applyTelemetryFusion(pSlip, pTransit, type, intensity = 1.0) {
  let slip = Number(pSlip), transit = Number(pTransit)
  if (type === 'hint_request') {
    slip = Math.min(0.5, slip + 0.05 * intensity)
    transit = Math.min(0.8, transit + 0.02 * intensity)
  } else if (type === 'chat_engagement') {
    transit = Math.min(0.9, transit + 0.1 * intensity)
  } else if (type === 'simulation_play') {
    slip = Math.max(0.01, slip - 0.05 * intensity)
    transit = Math.min(0.8, transit + 0.05 * intensity)
  }
  return { new_p_slip: slip, new_p_transit: transit }
}

// --- Artifact revision scoring (ported from backend score_artifact_revision_payload) ---
const _ART_STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'because', 'about', 'what', 'which', 'when', 'where', 'their', 'there', 'would', 'could', 'should', 'student', 'learner', 'artifact', 'work', 'product'])
function textTokens(value) {
  const out = new Set()
  for (const m of String(value || '').toLowerCase().matchAll(/[a-z][a-z0-9_-]{2,}/g)) {
    if (!_ART_STOP.has(m[0])) out.add(m[0])
  }
  return out
}
function clampN(v, min = 0, max = 1) { return Math.max(min, Math.min(max, v)) }
function boundedRatio(num, den = 1) { if (den <= 0) return 0; return Math.round(clampN(num / den, 0, 1) * 1000) / 1000 }
function r3(v) { return Math.round(v * 1000) / 1000 }
function interSize(a, b) { let n = 0; for (const x of a) if (b.has(x)) n++; return n }
function scoreArtifactRevision(req) {
  const e = (v) => String(v || '').trim()
  const initial = e(req.initial_draft), revised = e(req.revised_draft), claim = e(req.claim)
  const evidence = e(req.evidence), rationale = e(req.judgment_rationale), transfer = e(req.transfer)
  const iT = textTokens(initial), rT = textTokens(revised), cT = textTokens(claim)
  const eT = textTokens(evidence), raT = textTokens(rationale), tT = textTokens(transfer)
  const added = new Set([...rT].filter((x) => !iT.has(x)))
  const sClaim = interSize(rT, cT), sEv = interSize(rT, eT), sRa = interSize(rT, raT), sTr = interSize(rT, tT)
  const deltaChars = revised.length - initial.length
  const revisionDepth = clampN(boundedRatio(added.size, 12) * 0.65 + (Math.abs(deltaChars) >= 40 ? 0.2 : 0) + (rT.size >= Math.max(10, iT.size) ? 0.15 : 0), 0, 1)
  const claimClarity = clampN(boundedRatio(cT.size, 10) * 0.55 + boundedRatio(sClaim, Math.max(3, cT.size)) * 0.45, 0, 1)
  const evidenceAlignment = clampN(boundedRatio(eT.size, 12) * 0.35 + boundedRatio(sEv, Math.max(3, eT.size)) * 0.65, 0, 1)
  const judgmentQuality = clampN(boundedRatio(raT.size, 12) * 0.55 + boundedRatio(sRa, Math.max(2, raT.size)) * 0.25 + ((['modify', 'reject'].includes(req.judgment) && raT.size >= 6) ? 0.2 : 0.1), 0, 1)
  const transferReadiness = clampN(boundedRatio(tT.size, 10) * 0.55 + boundedRatio(sTr, Math.max(2, tT.size)) * 0.25 + (['audience', 'context', 'setting', 'course', 'role', 'dataset'].some((w) => transfer.toLowerCase().includes(w)) ? 0.2 : 0), 0, 1)
  const union = new Set([...cT, ...eT, ...raT, ...tT])
  const addedRelevant = [...added].filter((x) => union.has(x)).length
  const specificityDelta = clampN(boundedRatio(addedRelevant, 8) * 0.7 + boundedRatio(Math.max(0, deltaChars), 180) * 0.3, 0, 1)
  const overall = r3(0.2 * claimClarity + 0.22 * evidenceAlignment + 0.18 * revisionDepth + 0.16 * judgmentQuality + 0.12 * transferReadiness + 0.12 * specificityDelta)
  const errs = []
  if (!e(req.course)) errs.push('missing_course')
  if (!e(req.section)) errs.push('missing_section')
  if (initial.length < 12) errs.push('initial_draft_too_short')
  if (revised.length < 12) errs.push('revised_draft_too_short')
  if (evidence.length < 12) errs.push('evidence_too_short')
  if (rationale.length < 12) errs.push('judgment_rationale_too_short')
  return {
    validator_pass: errs.length === 0,
    validation_errors: errs,
    policy_version: 'artifact-revision-scorer-v1',
    scores: {
      claim_clarity: r3(claimClarity), evidence_alignment: r3(evidenceAlignment), revision_depth: r3(revisionDepth),
      judgment_quality: r3(judgmentQuality), transfer_readiness: r3(transferReadiness), specificity_delta: r3(specificityDelta),
      overall_revision_quality: overall,
    },
    diagnostics: {
      initial_token_count: iT.size, revised_token_count: rT.size, added_token_count: added.size,
      revision_delta_chars: deltaChars, claim_overlap: sClaim, evidence_overlap: sEv,
    },
  }
}

// --- Artifact trace validation (ported from backend validate_artifact_trace_payload) ---
const ARTIFACT_RUBRIC_KEYS = [
  'claim_visibility',
  'evidence_specificity',
  'support_boundary',
  'revision_quality',
  'rejection_rationale',
  'transfer_constraint',
]
function cleanStr(value) { return String(value ?? '').trim() }
function clampInt(value, low, high) {
  const n = parseInt(value, 10)
  const v = Number.isFinite(n) ? n : low
  return Math.max(low, Math.min(high, v))
}
function artifactSupportMove(traceScore) {
  if (traceScore <= 3) return 'explain'
  if (traceScore <= 6) return 'compare'
  return 'audit'
}
function validateArtifactTrace(req) {
  const lengths = [
    req.initial_draft_length,
    req.claim_length,
    req.evidence_length,
    req.accepted_length,
    req.rejected_length,
    req.judgment_rationale_length,
    req.revised_draft_length,
    req.transfer_length,
  ].map((value) => Math.max(0, parseInt(value, 10) || 0))

  const computedTraceScore = lengths.filter((length) => length >= 12).length
  const rubric = (req.rubric && typeof req.rubric === 'object') ? req.rubric : {}
  const normalizedRubric = {}
  for (const key of ARTIFACT_RUBRIC_KEYS) normalizedRubric[key] = clampInt(rubric[key], 0, 2)
  const computedQuality = Math.round((Object.values(normalizedRubric).reduce((sum, value) => sum + value, 0) / (ARTIFACT_RUBRIC_KEYS.length * 2)) * 1000) / 1000
  const recommendedSupportMove = artifactSupportMove(computedTraceScore)
  const validationErrors = []

  if (!cleanStr(req.course)) validationErrors.push('missing_course')
  if (!cleanStr(req.section)) validationErrors.push('missing_section')
  if (!cleanStr(req.artifact)) validationErrors.push('missing_artifact')
  if (computedTraceScore !== (parseInt(req.trace_score, 10) || 0)) validationErrors.push('trace_score_mismatch')
  if (Math.abs(computedQuality - Number(req.artifact_quality_score || 0)) > 0.01) validationErrors.push('artifact_quality_score_mismatch')
  if (req.recommended_support_move && req.recommended_support_move !== recommendedSupportMove) validationErrors.push('recommended_support_mismatch')
  if (!['explain', 'compare', 'audit'].includes(cleanStr(req.support_move))) validationErrors.push('unsupported_support_move')

  return {
    validator_pass: validationErrors.length === 0,
    validation_errors: validationErrors,
    computed_trace_score: computedTraceScore,
    computed_artifact_quality_score: computedQuality,
    recommended_support_move: recommendedSupportMove,
    normalized_rubric: normalizedRubric,
    policy_version: 'artifact-trace-validator-v1',
  }
}

// --- Practice grading (ported from backend grading_service.py) ---
const UNIT_CONV = { n: 1, kn: 1000, lbf: 4.44822, lb: 4.44822, m: 1, cm: 0.01, mm: 0.001, km: 1000, in: 0.0254, ft: 0.3048, rad: 1, deg: 0.0174533, '°': 0.0174533, kg: 1, g: 0.001, lb_mass: 0.453592, pa: 1, kpa: 1000, mpa: 1000000, psi: 6894.76 }
const UNIT_GROUPS = { force: ['n', 'kn', 'lbf', 'lb'], length: ['m', 'cm', 'mm', 'km', 'in', 'ft'], angle: ['rad', 'deg', '°'], mass: ['kg', 'g', 'lb_mass'], pressure: ['pa', 'kpa', 'mpa', 'psi'] }
function normUnit(u) { return String(u || '').trim().toLowerCase() }
function parseNumeric(v) { const c = String(v ?? '').trim().replace(/,/g, '').replace(/\s/g, ''); if (c === '') return null; const n = Number(c); return Number.isFinite(n) ? n : null }
function unitGroup(u) { const n = normUnit(u); for (const [g, us] of Object.entries(UNIT_GROUPS)) if (us.includes(n)) return g; return null }
function toBase(value, unit) { const k = normUnit(unit); if (k in UNIT_CONV) { const g = unitGroup(k); if (g) return [value * UNIT_CONV[k], UNIT_GROUPS[g][0]] } return [value, unit] }
function unitsCompatible(uu, eu) { if (!uu || !eu) return true; const ug = unitGroup(uu), eg = unitGroup(eu); if (ug && eg) return ug === eg; return normUnit(uu) === normUnit(eu) }
function gradeNumeric(userAnswer, userUnit, expectedValue, expectedUnit, tolerance = 0.01, requireUnit = true, tolAbs = false) {
  const result = { is_correct: false, value_correct: false, unit_correct: false, unit_error: false, expected: `${expectedValue} ${expectedUnit}`, explanation: '' }
  const userValue = parseNumeric(userAnswer)
  if (userValue === null) { result.explanation = 'Could not parse your answer as a number.'; return result }
  if (requireUnit && expectedUnit) {
    if (!userUnit) { result.unit_error = true; result.explanation = `Please include the unit. Expected unit: ${expectedUnit}`; return result }
    if (!unitsCompatible(userUnit, expectedUnit)) { result.unit_error = true; result.explanation = `Unit mismatch. You used '${userUnit}', expected '${expectedUnit}' or equivalent.`; return result }
  }
  const [userBase] = toBase(userValue, userUnit || expectedUnit)
  const [expBase] = toBase(expectedValue, expectedUnit)
  result.unit_correct = normUnit(userUnit || '') === normUnit(expectedUnit || '') || unitsCompatible(userUnit, expectedUnit)
  if (tolAbs) {
    let userInExpected = userValue
    if (userUnit && expectedUnit && unitsCompatible(userUnit, expectedUnit)) { const [ub] = toBase(userValue, userUnit); const [ef] = toBase(1.0, expectedUnit); if (ef) userInExpected = ub / ef }
    result.value_correct = Math.abs(userInExpected - expectedValue) <= tolerance
  } else if (expBase === 0) { result.value_correct = Math.abs(userBase) < tolerance }
  else { result.value_correct = Math.abs(userBase - expBase) / Math.abs(expBase) <= tolerance }
  result.is_correct = result.value_correct && result.unit_correct
  if (result.is_correct) result.explanation = 'Correct! Well done.'
  else if (result.value_correct && !result.unit_correct) result.explanation = `The numeric value is correct, but check your units. Expected: ${expectedUnit}`
  else if (!result.value_correct && result.unit_correct) result.explanation = `The unit is correct, but the value is off. Expected: ${expectedValue}`
  else result.explanation = `Both value and unit need correction. Expected: ${expectedValue} ${expectedUnit}`
  return result
}
function normalizeExpected(problem) {
  const fa = problem.final_answer
  if (fa && typeof fa === 'object' && fa.value !== undefined) return { expected_value: fa.value, expected_unit: fa.unit || '', tolerance: fa.tolerance ?? 0.01, abs: true }
  if (problem.expected_value !== undefined && problem.expected_value !== null) return { expected_value: problem.expected_value, expected_unit: problem.expected_unit || '', tolerance: problem.tolerance ?? 0.01, abs: false }
  return null
}
function resolveOptionMisconceptionId(problem, idx) {
  const om = problem.option_misconceptions
  if (om && typeof om === 'object' && !Array.isArray(om) && idx != null) { let c = om[idx] ?? om[String(idx)]; if (typeof c === 'string') c = c.trim(); if (c) return c }
  const ol = problem.option_misconception_ids
  if (Array.isArray(ol) && idx != null && idx >= 0 && idx < ol.length) { let c = ol[idx]; if (typeof c === 'string') c = c.trim(); if (c) return c }
  const pl = problem.misconception_id
  if (typeof pl === 'string' && pl.trim()) return pl.trim()
  return null
}

// --- Adaptive recommendation (ported from backend build_adaptive_recommendation) ---
const ADAPTIVE_WORKER_URL = 'https://alget-adaptive-recommendation.jewoong-moon.workers.dev'
function normRatioA(v, fb = 0) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fb }
function normSignal(v, ceiling) { if (ceiling <= 0) return 0; return clampN(Number(v) / ceiling, 0, 1) }
function humanizeConcept(c) { return c ? String(c).replace(/_/g, ' ') : 'this concept' }
function topMisconPressure(patterns) { if (!Array.isArray(patterns) || !patterns.length) return 0; const top = Math.max(...patterns.map((p) => Number(p.count) || 0)); return clampN(top / 4, 0, 1) }
function estimateOutcomes(actionScores, am, cr, fs, fr, tr) {
  const out = {}
  for (const [action, score] of Object.entries(actionScores || {})) {
    out[action] = {
      success_rate: Math.round(clampN(0.18 + am * 0.24 + cr * 0.12 + score * 0.34 - fs * 0.11 - fr * 0.06, 0.05, 0.97) * 1000) / 1000,
      retention_lift: Math.round(clampN(0.1 + score * 0.28 + (1 - fr) * 0.26 + tr * 0.18 + (['practice', 'represent'].includes(action) ? 0.06 : 0) + (action === 'explain' ? 0.04 : 0), 0.03, 0.96) * 1000) / 1000,
    }
  }
  return out
}
function buildCard(action, title, rationale, evidence, focusConcepts, coachPrompt = '') {
  return { action, title, rationale, evidence: (evidence || []).filter(Boolean).slice(0, 4), focus_concepts: (focusConcepts || []).filter(Boolean).slice(0, 3), coach_prompt: coachPrompt }
}
const _ADAPT_REASON_PROSE = {
  policy_emergency_pause: 'Adaptive support is temporarily paused by the course administrator; core reading and practice remain available.',
  policy_session_limit: 'Support is paused because this session reached the instructor-set intervention limit.',
  policy_cooldown: 'Support is held back during the instructor-set cooldown so the learner can work independently.',
  policy_faded_for_independence: 'High mastery and stable performance triggered intentional support fading.',
  policy_insufficient_support_signal: 'Current evidence does not cross the instructor-set threshold for an intervention.',
  unit_mismatch: 'A unit mismatch is present, which strongly favors direct conceptual repair.',
  idle_reengagement: 'The learner paused long enough that a lighter re-entry move is justified.',
  low_mastery: 'Average mastery is still below the stability band for fluent application.',
  high_friction: 'Recent stuck and wrong-answer signals indicate substantial friction in this section.',
  retrieval_risk: 'Forgetting risk is elevated, so the engine favors retrieval-supportive actions.',
  calibration_gap: 'Confidence and correctness are diverging, which makes unsupported advancement risky.',
  misconception_pattern: 'Misconception tags are clustering around the same idea, so the engine is correcting the frame instead of repeating the task.',
  annotation_friction: 'Peer/self annotations contain question or confusion signals, so support is being selected from reading evidence, not only quiz data.',
  annotation_section_focus: 'Annotations anchored to this exact section show the friction is about this reading, so the engine targets it directly.',
  artifact_quality_gap: 'Artifact trace quality or completeness is still weak, so the engine is holding back unsupported advancement.',
  artifact_revision_regression: 'The latest artifact revision scored lower than the prior draft, so the engine repairs before advancing.',
  artifact_annotation_momentum: 'Annotation and artifact traces show enough momentum to favor practice or advancement.',
  transfer_ready: 'Transfer readiness is strong enough that application-oriented moves are likely to pay off.',
  balanced_profile: 'No single risk dominated, so the action was chosen by the best overall score across mastery, friction, and transfer.',
}
const _ADAPT_TITLE_RATIONALE = {
  explain: ['Repair the conceptual footing before the next attempt', 'The learner profile shows that direct clarification is the safest path before more application.'],
  represent: ['Shift the representation before repeating the step', 'A new frame is more likely to unlock progress than repeating the same explanation or retry.'],
  practice: ['Reinforce the idea with one targeted attempt', 'Signals suggest the concept is close to stable and should now be consolidated through practice.'],
  advance: ['Preserve momentum and move the learner forward', 'Mastery and transfer signals are stable enough that extra support would create drag.'],
  ask: ['Use a diagnostic coaching turn', 'The learner state is mixed enough that one targeted question is the best way to disambiguate the next move.'],
}
const _ADAPT_FALLBACKS = {
  explain: [['represent', 'Try a visual or analogy', 'A second representation can reduce abstraction if the text explanation still feels heavy.'], ['practice', 'Return to one focused attempt', 'After the explanation lands, a single targeted problem helps transfer the idea.'], ['ask', 'Ask BigAL for a diagnostic hint', 'A short coaching exchange can pinpoint exactly where the reasoning is breaking.']],
  represent: [['explain', 'Pair the new view with a simpler explanation', 'Combining a representation with plain-language coaching often closes the gap quickly.'], ['practice', 'Test the new model right away', 'A quick attempt checks whether the new representation is usable, not just interesting.'], ['ask', 'Ask BigAL to compare two models', 'Dialog can help the learner connect the new representation back to the formal concept.']],
  practice: [['explain', 'Review the fragile step first', 'A brief explanation can prevent avoidable repetition if the learner is still uncertain.'], ['ask', 'Ask BigAL for a single scaffold', 'A targeted prompt keeps practice productive without giving away the answer.']],
  advance: [['practice', 'Do one stretch problem before advancing', 'A harder application can confirm the concept is robust enough to transfer forward.'], ['ask', 'Ask for a deeper extension', 'BigAL can connect the concept to a richer engineering use case before the learner moves on.']],
  ask: [['explain', 'Start with a direct explanation', 'If the learner cannot name the issue yet, a clean explanation is the safest starting point.'], ['represent', 'Switch to a new view', 'A diagram or analogy may surface the misconception faster than free-form chat.']],
}
function pct(x) { return `${Math.round(x * 100)}%` }

// Flatten the frontend's chat history (assistant entries can be intent objects)
// into plain OpenRouter messages.
function historyToMessages(history) {
  if (!Array.isArray(history)) return []
  return history.slice(-6).map((m) => {
    let content = m?.content
    if (content && typeof content === 'object') {
      content = content.text || content.summary || content.explanation || content.error || JSON.stringify(content)
    }
    return { role: m?.role === 'assistant' ? 'assistant' : 'user', content: String(content || '') }
  }).filter((m) => m.content)
}

const AGENTIC_TOOLS = [
  { id: 'course.read', label: 'Read course content', risk: 'low', roles: ['learner', 'instructor', 'course_admin', 'admin'], approval: 'none' },
  { id: 'mastery.read_own', label: 'Read own mastery evidence', risk: 'low', roles: ['learner'], approval: 'none' },
  { id: 'study_plan.write_own', label: 'Draft or revise own study plan', risk: 'low', roles: ['learner'], approval: 'learner' },
  { id: 'cohort.aggregate.read', label: 'Read cohort-level learning signals', risk: 'medium', roles: ['instructor', 'course_admin', 'admin'], approval: 'none' },
  { id: 'intervention.draft', label: 'Draft a cohort intervention', risk: 'medium', roles: ['instructor', 'course_admin', 'admin'], approval: 'instructor' },
  { id: 'learner.message', label: 'Send a learner communication', risk: 'high', roles: ['instructor', 'course_admin', 'admin'], approval: 'instructor', executable: false },
  { id: 'grade.finalize', label: 'Finalize a grade', risk: 'high', roles: ['instructor'], approval: 'instructor', executable: false },
  { id: 'content.publish', label: 'Publish course content', risk: 'high', roles: ['course_admin', 'admin'], approval: 'course_admin', executable: false },
]

const AGENTIC_TRANSITIONS = {
  draft: ['awaiting_approval', 'cancelled'],
  awaiting_approval: ['active', 'cancelled', 'blocked'],
  active: ['paused', 'completed', 'blocked', 'cancelled'],
  paused: ['active', 'cancelled'],
  blocked: ['awaiting_approval', 'cancelled'],
  completed: [],
  cancelled: [],
}

function evaluateAgenticTool(body) {
  const tool = AGENTIC_TOOLS.find((entry) => entry.id === body.tool_id)
  if (!tool) return { allowed: false, reason: 'unknown_tool', tool_id: body.tool_id }
  if (!tool.roles.includes(body.actor_role)) return { allowed: false, reason: 'role_not_permitted', tool }
  if (tool.executable === false) return { allowed: false, reason: 'execution_not_implemented', tool }
  if (tool.approval !== 'none' && body.approved !== true) return { allowed: false, reason: 'approval_required', tool }
  return { allowed: true, reason: 'policy_passed', tool }
}

function validateAgenticTransition(body) {
  const targets = AGENTIC_TRANSITIONS[body.current_status]
  if (!targets) return { allowed: false, reason: 'unknown_current_status' }
  if (!targets.includes(body.target_status)) return { allowed: false, reason: 'invalid_transition' }
  if (body.current_status === 'awaiting_approval' && body.target_status === 'active' && body.approved !== true) {
    return { allowed: false, reason: 'approval_required' }
  }
  return { allowed: true, reason: 'transition_allowed' }
}

function buildAgenticLearnerPlan(body) {
  const targetMastery = Number(body.target_mastery ?? 0.8)
  const weeklyMinutes = Number(body.weekly_minutes ?? 180)
  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  const targetDate = new Date(`${body.target_date}T00:00:00.000Z`)
  if (!body.course_id || !body.goal_title || !Number.isFinite(targetDate.getTime())) throw new Error('invalid_plan_request')
  if (targetDate < today) throw new Error('target_date must be today or later')
  if (targetMastery < 0.5 || targetMastery > 1) throw new Error('target_mastery must be between 0.5 and 1.0')
  if (weeklyMinutes < 60 || weeklyMinutes > 1200) throw new Error('weekly_minutes must be between 60 and 1200')
  const mastery = (Array.isArray(body.mastery) ? body.mastery : [])
    .filter((row) => row?.concept_id)
    .map((row) => ({ concept_id: String(row.concept_id), mastery: Math.max(0, Math.min(1, Number(row.mastery_score ?? row.p_known ?? 0))), attempts: Math.max(0, Number(row.attempts_count || 0)) }))
    .sort((left, right) => left.mastery - right.mastery || left.attempts - right.attempts || left.concept_id.localeCompare(right.concept_id))
  const weak = mastery.filter((row) => row.mastery < targetMastery)
  const focus = weak.length ? weak : mastery.length ? mastery.slice(0, 3) : [{ concept_id: 'course-foundations', mastery: 0, attempts: 0 }]
  const sessionCount = Math.max(3, Math.min(7, Math.round(weeklyMinutes / 35)))
  const sessionMinutes = Math.max(20, Math.min(50, Math.floor(weeklyMinutes / sessionCount)))
  const daysAvailable = Math.max(1, Math.min(7, Math.floor((targetDate - today) / 86400000) + 1))
  const modes = ['explain', 'worked-example', 'retrieval-practice', 'teach-back']
  const sessions = Array.from({ length: sessionCount }, (_, index) => {
    const concept = focus[index % focus.length]
    const scheduled = new Date(today); scheduled.setUTCDate(today.getUTCDate() + Math.round(index * Math.max(0, daysAvailable - 1) / Math.max(1, sessionCount - 1)))
    const mode = modes[index % modes.length]
    return {
      id: `session-${index + 1}`, scheduled_for: scheduled.toISOString().slice(0, 10), minutes: sessionMinutes,
      concept_id: concept.concept_id, mode,
      actions: ['Review the learning objective and one canonical example', `Complete a ${mode.replaceAll('-', ' ')} activity`, 'Record confidence before checking feedback', 'Finish with one retrieval question'],
      why_now: `Current mastery evidence is ${Math.round(concept.mastery * 100)}% from ${concept.attempts} recorded attempt(s), below the ${Math.round(targetMastery * 100)}% goal.`,
    }
  })
  return {
    schema_version: 'agentic-study-plan-v1', course_id: body.course_id, goal: String(body.goal_title).trim(),
    target_date: body.target_date, target_mastery: targetMastery, weekly_minutes: weeklyMinutes, generated_at: new Date().toISOString(),
    planning_horizon: { starts_on: today.toISOString().slice(0, 10), days: daysAvailable }, focus_concepts: focus.slice(0, 8), sessions,
    evidence: { source: 'learner_mastery_snapshot', concept_count: mastery.length, weak_concept_count: weak.length, causal_claim: false },
    learner_control: { requires_approval: true, can_edit: true, can_pause: true, can_cancel: true, memory_scope: 'learner-owned' },
  }
}

function buildAgenticIntervention(body) {
  const learnerCount = Number(body.learner_count)
  const average = Math.max(0, Math.min(1, Number(body.average_mastery)))
  if (!body.course_id || !body.concept_id || !Number.isFinite(learnerCount) || learnerCount < 1 || !Number.isFinite(average)) throw new Error('invalid_intervention_request')
  return {
    schema_version: 'agentic-intervention-v1', course_id: body.course_id, concept_id: body.concept_id,
    title: `Re-teach ${String(body.concept_id).replace(/[_-]/g, ' ')}`,
    summary: `Prepare a short compare-and-correct activity for ${learnerCount} learner(s); do not send or grade automatically.`,
    recommended_actions: ['Open with one diagnostic contrast example', 'Ask learners to explain the difference before feedback', 'Assign one low-stakes retrieval check', 'Review the next evidence snapshot before further action'],
    evidence: { learner_count: learnerCount, average_mastery: Math.round(average * 10000) / 10000, threshold: 0.6, urgency: average < 0.4 ? 'urgent' : 'monitor', causal_claim: false },
    target_user_ids: Array.isArray(body.target_user_ids) ? body.target_user_ids : [], risk_level: 'medium',
    delivery: { executed: false, requires_instructor_approval: true }, generated_at: new Date().toISOString(),
  }
}

function roadmapManifest() {
  return {
    schema_version: 'roadmap-manifest-v1',
    roadmap_contract: ROADMAP_CONTRACT_VERSION,
    horizons: {
      '0-12_months': ['governed_runtime_package', 'evidence_visible_generation', 'human_release_gate'],
      '12-24_months': ['decision_ledger', 'bounded_adaptive_interventions', 'social_outcome_metrics', 'evaluation_manifest'],
      '24-36_months': ['caliper', 'oneroster', 'case', 'model_registry', 'privacy_controls', 'incident_review'],
    },
    high_risk_actions: { publish: 'human_approval', grade: 'human_approval', message: 'human_approval', enroll: 'human_approval', policy_change: 'human_approval' },
    analytics: ['mastery', 'metacognitive_calibration', 'evidence_alignment', 'transfer', 'social_reasoning'],
  }
}

async function buildRoadmapRuntimePackage(body) {
  const courseId = String(body.course_id || '').trim()
  const sourceText = String(body.source_text || '')
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(courseId) || !sourceText.trim()) throw new Error('course_and_source_required')
  const source = { ...(body.source || {}) }
  source.sha256 = source.sha256 || await sha256Hex(new TextEncoder().encode(sourceText))
  source.title = String(source.title || 'Untitled course source').slice(0, 160)
  const sections = (Array.isArray(body.sections) ? body.sections : []).map((section, index) => ({
    id: String(section.id || `section-${index + 1}`), title: String(section.title || `Section ${index + 1}`),
    reading: { content: String(section.reading?.content || ''), estimated_minutes: Number(section.reading?.estimated_minutes || 8) },
    learning_objectives: Array.isArray(section.learning_objectives) ? section.learning_objectives : [],
    references: Array.isArray(section.references) ? section.references : [],
    activity: section.activity || { status: 'proposed' }, simulation: section.simulation || { status: 'proposed' },
    tutor: section.tutor || { status: 'proposed', approval: 'required' }, social: section.social || { status: 'proposed', dismissible: true },
  }))
  return {
    schema_version: ROADMAP_CONTRACT_VERSION, course_id: courseId, source, sections,
    runtime: { tutor: 'course_scoped', analytics: roadmapManifest().analytics, social_cues: 'passive_optional', high_risk_actions: 'default_deny' },
    policy: body.policy || { release_gate: 'human_approval_required', autonomy: 'bounded' },
    release: { status: 'shadow_draft', student_visible: false, automatic_publish: false, approval: null },
    created_at: new Date().toISOString(),
  }
}

function validateRoadmapRuntimePackage(pkg) {
  const errors = [], warnings = []
  const sourceHash = String(pkg?.source?.sha256 || '')
  if (!/^[0-9a-f]{64}$/.test(sourceHash)) errors.push('source_sha256_required')
  if (!pkg?.course_id) errors.push('course_id_required')
  if (!Array.isArray(pkg?.sections) || pkg.sections.length === 0) errors.push('sections_required')
  for (const [index, section] of (pkg.sections || []).entries()) {
    if (!String(section.id || '').trim()) errors.push(`section_${index}_id_required`)
    if (!String(section.reading?.content || '').trim()) errors.push(`section_${index}_reading_required`)
    if (!(section.references || []).length) warnings.push(`section_${index}_no_references`)
    for (const reference of section.references || []) if (reference.url && !String(reference.url).toLowerCase().startsWith('https://')) errors.push(`section_${index}_unsafe_reference`)
  }
  const release = pkg.release || {}
  if (release.status === 'published' && (!release.approval?.actor_id || !release.approval?.approved_at)) errors.push('published_requires_human_approval')
  if (release.automatic_publish) errors.push('automatic_publish_forbidden')
  return { valid: errors.length === 0, errors, warnings, claims_are_not_independently_verified: true }
}

function buildRoadmapDecision(body) {
  const decision = String(body.decision || '')
  if (!['accept', 'modify', 'reject', 'defer'].includes(decision)) throw new Error('invalid_agent_decision')
  if (!body.course_id || !body.actor_id || !body.proposal_id) throw new Error('decision_identity_required')
  if (decision === 'modify' && body.revised === undefined) throw new Error('modified_decision_requires_revised_value')
  return {
    id: `decision-${crypto.randomUUID()}`, schema_version: 'agent-decision-v1', course_id: body.course_id,
    proposal_id: body.proposal_id, actor: { id: body.actor_id, role: body.actor_role || 'instructor' }, decision,
    original: body.original, revised: decision === 'modify' ? body.revised : body.original,
    rationale: String(body.rationale || '').slice(0, 2000), evidence_ids: Array.isArray(body.evidence_ids) ? body.evidence_ids.filter(Boolean) : [],
    created_at: new Date().toISOString(),
  }
}

function summarizeRoadmapSocial(events) {
  const rows = Array.isArray(events) ? events : []
  const cueImpressions = rows.filter((event) => ['peer_pulse_seen', 'your_cue_selected', 'evidence_echo_opened'].includes(event.event_type)).length
  const started = rows.filter((event) => event.event_type === 'social_round_started').length
  const completed = rows.filter((event) => event.event_type === 'social_evidence_compared' && event.evidence_submitted).length
  return { schema_version: 'social-outcomes-v1', cue_impressions: cueImpressions, evidence_compare_started: started, evidence_compare_completed: completed, evidence_compare_completion_rate: started ? Number((completed / started).toFixed(4)) : null, learning_gain_claim: 'not_inferred_from_clicks', missing_evidence: completed === 0 }
}

function roadmapCaliper(body) {
  if (![body.event_type, body.actor_id, body.course_id, body.object_id, body.action].every((value) => String(value || '').trim())) throw new Error('caliper_event_fields_required')
  return { '@context': 'http://purl.imsglobal.org/ctx/caliper/v1p2', type: body.event_type, id: `urn:alget:event:${crypto.randomUUID()}`, eventTime: new Date().toISOString(), actor: { id: `urn:alget:user:${body.actor_id}`, type: 'Person' }, action: body.action, object: { id: `urn:alget:course:${body.course_id}:${body.object_id}`, type: 'DigitalResource' }, extensions: { course_id: body.course_id, ...(body.extensions || {}) } }
}

function roadmapOneRoster(body) {
  const users = (Array.isArray(body.users) ? body.users : []).map((user) => {
    if (!String(user.sourcedId || '').trim()) throw new Error('oneroster_sourced_id_required')
    const role = String(user.role || 'student').toLowerCase()
    if (!['student', 'teacher', 'administrator'].includes(role)) throw new Error('oneroster_role_invalid')
    return { sourcedId: String(user.sourcedId), status: String(user.status || 'active'), role, orgs: Array.isArray(user.orgs) ? user.orgs : [], metadata: { source: 'oneroster', privacy_scope: 'course_only' } }
  })
  return { schema_version: 'oneroster-v1', users }
}

function roadmapCase(body) {
  if (![body.uri, body.statement, body.human_code, body.document_uri].every((value) => String(value || '').trim())) throw new Error('case_competency_fields_required')
  return { uri: body.uri, fullStatement: body.statement, humanCodingScheme: body.human_code, CFDocument: { uri: body.document_uri }, type: 'CFItem', source: 'alget' }
}

function roadmapLti13(body) {
  if (!String(body.issuer || '').toLowerCase().startsWith('https://')) throw new Error('lti13_issuer_must_be_https')
  if (![body.client_id, body.deployment_id, body.context_id, body.course_id, body.resource_link_id].every((value) => String(value || '').trim())) throw new Error('lti13_context_fields_required')
  return {
    schema_version: 'lti13-context-v1', iss: body.issuer, client_id: body.client_id, deployment_id: body.deployment_id,
    context: { id: body.context_id, course_id: body.course_id }, resource_link: { id: body.resource_link_id },
    roles: Array.isArray(body.roles) && body.roles.length ? [...new Set(body.roles)] : ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
    privacy_scope: 'course_only', launch_state: 'requires_oidc_validation', jwt_validation_required: true,
  }
}

function roadmapPrivacy(body, confirm = false) {
  const subjectId = String(body.subject_id || '')
  if (!subjectId) throw new Error('privacy_subject_required')
  const records = Array.isArray(body.records) ? body.records : []
  const matches = records.filter((record) => [record.user_id, record.owner_id, record.actor_id, record.subject_id].includes(subjectId))
  if (!confirm) return { schema_version: 'privacy-deletion-v1', subject_id: subjectId, status: 'ready_for_confirmation', record_ids: matches.map((record) => record.id).filter(Boolean), requires_explicit_confirmation: true }
  return { schema_version: 'privacy-deletion-v1', subject_id: subjectId, status: 'deleted', removed_ids: matches.map((record) => record.id).filter(Boolean), remaining_records: records.filter((record) => !matches.includes(record)) }
}

function roadmapEvaluation(body) {
  if (![body.course_id, body.intervention, body.comparison, body.primary_outcome].every((value) => String(value || '').trim())) throw new Error('evaluation_manifest_fields_required')
  return { schema_version: 'evaluation-manifest-v1', course_id: body.course_id, intervention: body.intervention, comparison: body.comparison, primary_outcome: body.primary_outcome, secondary_outcomes: Array.isArray(body.secondary_outcomes) ? body.secondary_outcomes : [], preregistered: false, causal_claim_status: 'not_established', created_at: new Date().toISOString() }
}

async function handleRoadmapRequest(request, env, path) {
  if (path === '/roadmap/manifest' && request.method === 'GET') return json(roadmapManifest())
  const isAdminPath = path.includes('/model-registry') || path.includes('/incidents') || path.includes('/oneroster') || path.includes('/case') || path.includes('/lti13')
  const auth = isAdminPath ? await requireCourseAdmin(request, env) : await requireFacultyInstructor(request, env)
  if (auth.error) return auth.error
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {}
  try {
    if (path === '/roadmap/runtime-package' && request.method === 'POST') {
      const pkg = await buildRoadmapRuntimePackage(body)
      const persistence = await persistRoadmapRow(env, auth.authorization, 'course_runtime_packages', {
        course_id: pkg.course_id, source_sha256: pkg.source.sha256, package: pkg, status: pkg.release.status,
        student_visible: false, created_by: auth.operator.subject,
      })
      return json({ package: pkg, validation: validateRoadmapRuntimePackage(pkg), persistence })
    }
    if (path === '/roadmap/decision-ledger' && request.method === 'POST') {
      const event = buildRoadmapDecision(body)
      const persistence = await persistRoadmapRow(env, auth.authorization, 'agent_decision_ledger', {
        course_id: event.course_id, proposal_id: event.proposal_id, actor_id: auth.operator.subject,
        actor_role: event.actor.role, decision: event.decision, original: event.original, revised: event.revised,
        rationale: event.rationale, evidence_ids: event.evidence_ids, event_hash: event.id,
      })
      return json({ event, persistence }, 201)
    }
    if (path === '/roadmap/social/outcomes' && request.method === 'POST') return json(summarizeRoadmapSocial(body.events))
    if (path === '/roadmap/interoperability/caliper' && request.method === 'POST') {
      const payload = roadmapCaliper(body)
      const persistence = await persistRoadmapRow(env, auth.authorization, 'roadmap_interop_events', { course_id: body.course_id, standard: 'caliper', payload, actor_id: auth.operator.subject })
      return json({ ...payload, persistence })
    }
    if (path === '/roadmap/interoperability/oneroster' && request.method === 'POST') {
      const payload = roadmapOneRoster(body)
      const persistence = await persistRoadmapRow(env, auth.authorization, 'roadmap_interop_events', { course_id: String(body.course_id || 'institutional'), standard: 'oneroster', payload, actor_id: auth.operator.subject })
      return json({ ...payload, persistence })
    }
    if (path === '/roadmap/interoperability/case' && request.method === 'POST') {
      const payload = roadmapCase(body)
      const persistence = await persistRoadmapRow(env, auth.authorization, 'roadmap_interop_events', { course_id: String(body.course_id || 'institutional'), standard: 'case', payload, actor_id: auth.operator.subject })
      return json({ ...payload, persistence })
    }
    if (path === '/roadmap/interoperability/lti13' && request.method === 'POST') {
      const payload = roadmapLti13(body)
      const persistence = await persistRoadmapRow(env, auth.authorization, 'roadmap_interop_events', { course_id: body.course_id, standard: 'lti13', payload, actor_id: auth.operator.subject })
      return json({ ...payload, persistence })
    }
    if (path === '/roadmap/model-registry' && request.method === 'GET') return json({ schema_version: 'model-registry-v1', models: [...ROADMAP_MODELS.values()] })
    if (path === '/roadmap/model-registry' && request.method === 'POST') {
      if (body.status === 'production' && !body.approved_by) return json({ detail: 'production_model_requires_approval' }, 422)
      const record = { id: `${body.provider}:${body.model_id}:${body.version}`, provider: body.provider, model_id: body.model_id, version: body.version, capabilities: Array.isArray(body.capabilities) ? body.capabilities : [], status: body.status || 'draft', approved_by: body.approved_by || auth.operator.subject, registered_at: new Date().toISOString() }
      ROADMAP_MODELS.set(record.id, record)
      const persistence = await persistRoadmapRow(env, auth.authorization, 'agent_model_registry', { provider: record.provider, model_id: record.model_id, version: record.version, capabilities: record.capabilities, status: record.status, approved_by: auth.operator.subject, registered_by: auth.operator.subject })
      return json({ ...record, persistence }, 201)
    }
    if (path === '/roadmap/privacy/export' && request.method === 'POST') {
      const subjectId = String(body.subject_id || '')
      const payload = { schema_version: 'privacy-export-v1', subject_id: subjectId, generated_at: new Date().toISOString(), records: (body.records || []).filter((record) => [record.user_id, record.owner_id, record.actor_id, record.subject_id].includes(subjectId)) }
      const persistence = await persistRoadmapRow(env, auth.authorization, 'roadmap_privacy_requests', { subject_id: subjectId, request_type: 'export', status: 'completed', record_ids: payload.records.map((record) => record.id).filter(Boolean), requested_by: auth.operator.subject, completed_at: new Date().toISOString() })
      return json({ ...payload, persistence })
    }
    if (path === '/roadmap/privacy/delete' && request.method === 'POST') {
      const payload = roadmapPrivacy(body, body.confirm === true)
      const persistence = await persistRoadmapRow(env, auth.authorization, 'roadmap_privacy_requests', { subject_id: body.subject_id, request_type: 'delete', status: payload.status, record_ids: payload.record_ids || payload.removed_ids || [], requested_by: auth.operator.subject, confirmed_at: body.confirm === true ? new Date().toISOString() : null })
      return json({ ...payload, persistence })
    }
    if (path === '/roadmap/incidents' && request.method === 'POST') {
      const incident = { id: `incident-${crypto.randomUUID()}`, schema_version: 'incident-v1', course_id: body.course_id, severity: body.severity, category: body.category, summary: body.summary, detected_by: auth.operator.subject, status: 'open', timeline: [{ status: 'open', actor_id: auth.operator.subject, at: new Date().toISOString() }] }
      ROADMAP_INCIDENTS.set(incident.id, incident)
      const persistence = await persistRoadmapRow(env, auth.authorization, 'roadmap_incidents', { course_id: incident.course_id, severity: incident.severity, category: incident.category, summary: incident.summary, status: incident.status, detected_by: auth.operator.subject, timeline: incident.timeline })
      return json({ ...incident, persistence }, 201)
    }
    const incidentMatch = path.match(/^\/roadmap\/incidents\/([^/]+)\/transition$/)
    if (incidentMatch && request.method === 'POST') {
      const incident = ROADMAP_INCIDENTS.get(incidentMatch[1])
      if (!incident) return json({ detail: 'Incident not found' }, 404)
      const allowed = { open: ['triaged'], triaged: ['contained', 'resolved'], contained: ['resolved'], resolved: [] }
      if (!allowed[incident.status]?.includes(body.target_status)) return json({ detail: 'incident_transition_invalid' }, 422)
      incident.status = body.target_status
      incident.timeline.push({ status: body.target_status, actor_id: auth.operator.subject, note: String(body.note || ''), at: new Date().toISOString() })
      return json(incident)
    }
    if (path === '/roadmap/evaluation-manifest' && request.method === 'POST') {
      const manifest = roadmapEvaluation(body)
      const persistence = await persistRoadmapRow(env, auth.authorization, 'roadmap_evaluation_manifests', { course_id: manifest.course_id, intervention: manifest.intervention, comparison: manifest.comparison, primary_outcome: manifest.primary_outcome, secondary_outcomes: manifest.secondary_outcomes, preregistered: false, causal_claim_status: manifest.causal_claim_status, created_by: auth.operator.subject })
      return json({ ...manifest, persistence }, 201)
    }
    return json({ detail: `Unknown roadmap endpoint: ${path}` }, 404)
  } catch (error) { return json({ detail: error.message || 'Roadmap request invalid' }, 422) }
}

export {
  evaluateAgenticTool,
  validateAgenticTransition,
  buildAgenticLearnerPlan,
  buildAgenticIntervention,
  extractGoogleDocId,
  buildGoogleDocCourseDraft,
  roadmapManifest,
  validateRoadmapRuntimePackage,
  buildRoadmapDecision,
  summarizeRoadmapSocial,
  roadmapCaliper,
  roadmapLti13,
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/api/, '') || '/'

    // Warm-up is now a no-op: every endpoint is served by this Worker (or static
    // Pages), so there is no sleepy backend to wake. Kept so the app's on-load
    // ping still gets a 200. Only wakes a backend if one is explicitly configured.
    if (path === '/warmup') {
      return json({ ok: true })
    }

    if (path === '/health') {
      return json({
        status: 'ready',
        runtime: 'cloudflare-worker',
        release_schema_version: RELEASE_SCHEMA_VERSION,
        services: {
          adaptive_worker: Boolean(env.ADAPTIVE),
          adaptation_policy_store: Boolean(env.ADAPTATION_POLICIES),
          administrator_identity: Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY),
          ai_provider: Boolean(env.OPENROUTER_API_KEY),
        },
      })
    }

    if (path === '/agentic/tools' && request.method === 'GET') {
      return json({ schema_version: 'agentic-tool-registry-v1', tools: AGENTIC_TOOLS, default_policy: 'deny' })
    }

    if (path.startsWith('/roadmap/')) {
      return handleRoadmapRequest(request, env, path)
    }

    if (path.startsWith('/admin/')) {
      return handleAdminRequest(request, env, path)
    }
    if (path.startsWith('/faculty/')) {
      return handleFacultyRequest(request, env, path)
    }

    let body = {}
    if (request.method === 'POST') {
      try { body = await request.json() } catch { body = {} }
    }
    // Server key by default; allow a per-user OpenRouter key via the request.
    const key = (body.api_key && String(body.api_key).trim()) || env.OPENROUTER_API_KEY || ''
    const model = env.OPENROUTER_MODEL || DEFAULT_MODEL
    const noKeyMsg = 'AI support is not configured yet (no OpenRouter key). Add your own key in Settings, or ask your instructor to enable it.'

    try {
      if (path === '/agentic/tools/evaluate') return json(evaluateAgenticTool(body))
      if (path === '/agentic/workflows/transition-check') return json(validateAgenticTransition(body))
      if (path === '/agentic/learner-plan') {
        try { return json(buildAgenticLearnerPlan(body)) } catch (error) { return json({ detail: error.message }, 422) }
      }
      if (path === '/agentic/interventions/propose') {
        try { return json(buildAgenticIntervention(body)) } catch (error) { return json({ detail: error.message }, 422) }
      }

      // --- Rail: simpler explanation ---
      if (path === '/assist/explain') {
        if (!key) return json({ explanation: noKeyMsg })
        const topic = body.section_title || body.section_id || 'this section'
        const explanation = await openrouter(key, [
          { role: 'system', content: 'You are BigAL, a warm, concise tutor inside an interactive textbook. Explain clearly for a struggling learner using an everyday analogy and a concrete example. Keep it under 200 words. Markdown allowed. Explain the actual topic given by its TITLE — do not reinterpret it from a URL slug or assume a different subject.' },
          { role: 'user', content: `Section title: "${topic}" (id: ${body.section_id || 'n/a'}). Problem: ${body.problem_id || 'general concept'}. The student is stuck (reason: ${body.stuck_reason || 'unknown'}). Give a simpler, step-by-step explanation of THIS topic.` },
        ], { model, temperature: 0.7, maxTokens: 500 })
        const generation_trace = await buildGenerationTrace({
          body,
          output: explanation,
          model,
          promptVersion: 'assist-explain-v2',
        })
        return json({ explanation, generation_trace })
      }

      // --- Rail: alternate representation ---
      if (path === '/assist/represent') {
        const type = body.representation_type || 'mindmap'
        if (!key) return json({ content: noKeyMsg, type })
        const guide = {
          mindmap: 'an indented text concept map (parent -> children) of the core idea',
          analogy: 'a vivid real-world analogy that builds intuition',
          visual: 'an ASCII / diagram-style sketch with labels',
          formula: 'the key formulas or rules, each with a one-line plain-language explanation',
        }[type] || 'a concise alternate representation'
        const topic = body.section_title || body.section_id || 'this section'
        const content = await openrouter(key, [
          { role: 'system', content: 'You produce concise alternate representations of textbook concepts. Be specific to the actual topic given by its TITLE; do not reinterpret it from a URL slug, and never assume statics/equilibrium. Markdown allowed.' },
          { role: 'user', content: `For the section titled "${topic}" (id: ${body.section_id || 'n/a'}), produce ${guide}.` },
        ], { model, temperature: 0.6, maxTokens: 600 })
        const generation_trace = await buildGenerationTrace({
          body,
          output: content,
          model,
          promptVersion: `assist-represent-${type}-v2`,
        })
        return json({ content, type, generation_trace })
      }

      // --- BigAL chat ---
      // Pedagogical guardrail policy (tutor chat ONLY; the rail/assessment
      // routes above and below are untouched). Evidence: scaffold-not-answer
      // prompt design outperforms unguided AI help (Kestin et al. 2025, Sci
      // Reports RCT) and guardrailed tutoring beats free-form GPT-4
      // (Chowdhury et al. 2024, L@S).
      if (path === '/orchestrate') {
        if (!key) return json({ intent: 'legacy', text: noKeyMsg })
        const ctx = body.current_content ? `\n\nSection context (excerpt):\n${String(body.current_content).slice(0, 2000)}` : ''
        const generatedTutorConfig = body.tutor_config ? `\n\nInstructor-approved tutor configuration (follow within these bounds):\n${JSON.stringify(body.tutor_config).slice(0, 3000)}` : ''
        const pedagogyPolicy = `

Tutoring pedagogy policy — follow it on every turn:
(a) Diagnose first: before helping, briefly infer from the learner's message (and the recent conversation) what they most likely misunderstand or are missing, and name it in one sentence.
(b) Hint ladder: respond with the smallest useful step — first a guiding question, then a conceptual cue, then a worked micro-step (one step, not the whole solution). Escalate one rung at a time, and only when the learner is still stuck after trying.
(c) Never state the complete final answer to a practice or quiz problem the learner is currently working on. Guide them to produce it themselves; you may confirm or correct the steps of their own attempt.
(d) End every turn with one short check question that tests whether the learner can take the next step on their own.`
        const messages = [
          { role: 'system', content: `You are BigAL, a friendly, rigorous tutor embedded in an interactive textbook (course: ${body.course || 'general'}). Answer the learner's question clearly and concisely, grounded in the section context when relevant. Use Markdown. If the learner highlighted a passage, explain it.${pedagogyPolicy}${generatedTutorConfig}${ctx}` },
          ...historyToMessages(body.history),
          { role: 'user', content: String(body.query || '') },
        ]
        const text = await openrouter(key, messages, { model, temperature: 0.6, maxTokens: 900 })
        // No recognized `intent` -> ChatWidget renders `text` via its generic
        // <p> branch. (intent:'learn' would route to LearnIntentCard, which
        // expects structured fields and would drop a plain answer.)
        const generation_trace = await buildGenerationTrace({
          body,
          output: text,
          model,
          promptVersion: 'bigal-tutor-hint-ladder-v2',
        })
        return json({ intent: 'answer', text, generation_trace })
      }

      // --- Mastery update (Bayesian Knowledge Tracing) — deterministic math ---
      if (path === '/grade') {
        return json({ new_states: processQMatrix(body.current_states, body.q_matrix, !!body.is_correct) })
      }
      if (path === '/telemetry_fusion') {
        return json(applyTelemetryFusion(body.current_p_slip, body.current_p_transit, body.interaction_type, body.intensity ?? 1.0))
      }

      // --- Knowledge Check: generate a formative assessment (2 MCQ + 1 summary) ---
      if (path === '/generate_assessment') {
        if (!key) return json({ assessment: { mcq_questions: [], summary_question: null }, summary: noKeyMsg })
        const objs = (Array.isArray(body.learning_objectives) ? body.learning_objectives : []).map((o) => `- ${o}`).join('\n') || 'None specified'
        const concepts = (Array.isArray(body.concept_ids) ? body.concept_ids : []).join(', ') || 'infer from context'
        const retrieved = (Array.isArray(body.retrieved_context) ? body.retrieved_context : []).slice(0, 5)
        const retrievedText = retrieved.map((item, index) => `[${index + 1}] ${String(item.content || '').slice(0, 1200)} (source: ${item.source_id || 'section-context'})`).join('\n\n') || 'No retrieved passages supplied; use only the provided section context.'
        const assessment = await openrouterJSON(key, [
          { role: 'system', content: 'You are an expert educator generating formative assessments aligned to learning objectives. Return ONLY a JSON object — no prose, no markdown.' },
          { role: 'user', content: `Section title: "${body.section_title || 'this section'}".
Context: ${(body.biology_context || '') + ' ' + (body.engineering_context || '')}
Learning objectives:\n${objs}
Target concepts (use when applicable): [${concepts}]
Retrieved source passages (every item must be grounded in one or more of these):\n${retrievedText}

Return EXACTLY this JSON shape, fitting THIS section's actual topic. Evidence must cite a retrieved passage index and a short verbatim excerpt (max 180 chars):
{"mcq_questions":[{"question":"...","options":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"correct_option_id":"A","explanation":"why correct & others wrong","concept_id":"...","evidence":[{"source_id":"...","passage_index":1,"excerpt":"..."}]}],"summary_question":{"question":"a generative short-answer prompt","concept_id":"...","rubric":"key points expected","evidence":[{"source_id":"...","passage_index":1,"excerpt":"..."}]}}
Exactly 2 items in mcq_questions and exactly 1 summary_question.` },
        ], { model, temperature: 0.5, maxTokens: 1500 })
        const generation_trace = await buildGenerationTrace({
          body,
          output: assessment,
          model,
          promptVersion: 'formative-assessment-objective-aligned-v2',
          sourceKind: 'assessment_context',
          sourceText: `${body.biology_context || ''}\n${body.engineering_context || ''}\n${retrievedText}`,
          sourceTitle: body.section_title || 'Assessment generation context',
        })
        return json({ assessment, summary: 'Assessment generated successfully.', generation_trace })
      }

      // --- Knowledge Check: grade a short-answer/summary against a rubric ---
      if (path === '/grade_summary') {
        if (!key) return json({ content_score: 0.5, wording_score: 0.5, sub_scores: {}, feedback: noKeyMsg, is_passing: false })
        const out = await openrouterJSON(key, [
          { role: 'system', content: 'You are an expert educator grading a student short-answer response against a rubric. Return ONLY a JSON object.' },
          { role: 'user', content: `Question: ${body.question || ''}
Rubric / expected key points: ${body.rubric || ''}
Student answer: ${body.student_answer || ''}

Return EXACTLY: {"content_score":0.0-1.0,"wording_score":0.0-1.0,"sub_scores":{"<dimension>":0.0-1.0},"feedback":"2-3 sentences, praise first then what's missing","is_passing":true if content_score>=0.7 else false}` },
        ], { model, temperature: 0.3, maxTokens: 700 })
        const generation_trace = await buildGenerationTrace({
          body,
          output: out,
          model,
          promptVersion: 'summary-rubric-grader-v2',
          sourceKind: 'rubric',
          sourceText: body.rubric || '',
          sourceTitle: 'Instructor-provided scoring rubric',
          sourceLocator: 'request.rubric',
        })
        return json({ ...out, generation_trace })
      }

      // Image generation has been removed. If anything still calls it, return a
      // clear disabled response rather than proxying.
      if (path === '/generate-image') {
        return json({ success: false, error: 'Image generation has been disabled.' })
      }

      // --- Artifact revision scoring (deterministic, ported from backend) ---
      if (path === '/research/artifact-revision/score') {
        return json(scoreArtifactRevision(body))
      }

      // --- Artifact trace validation (deterministic, no raw text persisted) ---
      if (path === '/research/artifact-trace/validate') {
        return json(validateArtifactTrace(body))
      }

      // --- Practice problem grading (deterministic; reads static content) ---
      if (path.startsWith('/grade/')) {
        const problemId = decodeURIComponent(path.slice('/grade/'.length))
        const staticBase = (env.STATIC_API_BASE || DEFAULT_STATIC_BASE).replace(/\/$/, '')
        let section = null
        if (body.section_id) {
          try { const r = await fetch(`${staticBase}/book/${body.section_id}`); if (r.ok) section = await r.json() } catch { section = null }
        }
        const problems = (section && section.practice && section.practice.problems) || []
        let problem = problems.find((p) => String(p.id) === String(problemId))
        if (!problem) {
          problem = { id: problemId, type: 'numeric', expected_value: 693.67, expected_unit: 'N', tolerance: 0.02, require_unit: true }
        }
        if (problem.type === 'multiple_choice') {
          const options = problem.options || []
          const correctIndex = problem.correct_index
          let selectedIndex = body.selected_option
          if ((selectedIndex === null || selectedIndex === undefined) && body.answer) { const i = options.indexOf(body.answer); selectedIndex = i >= 0 ? i : null }
          const isCorrect = selectedIndex != null && correctIndex != null && Number(selectedIndex) === Number(correctIndex)
          const expectedText = (correctIndex != null && correctIndex >= 0 && correctIndex < options.length) ? options[correctIndex] : ''
          const resp = {
            is_correct: isCorrect,
            user_answer: body.answer || (selectedIndex != null && selectedIndex >= 0 && selectedIndex < options.length ? options[selectedIndex] : ''),
            expected: expectedText,
            explanation: problem.explanation || (isCorrect ? 'Correct.' : 'Not quite — review the explanation and try again.'),
            selected_option: selectedIndex,
            correct_index: correctIndex,
          }
          if (!isCorrect) {
            const mid = resolveOptionMisconceptionId(problem, selectedIndex)
            if (mid) {
              const entry = ((section && section.misconceptions) || []).find((m) => m.id === mid)
              if (entry) resp.misconception = { id: entry.id || mid, pattern: entry.pattern || '', feedback: entry.feedback || '', rail_action: entry.rail_action || '', description: entry.description || '' }
            }
          }
          return json(resp)
        }
        const ptype = problem.type || 'numeric'
        if (ptype === 'conceptual') return json({ is_correct: null, auto_graded: false, explanation: 'This is a short-answer question and is not auto-graded here.', expected: problem.expected_answer || '' })
        const expected = normalizeExpected(problem)
        if (!expected) return json({ is_correct: null, auto_graded: false, explanation: 'This problem has no machine-checkable answer key, so it is not auto-graded.' })
        const result = gradeNumeric(body.answer, body.unit || '', expected.expected_value, expected.expected_unit, expected.tolerance, problem.require_unit !== false, expected.abs)
        result.auto_graded = true
        if (problem.steps && ptype === 'step_based') result.steps = problem.steps
        return json(result)
      }

      // --- Concept origin (first section a concept appears in) — static index ---
      if (path.startsWith('/concept/') && path.endsWith('/origin')) {
        const cid = decodeURIComponent(path.slice('/concept/'.length, path.length - '/origin'.length))
        const staticBase = (env.STATIC_API_BASE || DEFAULT_STATIC_BASE).replace(/\/$/, '')
        let map = {}
        try { const r = await fetch(`${staticBase}/concept-origins`); if (r.ok) map = await r.json() } catch { map = {} }
        return json({ concept_id: cid, section_slug: map[cid] || null })
      }

      // --- Mastery graph (skeleton from static content + live mastery overlay) ---
      if (path === '/mastery_graph') {
        const course = body.course || 'inst-design'
        const staticBase = (env.STATIC_API_BASE || DEFAULT_STATIC_BASE).replace(/\/$/, '')
        let skel = null
        try { const r = await fetch(`${staticBase}/mastery-graph/${course}`); if (r.ok) skel = await r.json() } catch { skel = null }
        if (!skel) return json({ nodes: [], links: [] })
        const md = (body.mastery_data && typeof body.mastery_data === 'object') ? body.mastery_data : {}
        const currentSectionId = body.current_section_id || null
        const currentConcepts = Array.isArray(body.current_concepts) ? body.current_concepts : []
        let focusChapter = null
        if (currentSectionId) { const parts = String(currentSectionId).split('/'); if (parts.length >= 2) focusChapter = parts[1] }
        let nodes = skel.nodes || []
        if (focusChapter) { const scoped = nodes.filter((n) => n.chapter === focusChapter); if (scoped.length) nodes = scoped }
        const normRatio = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.1 }
        const statusOf = (p) => (p >= 0.8 ? 'mastered' : p >= 0.5 ? 'emerging' : 'novice')
        nodes = nodes.map((n) => {
          const pk = (n.id in md) ? normRatio(md[n.id]) : 0.1
          return { ...n, p_known: Math.round(pk * 100) / 100, status: statusOf(pk), is_current: n.section_id === currentSectionId || currentConcepts.includes(n.id) }
        })
        const ids = new Set(nodes.map((n) => n.id))
        const links = (skel.links || []).filter((l) => ids.has(l.source) && ids.has(l.target))
        return json({ nodes, links })
      }

      // --- Adaptive recommendation (deterministic; policy via dedicated worker) ---
      if (path === '/adaptive_recommendation') {
        const t = body.telemetry || {}
        const ti = (k) => Math.max(0, Number(t[k]) || 0)
        const lp = body.learner_profile || {}
        const mastery = Array.isArray(body.mastery) ? body.mastery : []
        const conceptIds = (Array.isArray(body.concept_ids) ? body.concept_ids : []).filter(Boolean)
        const staticBase = (env.STATIC_API_BASE || DEFAULT_STATIC_BASE).replace(/\/$/, '')
        let sectionSnapshot = null
        let contentVersion = body.content_version || null
        let contentVersionAlgorithm = body.content_version_algorithm || null
        if (body.section_id) {
          try {
            const sr = await fetch(`${staticBase}/book/${body.section_id}`)
            if (sr.ok) sectionSnapshot = await sr.json()
          } catch {
            sectionSnapshot = null
          }
          const descriptor = sectionSnapshot?.content_version
          if (descriptor && typeof descriptor === 'object') {
            contentVersion = contentVersion || descriptor.content_version || null
            contentVersionAlgorithm = contentVersionAlgorithm || descriptor.algorithm || null
          }
        }

        const conceptScores = mastery.map((s) => [s.concept_id, normRatioA(s.mastery_score != null ? s.mastery_score : s.p_known, 0.45)])
        let averageMastery, lowestConcept, lowestScore
        if (conceptScores.length) {
          averageMastery = conceptScores.reduce((a, [, v]) => a + v, 0) / conceptScores.length
          ;[lowestConcept, lowestScore] = conceptScores.reduce((m, c) => (c[1] < m[1] ? c : m))
        } else { averageMastery = conceptIds.length ? 0.45 : 0.5; lowestConcept = conceptIds[0] || null; lowestScore = averageMastery }

        const practiceAttempts = ti('practice_attempts')
        const correctAttempts = Math.max(0, Math.min(ti('correct_attempts'), practiceAttempts))
        const correctRatio = practiceAttempts ? correctAttempts / practiceAttempts : 0
        let frustration = ti('stuck_events') * 3 + ti('consecutive_wrong') * 2 + ti('hint_requests') + ti('affect_confused') * 2 + ti('affect_disengaged') * 2 + ti('idle_events')
        frustration += Math.round(normRatioA(lp.forgetting_risk, 0.5) * 2) + Math.round(normRatioA(lp.calibration_drift, 0) * 2)
        let positiveMomentum = correctAttempts * 2 + ti('affect_insight') * 2 + ti('affect_engaged')
        if (normRatioA(lp.transfer_readiness, 0) >= 0.7) positiveMomentum += 1
        const uncertainty = clampN(mastery.reduce((a, s) => a + 1 / Math.sqrt(Math.max(1, (Number(s.attempts_count) || 0) + 1)), 0) / Math.max(1, mastery.length), 0, 1)
        const frictionSignal = normSignal(frustration, 10)
        const masteryGap = clampN(1 - averageMastery, 0, 1)
        const accuracyGap = practiceAttempts ? clampN(1 - correctRatio, 0, 1) : masteryGap
        const forgettingRisk = normRatioA(lp.forgetting_risk, 0.5)
        const calibrationDrift = normRatioA(lp.calibration_drift, 0)
        const transferReadiness = normRatioA(lp.transfer_readiness, 0)
        const stabilityIndex = normRatioA(lp.stability_index, 0)
        // Backend model defaults these to 0.0 (not average_mastery), and
        // _normalize_ratio(0.0) returns 0.0 — so the average_mastery fallback is
        // never actually reached. Match the 0.0 default for omitted fields.
        const predNextCorrect = normRatioA(lp.predicted_next_correct, 0)
        const predRetention = normRatioA(lp.predicted_retention, 0)
        const misconPressure = clampN(Math.max(topMisconPressure(lp.misconception_patterns), normRatioA(lp.misconception_pressure, 0)), 0, 1)
        const engagementSignal = clampN((positiveMomentum + ti('chat_turns') * 0.5) / 6, 0, 1)
        const supportFatigue = normSignal(Number(lp.recent_interventions) || 0, 6)
        const chatSignal = normSignal(ti('chat_turns') + ti('explain_requests') + ti('representation_requests'), 5)
        const annFriction = clampN(normSignal(ti('annotation_questions') + ti('annotation_confusions') * 2, 6) + Math.min(0.2, ti('annotation_helpful_reactions') * 0.03), 0, 1)
        const annMomentum = clampN(normSignal(ti('annotation_insights') + ti('annotation_connections'), 5), 0, 1)
        const artifactQuality = normRatioA(t.artifact_quality_average, 0)
        const artifactCompleteness = normRatioA(t.artifact_trace_completeness, 0)
        const hasArtifact = !!ti('artifact_trace_count')
        const artifactGap = hasArtifact ? clampN(1 - Math.max(artifactQuality, artifactCompleteness * 0.6), 0, 1) : 0
        const sr = String(body.stuck_reason || '').toLowerCase()
        const unitSignal = sr.includes('unit') ? 1 : 0
        const idleSignal = sr.includes('idle') ? 1 : 0

        let readiness = 'support'
        if (averageMastery >= 0.8 && frustration <= 1 && artifactGap <= 0.25 && (correctRatio >= 0.75 || positiveMomentum >= 3)) readiness = 'advance'
        else if (averageMastery >= 0.45 && frustration <= 4) readiness = 'practice'
        let confidenceSignal = 'Needs support'
        if (readiness === 'advance') confidenceSignal = 'Ready to advance'
        else if (readiness === 'practice') confidenceSignal = 'Ready for guided practice'
        else if (normRatioA(lp.calibration_drift, 0) >= 0.35) confidenceSignal = 'Confidence is unstable'

        let focusConcepts = conceptIds.slice(0, 3)
        if (lowestConcept && !focusConcepts.includes(lowestConcept)) focusConcepts.unshift(lowestConcept)
        focusConcepts = focusConcepts.slice(0, 3)

        const r4 = (x) => Math.round(x * 10000) / 10000
        const features = {
          mastery_gap: r4(masteryGap), average_mastery: r4(averageMastery), friction_signal: r4(frictionSignal), frustration_index: frustration,
          accuracy_gap: r4(accuracyGap), uncertainty_signal: r4(uncertainty), correct_ratio: r4(correctRatio), forgetting_risk: r4(forgettingRisk),
          calibration_drift: r4(calibrationDrift), transfer_readiness: r4(transferReadiness), stability_index: r4(stabilityIndex),
          predicted_next_correct: r4(predNextCorrect), predicted_retention: r4(predRetention), misconception_pressure: r4(misconPressure),
          engagement_signal: r4(engagementSignal), support_fatigue: r4(supportFatigue), chat_signal: r4(chatSignal), unit_signal: unitSignal,
          idle_signal: idleSignal, no_stuck_reason: body.stuck_reason ? 0 : 1, artifact_quality: r4(artifactQuality), artifact_gap: r4(artifactGap),
          artifact_revision_delta: 0, annotation_friction: r4(annFriction), annotation_momentum: r4(annMomentum), annotation_section_overlap: 0,
        }

        // Policy: delegate to the parity-tested adaptive worker via a Service
        // Binding (internal; public worker-to-worker fetch is restricted).
        let decision
        try {
          const polReq = new Request('https://adaptive/recommend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ features, annotation_adaptive: body.annotation_adaptive !== false, prefer_advance: readiness === 'advance', section_id: body.section_id, content_version: contentVersion, content_version_algorithm: contentVersionAlgorithm }) })
          const dr = env.ADAPTIVE ? await env.ADAPTIVE.fetch(polReq) : await fetch(ADAPTIVE_WORKER_URL, polReq)
          decision = await dr.json()
        } catch { decision = null }
        if (!decision || !decision.action_scores) return json({ error: 'policy unavailable' }, 502)

        const actionScores = decision.action_scores
        let primaryAction = decision.selected_action
        const policyMode = decision.policy_mode
        const courseKey = String(body.course || body.section_id || '').split('/')[0]
        let activePolicy = null
        let adaptationControl = null
        if (courseKey && env.ADAPTATION_POLICIES) {
          try {
            [activePolicy, adaptationControl] = await Promise.all([
              env.ADAPTATION_POLICIES.get(`policy:${courseKey}:active`, 'json'),
              env.ADAPTATION_POLICIES.get(`policy:${courseKey}:control`, 'json'),
            ])
          } catch {
            activePolicy = null
            adaptationControl = null
          }
        }
        const policyConfig = activePolicy?.policy ? { ...DEFAULT_ADAPTATION_POLICY, ...activePolicy.policy } : null
        let interventionAllowed = true
        let suppressionReason = null
        if (adaptationControl?.enabled === false) {
          suppressionReason = 'emergency_pause'
          interventionAllowed = false
          primaryAction = readiness === 'advance' ? 'advance' : 'practice'
        } else if (policyConfig) {
          const recentInterventions = Math.max(0, Number(lp.recent_interventions) || 0)
          const rawMinutesSinceLast = Number(lp.minutes_since_last_intervention)
          const minutesSinceLast = Number.isFinite(rawMinutesSinceLast) ? Math.max(0, rawMinutesSinceLast) : Number.POSITIVE_INFINITY
          const supportSignal = averageMastery < policyConfig.mastery_support_threshold || frictionSignal >= policyConfig.friction_support_threshold || calibrationDrift >= policyConfig.calibration_support_threshold || forgettingRisk >= policyConfig.forgetting_risk_threshold
          if (recentInterventions >= policyConfig.max_interventions_per_session) suppressionReason = 'session_limit'
          else if (recentInterventions > 0 && minutesSinceLast < policyConfig.cooldown_minutes) suppressionReason = 'cooldown'
          else if (averageMastery >= policyConfig.fade_mastery_threshold && stabilityIndex >= policyConfig.fade_stability_threshold) suppressionReason = 'faded_for_independence'
          else if (!supportSignal) suppressionReason = 'insufficient_support_signal'
          interventionAllowed = !suppressionReason
          if (!interventionAllowed) primaryAction = readiness === 'advance' ? 'advance' : 'practice'
        }
        let ranked = Object.entries(actionScores).sort((a, b) => b[1] - a[1])
        if (ranked[0][0] !== primaryAction) ranked = Object.entries(actionScores).sort((a, b) => (a[0] !== primaryAction) - (b[0] !== primaryAction) || b[1] - a[1])
        const secondBest = ranked.length > 1 ? ranked[1][1] : ranked[0][1]
        const predictedOutcomes = estimateOutcomes(actionScores, averageMastery, correctRatio, frictionSignal, forgettingRisk, transferReadiness)
        const [title, rationale] = _ADAPT_TITLE_RATIONALE[primaryAction] || _ADAPT_TITLE_RATIONALE.ask

        const evidence = []
        if (lowestConcept) evidence.push(`Lowest mastery is ${humanizeConcept(lowestConcept)} at ${pct(lowestScore)}.`)
        evidence.push(`Average mastery across this section is ${pct(averageMastery)}.`)
        if (practiceAttempts) evidence.push(`Recent practice accuracy is ${correctAttempts}/${practiceAttempts} (${pct(correctRatio)}).`)
        if (ti('hint_requests')) evidence.push(`Hint requests in this section: ${ti('hint_requests')}.`)
        if (ti('affect_confused')) evidence.push('Learner reported confusion in this section.')
        if (ti('affect_insight')) evidence.push('Learner reported an insight moment recently.')
        if (body.stuck_reason) evidence.push(`Current stuck signal: ${body.stuck_reason}.`)
        if (predNextCorrect) evidence.push(`Predicted next-attempt success is ${pct(predNextCorrect)}.`)

        const reasonCodes = (decision.reason_codes || []).slice(0, 5)
        if (suppressionReason) reasonCodes.unshift(`policy_${suppressionReason}`)
        const recommendedBecause = reasonCodes.filter((c) => _ADAPT_REASON_PROSE[c]).map((c) => _ADAPT_REASON_PROSE[c]).slice(0, 4)
        const notRecommended = []
        for (const [alt, score] of ranked.slice(1, 3)) {
          if (alt === 'advance' && (frictionSignal >= 0.35 || calibrationDrift >= 0.25)) notRecommended.push('Advance was not first because friction or calibration instability makes a forward jump too risky right now.')
          else if (alt === 'practice' && (accuracyGap >= 0.35 || ti('consecutive_wrong') >= 2)) notRecommended.push('Practice was not first because recent error patterns suggest the learner needs support before another attempt.')
          else if (alt === 'represent' && unitSignal) notRecommended.push('A representation shift was not first because a unit error is better repaired through direct explanation.')
          else if (alt === 'ask' && primaryAction !== 'ask') notRecommended.push('Free-form chat was held back because a more structured intervention has stronger evidence than open-ended coaching.')
          else notRecommended.push(`${alt.charAt(0).toUpperCase() + alt.slice(1)} scored lower (${pct(score)}) than ${primaryAction} (${pct(actionScores[primaryAction])}) for this learner state.`)
        }
        const coachPrompt = `I'm working on ${humanizeConcept(lowestConcept)} in ${body.section_title || body.section_id}. Can you coach me with one diagnostic question first?`
        const primary = buildCard(primaryAction, title, rationale, evidence, focusConcepts, coachPrompt)
        const secondary = (_ADAPT_FALLBACKS[primaryAction] || []).map(([a, st, sra]) => buildCard(a, st, sra, evidence, focusConcepts, coachPrompt)).slice(0, 3)

        const signalCoverage = clampN((mastery.length + (practiceAttempts ? 1 : 0) + (ti('stuck_events') ? 1 : 0) + (Number(lp.confidence_samples) ? 1 : 0)) / 6, 0, 1)
        const confidence = Math.round(clampN(0.38 + (ranked[0][1] - secondBest) * 0.95 + signalCoverage * 0.18 - uncertainty * 0.08, 0.2, 0.96) * 1000) / 1000

        let needsPrereq = null
        if (lowestConcept && lowestScore != null && lowestScore < 0.4) {
          let map = {}
          try { const r = await fetch(`${staticBase}/concept-origins`); if (r.ok) map = await r.json() } catch { map = {} }
          const origin = map[lowestConcept]
          if (origin) needsPrereq = { concept_id: lowestConcept, suggested_section_slug: origin, reason: `Mastery on '${lowestConcept}' is ${Math.round(lowestScore * 100)}%. Reviewing the section where this concept was introduced is likely more efficient than continuing forward.` }
        }
        const dominantMiscon = (Array.isArray(lp.misconception_patterns) && lp.misconception_patterns[0]) ? lp.misconception_patterns[0].type : null

        return json({
          section_id: body.section_id,
          decision_id: decision.decision_id,
          policy_mode: policyMode,
          policy_version: activePolicy ? `${courseKey}-v${activePolicy.version}` : 'heuristic-bandit-v2',
          adaptation_policy: activePolicy ? {
            id: activePolicy.id,
            version: activePolicy.version,
            intervention_allowed: interventionAllowed,
            suppression_reason: suppressionReason,
            show_why_now: policyConfig.show_why_now,
            emergency_paused: adaptationControl?.enabled === false,
          } : null,
          content_version: contentVersion,
          content_version_algorithm: contentVersionAlgorithm,
          learner_state: { average_mastery: Math.round(averageMastery * 1000) / 1000, lowest_mastery_concept: lowestConcept, readiness, frustration_index: frustration, confidence_signal: confidenceSignal, forgetting_risk: Math.round(forgettingRisk * 1000) / 1000, calibration_drift: Math.round(calibrationDrift * 1000) / 1000, transfer_readiness: Math.round(transferReadiness * 1000) / 1000, dominant_misconception: dominantMiscon },
          primary_recommendation: primary,
          secondary_recommendations: secondary,
          needs_prerequisite: needsPrereq,
          reasoning: { confidence, policy_mode: policyMode, reason_codes: reasonCodes, recommended_because: recommendedBecause, not_recommended_because: notRecommended.slice(0, 4), evidence_snapshot: decision.evidence_snapshot || {}, action_scores: actionScores, predicted_outcomes: predictedOutcomes, candidate_actions: decision.candidate_actions || [], rejected_actions: decision.rejected_actions || [] },
        })
      }

      // --- Research evaluation validation (deterministic, ported) ---
      if (path === '/research/evaluation/validate') {
        const items = Array.isArray(body.item_responses) ? body.item_responses : []
        const totalQuestions = Math.max(0, parseInt(body.total_questions || items.length, 10) || 0)
        const errors = []
        const seen = new Set()
        const normalized = items.map((item, i) => {
          const itemId = String(item.item_id || '').trim() || `item_${String(i + 1).padStart(2, '0')}`
          if (seen.has(itemId)) errors.push(`duplicate_item_id:${itemId}`)
          seen.add(itemId)
          const sel = item.selected_option, cor = item.correct_index
          if (sel != null && !(Number(sel) >= 0 && Number(sel) <= 8)) errors.push(`selected_option_out_of_range:${itemId}`)
          if (cor != null && !(Number(cor) >= 0 && Number(cor) <= 8)) errors.push(`correct_index_out_of_range:${itemId}`)
          let conf = item.confidence
          if (conf != null) { conf = Number(conf); conf = conf <= 1 ? clampN(conf, 0, 1) : clampN(conf / 5, 0, 1) }
          return {
            item_id: itemId,
            concept_id: (String(item.concept_id || '').trim() || null),
            is_correct: !!item.is_correct,
            confidence: conf != null ? conf : null,
            latency_ms: item.latency_ms != null ? Math.max(0, parseInt(item.latency_ms, 10) || 0) : null,
            response_payload: { ...(item.response_payload || {}), selected_option: sel ?? null, correct_index: cor ?? null, server_validated: true },
          }
        })
        const computedScore = normalized.filter((it) => it.is_correct).length
        const denom = totalQuestions || normalized.length || 1
        const computedPct = Math.round((computedScore / denom) * 10000) / 100
        if (normalized.length !== totalQuestions) errors.push('item_count_mismatch')
        if (Math.abs(computedScore - parseInt(body.score, 10 || 0)) > 0) errors.push('score_mismatch')
        if (Math.abs(computedPct - Number(body.percentage || 0)) > 1.0) errors.push('percentage_mismatch')
        return json({
          validator_pass: errors.length === 0, validation_errors: errors, computed_score: computedScore,
          computed_percentage: computedPct, item_count: normalized.length, normalized_item_responses: normalized,
          policy_version: 'research-evaluation-validator-v1',
        })
      }

      // --- Custom module authoring: needs a writable content filesystem, which
      // the static Cloudflare deploy doesn't have (the generated section can't be
      // persisted or served). Return a clear message instead of proxying. ---
      if (path === '/book/generate_custom_module') {
        return json({ success: false, message: 'Custom module authoring runs only in the local/dev environment (it writes new content files). The hosted build serves a fixed, versioned catalog.' })
      }

      // --- Unknown path. Every endpoint the hosted app calls is handled above.
      return json({ error: `Unknown endpoint: ${path}` }, 404)
    } catch (e) {
      return json({ error: String(e?.message || e) }, 500)
    }
  },
}
