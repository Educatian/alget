import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAgenticIntervention,
  buildAgenticLearnerPlan,
  buildGoogleDocCourseDraft,
  buildRoadmapDecision,
  evaluateAgenticTool,
  extractGoogleDocId,
  roadmapCaliper,
  roadmapManifest,
  roadmapLti13,
  summarizeRoadmapSocial,
  validateAgenticTransition,
  validateRoadmapRuntimePackage,
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

test('source grounding exposes citation verification state instead of implying verification', () => {
  const draft = buildGoogleDocCourseDraft(`Course Foundations\n${'A source-grounded explanation of evidence evaluation and revision. '.repeat(5)}`, '12345678901234567890', 'Course Foundations')
  assert.ok(['not-verified', 'openstax-retrieved'].includes(draft.quality.citation_verification))
})

test('roadmap manifest exposes all three horizons and default human gates', () => {
  const manifest = roadmapManifest()
  assert.equal(manifest.roadmap_contract, 'roadmap-runtime-v1')
  assert.deepEqual(Object.keys(manifest.horizons), ['0-12_months', '12-24_months', '24-36_months'])
  assert.equal(manifest.high_risk_actions.publish, 'human_approval')
})

test('roadmap package validation refuses unapproved publishing', () => {
  const pkg = {
    course_id: 'ail-606',
    source: { sha256: 'a'.repeat(64) },
    sections: [{ id: '01/01', reading: { content: 'Read the source.' }, references: [] }],
    release: { status: 'published', automatic_publish: false },
  }
  const result = validateRoadmapRuntimePackage(pkg)
  assert.equal(result.valid, false)
  assert.ok(result.errors.includes('published_requires_human_approval'))
})

test('roadmap decision and social metrics keep agency and evidence separate', () => {
  const decision = buildRoadmapDecision({ course_id: 'ail-606', actor_id: 'u1', actor_role: 'instructor', proposal_id: 'p1', decision: 'modify', original: { prompt: 'Explain' }, revised: { prompt: 'Compare evidence' }, evidence_ids: ['src-1'] })
  assert.equal(decision.decision, 'modify')
  assert.deepEqual(decision.evidence_ids, ['src-1'])
  const metrics = summarizeRoadmapSocial([{ event_type: 'peer_pulse_seen' }, { event_type: 'social_round_started' }, { event_type: 'social_evidence_compared', evidence_submitted: true }])
  assert.equal(metrics.learning_gain_claim, 'not_inferred_from_clicks')
  assert.equal(metrics.evidence_compare_completion_rate, 1)
})

test('roadmap Caliper envelope is course scoped', () => {
  const event = roadmapCaliper({ event_type: 'ViewedEvent', actor_id: 'u1', course_id: 'ail-606', object_id: '01/01', action: 'Viewed' })
  assert.equal(event['@context'], 'http://purl.imsglobal.org/ctx/caliper/v1p2')
  assert.match(event.object.id, /ail-606:01\/01/)
})

test('roadmap LTI 1.3 contract keeps OIDC validation explicit', () => {
  const context = roadmapLti13({ issuer: 'https://lms.example.edu', client_id: 'client-1', deployment_id: 'deploy-1', context_id: 'ctx-1', course_id: 'ail-606', resource_link_id: 'reader-1' })
  assert.equal(context.schema_version, 'lti13-context-v1')
  assert.equal(context.jwt_validation_required, true)
  assert.equal(context.privacy_scope, 'course_only')
})
