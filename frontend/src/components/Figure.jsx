import { useId } from 'react'
import ConceptRef from './ConceptRef'
import { isKnownConcept } from './conceptRegistry'

/**
 * Figure - a typed SEMANTIC content node (PreTeXt figure block, item 6). Wraps
 * figure-like content (an image, a diagram, an embedded interactive) with a
 * real <figure>/<figcaption> pair and an optional concept link, so a figure
 * participates in the concept graph and renders an accessible, numbered-style
 * caption rather than an ad-hoc bolded line.
 *
 * MDX usage:
 *   <figure-block caption="Free-body diagram of the beam" conceptid="free_body_diagram">
 *     <img src="/figures/fbd.svg" alt="A beam with three labelled force vectors" />
 *   </figure-block>
 *
 * Accessibility: uses the native <figure>/<figcaption> structure (announced as
 * a figure with its caption); the caption is real text (not baked into an
 * image). Authors remain responsible for alt text on the inner <img>; the
 * caption is associated via aria-labelledby. When a conceptid resolves, the
 * caption exposes a knowl-style ConceptRef to the canonical concept.
 */
export default function Figure({ caption, conceptid, conceptId, children }) {
    const resolvedConceptId = conceptId || conceptid || ''
    const linked = isKnownConcept(resolvedConceptId)
    // Stable per-instance id for aria-labelledby wiring of caption <-> figure.
    const captionId = `figure-caption-${useId()}`

    return (
        <figure
            className="reading-breakout not-prose my-6 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] p-4 shadow-sm"
            aria-labelledby={caption ? captionId : undefined}
            data-semantic-node="figure"
            data-concept-id={resolvedConceptId || undefined}
            data-analytics-region="figure"
        >
            <div className="overflow-x-auto">{children}</div>
            {caption && (
                <figcaption id={captionId} className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">
                    <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                        Figure
                    </span>
                    {caption}
                    {linked && (
                        <>
                            {' '}
                            <ConceptRef id={resolvedConceptId} />
                        </>
                    )}
                </figcaption>
            )}
        </figure>
    )
}
