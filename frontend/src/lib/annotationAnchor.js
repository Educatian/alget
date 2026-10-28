/**
 * Text anchoring for highlights, after the W3C Web Annotation selectors that Hypothesis uses:
 * a TextQuote (exact + 32 characters of prefix/suffix) plus a TextPosition hint (start/end in
 * the container's text). Re-anchoring picks the occurrence whose context matches best, so a
 * phrase that appears twice is highlighted in the right place, and a selection that crosses
 * inline markup (bold, links) is wrapped node by node.
 */

const CONTEXT = 32
const SKIP = '[data-collab-badge], [data-live-presence-badge], script, style'

function textNodes(container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => (node.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    })
    const nodes = []
    let offset = 0
    let node
    while ((node = walker.nextNode())) {
        nodes.push({ node, start: offset })
        offset += node.data.length
    }
    return { nodes, text: nodes.map((n) => n.node.data).join('') }
}

function offsetOf(nodes, container, boundaryNode, boundaryOffset) {
    for (const { node, start } of nodes) {
        if (node === boundaryNode) return start + boundaryOffset
    }
    // Boundary on an element: count the text before that child.
    const probe = document.createRange()
    probe.selectNodeContents(container)
    probe.setEnd(boundaryNode, boundaryOffset)
    return probe.toString().length
}

/** Anchor for a DOM Range inside `container`, or null if the range is outside it. */
export function captureAnchor(range, container) {
    if (!range || !container?.contains(range.commonAncestorContainer)) return null
    const { nodes, text } = textNodes(container)
    const start = offsetOf(nodes, container, range.startContainer, range.startOffset)
    const end = offsetOf(nodes, container, range.endContainer, range.endOffset)
    if (end <= start) return null
    return {
        exact: text.slice(start, end),
        prefix: text.slice(Math.max(0, start - CONTEXT), start),
        suffix: text.slice(end, end + CONTEXT),
        start,
        end,
    }
}

function commonSuffix(a, b) {
    let n = 0
    while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
    return n
}

function commonPrefix(a, b) {
    let n = 0
    while (n < a.length && n < b.length && a[n] === b[n]) n++
    return n
}

/** Best {start, end} for an anchor in `text`, or null when the quote is no longer there. */
export function locateInText(text, anchor) {
    const exact = anchor?.exact
    if (!exact) return null
    let best = null
    for (let i = text.indexOf(exact); i !== -1; i = text.indexOf(exact, i + 1)) {
        const before = text.slice(Math.max(0, i - CONTEXT), i)
        const after = text.slice(i + exact.length, i + exact.length + CONTEXT)
        const score = commonSuffix(before, anchor.prefix || '') + commonPrefix(after, anchor.suffix || '')
            - (Number.isFinite(anchor.start) ? Math.min(Math.abs(i - anchor.start), 2000) / 2000 : 0)
        if (!best || score > best.score) best = { start: i, end: i + exact.length, score }
    }
    return best && { start: best.start, end: best.end }
}

/**
 * Wraps the anchored text in <mark> elements (one per text node it spans) made by makeMark().
 * Returns the marks, or [] when the quote can't be found (an "orphaned" annotation).
 */
export function wrapAnchor(container, anchor, makeMark) {
    const { nodes, text } = textNodes(container)
    const hit = locateInText(text, anchor)
    if (!hit) return []
    const marks = []
    for (const { node, start } of nodes) {
        const end = start + node.data.length
        if (end <= hit.start || start >= hit.end) continue
        const from = Math.max(hit.start, start) - start
        const to = Math.min(hit.end, end) - start
        if (!node.data.slice(from, to).trim()) continue
        const target = node.splitText(from)
        target.splitText(to - from)
        const mark = makeMark(marks.length === 0)
        target.parentNode.replaceChild(mark, target)
        mark.appendChild(target)
        marks.push(mark)
    }
    return marks
}
