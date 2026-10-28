/**
 * Shared underlines: passages where at least MIN_STUDENTS different students highlighted the same
 * text. Built from each student's synced highlights (progress key alget_highlights_v1:<section>),
 * whose anchors carry the exact text and its character offsets in the section (lib/annotationAnchor.js
 * in the frontend). Offsets can differ by a few characters between readers (an overlay that was
 * open, say), so each anchor is placed where its quote and context agree with the text already
 * seen, not trusted blindly. Only text, counts and colour-tag counts leave the server: never notes,
 * never who.
 */

export const MIN_STUDENTS = 2
const MIN_CHARS = 4
const CONTEXT = 32
const MAX_PASSAGES = 40
const MAX_SHIFT = 400
const WORD = /[\p{L}\p{N}'’-]/u

function anchorsOf(value) {
    let list
    try { list = JSON.parse(value) } catch { return [] }
    if (!Array.isArray(list)) return []
    return list.map((h) => ({ a: h?.anchor, color: typeof h?.color === 'string' ? h.color : 'yellow' }))
        .filter(({ a }) => a && typeof a.exact === 'string' && Number.isInteger(a.start) && Number.isInteger(a.end)
            && a.end > a.start && a.end - a.start === a.exact.length && a.start >= 0 && a.end - a.start <= 2000)
}

/**
 * rows: [{student_id, value}] for one section, one row per student.
 * Returns [{exact, prefix, suffix, start, end, count, tags: {colour: students}}] in reading order.
 */
/**
 * Shift that puts an anchor's prefix + quote + suffix onto the text seen so far without a
 * conflicting character: the smallest one with enough agreeing characters, 0 when nothing overlaps
 * yet, or null when it fits nowhere (left out).
 */
function shiftFor(text, a) {
    const ctx = String(a.prefix || '') + a.exact + String(a.suffix || '')
    const base = a.start - String(a.prefix || '').length
    const need = Math.min(16, a.exact.length)
    const agree = (d) => {
        let known = 0
        for (let i = 0; i < ctx.length; i++) {
            const c = text.get(base + d + i)
            if (c === undefined) continue
            if (c !== ctx[i]) return -1
            known++
        }
        return known
    }
    const atZero = agree(0)
    if (atZero >= need || (atZero === 0 && ![...Array(ctx.length).keys()].some((i) => text.has(base + i)))) return 0
    for (let k = 1; k <= MAX_SHIFT; k++) {
        for (const d of [-k, k]) if (base + d >= 0 && agree(d) >= need) return d
    }
    return atZero >= 0 ? 0 : null
}

export function sharedPassages(rows, minStudents = MIN_STUDENTS) {
    const text = new Map() // offset -> character, in the frame of the first anchor seen
    const spans = [] // {student, start, end, color}
    for (const row of rows) {
        for (const { a, color } of anchorsOf(row.value)) {
            const d = shiftFor(text, a)
            if (d === null) continue
            const start = a.start + d
            const end = a.end + d
            const before = String(a.prefix || '')
            const after = String(a.suffix || '')
            for (let i = 0; i < a.exact.length; i++) if (!text.has(start + i)) text.set(start + i, a.exact[i])
            for (let i = 0; i < before.length; i++) {
                const at = start - before.length + i
                if (at >= 0 && !text.has(at)) text.set(at, before[i])
            }
            for (let i = 0; i < after.length; i++) if (!text.has(end + i)) text.set(end + i, after[i])
            spans.push({ student: row.student_id, start, end, color })
        }
    }
    if (!spans.length) return []

    // Elementary segments between span boundaries, each with the students covering it.
    const cuts = [...new Set(spans.flatMap((s) => [s.start, s.end]))].sort((x, y) => x - y)
    const runs = []
    for (let i = 0; i < cuts.length - 1; i++) {
        const [from, to] = [cuts[i], cuts[i + 1]]
        const students = new Set(spans.filter((s) => s.start <= from && s.end >= to).map((s) => s.student))
        if (students.size < minStudents) continue
        const last = runs.at(-1)
        if (last && last.end === from) {
            last.end = to
            last.count = Math.max(last.count, students.size)
        } else {
            runs.push({ start: from, end: to, count: students.size })
        }
    }

    const at = (i) => text.get(i)
    const out = []
    for (const run of runs) {
        let { start, end } = run
        // Whole words: widen a cut that falls inside a word, then trim spaces and punctuation.
        while (at(start - 1) && WORD.test(at(start - 1)) && WORD.test(at(start) || '')) start--
        while (at(end) && WORD.test(at(end)) && WORD.test(at(end - 1) || '')) end++
        while (start < end && !WORD.test(at(start) || '')) start++
        while (end > start && !WORD.test(at(end - 1) || '')) end--
        let exact = ''
        for (let i = start; i < end; i++) {
            if (!text.has(i)) { exact = null; break }
            exact += at(i)
        }
        if (!exact || exact.replace(/\s/g, '').length < MIN_CHARS) continue
        let prefix = ''
        for (let i = start - 1; i >= start - CONTEXT && text.has(i); i--) prefix = at(i) + prefix
        let suffix = ''
        for (let i = end; i < end + CONTEXT && text.has(i); i++) suffix += at(i)
        const tags = {}
        const seen = new Set()
        for (const s of spans) {
            if (s.end <= start || s.start >= end || seen.has(`${s.student}|${s.color}`)) continue
            seen.add(`${s.student}|${s.color}`)
            tags[s.color] = (tags[s.color] || 0) + 1
        }
        out.push({ exact, prefix, suffix, start, end, count: run.count, tags })
    }
    return out.slice(0, MAX_PASSAGES)
}

/** Shared passages for one section, from D1. Test and instructor IDs (TAMU-9xx) are left out. */
export async function sharedForSection(env, sectionId) {
    const { results } = await env.DB.prepare(
        "SELECT student_id, value FROM progress WHERE key = ? AND student_id NOT LIKE 'TAMU-9%'",
    ).bind(`alget_highlights_v1:${sectionId}`).all()
    return sharedPassages(results || [])
}
