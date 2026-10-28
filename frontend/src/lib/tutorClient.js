/**
 * Client for the TAMU tutor worker (cloudflare/tamu-tutor-worker). Enabled by VITE_TUTOR_URL.
 * Requests carry only ids, option numbers and the selected course text, never learner writing.
 * A failed call resolves to { error } (never throws) so callers fall back to their offline behaviour.
 */

export const TUTOR_URL = (import.meta.env.VITE_TUTOR_URL || '').replace(/\/$/, '')
export const TUTOR_ENABLED = Boolean(TUTOR_URL)

async function post(path, body) {
    if (!TUTOR_ENABLED) return null
    try {
        const res = await fetch(`${TUTOR_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(12000),
        })
        const data = await res.json().catch(() => null)
        return res.ok ? data : { error: data?.error || `http_${res.status}` }
    } catch {
        return { error: 'network' }
    }
}

/** Socratic hint for a practice item; picks are the learner's wrong option indexes. */
export const askTutorHint = ({ sectionId, problemId, rung, picks }) =>
    post('/hint', { section_id: sectionId, problem_id: problemId, rung, picks })

/** Grounded explanation of a selected passage. mode: explain | simpler | example | quiz_me */
export const explainPassage = ({ sectionId, exact, mode }) =>
    post('/explain', { section_id: sectionId, exact, mode })
