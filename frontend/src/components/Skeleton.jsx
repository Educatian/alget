/**
 * Skeleton — shared loading placeholders.
 *
 * Three variants cover ~95% of ALGET's loading surfaces:
 *   <Skeleton variant="line" />    — single horizontal bar
 *   <Skeleton variant="block" />   — full-width rounded block
 *   <Skeleton variant="card" />    — small card with title + body bars
 *
 * Animations respect the global @media (prefers-reduced-motion: reduce)
 * gate from index.css; no per-component check needed.
 */

const VARIANTS = {
    line: 'h-3 rounded animate-pulse bg-[var(--ath-panel)]',
    block: 'h-12 rounded-xl animate-pulse bg-[var(--ath-panel)]',
    bar: 'h-1.5 rounded-full animate-pulse bg-[var(--ath-panel)]',
    avatar: 'h-8 w-8 rounded-full animate-pulse bg-[var(--ath-panel)]',
}

export default function Skeleton({ variant = 'line', width = null, className = '', ...rest }) {
    const styleClass = VARIANTS[variant] || VARIANTS.line
    const inlineStyle = width ? { width } : undefined
    return <div className={`${styleClass} ${className}`} style={inlineStyle} aria-hidden="true" {...rest} />
}

/**
 * SkeletonCard — card-shaped placeholder for repeated list items.
 * Used by HighlightDiscussion (replies), KindredReaders (peer rows), etc.
 */
export function SkeletonCard({ lines = 2, className = '' }) {
    return (
        <div
            className={`rounded-xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] p-3 ${className}`}
            aria-hidden="true"
        >
            <Skeleton variant="line" width="6rem" />
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    variant="line"
                    width={i === lines - 1 ? '60%' : '85%'}
                    className="mt-2"
                />
            ))}
        </div>
    )
}

/**
 * SkeletonGroup — convenience wrapper for n stacked skeletons. Marks the
 * group as aria-busy so screen readers announce "loading region" once
 * instead of N times.
 */
export function SkeletonGroup({ count = 3, variant = 'block', className = '', spacing = 'space-y-2' }) {
    return (
        <div className={`${spacing} ${className}`} aria-busy="true">
            {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} variant={variant} />
            ))}
        </div>
    )
}
