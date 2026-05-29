import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, X } from 'lucide-react'
import API_BASE from '../lib/apiConfig'
import { safeLocalStorageGet, safeLocalStorageSet } from '../lib/browserStorage'

/**
 * GlobalSearch — Cmd+K / Ctrl+K modal for fuzzy search across every section
 * of every course. The backend serves a flat /api/search/index that we
 * cache locally for 30 minutes. Match is a small in-JS scorer (no fuse.js
 * dependency): each whitespace-split query token must appear somewhere
 * in (title + description + concept_ids + course/chapter labels), and the
 * total score weights title hits over description over concept_ids.
 */

const CACHE_KEY = 'alget_search_index_v1'
const CACHE_TTL_MS = 30 * 60 * 1000
const MAX_RESULTS = 12

function loadCache() {
    try {
        const raw = safeLocalStorageGet(CACHE_KEY, '')
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed?.fetchedAt || Date.now() - parsed.fetchedAt > CACHE_TTL_MS) {
            return null
        }
        return parsed.payload
    } catch {
        return null
    }
}

function writeCache(payload) {
    try {
        safeLocalStorageSet(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), payload }))
    } catch {
        // noop — cache is best-effort
    }
}

function tokenize(query) {
    return String(query || '')
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
}

function scoreItem(item, tokens) {
    if (tokens.length === 0) return 0
    const title = String(item.title || '').toLowerCase()
    const description = String(item.description || '').toLowerCase()
    const conceptText = (item.concept_ids || []).join(' ').toLowerCase()
    const courseText = String(item.course || '').toLowerCase()
    const chapterText = String(item.chapter_title || '').toLowerCase()

    let score = 0
    for (const token of tokens) {
        let tokenScore = 0
        if (title === token) tokenScore = 100
        else if (title.startsWith(token)) tokenScore = 50
        else if (title.includes(token)) tokenScore = 30
        else if (chapterText.includes(token)) tokenScore = 20
        else if (conceptText.includes(token)) tokenScore = 15
        else if (description.includes(token)) tokenScore = 10
        else if (courseText.includes(token)) tokenScore = 5

        if (tokenScore === 0) return 0 // every token must hit something
        score += tokenScore
    }
    return score
}

function highlight(text, tokens) {
    if (!text || tokens.length === 0) return text
    const lower = text.toLowerCase()
    const ranges = []
    for (const token of tokens) {
        if (!token) continue
        let i = 0
        while (i < lower.length) {
            const idx = lower.indexOf(token, i)
            if (idx < 0) break
            ranges.push([idx, idx + token.length])
            i = idx + token.length
        }
    }
    if (ranges.length === 0) return text

    ranges.sort((a, b) => a[0] - b[0])
    const merged = []
    for (const range of ranges) {
        const last = merged[merged.length - 1]
        if (last && range[0] <= last[1]) {
            last[1] = Math.max(last[1], range[1])
        } else {
            merged.push([...range])
        }
    }

    const pieces = []
    let cursor = 0
    merged.forEach(([start, end], index) => {
        if (cursor < start) pieces.push(<span key={`p-${index}-pre`}>{text.slice(cursor, start)}</span>)
        pieces.push(<mark key={`p-${index}-hl`} className="rounded bg-[var(--ath-primary-soft)] px-0.5 text-[var(--ath-primary)]">{text.slice(start, end)}</mark>)
        cursor = end
    })
    if (cursor < text.length) pieces.push(<span key="p-tail">{text.slice(cursor)}</span>)
    return pieces
}

