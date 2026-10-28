/**
 * Agentic tutor annotations (POST /annotate {section_id, misconception_ids?}): 2–3 margin notes
 * anchored to exact spans of the section text, aimed at the misconceptions the learner showed.
 * Quotes not found in the section are dropped. Results are cached per section and focus.
 */
import { loadSection, quoteInSection, sectionPlainText } from './content.js'
import { ANNOTATE_SCHEMA, annotateMessages } from './prompts.js'

const CACHE_TTL = 7 * 24 * 3600

export async function annotate(body, env, callModel) {
    const section = await loadSection(env, body.section_id)
    if (!section) return [{ error: 'unknown_section' }, 404]
    const known = section.misconceptions || []
    const ids = [...new Set((Array.isArray(body.misconception_ids) ? body.misconception_ids : []).map(String))]
        .filter((id) => known.some((m) => m.id === id)).sort().slice(0, 3)
    const cacheKey = `ann:${body.section_id}:${ids.join(',') || 'general'}`
    const cached = env.USAGE ? await env.USAGE.get(cacheKey, 'json') : null
    if (cached) return [{ ...cached, cached: true }, 200, { focus: ids.length, cached: true }]

    const focus = ids.map((id) => known.find((m) => m.id === id)).map((m) => `${m.description} (${m.feedback})`).join('; ')
    const out = await callModel(env, annotateMessages({ sectionTitle: section.meta?.title || body.section_id, sectionText: sectionPlainText(section.content), focus }), ANNOTATE_SCHEMA, { temperature: 0.3, maxTokens: 600, timeoutMs: 12000 })
    const notes = (out.notes || [])
        .map((n) => ({ quote: String(n.quote || '').trim(), kind: n.kind, note: String(n.note || '').slice(0, 200) }))
        .filter((n) => n.quote.split(/\s+/).length >= 2 && quoteInSection(n.quote, section.content) && ['key_idea', 'watch_out', 'connect'].includes(n.kind))
        .slice(0, 3)
    const result = { notes, focus: ids }
    if (notes.length && env.USAGE) await env.USAGE.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL })
    return [result, 200, { focus: ids.length, notes: notes.length, cached: false }]
}
