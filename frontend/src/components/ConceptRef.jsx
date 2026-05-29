import * as Popover from '@radix-ui/react-popover'
import { resolveConcept, conceptLabel, isKnownConcept } from './conceptRegistry'
import { logEvent } from '../lib/loggingService'

/**
 * ConceptRef - knowl-style inline cross-reference expansion (PreTeXt knowl.js
 * pattern, item 7). A reference to a registered concept expands the concept's
 * definition IN PLACE via an accessible disclosure popover instead of
 * navigating away, resolved against the canonical concept registry.
 *
 * The expansion lives entirely in the React tree (radix Popover, already in
 * deps) - no DOM mutation, unlike rex's imperative model.
 *
 * MDX usage:
 *   <concept-ref id="cognitive_load">cognitive load</concept-ref>
 *   <concept-ref id="cognitive_load" />            // label from the registry
 *
 * Accessibility: the trigger is a real <button> with aria-expanded wired by
 * radix; the disclosure is announced and keyboard-dismissable (Esc), and the
 * reference is marked with a dotted underline plus an aria-label rather than
 * color alone.
 */
export default function ConceptRef({ id, children }) {
    const conceptId = id || ''
    const concept = resolveConcept(conceptId)
    const label = children || conceptLabel(conceptId)

    // Dangling reference: resolve to readable text without an expansion, so a
    // typo in authored content degrades gracefully rather than throwing. The
    // build-time validator (validate_content.py) is the gate that catches
    // these; this is the runtime fallback.
    if (!isKnownConcept(conceptId)) {
        return <span data-concept-ref="unresolved">{label}</span>
    }

    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    data-concept-ref={conceptId}
                    data-analytics-region="concept-ref"
                    onClick={() => logEvent('concept_ref_expand', conceptId, { concept_id: conceptId })}
                    className="cursor-help rounded-sm border-b border-dotted border-[var(--ath-primary)] font-medium text-[var(--ath-text)] underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                    aria-label={`Show definition of ${typeof label === 'string' ? label : concept.label}`}
                >
                    {label}
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="top"
                    align="center"
                    sideOffset={6}
                    collisionPadding={12}
                    role="dialog"
                    aria-label={`Definition of ${concept.label}`}
                    className="z-[80] w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-[var(--ath-line)] bg-white/95 p-3 text-xs leading-5 text-[var(--ath-muted)] shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur-xl"
                >
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                        Concept
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ath-text)]">{concept.label}</p>
                    <p className="mt-1">{concept.description}</p>
                    {concept.related?.length > 0 && (
                        <p className="mt-2 text-[11px] text-[var(--ath-secondary)]">
                            <span className="font-semibold">Related:</span>{' '}
                            {concept.related.map((relatedId, index) => (
                                <span key={relatedId}>
                                    {index > 0 && ', '}
                                    {conceptLabel(relatedId)}
                                </span>
                            ))}
                        </p>
                    )}
                    <Popover.Arrow className="fill-white/95" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
