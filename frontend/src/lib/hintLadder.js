/**
 * Offline hint ladder for a practice item, built only from course data already on the page:
 *   1. "Where to look"  - the section paragraph that best matches the question
 *   2. "Watch out for"  - the item's misconception, as a guiding question
 *   3. "Narrow it down" - one wrong option ruled out
 * No rung states the correct option; the answer is shown only after attempts run out.
 */

const STOP = new Set('a an and are as at be by can do does for from has have how in is it its of on or that the this to was what when which who why will with you your each one step'.split(' '))

function words(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
}

/** Plain-text paragraphs of an MDX section (tags, headings and markup removed). */
export function sectionParagraphs(mdx) {
    return String(mdx || '')
        .replace(/<[^>]+>/g, ' ')
        .split(/\n\s*\n/)
        .map((block) => block.replace(/^#+\s.*$/gm, '').replace(/[*_`>[\]()]|^\s*[-\d.]+\s/gm, ' ').replace(/\s+/g, ' ').trim())
        .filter((p) => p.length > 60)
}

export function bestParagraph(problem, mdx) {
    const query = new Set([...words(problem?.stem || problem?.statement), ...words(String(problem?.concept_id || '').replace(/_/g, ' '))])
    let best = null
    for (const paragraph of sectionParagraphs(mdx)) {
        const score = words(paragraph).filter((w) => query.has(w)).length
        if (score > 0 && (!best || score > best.score)) best = { text: paragraph, score }
    }
    return best?.text || null
}

export function buildHintLadder(problem, misconception, mdx, ruledOut = []) {
    const rungs = []
    const passage = bestParagraph(problem, mdx)
    if (passage) rungs.push({ kind: 'reread', title: 'Where to look', text: passage.length > 260 ? `${passage.slice(0, 257)}…` : passage, anchor: passage.slice(0, 60) })
    if (misconception?.description) {
        rungs.push({ kind: 'mixup', title: 'Watch out for', text: `A common mix-up is "${misconception.description.replace(/\.$/, '')}". Which option would someone with that idea pick, and why is it off?` })
    }
    if (problem?.type === 'multiple_choice' && Array.isArray(problem.options)) {
        const wrong = problem.options.map((_, i) => i).filter((i) => i !== problem.correct_index && !ruledOut.includes(i))
        if (wrong.length > 1) rungs.push({ kind: 'eliminate', title: 'Narrow it down', text: `Option ${String.fromCharCode(65 + wrong[0])} can be ruled out.`, eliminate: wrong[0] })
    }
    return rungs
}

/** Scrolls the reading column to the paragraph that starts like `anchor` and flashes it. */
export function revealPassage(anchor) {
    const key = String(anchor || '').slice(0, 40).toLowerCase()
    const target = [...document.querySelectorAll('.reading-narrative p, .reading-narrative li')]
        .find((el) => el.textContent.replace(/\s+/g, ' ').trim().toLowerCase().startsWith(key))
    if (!target) return false
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    target.classList.remove('review-anchor-flash')
    void target.offsetWidth
    target.classList.add('review-anchor-flash')
    return true
}
