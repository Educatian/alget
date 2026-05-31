import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Highlighter, MessageSquarePlus, ThumbsUp } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { logEvent } from '../lib/loggingService'
import { recordAdaptiveSignal } from '../lib/knowledgeService'
import { safeLocalStorageGet, safeLocalStorageSet } from '../lib/browserStorage'

const TAGS = [
    { id: 'question', label: 'Question' },
    { id: 'confusion', label: 'Confusion' },
    { id: 'insight', label: 'Insight' },
    { id: 'connection', label: 'Connection' },
]

function storageKey(sectionId) {
    return `alget_perusall_annotations_${sectionId || 'unknown'}`
}

function readAnnotations(sectionId) {
    try {
        return JSON.parse(safeLocalStorageGet(storageKey(sectionId), '[]') || '[]')
    } catch {
        return []
    }
}

function writeAnnotations(sectionId, annotations) {
    return safeLocalStorageSet(storageKey(sectionId), JSON.stringify(annotations))
}

function mergeAnnotations(localAnnotations, remoteAnnotations) {
    const remoteIds = new Set(remoteAnnotations.map((annotation) => annotation.id))
    const unsyncedLocal = localAnnotations.filter((annotation) =>
        annotation.source === 'local' && !remoteIds.has(annotation.id)
    )
    return [...unsyncedLocal, ...remoteAnnotations]
}

async function quoteHash(text) {
    const normalized = (text || '').trim().replace(/\s+/g, ' ')
    if (!normalized) return null
    if (window.crypto?.subtle) {
        const bytes = new TextEncoder().encode(normalized)
        const digest = await window.crypto.subtle.digest('SHA-256', bytes)
        return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
    }
    let hash = 0
    for (let i = 0; i < normalized.length; i += 1) {
        hash = ((hash << 5) - hash) + normalized.charCodeAt(i)
        hash |= 0
    }
    return `fallback_${Math.abs(hash)}`
}

function dbToAnnotation(row, reactionCounts = {}) {
    return {
        id: row.id,
        quote: row.quote_text || '',
        body: row.body,
        tag: row.annotation_type,
        upvotes: reactionCounts[row.id] || 0,
        createdAt: row.created_at,
        source: 'supabase',
    }
}

function isMissingSupabaseTableError(error) {
    return error?.code === 'PGRST205' ||
        /Could not find the table|schema cache/i.test(error?.message || '')
}

