import { useCallback, useEffect, useMemo, useState } from 'react'
import { Highlighter, MessageSquarePlus, Quote, Search, ThumbsUp } from 'lucide-react'
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

export default function PerusallLayer({ sectionId, sectionTitle, conceptIds = [] }) {
    const [annotations, setAnnotations] = useState(() => readAnnotations(sectionId))
    const [quote, setQuote] = useState('')
    const [body, setBody] = useState('')
    const [tag, setTag] = useState('question')
    const [filter, setFilter] = useState('all')
    const [isSynced, setIsSynced] = useState(false)
    const [syncError, setSyncError] = useState('')

    useEffect(() => {
        writeAnnotations(sectionId, annotations)
    }, [annotations, sectionId])

    const loadRemoteAnnotations = useCallback(async () => {
        if (!isSupabaseConfigured || !sectionId) return
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
            setSyncError('')
        } catch (err) {
            console.warn('[PerusallLayer] remote sync unavailable, falling back to local:', err?.message || err)
            setIsSynced(false)
            setSyncError(err?.message || 'Remote annotation sync failed')
        }
    }, [sectionId])

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

        if (isSupabaseConfigured) {
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
                setSyncError('')
            } catch (err) {
                console.warn('[PerusallLayer] insert failed, kept local:', err?.message || err)
                setAnnotations((current) => [nextLocal, ...current])
                setIsSynced(false)
                setSyncError(err?.message || 'Saved locally; remote sync failed')
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
        if (!isSupabaseConfigured || id.startsWith('pa_')) return
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const { error } = await supabase.from('annotation_reactions').upsert({
                annotation_id: id,
                user_id: session?.user?.id,
                reaction_type: 'helpful',
            })
            if (error) throw error
            setSyncError('')
        } catch (err) {
            console.warn('[PerusallLayer] reaction sync failed:', err?.message || err)
            setSyncError(err?.message || 'Reaction sync failed')
        }
    }

    return (
        <section className="my-10 rounded-[2rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.78)] p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold tracking-tight text-[var(--ath-text)]">
                            Annotations
                        </h2>
                        <span
                            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ath-panel)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]"
                            title={
                                isSupabaseConfigured
                                    ? isSynced
                                        ? 'Annotations sync to the research layer'
                                        : 'Saved locally - will sync when the annotations table is reachable'
                                    : 'Annotations are stored on this device only'
                            }
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${isSupabaseConfigured && isSynced ? 'bg-emerald-500' : 'bg-amber-400'}`} aria-hidden />
                            {isSupabaseConfigured && isSynced ? 'Synced' : 'Local only'}
                        </span>
                        {conceptIds.slice(0, 3).map((concept) => (
                            <span key={concept} className="rounded-full bg-[var(--ath-panel-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--ath-muted)]">
                                {concept.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                    {syncError && (
                        <p className="mt-2 max-w-xl text-xs leading-5 text-[var(--ath-danger)]">
                            Sync paused. Local notes are safe.
                        </p>
                    )}
                </div>
                <div className="grid min-w-[16rem] grid-cols-2 gap-2">
                    {TAGS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setFilter(filter === item.id ? 'all' : item.id)}
                            className={`rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-all ${filter === item.id
                                ? 'border-[var(--ath-primary)] bg-[rgba(200,226,236,0.5)] text-[var(--ath-primary)]'
                                : 'border-[var(--ath-line)] bg-white/70 text-[var(--ath-muted)] hover:bg-[var(--ath-panel)]'
                                }`}
                        >
                            <span className="block uppercase tracking-[0.16em]">{item.label}</span>
                            <span className="mt-1 block text-lg text-[var(--ath-text)]">{tagCounts[item.id] || 0}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[1.6rem] border border-[var(--ath-line)] bg-white/72 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--ath-text)]">New Annotation</p>
                        <button
                            type="button"
                            onClick={captureSelection}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--ath-primary)] hover:bg-[rgba(200,226,236,0.45)]"
                        >
                            <Highlighter className="h-3.5 w-3.5" />
                            Capture Selection
                        </button>
                    </div>

                    <label htmlFor={`${sectionId}-annotation-quote`} className="mt-4 block text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                        Quoted Passage
                    </label>
                    <textarea
                        id={`${sectionId}-annotation-quote`}
                        value={quote}
                        onChange={(event) => setQuote(event.target.value)}
                        placeholder="Optional: capture or paste the passage you are responding to."
                        className="editorial-input mt-2 min-h-20 text-sm"
                    />

                    <label className="mt-4 block text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                        Annotation Type
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {TAGS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setTag(item.id)}
                                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${tag === item.id
                                    ? 'border-[var(--ath-primary)] bg-[rgba(200,226,236,0.45)] text-[var(--ath-primary)]'
                                    : 'border-[var(--ath-line)] bg-white text-[var(--ath-muted)]'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <label htmlFor={`${sectionId}-annotation-body`} className="mt-4 block text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                        Note
                    </label>
                    <textarea
                        id={`${sectionId}-annotation-body`}
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        placeholder={`Write a ${tag} for ${sectionTitle || 'this section'}...`}
                        className="editorial-input mt-2 min-h-28 text-sm"
                    />

                    <button
                        type="button"
                        onClick={addAnnotation}
                        disabled={!body.trim()}
                        className="editorial-button mt-4 w-full px-4 py-3 text-sm disabled:opacity-50"
                    >
                        <MessageSquarePlus className="h-4 w-4" />
                        Add Public Note
                    </button>
                </div>

                <div className="rounded-[1.6rem] border border-[var(--ath-line)] bg-white/72 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-[var(--ath-text)]">Section Discussion</p>
                            <p className="mt-1 text-xs text-[var(--ath-muted)]">
                                {filteredAnnotations.length} visible of {annotations.length} notes
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--ath-muted)]"
                        >
                            <Search className="h-3.5 w-3.5" />
                            All
                        </button>
                    </div>

                    <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                        {filteredAnnotations.length === 0 ? (
                            <div className="rounded-[1.4rem] border border-dashed border-[var(--ath-line)] bg-[rgba(255,255,255,0.58)] p-6 text-center">
                                <Quote className="mx-auto h-6 w-6 text-[var(--ath-secondary)]" />
                                <p className="mt-3 text-sm font-semibold text-[var(--ath-text)]">No notes in this view yet.</p>
                                <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">Add the first question, confusion, insight, or connection for this section.</p>
                            </div>
                        ) : filteredAnnotations.map((annotation) => (
                            <article key={annotation.id} className="rounded-[1.4rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.86)] p-4 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="rounded-full bg-[var(--ath-panel)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ath-primary)]">
                                        {TAGS.find((item) => item.id === annotation.tag)?.label || annotation.tag}
                                    </span>
                                    <span className="text-[11px] font-medium text-[var(--ath-muted)]">
                                        {new Date(annotation.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                {annotation.quote && (
                                    <blockquote className="mt-3 rounded-xl border-l-4 border-[var(--ath-primary)] bg-[rgba(200,226,236,0.24)] px-3 py-2 text-sm leading-6 text-[var(--ath-muted)]">
                                        {annotation.quote}
                                    </blockquote>
                                )}
                                <p className="mt-3 text-sm leading-6 text-[var(--ath-text)]">{annotation.body}</p>
                                <button
                                    type="button"
                                    onClick={() => upvote(annotation.id)}
                                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--ath-line)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ath-muted)] hover:text-[var(--ath-primary)]"
                                >
                                    <ThumbsUp className="h-3.5 w-3.5" />
                                    Helpful {annotation.upvotes > 0 ? annotation.upvotes : ''}
                                </button>
                            </article>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
