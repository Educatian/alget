import { BookOpenCheck, ExternalLink, ShieldCheck } from 'lucide-react'

function safeHttpsUrl(value) {
    try {
        const url = new URL(String(value || ''))
        return url.protocol === 'https:' ? url.toString() : ''
    } catch {
        return ''
    }
}

/**
 * Compact provenance affordance for generated/published reading sections.
 *
 * The default state is intentionally quiet: provenance is available without
 * turning the reading surface into another card stack. The component never
 * claims that a source citation proves a generated claim; it only reports the
 * attached retrieval context and lets the learner inspect the canonical source.
 */
export default function EvidenceTrail({ references = [], sourceStatus = '', sourceTitle = '' }) {
    const normalized = (Array.isArray(references) ? references : [])
        .map((reference) => ({
            title: String(reference?.title || 'Untitled source').trim(),
            book: String(reference?.book || reference?.book_title || '').trim(),
            url: safeHttpsUrl(reference?.url),
            licenseUrl: safeHttpsUrl(reference?.license_url),
        }))
        .filter((reference) => reference.url)
        .slice(0, 6)

    if (normalized.length === 0 && !sourceStatus) return null

    const statusLabel = sourceStatus === 'context_attached'
        ? 'Context attached; inspect sources before relying on a claim.'
        : sourceStatus === 'no_source_context'
            ? 'No external source context was attached to this generation.'
            : 'Source context is available for inspection.'

    return (
        <details className="group mt-3 border-b border-[var(--ath-line)] px-1 py-2" data-testid="evidence-trail">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[var(--ath-secondary)]">
                <BookOpenCheck className="h-3.5 w-3.5 shrink-0 text-[var(--ath-primary)]" aria-hidden="true" />
                <span>Evidence trail</span>
                {normalized.length > 0 && <span className="font-normal text-[var(--ath-muted)]">· {normalized.length} source{normalized.length === 1 ? '' : 's'}</span>}
                <span className="ml-auto text-[10px] transition-transform group-open:rotate-90" aria-hidden="true">›</span>
            </summary>
            <div className="mt-2 space-y-2 pb-1">
                <div className="flex items-start gap-2 text-[11px] leading-5 text-[var(--ath-muted)]">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ath-primary)]" aria-hidden="true" />
                    <p>{sourceTitle ? `Attached to ${sourceTitle}. ${statusLabel}` : statusLabel}</p>
                </div>
                {normalized.length > 0 && (
                    <ul className="space-y-1.5" aria-label="Attached sources">
                        {normalized.map((reference, index) => (
                            <li key={`${reference.url}-${index}`} className="flex items-start gap-2 text-xs leading-5">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ath-primary)]" aria-hidden="true" />
                                <span className="min-w-0 flex-1 text-[var(--ath-text)]">
                                    <a
                                        href={reference.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-semibold underline decoration-[var(--ath-line-strong)] underline-offset-2 hover:text-[var(--ath-primary)]"
                                    >
                                        {reference.title}
                                        <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden="true" />
                                    </a>
                                    {reference.book && <span className="text-[var(--ath-muted)]"> · {reference.book}</span>}
                                    {reference.licenseUrl && (
                                        <a href={reference.licenseUrl} target="_blank" rel="noreferrer" className="ml-1 text-[var(--ath-muted)] underline underline-offset-2 hover:text-[var(--ath-primary)]">licence</a>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </details>
    )
}

