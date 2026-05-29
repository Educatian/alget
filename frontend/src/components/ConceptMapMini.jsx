import { useId, useMemo, useState } from 'react'
import { resolveConcept, conceptLabel, isKnownConcept } from './conceptRegistry'
import { logEvent } from '../lib/loggingService'

/**
 * ConceptMapMini - a small interactive concept-neighborhood map for the
 * current section.
 *
 * Given a set of concept ids (the section's concepts), it renders an accessible
 * node-link SVG of those concepts plus the registry 'related' links between
 * them, so a learner can see how the ideas in front of them connect. Selecting
 * a node (click, Enter, or Space) surfaces its label and description in an
 * aria-live panel, the way a small knowledge-map gives a learner a sense of
 * where the current idea sits.
 *
 * MDX usage:
 *   <concept-map concepts='["cognitive_load","mayer_principles"]' />
 *   <concept-map concepts='["cognitive_load"]' title="This section" />
 *
 * MDX attribute values arrive as STRINGS, so the concepts prop is parsed
 * defensively (JSON array, or a comma-separated fallback). With no resolvable
 * concepts the component renders nothing, so it degrades gracefully.
 *
 * Accessibility: the SVG is a labelled group; each node is a focusable element
 * with role="button", aria-pressed, and a descriptive aria-label. The graph is
 * fully keyboard operable (Tab between nodes, Enter/Space to select), the
 * selection detail is announced via an aria-live region, links use a
 * non-color-only marker, and motion respects prefers-reduced-motion.
 */
export default function ConceptMapMini({ concepts, title, course }) {
    const reactId = useId()
    const ids = useMemo(() => parseConceptIds(concepts), [concepts])

    // Resolve to known concepts only; unknown ids degrade away rather than
    // rendering a dangling node. conceptLabel still gives readable text but a
    // node needs a real registry record to show a description on selection.
    const nodes = useMemo(() => {
        const seen = new Set()
        const resolved = []
        ids.forEach((id) => {
            if (!isKnownConcept(id) || seen.has(id)) return
            seen.add(id)
            const concept = resolveConcept(id)
            resolved.push({
                id,
                label: concept?.label || conceptLabel(id),
                description: concept?.description || '',
                related: Array.isArray(concept?.related) ? concept.related : [],
            })
        })
        return resolved
    }, [ids])

    // Edges are the 'related' links that stay inside this neighborhood (both
    // endpoints are nodes we are drawing). Deduplicate undirected pairs.
    const edges = useMemo(() => {
        const present = new Set(nodes.map((n) => n.id))
        const pairs = new Set()
        const result = []
        nodes.forEach((node) => {
            node.related.forEach((relatedId) => {
                if (!present.has(relatedId)) return
                const key = [node.id, relatedId].sort().join('::')
                if (pairs.has(key)) return
                pairs.add(key)
                result.push({ source: node.id, target: relatedId, key })
            })
        })
        return result
    }, [nodes])

    const [selectedId, setSelectedId] = useState(null)

    const layout = useMemo(() => computeLayout(nodes), [nodes])

    if (nodes.length === 0) return null

    const selected = nodes.find((n) => n.id === selectedId) || null
    const headingId = `${reactId}-heading`
    const liveId = `${reactId}-live`

    const handleSelect = (node) => {
        setSelectedId(node.id)
        logEvent('concept_map_select', node.id, { concept_id: node.id, course: course || null })
    }

    return (
        <div className="my-6 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.85)] p-4 shadow-sm">
            <style>{`
                @media (prefers-reduced-motion: reduce) {
                    .concept-map-node { transition: none !important; }
                }
            `}</style>
            <p id={headingId} className="editorial-kicker">
                {title ? title : 'Concept map'}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">
                Select a concept to see how it connects to the others in this section.
            </p>

            <svg
                role="group"
                aria-labelledby={headingId}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                className="mt-3 w-full"
                style={{ maxHeight: '320px' }}
            >
                {/* Edges first so nodes paint on top. Each link is given a title
                    for assistive tech rather than relying on the line alone. */}
                {edges.map((edge) => {
                    const a = layout.positions[edge.source]
                    const b = layout.positions[edge.target]
                    if (!a || !b) return null
                    return (
                        <line
                            key={edge.key}
                            x1={a.x}
                            y1={a.y}
                            x2={b.x}
                            y2={b.y}
                            stroke="var(--ath-line)"
                            strokeWidth="2"
                            strokeDasharray="4 3"
                        >
                            <title>
                                {conceptLabel(edge.source)} is related to {conceptLabel(edge.target)}
                            </title>
                        </line>
                    )
                })}

                {nodes.map((node) => {
                    const pos = layout.positions[node.id]
                    if (!pos) return null
                    const isSelected = node.id === selectedId
                    return (
                        <g
                            key={node.id}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            aria-label={`Concept: ${node.label}. Select to read its description.`}
                            data-concept-node={node.id}
                            className="concept-map-node cursor-pointer outline-none transition-transform"
                            onClick={() => handleSelect(node)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                                    event.preventDefault()
                                    handleSelect(node)
                                }
                            }}
                        >
                            <circle
                                cx={pos.x}
                                cy={pos.y}
                                r={NODE_RADIUS}
                                fill={isSelected ? 'var(--ath-primary)' : 'white'}
                                stroke="var(--ath-primary)"
                                strokeWidth={isSelected ? 3 : 2}
                            />
                            <text
                                x={pos.x}
                                y={pos.y + NODE_RADIUS + 16}
                                textAnchor="middle"
                                className="text-[11px]"
                                fill="var(--ath-text)"
                            >
                                {truncate(node.label, 22)}
                            </text>
                        </g>
                    )
                })}
            </svg>

            <div
                id={liveId}
                role="status"
                aria-live="polite"
                className="mt-3 rounded-xl bg-[var(--ath-panel)] px-3 py-2 text-sm leading-6 text-[var(--ath-text)]"
            >
                {selected ? (
                    <>
                        <span className="font-semibold">{selected.label}.</span>{' '}
                        <span className="text-[var(--ath-muted)]">
                            {selected.description || 'A concept taught in this section.'}
                        </span>
                        {selected.related.filter((r) => nodes.some((n) => n.id === r)).length > 0 && (
                            <span className="mt-1 block text-xs text-[var(--ath-secondary)]">
                                Connects to{' '}
                                {selected.related
                                    .filter((r) => nodes.some((n) => n.id === r))
                                    .map((r) => conceptLabel(r))
                                    .join(', ')}
                                .
                            </span>
                        )}
                    </>
                ) : (
                    <span className="text-[var(--ath-muted)]">
                        No concept selected. Choose a node above to read about it.
                    </span>
                )}
            </div>
        </div>
    )
}

