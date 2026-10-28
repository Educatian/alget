/**
 * Course content for the tutor, read from the static preview's exported API (the same JSON the
 * reader uses), so the tutor never trusts question or answer data sent by the browser.
 */

const SECTION_ID = /^[a-z0-9-]+\/\d{2}\/\d{2}$/
const cache = new Map()

export function isSectionId(value) {
    return typeof value === 'string' && SECTION_ID.test(value)
}

export async function loadSection(env, sectionId) {
    if (!isSectionId(sectionId)) return null
    const hit = cache.get(sectionId)
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.data
    const res = await fetch(`${env.CONTENT_BASE}/book/${sectionId}`, { cf: { cacheTtl: 600 } })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.content) return null
    cache.set(sectionId, { at: Date.now(), data })
    return data
}

/** The section's reading text roughly as the reader renders it: MDX tags and markdown removed. */
export function sectionPlainText(mdx) {
    return String(mdx || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
        .replace(/^\s*>\s?/gm, '')
        .replace(/[*_`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

const norm = (s) => String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()

/** True when the selected quote really is part of this section's reading text. */
export function quoteInSection(exact, mdx) {
    const quote = norm(exact)
    return quote.length >= 8 && norm(sectionPlainText(mdx)).includes(quote)
}