function formatCourseLabel(course) {
    return String(course || '').split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

export default function GlobalSearch() {
    const [open, setOpen] = useState(false)
    const [index, setIndex] = useState(() => loadCache())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [query, setQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)
    const inputRef = useRef(null)
    const listRef = useRef(null)
    const navigate = useNavigate()

    // Cmd+K / Ctrl+K listener (and "/" as a power-user alt).
    useEffect(() => {
        const handler = (event) => {
            const isMac = navigator.platform.toLowerCase().includes('mac')
            const modifier = isMac ? event.metaKey : event.ctrlKey
            if (modifier && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                setOpen((value) => !value)
            }
            if (open && event.key === 'Escape') {
                event.preventDefault()
                setOpen(false)
            }
        }
        window.addEventListener('keydown', handler)
        const trigger = () => setOpen(true)
        window.addEventListener('alget-open-search', trigger)
        return () => {
            window.removeEventListener('keydown', handler)
            window.removeEventListener('alget-open-search', trigger)
        }
    }, [open])

    const fetchIndex = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`${API_BASE}/search/index`)
            if (!response.ok) throw new Error(`Search index ${response.status}`)
            const payload = await response.json()
            setIndex(payload)
            writeCache(payload)
        } catch (err) {
            console.warn('[GlobalSearch] index fetch failed:', err?.message || err)
            setError(err?.message || 'Could not load search index')
        } finally {
            setLoading(false)
        }
    }, [])

    // Refresh index on first open if cache is empty/expired.
    useEffect(() => {
        if (!open) return
        if (!index || !Array.isArray(index.items) || index.items.length === 0) {
            fetchIndex()
        }
        const timer = setTimeout(() => inputRef.current?.focus(), 30)
        return () => clearTimeout(timer)
    }, [open, index, fetchIndex])

    const tokens = useMemo(() => tokenize(query), [query])

    const results = useMemo(() => {
        if (!index?.items || tokens.length === 0) return []
        const scored = []
        for (const item of index.items) {
            const score = scoreItem(item, tokens)
            if (score > 0) scored.push({ item, score })
        }
        scored.sort((a, b) => b.score - a.score)
        return scored.slice(0, MAX_RESULTS).map((entry) => entry.item)
    }, [index, tokens])

    useEffect(() => {
        setActiveIndex(0)
    }, [query])

    const openItem = (item) => {
        if (!item) return
        setOpen(false)
        setQuery('')
        navigate(`/book/${item.course}/${item.chapter}/${item.section}`)
    }

    const handleKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveIndex((value) => Math.min(results.length - 1, value + 1))
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((value) => Math.max(0, value - 1))
        } else if (event.key === 'Enter') {
            event.preventDefault()
            openItem(results[activeIndex])
        }
    }

    if (!open) return null

    return (
        // Backdrop click-to-dismiss; Escape close is handled by the global keydown listener above; keyboard close provided globally.
        /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */
        <div
            className="fixed inset-0 z-[300] flex items-start justify-center bg-[rgba(5,6,8,0.42)] p-4 pt-[14vh] backdrop-blur-sm"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Search ALGET"
        >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- stops backdrop dismissal when interacting inside the panel; not a user-facing control */}
            <div
                className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center gap-3 border-b border-[var(--ath-line)] px-4 py-3">
                    <Search className="h-4 w-4 shrink-0 text-[var(--ath-secondary)]" aria-hidden />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search sections, concepts, courses…"
                        className="flex-1 bg-transparent text-sm font-medium text-[var(--ath-text)] placeholder:text-[var(--ath-secondary)] focus:outline-none"
                        aria-label="Search query"
                    />
                    <span className="hidden items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)] sm:flex">
                        Esc
                    </span>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="rounded p-1 text-[var(--ath-secondary)] hover:bg-[var(--ath-panel)] hover:text-[var(--ath-text)] sm:hidden"
                        aria-label="Close search"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
                    {tokens.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-[var(--ath-secondary)]">
                            {index?.items
                                ? <>Type to search across {index.items.length} section{index.items.length === 1 ? '' : 's'}.</>
                                : loading
                                    ? 'Loading search index…'
                                    : error
                                        ? <button type="button" onClick={fetchIndex} className="text-[var(--ath-primary)] underline-offset-4 hover:underline">Retry loading search index</button>
                                        : 'Press ↑↓ to navigate · Enter to open · Esc to close'}
                            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.18em]">
                                <span className="rounded border border-[var(--ath-line)] px-1.5 py-0.5">⌘ K</span>
                                <span>opens this anywhere</span>
                            </div>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-[var(--ath-secondary)]">
                            No matches for <span className="font-semibold text-[var(--ath-text)]">"{query}"</span>.
                        </div>
                    ) : (
                        <ul role="listbox" aria-label="Search results">
                            {results.map((item, idx) => {
                                const isActive = idx === activeIndex
                                const courseLabel = formatCourseLabel(item.course)
                                return (
                                    <li key={`${item.course}/${item.chapter}/${item.section}`}>
                                        <button
                                            type="button"
                                            onClick={() => openItem(item)}
                                            onMouseEnter={() => setActiveIndex(idx)}
                                            role="option"
                                            aria-selected={isActive}
                                            className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                                                isActive
                                                    ? 'bg-[var(--ath-panel-muted)]'
                                                    : 'hover:bg-[var(--ath-panel)]'
                                            }`}
                                        >
                                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--ath-panel)] text-[10px] font-bold text-[var(--ath-secondary)]">
                                                {item.chapter}.{item.section}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-[var(--ath-text)]">
                                                    {highlight(item.title, tokens)}
                                                </p>
                                                <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                                                    <span>{courseLabel}</span>
                                                    <span className="text-[var(--ath-line-strong)]">·</span>
                                                    <span className="truncate">{item.chapter_title}</span>
                                                </p>
                                                {item.description && (
                                                    <p className="mt-1 line-clamp-1 text-[11px] text-[var(--ath-muted)]">
                                                        {highlight(item.description, tokens)}
                                                    </p>
                                                )}
                                            </div>
                                            <ChevronRight className={`mt-1 h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-[var(--ath-primary)]' : 'text-[var(--ath-secondary)]'}`} />
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                    <div className="flex items-center gap-2">
                        <span><kbd className="rounded border border-[var(--ath-line)] bg-white/70 px-1">↑</kbd> <kbd className="rounded border border-[var(--ath-line)] bg-white/70 px-1">↓</kbd> nav</span>
                        <span><kbd className="rounded border border-[var(--ath-line)] bg-white/70 px-1">⏎</kbd> open</span>
                    </div>
                    <span>{results.length > 0 ? `${results.length} result${results.length === 1 ? '' : 's'}` : ''}</span>
                </div>
            </div>
        </div>
    )
}
