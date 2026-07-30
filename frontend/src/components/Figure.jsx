/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- the overflow region must be keyboard-focusable so wide instructional figures can be panned without a pointer */
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
export default function Figure({
    caption,
    conceptid,
    conceptId,
    purpose,
    source,
    sourceurl,
    sourceUrl,
    license,
    children,
}) {
    const resolvedConceptId = conceptId || conceptid || ''
    const resolvedSourceUrl = sourceUrl || sourceurl || ''
    const linked = isKnownConcept(resolvedConceptId)
    // Stable per-instance id for aria-labelledby wiring of caption <-> figure.
    const captionId = `figure-caption-${useId()}`

    return (
        <figure
            className="reading-breakout not-prose my-6 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] p-4 shadow-sm"
            aria-labelledby={caption ? captionId : undefined}
            data-semantic-node="figure"
            data-concept-id={resolvedConceptId || undefined}
            data-visual-purpose={purpose || undefined}
            data-analytics-region="figure"
        >
            <div
                className="overflow-x-auto overscroll-x-contain rounded-xl [&_img]:block [&_img]:h-auto [&_img]:min-w-[680px] [&_img]:max-w-none sm:[&_img]:min-w-0 sm:[&_img]:max-w-full"
                tabIndex={0}
                role="region"
                aria-label="Scrollable instructional figure"
            >
                {children}
            </div>
            <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ath-secondary)] sm:hidden">
                Swipe horizontally to inspect the figure
            </span>
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
                    {(source || license) && (
                        <span className="mt-1 block text-xs leading-5 text-[var(--ath-secondary)]">
                            {source && (
                                <>
                                    Source:{' '}
                                    {resolvedSourceUrl ? (
                                        <a href={resolvedSourceUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">
                                            {source}
                                        </a>
                                    ) : source}
                                </>
                            )}
                            {source && license ? ' · ' : ''}
                            {license ? `License: ${license}` : ''}
                        </span>
                    )}
                </figcaption>
            )}
        </figure>
    )
}
