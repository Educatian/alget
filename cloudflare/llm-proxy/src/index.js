// Cloudflare Worker: alget-llm  (OpenRouter-backed)
//
// The ENTIRE dynamic AI/compute layer for ALGET — no FastAPI/onrender backend.
//   - LLM (BigAL rail explain/represent, chat, Knowledge Check generate/grade)
//     -> OpenRouter directly.
//   - Deterministic, ported from the Python backend (parity-verified): BKT
//     grade + telemetry_fusion, practice grade/{id} (reads static practice),
//     artifact-revision score, research-evaluation validate, concept-origin +
//     mastery_graph (from baked static indexes), adaptive_recommendation
//     (policy via the alget-adaptive-recommendation Worker, service-bound).
//   - Static content/diagnostic/indexes are served by Cloudflare Pages.
//
// SECRET (set via wrangler, NOT committed):
//   wrangler secret put OPENROUTER_API_KEY
// Optional [vars]:
//   OPENROUTER_MODEL  (default google/gemini-2.0-flash-001)
//   STATIC_API_BASE   (default the Pages /api origin)
//   BACKEND_API_BASE  (unset; only set to re-enable a proxy escape hatch)

const DEFAULT_MODEL = 'google/gemini-2.5-flash'
// Static content (Pages) the Worker reads for deterministic grading/graphs.
const DEFAULT_STATIC_BASE = 'https://alget.pages.dev/api'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
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

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/api/, '') || '/'

    // Warm-up is now a no-op: every endpoint is served by this Worker (or static
    // Pages), so there is no sleepy backend to wake. Kept so the app's on-load
    // ping still gets a 200. Only wakes a backend if one is explicitly configured.
    if (path === '/warmup') {
      if (env.BACKEND_API_BASE) ctx.waitUntil(fetch(`${String(env.BACKEND_API_BASE).replace(/\/$/, '')}/book/inst-design/toc`).catch(() => {}))
      return json({ ok: true })
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
      // --- Rail: simpler explanation ---
      if (path === '/assist/explain') {
        if (!key) return json({ explanation: noKeyMsg })
        const topic = body.section_title || body.section_id || 'this section'
        const explanation = await openrouter(key, [
          { role: 'system', content: 'You are BigAL, a warm, concise tutor inside an interactive textbook. Explain clearly for a struggling learner using an everyday analogy and a concrete example. Keep it under 200 words. Markdown allowed. Explain the actual topic given by its TITLE — do not reinterpret it from a URL slug or assume a different subject.' },
          { role: 'user', content: `Section title: "${topic}" (id: ${body.section_id || 'n/a'}). Problem: ${body.problem_id || 'general concept'}. The student is stuck (reason: ${body.stuck_reason || 'unknown'}). Give a simpler, step-by-step explanation of THIS topic.` },
        ], { model, temperature: 0.7, maxTokens: 500 })
        return json({ explanation })
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
        return json({ content, type })
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
        const pedagogyPolicy = `

Tutoring pedagogy policy — follow it on every turn:
(a) Diagnose first: before helping, briefly infer from the learner's message (and the recent conversation) what they most likely misunderstand or are missing, and name it in one sentence.
(b) Hint ladder: respond with the smallest useful step — first a guiding question, then a conceptual cue, then a worked micro-step (one step, not the whole solution). Escalate one rung at a time, and only when the learner is still stuck after trying.
(c) Never state the complete final answer to a practice or quiz problem the learner is currently working on. Guide them to produce it themselves; you may confirm or correct the steps of their own attempt.
(d) End every turn with one short check question that tests whether the learner can take the next step on their own.`
        const messages = [
          { role: 'system', content: `You are BigAL, a friendly, rigorous tutor embedded in an interactive textbook (course: ${body.course || 'general'}). Answer the learner's question clearly and concisely, grounded in the section context when relevant. Use Markdown. If the learner highlighted a passage, explain it.${pedagogyPolicy}${ctx}` },
          ...historyToMessages(body.history),
          { role: 'user', content: String(body.query || '') },
        ]
        const text = await openrouter(key, messages, { model, temperature: 0.6, maxTokens: 900 })
        // No recognized `intent` -> ChatWidget renders `text` via its generic
        // <p> branch. (intent:'learn' would route to LearnIntentCard, which
        // expects structured fields and would drop a plain answer.)
        return json({ intent: 'answer', text })
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
        const assessment = await openrouterJSON(key, [
          { role: 'system', content: 'You are an expert educator generating formative assessments aligned to learning objectives. Return ONLY a JSON object — no prose, no markdown.' },
          { role: 'user', content: `Section title: "${body.section_title || 'this section'}".
Context: ${(body.biology_context || '') + ' ' + (body.engineering_context || '')}
Learning objectives:\n${objs}
Target concepts (use when applicable): [${concepts}]

Return EXACTLY this JSON shape, fitting THIS section's actual topic:
{"mcq_questions":[{"question":"...","options":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"correct_option_id":"A","explanation":"why correct & others wrong","concept_id":"..."}],"summary_question":{"question":"a generative short-answer prompt","concept_id":"...","rubric":"key points expected"}}
Exactly 2 items in mcq_questions and exactly 1 summary_question.` },
        ], { model, temperature: 0.5, maxTokens: 1500 })
        return json({ assessment, summary: 'Assessment generated successfully.' })
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
        return json(out)
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
        const primaryAction = decision.selected_action
        const policyMode = decision.policy_mode
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

      // --- Unknown path. Every endpoint the app calls is handled above, so the
      // app no longer depends on the onrender backend at all. Optional escape
      // hatch: only proxy if a BACKEND_API_BASE var is explicitly configured.
      if (env.BACKEND_API_BASE) {
        const proxied = await fetch(`${String(env.BACKEND_API_BASE).replace(/\/$/, '')}${path}${url.search}`, {
          method: request.method,
          headers: { 'content-type': 'application/json' },
          body: request.method === 'POST' ? JSON.stringify(body) : undefined,
        })
        const text = await proxied.text()
        return new Response(text, { status: proxied.status, headers: { ...CORS, 'content-type': proxied.headers.get('content-type') || 'application/json' } })
      }
      return json({ error: `Unknown endpoint: ${path}` }, 404)
    } catch (e) {
      return json({ error: String(e?.message || e) }, 500)
    }
  },
}
