/**
 * Highlights kept in this browser when there is no Supabase (static preview, local dev).
 * One key per section; listAllLocalHighlights() feeds the notebook across sections.
 */

const PREFIX = 'alget_highlights_v1:'

// Colour tags, as in Hypothesis/Perusall-style reading: each colour carries a meaning.
export const HIGHLIGHT_TAGS = {
    yellow: { label: 'Insight', mark: 'bg-yellow-200 hover:bg-yellow-300', underline: 'border-b-2 border-yellow-500', dot: 'bg-yellow-400' },
    blue: { label: 'Question', mark: 'bg-sky-200 hover:bg-sky-300', underline: 'border-b-2 border-sky-500', dot: 'bg-sky-400' },
    red: { label: 'Confusion', mark: 'bg-rose-200 hover:bg-rose-300', underline: 'border-b-2 border-rose-500', dot: 'bg-rose-400' },
    green: { label: 'Connection', mark: 'bg-emerald-200 hover:bg-emerald-300', underline: 'border-b-2 border-emerald-500', dot: 'bg-emerald-400' },
}

export const tagFor = (color) => HIGHLIGHT_TAGS[color] || HIGHLIGHT_TAGS.yellow

export function readLocalHighlights(sectionId) {
    try {
        const list = JSON.parse(window.localStorage.getItem(PREFIX + sectionId) || '[]')
        return Array.isArray(list) ? list : []
    } catch {
        return []
    }
}

export function writeLocalHighlights(sectionId, highlights) {
    try {
        if (highlights.length) window.localStorage.setItem(PREFIX + sectionId, JSON.stringify(highlights))
        else window.localStorage.removeItem(PREFIX + sectionId)
    } catch { /* storage unavailable */ }
}

/** Every locally stored highlight, optionally limited to one course, oldest first. */
export function listAllLocalHighlights(course = null) {
    const all = []
    try {
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i)
            if (!key?.startsWith(PREFIX)) continue
            const sectionId = key.slice(PREFIX.length)
            if (course && !sectionId.startsWith(`${course}/`)) continue
            all.push(...readLocalHighlights(sectionId))
        }
    } catch { /* storage unavailable */ }
    return all.sort((a, b) => String(a.section_id).localeCompare(String(b.section_id)) || String(a.created_at).localeCompare(String(b.created_at)))
}

export function highlightsToMarkdown(highlights, title) {
    const lines = [`# ${title}`, `*Exported on ${new Date().toLocaleDateString()}*`, '']
    let section = null
    for (const h of highlights) {
        if (h.section_id !== section) {
            section = h.section_id
            lines.push(`## ${section}`, '')
        }
        lines.push(`> ${String(h.text_content).replace(/\n+/g, ' ')}`, '', `*${tagFor(h.color).label}*${h.note ? ` · ${h.note}` : ''}`, '')
    }
    return lines.join('\n')
}
