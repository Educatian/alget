import { readFile } from 'node:fs/promises'

const LLM_BASE_URL = (process.env.ALGET_LLM_BASE_URL || 'https://alget-llm.jewoong-moon.workers.dev').replace(/\/$/, '')
const token = String(process.env.ALGET_INSTRUCTOR_TOKEN || '').trim()
const courseId = String(process.env.ALGET_FACULTY_COURSE_ID || 'faculty-pilot-smoke').trim()
const googleDocUrl = String(process.env.ALGET_GOOGLE_DOC_URL || '').trim()
const pdfPath = String(process.env.ALGET_PDF_PATH || '').trim()
const timeoutMs = Number(process.env.ALGET_FACULTY_SMOKE_TIMEOUT_MS || 45_000)

function fail(message) {
  console.error(`Faculty authenticated smoke failed: ${message}`)
  process.exitCode = 1
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function request(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function readJson(response) {
  return response.json().catch(() => ({}))
}

function assertDraft(body, sourceLabel) {
  assert(body?.status === 'shadow_draft', `${sourceLabel} did not return shadow_draft`)
  assert(body?.operator?.role && ['instructor', 'admin', 'course_admin'].includes(body.operator.role), `${sourceLabel} returned no faculty operator role`)
  assert(body?.draft?.source, `${sourceLabel} draft is missing source metadata`)
  assert(Array.isArray(body?.draft?.sections) && body.draft.sections.length > 0, `${sourceLabel} draft has no generated sections`)
  return body.draft.sections.length
}

async function verifyGoogleDoc() {
  const response = await request(`${LLM_BASE_URL}/faculty/google-docs/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ course_id: courseId, document_url: googleDocUrl }),
  })
  const body = await readJson(response)
  assert(response.ok, `Google Docs import returned HTTP ${response.status}`)
  return assertDraft(body, 'Google Docs import')
}

async function verifyPdf() {
  const bytes = await readFile(pdfPath)
  const form = new FormData()
  form.append('course_id', courseId)
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), pdfPath.split(/[\\/]/).pop() || 'course-source.pdf')
  const response = await request(`${LLM_BASE_URL}/faculty/pdf/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const body = await readJson(response)
  assert(response.ok, `PDF import returned HTTP ${response.status}`)
  return assertDraft(body, 'PDF import')
}

if (!token) {
  fail('set ALGET_INSTRUCTOR_TOKEN for a short-lived instructor access token; it is never written to disk or printed')
} else if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(courseId)) {
  fail('ALGET_FACULTY_COURSE_ID must be lowercase kebab-case (2–80 characters)')
} else if (!googleDocUrl && !pdfPath) {
  fail('set ALGET_GOOGLE_DOC_URL and/or ALGET_PDF_PATH to exercise at least one import path')
} else {
  try {
    const results = []
    if (googleDocUrl) results.push(`Google Docs ${await verifyGoogleDoc()} sections`)
    if (pdfPath) results.push(`PDF ${await verifyPdf()} sections`)
    console.log(`Faculty authenticated smoke passed: ${results.join(', ')} (course ${courseId})`)
  } catch (error) {
    fail(error.name === 'AbortError' ? `request timed out after ${timeoutMs}ms` : error.message)
  }
}
