#!/usr/bin/env node
/**
 * Post-deploy smoke test against the live surfaces.
 *
 * Every check here corresponds to something that has actually broken in
 * production without anyone noticing. The access-code endpoint returned 405 for
 * days because the Pages Function was never uploaded, which silently disabled
 * every pathway unlock and the researcher console; nothing in CI could see it,
 * because CI never touches the deployed artifact.
 *
 *   node scripts/post_deploy_smoke.mjs
 *   ALGET_APP_URL=https://preview.alget.pages.dev node scripts/post_deploy_smoke.mjs
 *
 * Exits non-zero on the first failed check, so it can gate a release.
 */
const APP = (process.env.ALGET_APP_URL || 'https://alget.pages.dev').replace(/\/$/, '')
const WORKER = (process.env.ALGET_WORKER_URL || 'https://alget-llm.jewoong-moon.workers.dev').replace(/\/$/, '')
const TIMEOUT_MS = Number(process.env.ALGET_SMOKE_TIMEOUT_MS || 20000)

const results = []

async function request(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const startedAt = Date.now()
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const text = await response.text()
    return { status: response.status, headers: response.headers, text, elapsedMs: Date.now() - startedAt }
  } finally {
    clearTimeout(timer)
  }
}

function withinBudget(response, budgetMs, label) {
  if (response.elapsedMs > budgetMs) throw new Error(`${label} exceeded ${budgetMs}ms budget (${response.elapsedMs}ms)`)
  return `${response.status} in ${response.elapsedMs}ms`
}

async function check(name, run) {
  try {
    const detail = await run()
    results.push({ name, ok: true, detail })
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } catch (error) {
    results.push({ name, ok: false, detail: error.message })
    console.log(`  FAIL  ${name} — ${error.message}`)
  }
}

const json = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    // The SPA shell is served for any unmatched path, so HTML here means the
    // endpoint does not exist rather than that it returned bad data.
    throw new Error('response was not JSON (the SPA shell is served when a route is missing)')
  }
}

console.log(`app    ${APP}`)
console.log(`worker ${WORKER}\n`)

await check('app shell responds', async () => {
  const response = await request(`${APP}/`)
  const { status } = response
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  return withinBudget(response, 5000, 'app shell')
})

await check('security headers present', async () => {
  const { headers } = await request(`${APP}/`)
  const missing = ['content-security-policy', 'x-content-type-options', 'referrer-policy']
    .filter((header) => !headers.get(header))
  if (missing.length) throw new Error(`missing ${missing.join(', ')}`)
  return 'CSP, nosniff, referrer-policy'
})

// The Pages Function, not the static asset handler. A static handler answers
// POST with 405, which is exactly how this broke before.
await check('access-code endpoint is a function, not a static asset', async () => {
  const { status, text } = await request(`${APP}/api/access/validate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope: 'engineering', passcode: 'smoke-test-not-a-real-code' }),
  })
  if (status === 405) throw new Error('405: the Pages Function is not deployed; deploy from frontend/ so functions/ is uploaded')
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  const body = json(text)
  if (typeof body.valid !== 'boolean') throw new Error('response has no boolean "valid"')
  if (body.valid) throw new Error('a deliberately wrong passcode was accepted')
  return 'rejects a wrong code with 200 {valid:false}'
})

await check('worker health reports its services', async () => {
  const response = await request(`${WORKER}/health`)
  const { status, text } = response
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  const body = json(text)
  if (body.status !== 'ready') throw new Error(`status is "${body.status}"`)
  const down = Object.entries(body.services || {}).filter(([, up]) => !up).map(([name]) => name)
  if (down.length) throw new Error(`services down: ${down.join(', ')}`)
  withinBudget(response, 5000, 'worker health')
  return `ready, ${Object.keys(body.services || {}).length} services up in ${response.elapsedMs}ms`
})

await check('roadmap manifest exposes governed runtime contracts', async () => {
  const { status, text } = await request(`${WORKER}/roadmap/manifest`)
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  const body = json(text)
  if (body.schema_version !== 'roadmap-manifest-v1') throw new Error(`schema is "${body.schema_version || 'missing'}"`)
  if (body.roadmap_contract !== 'roadmap-runtime-v1') throw new Error(`contract is "${body.roadmap_contract || 'missing'}"`)
  const horizons = body.horizons || {}
  if (!['0-12_months', '12-24_months', '24-36_months'].every((key) => Array.isArray(horizons[key]) && horizons[key].length)) {
    throw new Error('roadmap horizons are incomplete')
  }
  return 'roadmap-runtime-v1, 3 horizons'
})

await check('assessment generation returns a usable assessment', async () => {
  const response = await request(`${WORKER}/generate_assessment`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ section_title: 'Post-deploy smoke check' }),
  })
  const { status, text } = response
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  const body = json(text)
  const questions = body.assessment?.mcq_questions
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error(`no questions generated: ${body.summary || 'no summary'}`)
  }
  // Generation is model-backed and can cold-start in production; keep a
  // bounded but realistic release gate instead of flaking at 15s.
  withinBudget(response, 20000, 'assessment generation')
  return `${questions.length} questions in ${response.elapsedMs}ms`
})

await check('agentic tool registry exposes default-deny policy', async () => {
  const response = await request(`${WORKER}/agentic/tools`)
  if (response.status !== 200) throw new Error(`expected 200, got ${response.status}`)
  const body = json(response.text)
  if (body.schema_version !== 'agentic-tool-registry-v1') throw new Error(`schema is "${body.schema_version || 'missing'}"`)
  if (body.default_policy !== 'deny') throw new Error(`default policy is "${body.default_policy || 'missing'}"`)
  if (!Array.isArray(body.tools) || body.tools.length < 5) throw new Error('tool registry is incomplete')
  return `${body.tools.length} tools, default deny`
})

await check('agentic policy refuses unimplemented high-risk execution', async () => {
  const response = await request(`${WORKER}/agentic/tools/evaluate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool_id: 'content.publish', actor_role: 'admin', approved: true }),
  })
  if (response.status !== 200) throw new Error(`expected 200, got ${response.status}`)
  const body = json(response.text)
  if (body.allowed !== false || body.reason !== 'execution_not_implemented') {
    throw new Error(`unexpected policy result: ${body.reason || 'missing reason'}`)
  }
  return 'content.publish remains unavailable to autonomous execution'
})

