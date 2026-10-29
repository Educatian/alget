/**
 * Chapter due dates (sites with the "deadlines" feature; see lib/site.js). Due dates guide pacing
 * only: nothing locks when one passes.
 */
import { CHAPTER_DUE } from './site'

const SOON_MS = 48 * 3600 * 1000
const TIME_ZONE = 'America/Chicago'

export const hasDeadlines = () => Object.keys(CHAPTER_DUE).length > 0

/** "Sun, Nov 8" in course time (Central). */
export function dueLabel(iso) {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TIME_ZONE })
}

/**
 * State of one chapter's due date: done (every section complete), past_due, due_soon (within 48 h)
 * or upcoming. Returns null when the chapter has no due date.
 */
export function chapterDue(chapterId, sectionsDone, sectionsTotal, now = Date.now(), due = CHAPTER_DUE) {
    const iso = due[chapterId]
    if (!iso) return null
    const at = Date.parse(iso)
    const done = sectionsTotal > 0 && sectionsDone >= sectionsTotal
    const state = done ? 'done' : now > at ? 'past_due' : at - now <= SOON_MS ? 'due_soon' : 'upcoming'
    return { iso, label: dueLabel(iso), state }
}

/**
 * Where a student stands against the due dates, from their section statuses in course order
 * (sections grouped three per chapter, ids like "ai-literacy/01/02"): chapters past due and not done.
 */
export function pacing(sectionIds, statuses, now = Date.now(), due = CHAPTER_DUE) {
    const behind = []
    let next = null
    for (const [chapter, iso] of Object.entries(due).sort((a, b) => Date.parse(a[1]) - Date.parse(b[1]))) {
        const idx = sectionIds.map((id, i) => (id.split('/')[1] === chapter ? i : -1)).filter((i) => i >= 0)
        const done = idx.length > 0 && idx.every((i) => statuses[i] === 'done')
        if (Date.parse(iso) < now) { if (!done) behind.push(chapter) } else if (!next) next = { chapter, iso }
    }
    return { behind, next }
}
