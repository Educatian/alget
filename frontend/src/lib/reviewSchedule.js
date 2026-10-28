/**
 * Per-concept spaced review, kept in this browser. A wrong answer brings the concept back soon;
 * each unaided correct answer pushes it further out (expanding intervals, as in spaced
 * retrieval practice). A hint-assisted correct answer keeps the current interval.
 */

const KEY = 'alget_review_v1'
const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE
export const REVIEW_INTERVALS = [10 * MINUTE, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY]

function read() {
    try {
        const data = JSON.parse(window.localStorage.getItem(KEY) || '{}')
        return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
    } catch {
        return {}
    }
}

export function recordReviewOutcome(conceptId, sectionId, isCorrect, hintUsed = false, now = Date.now()) {
    if (!conceptId || !sectionId) return null
    const all = read()
    const previous = all[conceptId]
    let step = previous?.step ?? 0
    if (!isCorrect) step = 0
    else if (!hintUsed) step = Math.min(step + 1, REVIEW_INTERVALS.length - 1)
    all[conceptId] = { step, due: now + REVIEW_INTERVALS[step], section_id: sectionId, last: now }
    try { window.localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* storage unavailable */ }
    return all[conceptId]
}

/** Concepts due for review in a course (soonest first), leaving out the current section's own. */
export function dueConcepts(course, { excludeSectionId = null, now = Date.now(), limit = 3 } = {}) {
    return Object.entries(read())
        .filter(([, r]) => r.due <= now && String(r.section_id).startsWith(`${course}/`) && r.section_id !== excludeSectionId)
        .sort(([, a], [, b]) => a.due - b.due)
        .slice(0, limit)
        .map(([conceptId, r]) => ({ conceptId, ...r }))
}
