import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import worker from './index.js'

const ORIGINAL_FETCH = globalThis.fetch

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

test('assessment generation degrades to a valid evidence-labelled fallback when provider JSON is malformed', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: '{"mcq_questions":[{"question":"truncated"}]' } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } })

  const response = await worker.fetch(new Request('https://worker.test/generate_assessment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      section_title: 'Post-deploy smoke check',
      retrieved_context: [{ source_id: 'smoke-source', content: 'A learner should connect a claim to evidence before revising it.' }],
    }),
  }), { OPENROUTER_API_KEY: 'test-key' })

  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.assessment.mcq_questions.length, 2)
  assert.equal(body.assessment.summary_question.evidence[0].source_id, 'smoke-source')
  assert.equal(body.generation_trace.source_status, 'context_attached')
})
