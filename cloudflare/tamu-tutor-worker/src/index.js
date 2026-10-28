/**
 * ALGET TAMU tutor: Socratic hints and grounded passage explanations for the TAMU static preview.
 *
 *   POST /hint     {section_id, problem_id, rung, picks}       -> {hint, check_question}
 *   POST /explain  {section_id, exact, mode}                    -> {explanation, check_question, in_section}
 *   GET  /healthz
 *
 * Questions, answers and section text are loaded from the preview's exported course JSON, never
 * taken from the request. Requests carry no learner writing. Every hint passes the answer-leak
 * guard (leakGuard.js); on any failure the client falls back to its offline hints.
 */
import { bestParagraph } from '../../../frontend/src/lib/hintLadder.js'
import { isSectionId, loadSection, quoteInSection, sectionPlainText } from './content.js'
import { findLeak } from './leakGuard.js'
import { EXPLAIN_MODES, EXPLAIN_SCHEMA, HINT_SCHEMA, explainMessages, hintMessages } from './prompts.js'

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions'

function cors(origin, env) {
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
    return allowed.includes(origin)
        ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
        : null
}

const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } })

async function underDailyCap(env) {
    if (!env.USAGE) return true
    const key = `calls:${new Date().toISOString().slice(0, 10)}`
    const used = Number(await env.USAGE.get(key)) || 0
    if (used >= Number(env.DAILY_CAP || 500)) return false
    await env.USAGE.put(key, String(used + 1), { expirationTtl: 3 * 24 * 3600 })
    return true
}

export async function callModel(env, messages, schema) {
    const res = await fetch(OPENROUTER, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'ALGET TAMU tutor' },
        body: JSON.stringify({
            model: env.MODEL,
            messages,
            temperature: 0.4,
            max_tokens: 400,
            response_format: { type: 'json_schema', json_schema: schema },
        }),
        signal: AbortSignal.timeout(Number(env.TIMEOUT_MS || 8000)),
    })
    if (!res.ok) throw new Error(`model ${res.status}`)
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content || ''
    const start = text.indexOf('{')
    return JSON.parse(start > 0 ? text.slice(start, text.lastIndexOf('}') + 1) : text)
}

async function hint(body, env) {
    const section = await loadSection(env, body.section_id)
    const problem = section?.practice?.problems?.find((p) => p.id === body.problem_id)
    if (!problem || problem.type !== 'multiple_choice' || !Array.isArray(problem.options)) return [{ error: 'unknown_problem' }, 404]
    const picks = [...new Set((Array.isArray(body.picks) ? body.picks : []).map(Number))]
        .filter((i) => Number.isInteger(i) && i >= 0 && i < problem.options.length && i !== problem.correct_index)
    const rung = Math.max(1, Math.min(3, Number(body.rung) || 1))
    const misconception = (section.misconceptions || []).find((m) => m.id === problem.misconception_id) || null
    const passage = bestParagraph(problem, section.content)

    // One retry with stricter instructions, then give up so the client shows its offline hint.
    let guard = null
    for (const strict of [false, true]) {
        const out = await callModel(env, hintMessages({ problem, misconception, passage, picks, rung, strict }), HINT_SCHEMA)
        guard = findLeak(`${out.hint} ${out.check_question}`, problem, picks)
        if (!guard) return [{ hint: out.hint, check_question: out.check_question, retried: strict }, 200, { guard: 'pass', retried: strict }]
    }
    return [{ error: 'guard_blocked' }, 422, { guard }]
}

async function explain(body, env) {
    const mode = EXPLAIN_MODES.includes(body.mode) ? body.mode : 'explain'
    const exact = String(body.exact || '').slice(0, 1200)
    const section = await loadSection(env, body.section_id)
    if (!section) return [{ error: 'unknown_section' }, 404]
    if (!quoteInSection(exact, section.content)) return [{ error: 'quote_not_in_section' }, 422]
    const out = await callModel(env, explainMessages({
        quote: exact,
        sectionTitle: section.meta?.title || body.section_id,
        sectionText: sectionPlainText(section.content),
        mode,
    }), EXPLAIN_SCHEMA)
    return [{ explanation: out.explanation, check_question: out.check_question, in_section: Boolean(out.in_section), mode }, 200, { mode }]
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url)
        const origin = request.headers.get('Origin') || ''
        const headers = cors(origin, env)

        if (url.pathname === '/healthz') return json({ ok: true, enabled: env.TUTOR_ENABLED === 'true', configured: Boolean(env.OPENROUTER_API_KEY) }, 200, {})
        if (!headers) return json({ error: 'origin_not_allowed' }, 403, {})
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
        if (request.method !== 'POST' || !['/hint', '/explain'].includes(url.pathname)) return json({ error: 'not_found' }, 404, headers)
        if (env.TUTOR_ENABLED !== 'true') return json({ error: 'disabled' }, 503, headers)
        if (!env.OPENROUTER_API_KEY) return json({ error: 'not_configured' }, 503, headers)

        const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
        if (env.RATE_LIMITER && !(await env.RATE_LIMITER.limit({ key: ip })).success) return json({ error: 'rate_limited' }, 429, headers)

        let body
        try {
            body = await request.json()
        } catch {
            return json({ error: 'bad_json' }, 400, headers)
        }
        if (!isSectionId(body?.section_id)) return json({ error: 'bad_section' }, 400, headers)
        if (!(await underDailyCap(env))) return json({ error: 'daily_cap' }, 429, headers)

        const started = Date.now()
        try {
            const [result, status, meta = {}] = url.pathname === '/hint' ? await hint(body, env) : await explain(body, env)
            // Metadata only: no course text, no model output, no IP.
            console.log(JSON.stringify({ route: url.pathname, status, ms: Date.now() - started, ...meta }))
            return json(result, status, headers)
        } catch (err) {
            console.log(JSON.stringify({ route: url.pathname, status: 502, ms: Date.now() - started, error: String(err?.message || err).slice(0, 80) }))
            return json({ error: 'model_unavailable' }, 502, headers)
        }
    },
}