await check('agentic learner plan remains approval-gated', async () => {
  const target = new Date()
  target.setUTCDate(target.getUTCDate() + 7)
  const response = await request(`${WORKER}/agentic/learner-plan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      course_id: 'cat100-supplement',
      goal_title: 'Post-deploy smoke plan',
      target_date: target.toISOString().slice(0, 10),
      target_mastery: 0.8,
      weekly_minutes: 180,
      mastery: [{ concept_id: 'smoke_concept', mastery_score: 0.35, attempts_count: 2 }],
    }),
  })
  if (response.status !== 200) throw new Error(`expected 200, got ${response.status}`)
  const body = json(response.text)
  if (body.schema_version !== 'agentic-study-plan-v1') throw new Error('unexpected learner plan schema')
  if (body.learner_control?.requires_approval !== true) throw new Error('learner approval gate is missing')
  if (!Array.isArray(body.sessions) || body.sessions.length === 0) throw new Error('plan has no sessions')
  return `${body.sessions.length} sessions; learner approval required`
})

await check('agentic intervention proposal never delivers automatically', async () => {
  const response = await request(`${WORKER}/agentic/interventions/propose`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      course_id: 'cat100-supplement',
      concept_id: 'smoke_concept',
      learner_count: 3,
      average_mastery: 0.38,
      target_user_ids: [],
    }),
  })
  if (response.status !== 200) throw new Error(`expected 200, got ${response.status}`)
  const body = json(response.text)
  if (body.delivery?.executed !== false || body.delivery?.requires_instructor_approval !== true) {
    throw new Error('intervention delivery guard is missing')
  }
  if (body.evidence?.causal_claim !== false) throw new Error('proposal did not preserve non-causal evidence label')
  return 'proposal only; delivery and grading remain disabled'
})

// Unauthenticated callers must be refused, and refused as a routed endpoint
// rather than falling through to the SPA shell.
for (const [name, path] of [
  ['administrator', '/admin/system/summary'],
  ['instructor invite', '/admin/instructors/invite'],
  ['instructor approval review', '/admin/instructors/review'],
  ['faculty PDF import', '/faculty/pdf/import'],
  ['faculty Google Docs import', '/faculty/google-docs/import'],
  ['roadmap runtime package', '/roadmap/runtime-package'],
]) {
  await check(`${name} endpoint refuses anonymous callers`, async () => {
    const { status, text } = await request(`${WORKER}${path}`, { method: path.includes('summary') ? 'GET' : 'POST' })
    if (status === 404) throw new Error('404: the endpoint is not deployed')
    if (status !== 401 && status !== 403) throw new Error(`expected 401/403, got ${status}`)
    json(text)
    return `${status}`
  })
}

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) {
  console.log('failed: ' + failed.map((result) => result.name).join('; '))
  process.exit(1)
}