const NODE_RADIUS = 22

function parseConceptIds(raw) {
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
    if (typeof raw !== 'string') return []
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
        if (parsed && typeof parsed === 'string') return [parsed]
    } catch {
        // Fall through to comma-separated parsing below.
    }
    return trimmed
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
}

// Deterministic radial layout: anchor node at the centre, the rest evenly
// spaced on a circle. Deterministic so tests and snapshots are stable and so a
// node keeps its place across re-renders.
function computeLayout(nodes) {
    const width = 480
    const height = 260
    const cx = width / 2
    const cy = height / 2
    const positions = {}

    if (nodes.length === 0) {
        return { width, height, positions }
    }

    if (nodes.length === 1) {
        positions[nodes[0].id] = { x: cx, y: cy }
        return { width, height, positions }
    }

    // First node sits at the centre; remaining nodes ring around it.
    positions[nodes[0].id] = { x: cx, y: cy }
    const ringNodes = nodes.slice(1)
    const radius = Math.min(width, height) / 2 - NODE_RADIUS - 26
    ringNodes.forEach((node, index) => {
        const angle = (2 * Math.PI * index) / ringNodes.length - Math.PI / 2
        positions[node.id] = {
            x: Math.round(cx + radius * Math.cos(angle)),
            y: Math.round(cy + radius * Math.sin(angle)),
        }
    })

    return { width, height, positions }
}

function truncate(text, max) {
    const str = String(text || '')
    if (str.length <= max) return str
    return `${str.slice(0, max - 1)}…`
}
