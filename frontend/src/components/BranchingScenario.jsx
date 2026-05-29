import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * BranchingScenario - an interactive decision scenario for ethics and
 * teacher-judgment content. A small decision tree: each node has a prompt and
 * 2-4 choices; choosing one navigates to a consequence node that shows feedback
 * and may offer further choices. The learner's path is tracked and shown as a
 * breadcrumb trail; "Back up" returns to the previous node so a different
 * branch can be explored.
 *
 * MDX usage (props arrive as strings, parsed defensively):
 *   <branching-scenario tree='{
 *     "start": "n1",
 *     "nodes": {
 *       "n1": { "prompt": "A student submits AI-written work...",
 *               "choices": [
 *                 { "label": "Report it", "next": "n2", "feedback": "..." },
 *                 { "label": "Talk first", "next": "n3" }
 *               ] },
 *       "n2": { "prompt": "...", "feedback": "An outcome.", "choices": [] }
 *     }
 *   }' />
 *
 * Accessibility:
 *  - Choices are real <button>s; the consequence/feedback region is aria-live
 *    so screen readers hear the outcome after each decision.
 *  - Focus moves to the new node heading after a choice or a back-up so
 *    keyboard users are oriented (respecting prefers-reduced-motion: no smooth
 *    scroll when the user opts out).
 *  - Terminal nodes are announced as an ending; the path trail uses an ordered
 *    list so position in the decision tree is conveyed.
 */
export default function BranchingScenario({ tree }) {
    const model = useMemo(() => normalizeTree(tree), [tree])
    // path is an array of { nodeId, choiceLabel?, feedback? } entries; the first
    // entry is the start node (no incoming choice).
    const [path, setPath] = useState(() => (model ? [{ nodeId: model.start }] : []))
    const headingRef = useRef(null)
    const isFirstRender = useRef(true)

    const current = path[path.length - 1]
    const node = model && current ? model.nodes[current.nodeId] : null

    useEffect(() => {
        // Skip focus-move on the very first render so we do not steal focus on
        // page load; move focus only after a learner-initiated transition.
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }
        headingRef.current?.focus()
    }, [path.length])

    if (!model || !node) {
        return null
    }

    const choices = Array.isArray(node.choices) ? node.choices : []
    const isTerminal = choices.length === 0

    const handleChoose = (choice) => {
        const target = model.nodes[choice.next]
        if (!target) return
        setPath((prev) => [
            ...prev,
            { nodeId: choice.next, choiceLabel: choice.label, feedback: choice.feedback || target.feedback || '' },
        ])
    }

    const handleBack = () => {
        setPath((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
    }

    const handleRestart = () => {
        setPath([{ nodeId: model.start }])
    }

    return (
        <section
            className="my-5 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.85)] p-4 shadow-sm"
            aria-label={model.title || 'Decision scenario'}
        >
            <p className="editorial-kicker">{model.title || 'Decision scenario'}</p>

            {path.length > 1 && (
                <nav aria-label="Decisions so far" className="mt-2">
                    <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--ath-muted)]">
                        {path.slice(1).map((step, index) => (
                            <li key={`${step.nodeId}-${index}`} className="flex items-center gap-1">
                                {index > 0 && <span aria-hidden="true">{'›'}</span>}
                                <span className="rounded-full bg-[var(--ath-panel)] px-2 py-0.5">
                                    {step.choiceLabel}
                                </span>
                            </li>
                        ))}
                    </ol>
                </nav>
            )}

            <h3
                ref={headingRef}
                tabIndex={-1}
                className="mt-3 text-sm font-semibold leading-6 text-[var(--ath-text)] outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
            >
                {node.prompt}
            </h3>

            {/* Consequence / feedback for how we arrived at this node. */}
            <div aria-live="polite" className="mt-2">
                {current.feedback && (
                    <p className="rounded-xl bg-[var(--ath-panel)] px-3 py-2 text-xs leading-5 text-[var(--ath-muted)]">
                        {current.feedback}
                    </p>
                )}
                {isTerminal && (
                    <p className="mt-2 text-xs font-semibold text-[var(--ath-secondary)]">
                        <span aria-hidden="true">{'■ '}</span>
                        This path has reached an ending.
                    </p>
                )}
            </div>

            {!isTerminal && (
                <div className="mt-3 grid gap-2" role="group" aria-label="Choose what to do next">
                    {choices.map((choice, index) => (
                        <button
                            key={`${choice.label}-${index}`}
                            type="button"
                            onClick={() => handleChoose(choice)}
                            className="flex items-start gap-2 rounded-xl border border-[var(--ath-line)] bg-white px-3 py-2 text-left text-sm leading-6 text-[var(--ath-text)] hover:border-[var(--ath-primary)] hover:bg-[var(--ath-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] motion-safe:transition-colors"
                        >
                            <span className="font-mono text-xs text-[var(--ath-muted)]" aria-hidden="true">
                                {String.fromCharCode(65 + index)}.
                            </span>
                            <span>{choice.label}</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={handleBack}
                    disabled={path.length <= 1}
                    className="rounded-full border border-[var(--ath-line)] bg-white px-4 py-1.5 text-xs font-semibold text-[var(--ath-text)] hover:bg-[var(--ath-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Back up and try another branch
                </button>
                {path.length > 1 && (
                    <button
                        type="button"
                        onClick={handleRestart}
                        className="rounded-full border border-[var(--ath-line)] bg-white px-4 py-1.5 text-xs font-semibold text-[var(--ath-text)] hover:bg-[var(--ath-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                    >
                        Start over
                    </button>
                )}
            </div>
        </section>
    )
}

/* ------------------------------ helpers ------------------------------ */

// Normalize the tree prop (string JSON or object) into a validated model:
// { start, title, nodes: { id: { prompt, feedback, choices: [{label,next,feedback}] } } }.
// Returns null when the tree is unusable so the component degrades gracefully.
function normalizeTree(tree) {
    const raw = typeof tree === 'string' ? safeParse(tree) : tree
    if (!raw || typeof raw !== 'object') return null

    const nodes = raw.nodes && typeof raw.nodes === 'object' ? raw.nodes : null
    if (!nodes) return null

    const ids = Object.keys(nodes)
    if (ids.length === 0) return null

    const start = typeof raw.start === 'string' && nodes[raw.start] ? raw.start : ids[0]

    const cleanNodes = {}
    for (const id of ids) {
        const n = nodes[id] || {}
        const choices = Array.isArray(n.choices)
            ? n.choices
                  .filter((c) => c && typeof c === 'object' && c.label && c.next && nodes[c.next])
                  .map((c) => ({
                      label: String(c.label),
                      next: String(c.next),
                      feedback: c.feedback ? String(c.feedback) : '',
                  }))
            : []
        cleanNodes[id] = {
            prompt: String(n.prompt ?? ''),
            feedback: n.feedback ? String(n.feedback) : '',
            choices,
        }
    }

    if (!cleanNodes[start]?.prompt) return null

    return { start, title: raw.title ? String(raw.title) : '', nodes: cleanNodes }
}

function safeParse(raw) {
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}
