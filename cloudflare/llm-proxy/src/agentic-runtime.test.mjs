import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAgenticIntervention,
  buildAgenticLearnerPlan,
  buildGoogleDocCourseDraft,
  evaluateAgenticTool,
  extractGoogleDocId,
  validateAgenticTransition,
} from './index.js'

test('Cloudflare agentic policy remains default-deny for high-risk execution', () => {
  assert.deepEqual(evaluateAgenticTool({ tool_id: 'content.publish', actor_role: 'admin', approved: true }).reason, 'execution_not_implemented')
  assert.equal(evaluateAgenticTool({ tool_id: 'intervention.draft', actor_role: 'learner' }).allowed, false)
})

test('Cloudflare workflow activation requires approval', () => {
  assert.equal(validateAgenticTransition({ current_status: 'awaiting_approval', target_status: 'active', approved: false }).reason, 'approval_required')
  assert.equal(validateAgenticTransition({ current_status: 'awaiting_approval', target_status: 'active', approved: true }).allowed, true)
})

test('Cloudflare learner planning prioritizes low mastery and preserves learner control', () => {
  const plan = buildAgenticLearnerPlan({
    course_id: 'cat100-supplement', goal_title: 'Master force vectors', target_date: '2099-08-08',
    target_mastery: 0.8, weekly_minutes: 180,
    mastery: [{ concept_id: 'force_vectors', mastery_score: 0.3, attempts_count: 3 }, { concept_id: 'equilibrium', mastery_score: 0.7, attempts_count: 4 }],
  })
  assert.equal(plan.sessions[0].concept_id, 'force_vectors')
  assert.equal(plan.learner_control.requires_approval, true)
  assert.equal(plan.evidence.causal_claim, false)
})

test('Cloudflare intervention proposal never executes delivery', () => {
  const proposal = buildAgenticIntervention({ course_id: 'cat100-supplement', concept_id: 'force_vectors', learner_count: 8, average_mastery: 0.38 })
  assert.equal(proposal.evidence.urgency, 'urgent')
  assert.equal(proposal.delivery.executed, false)
})

test('Google Docs ingestion accepts only canonical document links', () => {
  assert.equal(extractGoogleDocId('https://docs.google.com/document/d/12345678901234567890/edit?tab=t.0'), '12345678901234567890')
  assert.throws(() => extractGoogleDocId('https://example.com/course.txt'), /standard Google Docs/i)
})

test('Google Docs course drafting keeps generated experiences in shadow review', () => {
  const draft = buildGoogleDocCourseDraft(`Course Foundations\n${'A source-grounded explanation of evidence evaluation and revision. '.repeat(5)}\nLearning Activity\n${'Learners compare a claim with its cited source and explain a revision. '.repeat(5)}`, '12345678901234567890', 'Course Foundations')
  assert.ok(draft.sections.length >= 1)
  assert.equal(draft.sections[0].simulation.status, 'proposed')
  assert.equal(draft.quality.student_visible, false)
  assert.equal(draft.quality.automatic_publish, false)
})
