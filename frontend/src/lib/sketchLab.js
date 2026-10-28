/**
 * Message contract for the Sketchbook 3D labs (see components/SketchLab.jsx).
 *
 * A framed lab posts `{ channel: 'sim-telemetry', sim: '<prefix><lesson>', type, data }`.
 * Only safe event names are accepted, and data keeps booleans, finite numbers and short
 * strings, so no learner-typed text reaches the logs.
 */
const BOOK_PREFIX = Object.freeze({ ai: 'ailit-', energy: 'energy-' })
const SAFE_EVENT = /^[a-z][a-z0-9_]{0,63}$/
const SAFE_LESSON = /^[a-z0-9-]{1,40}$/

export function sketchLabSimId(book, lesson) {
    const prefix = BOOK_PREFIX[book]
    return prefix && SAFE_LESSON.test(lesson || '') ? `${prefix}${lesson}` : null
}

export function normalizeSketchMessage(data, expectedSimId) {
    if (!data || typeof data !== 'object' || data.channel !== 'sim-telemetry') return null
    if (data.sim !== expectedSimId || !SAFE_EVENT.test(data.type || '')) return null
    const safe = {}
    for (const [key, value] of Object.entries(data.data || {})) {
        if (!SAFE_EVENT.test(key) || Object.keys(safe).length >= 20) continue
        if (typeof value === 'boolean') safe[key] = value
        else if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value
        else if (typeof value === 'string') safe[key] = value.slice(0, 160)
    }
    return { type: `sketch_${data.type}`, data: safe }
}
