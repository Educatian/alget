const REVIEW_LABELS = {
    agent_reviewed: 'Agent-reviewed, not human-reviewed',
    not_human_reviewed: 'Not human-reviewed',
    deterministic_fallback: 'Deterministic fallback',
}

function shortHash(value) {
    return value ? String(value).slice(0, 10) : 'not recorded'
}

export default function GenerationTrace({ trace, compact = false }) {
    if (!trace) return null

    const sources = Array.isArray(trace.sources) ? trace.sources : []
    const hasContext = trace.source_status === 'context_attached' && sources.length > 0
    const reviewLabel = REVIEW_LABELS[trace.review?.status] || trace.review?.status || 'Review status unavailable'

    return (
        <details className={`${compact ? 'mt-2' : 'mt-4'} group border-t border-[var(--ath-line)] pt-2 text-left`}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-semibold text-[var(--ath-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_40%,transparent)]">
                <span className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--ath-primary)_10%,transparent)] px-2 py-0.5 uppercase tracking-[0.12em] text-[var(--ath-primary)]">AI generated</span>
                    <span>{hasContext ? 'Current section context used' : 'No source context attached'}</span>
                </span>
                <span className="transition-transform group-open:rotate-90" aria-hidden="true">›</span>
            </summary>

            <div className="mt-3 space-y-3 text-xs leading-5 text-[var(--ath-muted)]">
                <p>
                    {hasContext
                        ? 'The model received the source context below. Individual claims have not been independently citation-verified.'
                        : 'This response is an unverified AI draft. Confirm important claims against course or primary sources.'}
                </p>

                {sources.length > 0 && (
                    <div>
                        <p className="font-semibold text-[var(--ath-text)]">Attached context</p>
                        <ul className="mt-1 space-y-2">
                            {sources.map((source, index) => (
                                <li key={source.source_id || `${source.kind}-${index}`}>
                                    <span className="font-medium text-[var(--ath-text)]">{source.title || 'Generation context'}</span>
                                    {source.locator ? <span> · {source.locator}</span> : null}
                                    {source.excerpt ? <p className="mt-1 border-l-2 border-[var(--ath-line-strong)] pl-2">“{source.excerpt}”</p> : null}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
                    <dt>Review</dt><dd className="text-[var(--ath-text)]">{reviewLabel}</dd>
                    <dt>Model</dt><dd className="break-all text-[var(--ath-text)]">{trace.model || 'not recorded'}</dd>
                    <dt>Prompt</dt><dd className="break-all text-[var(--ath-text)]">{trace.prompt_version || 'not recorded'}</dd>
                    <dt>Output</dt><dd className="font-mono text-[var(--ath-text)]">{shortHash(trace.output_hash)}</dd>
                </dl>

                {trace.limitations?.length > 0 && (
                    <p>{trace.limitations[0]}</p>
                )}
            </div>
        </details>
    )
}
