/**
 * Formative feedback on a section's written activity (POST /feedback), in the PenMentor style:
 * criteria judgements, pen marks on the learner's own words, and one next step as a hint.
 * The learner's text is sent to the model (the reader says so); it is never logged or stored.
 */
import { ACTIVITIES } from './activities.js'
import { loadSection, sectionPlainText } from './content.js'
import { FEEDBACK_SCHEMA, feedbackMessages } from './prompts.js'

const MIN_CHARS = 20
const MAX_CHARS = 4000
const MAX_MARKS = 4

const words = (s) => String(s).toLowerCase().match(/[a-z0-9']{4,}/g) || []

/** Share of the reference's content words reproduced by a feedback string (0..1). */
export function referenceOverlap(textOut, reference) {
    const ref = new Set(words(reference))
    const out = words(textOut)
    if (!ref.size || !out.length) return 0
    const hits = new Set(out.filter((w) => ref.has(w)))
    return hits.size / Math.min(ref.size, 40)
}

/** Keeps only marks that quote the learner's text exactly, and only known criteria. */
export function cleanFeedback(out, activity, text) {
    const criteria = activity.criteria.map((c) => {
        const got = (out.criteria || []).find((x) => x.id === c.id)
        return { id: c.id, status: got?.status || 'not_yet', comment: String(got?.comment || '').slice(0, 240) }
    })
    const marks = (out.marks || [])
        .map((m) => ({ quote: String(m.quote || '').trim(), kind: m.kind, note: String(m.note || '').slice(0, 160) }))
        .filter((m) => m.quote.length >= 3 && text.includes(m.quote) && ['strength', 'issue', 'question'].includes(m.kind))
        .slice(0, MAX_MARKS)
    return { criteria, marks, next_step: String(out.next_step || '').slice(0, 300), ready: criteria.every((c) => c.status === 'met') }
}

export async function feedback(body, env, callModel) {
    const activity = ACTIVITIES[body.section_id]
    if (!activity) return [{ error: 'unknown_activity' }, 404]
    const text = String(body.text || '').trim()
    if (text.length < MIN_CHARS) return [{ error: 'too_short' }, 400]
    if (text.length > MAX_CHARS) return [{ error: 'too_long' }, 400]
    const revision = Math.max(1, Math.min(5, Number(body.revision) || 1))
    const previous = Array.isArray(body.previous) ? body.previous.filter((c) => activity.criteria.some((k) => k.id === c?.id)).slice(0, 6) : null
    const section = await loadSection(env, body.section_id)
    const sectionText = section ? sectionPlainText(section.content) : ''

    let leak = 0
    for (const strict of [false, true]) {
        const out = await callModel(env, feedbackMessages({ activity, text, revision, previous, sectionText, strict }), FEEDBACK_SCHEMA, { temperature: 0.3, maxTokens: 900 })
        const clean = cleanFeedback(out, activity, text)
        const said = [clean.next_step, ...clean.criteria.map((c) => c.comment), ...clean.marks.map((m) => m.note)].join(' ')
        leak = referenceOverlap(said, activity.reference)
        if (leak < 0.45) return [{ ...clean, revision, retried: strict }, 200, { revision, met: clean.criteria.filter((c) => c.status === 'met').length, marks: clean.marks.length, retried: strict }]
    }
    return [{ error: 'guard_blocked' }, 422, { revision, guard: 'reference_overlap', overlap: Math.round(leak * 100) / 100 }]
}