export default function PerusallLayer({ sectionId, conceptIds = [] }) {
    const [annotations, setAnnotations] = useState(() => readAnnotations(sectionId))
    const [quote, setQuote] = useState('')
    const [body, setBody] = useState('')
    const [tag, setTag] = useState('question')
    const [filter, setFilter] = useState('all')
    const [isSynced, setIsSynced] = useState(false)
    const [remoteUnavailable, setRemoteUnavailable] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [composing, setComposing] = useState(false)

    useEffect(() => {
        writeAnnotations(sectionId, annotations)
    }, [annotations, sectionId])

    const loadRemoteAnnotations = useCallback(async () => {
        if (!isSupabaseConfigured || !sectionId || remoteUnavailable) return
        try {
            const { data, error } = await supabase
                .from('section_annotations')
                .select('id, quote_text, body, annotation_type, created_at')
                .eq('section_id', sectionId)
                .eq('visibility', 'course')
                .order('created_at', { ascending: false })
                .limit(80)

            if (error) throw error

            const ids = (data || []).map((row) => row.id)
            let reactionCounts = {}
            if (ids.length > 0) {
                const { data: reactions, error: reactionError } = await supabase
                    .from('annotation_reactions')
                    .select('annotation_id, reaction_type')
                    .in('annotation_id', ids)
                    .eq('reaction_type', 'helpful')
                if (reactionError) throw reactionError
                reactionCounts = (reactions || []).reduce((acc, row) => {
                    acc[row.annotation_id] = (acc[row.annotation_id] || 0) + 1
                    return acc
                }, {})
            }

            const remoteAnnotations = (data || []).map((row) => dbToAnnotation(row, reactionCounts))
            setAnnotations((current) => mergeAnnotations(current, remoteAnnotations))
            setIsSynced(true)
        } catch (err) {
            if (isMissingSupabaseTableError(err)) {
                setRemoteUnavailable(true)
            }
            console.warn('[PerusallLayer] remote sync unavailable, falling back to local:', err?.message || err)
            setIsSynced(false)
        }
    }, [remoteUnavailable, sectionId])

    useEffect(() => {
        loadRemoteAnnotations()
    }, [loadRemoteAnnotations])

    const filteredAnnotations = useMemo(() => (
        filter === 'all'
            ? annotations
            : annotations.filter((annotation) => annotation.tag === filter)
    ), [annotations, filter])

    const tagCounts = useMemo(() => {
        return TAGS.reduce((acc, item) => {
            acc[item.id] = annotations.filter((annotation) => annotation.tag === item.id).length
            return acc
        }, {})
    }, [annotations])

    void conceptIds // surface kept slim; concept chips moved to the section header

    const captureSelection = () => {
        const selected = window.getSelection()?.toString()?.trim() || ''
        if (selected.length >= 3) {
            setQuote(selected.slice(0, 500))
            logEvent('annotation_capture_selection', 'perusall_layer', {
                quote_length: Math.min(selected.length, 500),
                concept_ids: conceptIds.slice(0, 4),
            }, sectionId)
        }
    }

    const addAnnotation = async () => {
        const text = body.trim()
        if (!text) return

        const nextLocal = {
            id: `pa_${Date.now()}`,
            quote: quote.trim(),
            body: text,
            tag,
            upvotes: 0,
            createdAt: new Date().toISOString(),
            source: 'local',
        }
        const selectedQuote = quote.trim()

        if (isSupabaseConfigured && !remoteUnavailable) {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                const hash = await quoteHash(selectedQuote)
                const payload = {
                    user_id: session?.user?.id,
                    course_id: sectionId?.split('/')?.[0] || null,
                    section_id: sectionId,
                    concept_ids: conceptIds,
                    quote_text: selectedQuote || null,
                    quote_hash: hash,
                    annotation_type: tag,
                    body: text,
                    visibility: 'course',
                }
                const { data, error } = await supabase
                    .from('section_annotations')
                    .insert(payload)
                    .select('id, quote_text, body, annotation_type, created_at')
                    .single()
                if (error) throw error
                setAnnotations((current) => [dbToAnnotation(data), ...current])
                setIsSynced(true)
            } catch (err) {
                if (isMissingSupabaseTableError(err)) {
                    setRemoteUnavailable(true)
                }
                console.warn('[PerusallLayer] insert failed, kept local:', err?.message || err)
                setAnnotations((current) => [nextLocal, ...current])
                setIsSynced(false)
            }
        } else {
            setAnnotations((current) => [nextLocal, ...current])
        }

        logEvent('annotation_create', 'perusall_layer', {
            annotation_type: tag,
            quote_length: selectedQuote.length,
            body_length: text.length,
            concept_ids: conceptIds.slice(0, 4),
            synced: isSupabaseConfigured,
        }, sectionId)
        recordAdaptiveSignal(sectionId, 'annotation_create', {
            annotationType: tag,
            quoteLength: selectedQuote.length,
            bodyLength: text.length,
            conceptIds: conceptIds.slice(0, 4),
        })
        setQuote('')
        setBody('')
        setTag('question')
    }

    const upvote = async (id) => {
        setAnnotations((current) =>
            current.map((annotation) =>
                annotation.id === id
                    ? { ...annotation, upvotes: annotation.upvotes + 1 }
                    : annotation
            )
        )
        logEvent('annotation_reaction', 'perusall_layer', {
            annotation_id: id,
            reaction_type: 'helpful',
        }, sectionId)
        recordAdaptiveSignal(sectionId, 'annotation_reaction', {
            annotationId: id,
            reactionType: 'helpful',
        })
        if (!isSupabaseConfigured || remoteUnavailable || id.startsWith('pa_')) return
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const { error } = await supabase.from('annotation_reactions').upsert({
                annotation_id: id,
                user_id: session?.user?.id,
                reaction_type: 'helpful',
            })
            if (error) throw error
        } catch (err) {
            if (isMissingSupabaseTableError(err)) {
                setRemoteUnavailable(true)
            }
            console.warn('[PerusallLayer] reaction sync failed:', err?.message || err)
        }
    }

    const startCompose = (selectedTag) => {
        setExpanded(true)
        setComposing(true)
        if (selectedTag) setTag(selectedTag)
    }
    const cancelCompose = () => {
        setComposing(false)
        setQuote('')
        setBody('')
    }
    const submitNote = async () => {
        await addAnnotation()
        setComposing(false)
    }

    const syncBadge = (
        <span
            className="inline-flex items-center gap-1 rounded-full bg-[var(--ath-panel)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ath-secondary)]"
            title={
                isSupabaseConfigured && !remoteUnavailable
                    ? isSynced
                        ? 'Annotations sync to the research layer'
                        : 'Saved locally — will sync when the annotations table is reachable'
                    : 'Annotations are stored on this device only'
            }
        >
            <span className={`h-1.5 w-1.5 rounded-full ${isSupabaseConfigured && !remoteUnavailable && isSynced ? 'bg-emerald-500' : 'bg-amber-400'}`} aria-hidden />
            {isSupabaseConfigured && !remoteUnavailable && isSynced ? 'Synced' : 'Local'}
        </span>
    )

    return (
        <section className="my-6">
            {/* Collapsed bar — single row that respects the reading flow */}
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-[var(--ath-line)] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[var(--ath-muted)] shadow-sm">
                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    aria-expanded={expanded}
                    className="flex items-center gap-2 text-[var(--ath-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)] rounded-full px-1"
                >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`} aria-hidden />
                    <span>Annotations</span>
                    <span className="rounded-full bg-[var(--ath-panel-muted)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ath-text)]">{annotations.length}</span>
                </button>
                {syncBadge}
                <button
                    type="button"
                    onClick={() => startCompose()}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--ath-primary)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:brightness-105"
                >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    Add note
                </button>
            </div>

            {expanded && (
                <div className="mt-3 rounded-2xl border border-[var(--ath-line)] bg-white/80 p-4 shadow-sm">
                    {/* Inline filter pills */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className={`rounded-full px-2.5 py-0.5 transition-colors ${filter === 'all' ? 'bg-[var(--ath-text)] text-[var(--ath-background)]' : 'bg-[var(--ath-panel)] text-[var(--ath-muted)] hover:bg-[var(--ath-panel-muted)]'}`}
                        >
                            All {annotations.length}
                        </button>
                        {TAGS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setFilter(filter === item.id ? 'all' : item.id)}
                                className={`rounded-full px-2.5 py-0.5 transition-colors ${filter === item.id
                                    ? 'bg-[var(--ath-text)] text-[var(--ath-background)]'
                                    : 'bg-[var(--ath-panel)] text-[var(--ath-muted)] hover:bg-[var(--ath-panel-muted)]'
                                    }`}
                            >
                                {item.label} {tagCounts[item.id] || 0}
                            </button>
                        ))}
                    </div>

                    {/* Compose form (only when learner taps "Add note") */}
                    {composing && (
                        <div className="mt-4 rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3">
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                                {TAGS.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setTag(item.id)}
                                        className={`rounded-full px-2.5 py-0.5 transition-colors ${tag === item.id
                                            ? 'bg-[var(--ath-primary)] text-white'
                                            : 'bg-white text-[var(--ath-muted)] hover:text-[var(--ath-primary)]'
                                            }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={captureSelection}
                                    className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-[var(--ath-muted)] hover:text-[var(--ath-text)]"
                                    title="Use the currently selected reading text as the quote"
                                >
                                    <Highlighter className="h-3 w-3" />
                                    Capture selection
                                </button>
                            </div>
                            {quote && (
                                <blockquote className="mt-2 rounded-lg border-l-2 border-[var(--ath-primary)] bg-white/60 px-2 py-1 text-xs text-[var(--ath-muted)]">
                                    {quote}
                                </blockquote>
                            )}
                            <textarea
                                id={`${sectionId}-annotation-body`}
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                placeholder={`Write a ${tag}…`}
                                className="editorial-input mt-2 min-h-20 text-sm"
                                aria-label="Note"
                            />
                            <div className="mt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={cancelCompose}
                                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--ath-muted)] hover:text-[var(--ath-text)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={submitNote}
                                    disabled={!body.trim()}
                                    className="editorial-button px-3 py-1.5 text-[11px] disabled:opacity-50"
                                >
                                    <MessageSquarePlus className="h-3.5 w-3.5" />
                                    Post
                                </button>
                            </div>
                        </div>
                    )}

                    {/* List */}
                    <div className="mt-4 space-y-2">
                        {filteredAnnotations.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-[var(--ath-line)] px-3 py-4 text-center text-xs text-[var(--ath-muted)]">
                                {composing ? 'Your note will appear here.' : 'No notes yet — Add note above to start.'}
                            </p>
                        ) : filteredAnnotations.map((annotation) => (
                            <article key={annotation.id} className="rounded-xl border border-[var(--ath-line)] bg-white/85 p-3">
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">
                                    <span className="rounded-full bg-[var(--ath-panel)] px-2 py-0.5 text-[var(--ath-primary)]">
                                        {TAGS.find((item) => item.id === annotation.tag)?.label || annotation.tag}
                                    </span>
                                    <span className="font-medium normal-case tracking-normal">
                                        {new Date(annotation.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                {annotation.quote && (
                                    <blockquote className="mt-2 rounded-md border-l-2 border-[var(--ath-primary)] bg-[rgba(200,226,236,0.18)] px-2 py-1 text-xs leading-5 text-[var(--ath-muted)]">
                                        {annotation.quote}
                                    </blockquote>
                                )}
                                <p className="mt-2 text-sm leading-6 text-[var(--ath-text)]">{annotation.body}</p>
                                <button
                                    type="button"
                                    onClick={() => upvote(annotation.id)}
                                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ath-muted)] hover:text-[var(--ath-primary)]"
                                >
                                    <ThumbsUp className="h-3 w-3" />
                                    Helpful {annotation.upvotes > 0 ? annotation.upvotes : ''}
                                </button>
                            </article>
                        ))}
                    </div>
                </div>
            )}
        </section>
    )
}
