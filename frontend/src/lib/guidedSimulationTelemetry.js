/**
 * Convert locally stored learner writing into research-safe process features.
 * The authored text must never be included in the returned value.
 */
export function summarizeGuideText(value) {
    const length = String(value || '').trim().length
    if (length === 0) return { completed: false, length_band: 'empty' }
    if (length < 60) return { completed: true, length_band: 'brief' }
    if (length < 180) return { completed: true, length_band: 'developed' }
    return { completed: true, length_band: 'extended' }
}
