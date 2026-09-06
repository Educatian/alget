import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import worker from './index.js'

const ORIGINAL_FETCH = globalThis.fetch
const ENV = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-test-key',
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

function installIdentityAndSourceMocks({ role = 'instructor', sourceText = '', pdfBytes = null } = {}) {
  let docsRequested = false
  let pdfRequested = false
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input?.url || String(input)
    if (url === `${ENV.SUPABASE_URL}/auth/v1/user`) {
      return new Response(JSON.stringify({ id: 'instructor-test-1', app_metadata: { role } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url.includes('docs.google.com/document/') && url.includes('/export?format=txt')) {
      docsRequested = true
      return new Response(sourceText, { status: 200, headers: { 'content-type': 'text/plain' } })
    }
    if (url === `${ENV.SUPABASE_URL}/rest/v1/rpc/search_openstax_sections`) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (pdfBytes) {
      pdfRequested = true
    }
    throw new Error(`Unexpected test fetch: ${url}`)
  }
  return { get docsRequested() { return docsRequested }, get pdfRequested() { return pdfRequested } }
}

function request(path, options = {}) {
  return new Request(`https://worker.test${path}`, {
    ...options,
    headers: {
      authorization: 'Bearer instructor-test-token',
      ...(options.headers || {}),
    },
  })
}

function sourceText() {
  return `Course Foundations\n${'Learners compare a claim with its evidence, revise the claim, and explain the decision. '.repeat(12)}`
}

// A tiny valid one-page PDF keeps this test hermetic while exercising the same
// unpdf extraction path used by the production faculty endpoint.
function minimalPdf() {
  const stream = 'BT /F1 12 Tf 72 720 Td (Course Foundations. Evidence evaluation and revision guide. Learners compare claims with sources and explain decisions.) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index < offsets.length; index += 1) pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

test('authenticated instructor can import Google Docs into a private shadow draft', async () => {
  const mocks = installIdentityAndSourceMocks({ sourceText: sourceText() })
  const response = await worker.fetch(request('/faculty/google-docs/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      course_id: 'cat100-supplement',
      document_url: 'https://docs.google.com/document/d/12345678901234567890/edit',
    }),
  }), ENV)
  const body = await response.json()
  assert.equal(response.status, 201)
  assert.equal(body.status, 'shadow_draft')
  assert.equal(body.operator.role, 'instructor')
  assert.equal(body.draft.quality.student_visible, false)
  assert.equal(body.draft.quality.automatic_publish, false)
  assert.equal(body.draft.runtime_package.approval_required, true)
  assert.ok(body.draft.sections[0].reading.content.length >= 200)
  assert.ok(body.draft.sections[0].practice.problems.length >= 2)
  assert.ok(body.draft.sections[0].knowledge_base.chunks.length >= 1)
  assert.ok(body.draft.runtime_package.generated.includes('formative_assessment'))
  assert.ok(body.draft.source.sha256)
  assert.equal(mocks.docsRequested, true)
})

test('authenticated instructor can import PDF into the same governed shadow contract', async () => {
  const mocks = installIdentityAndSourceMocks({ pdfBytes: minimalPdf() })
  const form = new FormData()
  form.set('course_id', 'cat100-supplement')
  form.set('file', new File([minimalPdf()], 'course-source.pdf', { type: 'application/pdf' }))
  const response = await worker.fetch(request('/faculty/pdf/import', { method: 'POST', body: form }), ENV)
  const body = await response.json()
  assert.equal(response.status, 201)
  assert.equal(body.status, 'shadow_draft')
  assert.equal(body.operator.role, 'instructor')
  assert.equal(body.draft.source.title, 'course-source.pdf')
  assert.equal(body.draft.source.page_count, 1)
  assert.equal(body.draft.quality.student_visible, false)
  assert.equal(body.draft.quality.automatic_publish, false)
  assert.equal(body.draft.runtime_package.approval_required, true)
  assert.equal(body.draft.source.kind, 'pdf')
  assert.ok(body.draft.sections[0].reading.content)
  assert.ok(body.draft.sections[0].knowledge_base)
  assert.ok(body.draft.source.sha256)
  assert.equal(mocks.docsRequested, false)
})

test('learner role cannot reach faculty import even with a valid bearer token', async () => {
  const mocks = installIdentityAndSourceMocks({ role: 'learner', sourceText: sourceText() })
  const response = await worker.fetch(request('/faculty/google-docs/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      course_id: 'cat100-supplement',
      document_url: 'https://docs.google.com/document/d/12345678901234567890/edit',
    }),
  }), ENV)
  assert.equal(response.status, 403)
  assert.equal(mocks.docsRequested, false)
})
