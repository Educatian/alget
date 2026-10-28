/**
 * ALGET TAMU tutor: Socratic hints and grounded passage explanations for the TAMU static preview.
 *
 *   POST /login    {id, password}                               -> {token, id}
 *   POST /logout
 *   GET  /progress                                              -> {id, items}
 *   POST /progress {set: {key: value | null}}
 *   POST /events   {session_id, events: [...]}                  (events.js)
 *   POST /hint     {section_id, problem_id, rung, picks}       -> {hint, check_question}
 *   POST /explain  {section_id, exact, mode}                    -> {explanation, check_question, in_section}
 *   POST /feedback {section_id, text, revision, previous}       -> {criteria, marks, next_step, ready}  (feedback.js)
 *   POST /annotate {section_id, misconception_ids}              -> {notes: [{quote, kind, note}]}       (annotate.js)
 *   GET  /healthz
 *
 * Everything except /login and /healthz needs a session (Authorization: Bearer <token>); see
 * accounts.js. Rate limits count per student ID, since a class often shares one campus IP.
 *
 * Questions, answers and section text are loaded from the preview's exported course JSON, never
 * taken from the request. Requests carry no learner writing. Every hint passes the answer-leak
 * guard (leakGuard.js); on any failure the client falls back to its offline hints.
 *
 * Model calls go to UA's Microsoft Foundry (Azure OpenAI v1 API), the route UA OIT approves:
 * FOUNDRY_ENDPOINT is the resource's .../openai/v1 base, MODEL is the deployment name.
 */
import { bestParagraph } from '../../../frontend/src/lib/hintLadder.js'
import { getProgress, login, logout, saveProgress, sessionId } from './accounts.js'
import { saveEvents } from './events.js'
import { feedback } from './feedback.js'
import { annotate } from './annotate.js'
import { isSectionId, loadSection, quoteInSection, sectionPlainText } from './content.js'
import { findLeak } from './leakGuard.js'
import { EXPLAIN_MODES, EXPLAIN_SCHEMA, HINT_SCHEMA, JUDGE_SCHEMA, explainMessages, hintMessages, judgeMessages } from './prompts.js'

function cors(origin, env) {
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
    return allowed.includes(origin)
        ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
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

const configured = (env) => Boolean(env.FOUNDRY_API_KEY && env.FOUNDRY_ENDPOINT && env.MODEL)

export async function callModel(env, messages, schema, { temperature = 0.4, maxTokens = 400, timeoutMs } = {}) {
    // Reasoning deployments (gpt-5 family) take reasoning_effort and no custom temperature, and
    // spend part of the token budget on reasoning.
    const reasoning = Boolean(env.REASONING_EFFORT)
    const res = await fetch(`${env.FOUNDRY_ENDPOINT.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'api-key': env.FOUNDRY_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: env.MODEL,
            messages,
            max_completion_tokens: reasoning ? 2000 + maxTokens : maxTokens,
            ...(reasoning ? { reasoning_effort: env.REASONING_EFFORT } : { temperature }),
            response_format: { type: 'json_schema', json_schema: schema },
        }),
        // Longer outputs (written feedback, tutor notes) pass their own, longer timeout.
        signal: AbortSignal.timeout(timeoutMs || Number(env.TIMEOUT_MS || 8000)),
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

    // Lexical guard first, then a model judge for answers given away in other words. One retry with
    // stricter instructions, then give up so the client shows its offline hint.
    let guard = null
    for (const strict of [false, true]) {
        const out = await callModel(env, hintMessages({ problem, misconception, passage, picks, rung, strict }), HINT_SCHEMA)
        const text = `${out.hint} ${out.check_question}`
        guard = findLeak(text, problem, picks)
        if (!guard) {
            const verdict = await callModel(env, judgeMessages({ problem, text }), JUDGE_SCHEMA, { temperature: 0 })
            if (verdict.reveals_answer) guard = 'judge_reveals'
        }
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

        if (url.pathname === '/healthz') return json({ ok: true, enabled: env.TUTOR_ENABLED === 'true', configured: configured(env) }, 200, {})
        if (!headers) return json({ error: 'origin_not_allowed' }, 403, {})
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
        const route = `${request.method} ${url.pathname}`
        const routes = ['POST /login', 'POST /logout', 'GET /progress', 'POST /progress', 'POST /events', 'POST /hint', 'POST /explain', 'POST /feedback', 'POST /annotate']
        if (!routes.includes(route)) return json({ error: 'not_found' }, 404, headers)
        if (!env.ACCOUNTS || !env.DB) return json({ error: 'not_configured' }, 503, headers)

        let body = null
        if (request.method === 'POST' && route !== 'POST /logout') {
            try {
                body = await request.json()
            } catch {
                return json({ error: 'bad_json' }, 400, headers)
            }
        }
        if (route === 'POST /login') {
            const [result, status] = await login(body, env)
            console.log(JSON.stringify({ route: '/login', status }))
            return json(result, status, headers)
        }
        if (route === 'POST /logout') return json(...(await logout(request, env)), headers)

        const id = await sessionId(request, env)
        if (!id) return json({ error: 'signed_out' }, 401, headers)
        if (env.RATE_LIMITER && !(await env.RATE_LIMITER.limit({ key: `${url.pathname}:${id}` })).success) return json({ error: 'rate_limited' }, 429, headers)
        if (route === 'GET /progress') return json(...(await getProgress(id, env)), headers)
        if (route === 'POST /progress') return json(...(await saveProgress(id, body, env)), headers)
        if (route === 'POST /events') return json(...(await saveEvents(id, body, env)), headers)

        if (env.TUTOR_ENABLED !== 'true') return json({ error: 'disabled' }, 503, headers)
        if (!configured(env)) return json({ error: 'not_configured' }, 503, headers)
        if (!isSectionId(body?.section_id)) return json({ error: 'bad_section' }, 400, headers)
        if (!(await underDailyCap(env))) return json({ error: 'daily_cap' }, 429, headers)

        const started = Date.now()
        try {
            const handlers = {
                '/hint': () => hint(body, env),
                '/explain': () => explain(body, env),
                '/feedback': () => feedback(body, env, callModel),
                '/annotate': () => annotate(body, env, callModel),
            }
            const [result, status, meta = {}] = await handlers[url.pathname]()
            // Metadata only: no course text, no model output, no IP.
            console.log(JSON.stringify({ route: url.pathname, status, ms: Date.now() - started, ...meta }))
            return json(result, status, headers)
        } catch (err) {
            console.log(JSON.stringify({ route: url.pathname, status: 502, ms: Date.now() - started, error: String(err?.message || err).slice(0, 80) }))
            return json({ error: 'model_unavailable' }, 502, headers)
        }
    },
}
