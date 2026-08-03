import React from 'react'

/**
 * EmptyState - a tokenized, dark-adapting empty-state primitive.
 *
 * Replaces the bare muted sentence that every zero-state currently hand-rolls
 * (dashboard, practice, analytics, lab) with one consistent, accessible block:
 * a dashed-border container drawn with the design-system line token, a centered
 * icon, a serif-friendly title, muted explanatory body, and an optional
 * recovery call-to-action so the learner is never stranded.
 *
 * Why it matters (design critique, systemic gap #9): "No reusable empty-state
 * primitive. Every dashboard zero-state is a bare muted sentence; build
 * <EmptyState icon title body action> with a dashed-border container and a
 * recovery CTA."
 *
 * All color comes from --ath-* tokens so the block inverts correctly in dark
 * mode; no raw hex is used. The dashed border uses --ath-line, text uses
 * --ath-text / --ath-muted, and the CTA reuses the canonical .editorial-button
 * class so it carries the system's full interaction-state matrix.
 *
 * Props:
 *   icon   - optional React node (e.g. a lucide icon element) shown in a
 *            tokenized badge above the title. Decorative: marked aria-hidden.
 *   title  - required short headline (string or node).
 *   body   - optional supporting sentence (string or node).
 *   action - optional recovery CTA. Either:
 *              { label, onClick }          -> renders a real <button>
 *              { label, href }             -> renders an <a>
 *            Omit for a passive empty-state with no recovery path.
 *   className - optional extra classes appended to the container.
 */
export default function EmptyState({ icon, title, body, action, className = '', ...rest }) {
    const hasAction = Boolean(action && action.label && (action.onClick || action.href))

    return (
        <div
            className={`flex flex-col items-center justify-center gap-3 rounded-[var(--ath-radius-lg)] border border-dashed border-[var(--ath-line-strong)] bg-[color-mix(in_srgb,var(--ath-surface)_62%,transparent)] px-4 py-6 text-center ${className}`}
            {...rest}
        >
            {icon != null && (
                <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-[var(--ath-radius)] bg-[var(--ath-panel-muted)] text-[var(--ath-primary)]"
                >
                    {icon}
                </span>
            )}

            {title != null && (
                <h3 className="font-headline text-lg font-semibold text-[var(--ath-text)]">
                    {title}
                </h3>
            )}

            {body != null && (
                <p className="max-w-prose text-sm leading-7 text-[var(--ath-muted)]">
                    {body}
                </p>
            )}

            {hasAction && (
                action.href ? (
                    <a
                        href={action.href}
                        onClick={action.onClick}
                        className="editorial-button px-5 py-2.5 text-sm no-underline"
                    >
                        {action.label}
                    </a>
                ) : (
                    <button
                        type="button"
                        onClick={action.onClick}
                        className="editorial-button px-5 py-2.5 text-sm"
                    >
                        {action.label}
                    </button>
                )
            )}
        </div>
    )
}
