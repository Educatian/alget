import ConceptRef from './ConceptRef'
import { isKnownConcept } from './conceptRegistry'

/**
 * Definition - a typed SEMANTIC content node (PreTeXt definition block, item 6).
 * Renders an accessible definition block whose defined TERM is linked into the
 * canonical concept registry, so a definition in the prose participates in the
 * same concept graph the knowledge tracer and validator use.
 *
 * MDX usage:
 *   <definition term="Cognitive load" conceptid="cognitive_load">
 *     The total mental effort imposed on working memory during a task.
 *   </definition>
 *
 * Accessibility: rendered as a <dl> (description list) - a real semantic
 * structure announced by screen readers as a term/definition pair - inside a
 * region labelled by the term, with a visible "Definition" label that does not
 * rely on color. When the term resolves to a registry concept, the term itself
 * becomes a knowl-style ConceptRef so the canonical concept description is one
 * keystroke away.
 */
export default function Definition({ term, conceptid, conceptId, children }) {
    const resolvedConceptId = conceptId || conceptid || ''
    const linked = isKnownConcept(resolvedConceptId)
    const displayTerm = term || ''

    return (
        <aside
            className="reading-breakout not-prose my-6 rounded-2xl border border-[var(--ath-line)] border-l-4 border-l-[var(--ath-primary)] bg-[rgba(255,255,255,0.7)] p-4 shadow-sm"
            role="group"
            aria-label={`Definition: ${displayTerm}`}
            data-semantic-node="definition"
            data-concept-id={resolvedConceptId || undefined}
        >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                Definition
            </p>
            <dl className="mt-1">
                <dt className="text-base font-semibold text-[var(--ath-text)]">
                    {linked ? (
                        <ConceptRef id={resolvedConceptId}>{displayTerm}</ConceptRef>
                    ) : (
                        // A non-resolving conceptid degrades to plain term text; the
                        // build-time validator (validate_content.py) is the gate that
                        // catches dangling concept references before publish.
                        <span>{displayTerm}</span>
                    )}
                </dt>
                <dd className="mt-1.5 text-sm leading-6 text-[var(--ath-muted)]">{children}</dd>
            </dl>
        </aside>
    )
}
