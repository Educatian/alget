import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Search, X } from 'lucide-react'
import { HIGHLIGHT_TAGS, highlightsToMarkdown, listAllLocalHighlights, tagFor } from '../lib/localAnnotations'
import { logEvent } from '../lib/loggingService'

/**
 * Notebook drawer: the reader's highlights and notes, filterable by tag and text, for this
 * section or (when highlights are stored in this browser) the whole course. Clicking an entry
 * jumps to the passage; Markdown export takes the current view.
 */
export default function NotebookPanel({ open, onClose, highlights, sectionId, localOnly }) {
    const navigate = useNavigate()
    const course = String(sectionId || '').split('/')[0]
    const [scope, setScope] = useState('section')
    const [tag, setTag] = useState('all')
    const [query, setQuery] = useState('')

    useEffect(() => {
        if (open) logEvent('notebook_open', null, { highlights: highlights.length }, sectionId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    useEffect(() => {
        if (!open) return undefined
        const onKey = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    const items = useMemo(() => {
        if (!open) return []
        const source = scope === 'course' && localOnly
            ? [...listAllLocalHighlights(course).filter((h) => h.section_id !== sectionId), ...highlights]
            : highlights
        const q = query.trim().toLowerCase()
        return source
            .filter((h) => tag === 'all' || (h.color || 'yellow') === tag)
            .filter((h) => !q || `${h.text_content} ${h.note || ''}`.toLowerCase().includes(q))
            .sort((a, b) => String(a.section_id).localeCompare(String(b.section_id)) || String(a.created_at).localeCompare(String(b.created_at)))
    }, [open, scope, localOnly, course, sectionId, highlights, tag, query])

    if (!open) return null

    const jump = (h) => {
        logEvent('notebook_jump', String(h.id), { to_section: h.section_id, tag: h.color || 'yellow', scope }, sectionId)
        if (h.section_id !== sectionId) {
            onClose()
            navigate(`/book/${h.section_id}`)
            return
        }
        const mark = document.querySelector(`mark[data-highlight-id="${CSS.escape(String(h.id))}"]`)
        if (!mark) return
        onClose()
        mark.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
        mark.classList.remove('review-anchor-flash')
        void mark.offsetWidth
        mark.classList.add('review-anchor-flash')
    }

    const exportMarkdown = () => {
        logEvent('notebook_export', null, { scope, tag, items: items.length }, sectionId)
        const blob = new Blob([highlightsToMarkdown(items, scope === 'course' ? `Notebook: ${course}` : `Notebook: ${sectionId}`)], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `notebook-${(scope === 'course' ? course : sectionId).replace(/\//g, '-')}.md`
        a.click()
        URL.revokeObjectURL(url)
    }

    const chip = (active) => `inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${active
        ? 'border-[var(--ath-primary)] bg-[var(--ath-primary-soft)] text-[var(--ath-text)]'
        : 'border-[var(--ath-line)] text-[var(--ath-muted)] hover:text-[var(--ath-text)]'}`

    return (
        <div className="fixed inset-0 z-[140] flex justify-end bg-slate-900/30" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <aside role="dialog" aria-modal="true" aria-label="Notebook" className="flex h-full w-[min(28rem,100vw)] flex-col border-l border-[var(--ath-line)] bg-[var(--ath-panel)] text-[var(--ath-text)] shadow-[var(--ath-shadow)]">
                <header className="flex items-center gap-2 border-b border-[var(--ath-line)] px-5 py-4">
                    <h2 className="mr-auto text-base font-semibold">Notebook</h2>
                    <button type="button" onClick={exportMarkdown} disabled={!items.length} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[var(--ath-primary)] hover:bg-[var(--ath-panel-muted)] disabled:text-[var(--ath-muted)]">
                        <Download className="h-4 w-4" aria-hidden="true" /> Export
                    </button>
                    <button type="button" onClick={onClose} aria-label="Close notebook" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--ath-panel-muted)]">
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </header>

                <div className="space-y-3 border-b border-[var(--ath-line)] px-5 py-3">
                    {localOnly && (
                        <div className="flex gap-2">
                            <button type="button" aria-pressed={scope === 'section'} onClick={() => setScope('section')} className={chip(scope === 'section')}>This section</button>
                            <button type="button" aria-pressed={scope === 'course'} onClick={() => setScope('course')} className={chip(scope === 'course')}>Whole course</button>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                        <button type="button" aria-pressed={tag === 'all'} onClick={() => setTag('all')} className={chip(tag === 'all')}>All</button>
                        {Object.entries(HIGHLIGHT_TAGS).map(([color, t]) => (
                            <button key={color} type="button" aria-pressed={tag === color} onClick={() => setTag(color)} className={chip(tag === color)}>
                                <span className={`h-2.5 w-2.5 rounded-full ${t.dot}`} aria-hidden="true" />{t.label}
                            </button>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 rounded-lg border border-[var(--ath-line)] px-3">
                        <Search className="h-4 w-4 text-[var(--ath-muted)]" aria-hidden="true" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search highlights and notes" aria-label="Search highlights and notes" className="min-h-[38px] flex-1 bg-transparent text-sm outline-none" />
                    </label>
                </div>

                <ol className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
                    {items.length === 0 && <li className="text-sm text-[var(--ath-muted)]">Nothing here yet. Select text in the reading and pick a colour to highlight it.</li>}
                    {items.map((h) => {
                        const t = tagFor(h.color)
                        return (
                            <li key={h.id}>
                                <button type="button" onClick={() => jump(h)} className="w-full rounded-xl border border-[var(--ath-line)] p-3 text-left transition-colors hover:border-[var(--ath-line-strong)] hover:bg-[var(--ath-panel-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ath-primary)]">
                                    <span className="flex items-center gap-2 text-[11px] font-semibold text-[var(--ath-muted)]">
                                        <span className={`h-2.5 w-2.5 rounded-full ${t.dot}`} aria-hidden="true" />{t.label}
                                        {h.section_id !== sectionId && <span className="ml-auto">{String(h.section_id).split('/').slice(1).join('.')}</span>}
                                    </span>
                                    <span className="mt-1.5 line-clamp-3 block text-sm leading-6">“{h.text_content}”</span>
                                    {h.note && <span className="mt-1 block text-sm leading-6 text-[var(--ath-muted)]">{h.note}</span>}
                                </button>
                            </li>
                        )
                    })}
                </ol>
                <p className="border-t border-[var(--ath-line)] px-5 py-2 text-[11px] text-[var(--ath-muted)]">
                    {localOnly ? 'Saved in this browser only.' : 'Saved to your account.'}
                </p>
            </aside>
        </div>
    )
}
