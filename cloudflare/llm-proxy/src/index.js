// Cloudflare Worker: alget-llm  (OpenRouter-backed)
//
// The dynamic AI layer for ALGET. On the static Pages deploy, /api only holds
// content/search snapshots, so every LLM call (BigAL rail, chat, grading,
// generation) 404/405'd. This Worker is the single dynamic endpoint:
//
//   - /assist/explain, /assist/represent, /orchestrate  -> answered DIRECTLY
//     via OpenRouter (no cold start). These are the BigAL rail + chat the
//     learner actually sees.
//   - everything else (grade, generate*, diagnostic, research, ...) -> PROXIED
//     to the FastAPI backend as-is (best effort; needs the backend's own key).
//
// SECRET (set via wrangler, NOT committed):
//   wrangler secret put OPENROUTER_API_KEY
// Optional [vars]:
//   OPENROUTER_MODEL     (default: google/gemini-2.0-flash-001)
//   BACKEND_API_BASE     (default: the onrender FastAPI deploy)

const DEFAULT_MODEL = 'google/gemini-2.0-flash-001'
const DEFAULT_BACKEND = 'https://alget.onrender.com/api'
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
    const backendEarly = (env.BACKEND_API_BASE || DEFAULT_BACKEND).replace(/\/$/, '')

    // On-demand warm-up: the app pings this on load so the (free-tier, sleepy)
    // FastAPI backend is booting while the learner reads, eliminating the cold
    // start before they hit a proxied deterministic endpoint (grade, etc.).
    // Returns immediately; the wake request continues in the background.
    if (path === '/warmup') {
      ctx.waitUntil(fetch(`${backendEarly}/book/inst-design/toc`).catch(() => {}))
      return json({ ok: true, warming: true })
    }

    let body = {}
    if (request.method === 'POST') {
      try { body = await request.json() } catch { body = {} }
    }
    // Server key by default; allow a per-user OpenRouter key via the request.
    const key = (body.api_key && String(body.api_key).trim()) || env.OPENROUTER_API_KEY || ''
    const model = env.OPENROUTER_MODEL || DEFAULT_MODEL
    const backend = (env.BACKEND_API_BASE || DEFAULT_BACKEND).replace(/\/$/, '')
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
      if (path === '/orchestrate') {
        if (!key) return json({ intent: 'legacy', text: noKeyMsg })
        const ctx = body.current_content ? `\n\nSection context (excerpt):\n${String(body.current_content).slice(0, 2000)}` : ''
        const messages = [
          { role: 'system', content: `You are BigAL, a friendly, rigorous tutor embedded in an interactive textbook (course: ${body.course || 'general'}). Answer the learner's question clearly and concisely, grounded in the section context when relevant. Use Markdown. If the learner highlighted a passage, explain it.${ctx}` },
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

      // --- Everything else: proxy to the FastAPI backend as-is ---
      const proxied = await fetch(`${backend}${path}${url.search}`, {
        method: request.method,
        headers: { 'content-type': 'application/json' },
        body: request.method === 'POST' ? JSON.stringify(body) : undefined,
      })
      const text = await proxied.text()
      return new Response(text, {
        status: proxied.status,
        headers: { ...CORS, 'content-type': proxied.headers.get('content-type') || 'application/json' },
      })
    } catch (e) {
      return json({ error: String(e?.message || e) }, 500)
    }
  },
}
