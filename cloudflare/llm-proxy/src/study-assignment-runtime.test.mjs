import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { requireEngineeringStudyTreatment } from './index.js'

const ORIGINAL_FETCH = globalThis.fetch
const ENV = {
  ENGINEERING_STUDY_ENFORCEMENT: 'strict',
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-test-key',
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

function request(withToken = true) {
  return new Request('https://worker.test/adaptive_recommendation', {
    method: 'POST',
    headers: withToken ? { authorization: 'Bearer learner-token' } : {},
  })
}

test('strict study mode permits only a persisted treatment assignment', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify([{
    assignment_hash: 'a'.repeat(64),
    experiment_arms: { arm_key: 'treatment_annotation_adaptive' },
    experiments: { experiment_key: 'alget-bio-inspired-agentic-rct-v1' },
  }]), { status: 200, headers: { 'content-type': 'application/json' } })

  const result = await requireEngineeringStudyTreatment(request(), ENV, { course: 'bio-inspired' })
  assert.equal(result.enforced, true)
  assert.equal(result.arm, 'treatment_annotation_adaptive')
})

test('strict study mode rejects comparison and missing bearer access', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify([{
    assignment_hash: 'b'.repeat(64),
    experiment_arms: { arm_key: 'comparison_practice_only' },
    experiments: { experiment_key: 'alget-bio-inspired-agentic-rct-v1' },
  }]), { status: 200, headers: { 'content-type': 'application/json' } })

  const comparison = await requireEngineeringStudyTreatment(request(), ENV, { section_id: 'bio-inspired/01/01' })
  assert.equal(comparison.error.status, 403)
  const missingBearer = await requireEngineeringStudyTreatment(request(false), ENV, { course: 'bio-inspired' })
  assert.equal(missingBearer.error.status, 401)
})

test('non-study courses remain on the standard product path', async () => {
  globalThis.fetch = async () => { throw new Error('should not query') }
  const result = await requireEngineeringStudyTreatment(request(false), ENV, { course: 'statics' })
  assert.deepEqual(result, { enforced: false })
})
