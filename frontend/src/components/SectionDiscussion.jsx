import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, MessagesSquare, Reply, Send, X } from 'lucide-react'
import { accountRequest, currentSession } from '../lib/account'
import { notifyDiscussion } from '../lib/liveClass'
import { logEvent } from '../lib/loggingService'

/**
 * Section discussion (sites with the discussion feature): a "Discuss" chip by the section title opens a
 * side panel of threads for this section, which can quote a passage ("Discuss this passage" in the
 * selection toolbar). New posts arrive live through the live-class socket; there are no pop-ups,
 * only a dot on the chip. Authors show by roster ID. Instructors can hide a post.
 */

const POLL_MS = 60_000 // backup for when the live socket is down

function revealQuote(quote) {
    const key = String(quote || '').replace(/\s+/g, ' ').trim().slice(0, 40).toLowerCase()
    const target = [...document.querySelectorAll('.reading-narrative p, .reading-narrative li')]
        .find((el) => el.textContent.replace(/\s+/g, ' ').toLowerCase().includes(key))
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.remove('review-anchor-flash')
    void target.offsetWidth
    target.classList.add('review-anchor-flash')
}

function when(ts) {
    const minutes = Math.round((Date.now() - Date.parse(ts)) / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes} min ago`
    const d = new Date(ts)
    return d.toDateString() === new Date().toDateString()
        ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function Post({ post, instructor, onReply, onHide }) {
    return (
        <div className={post.hidden ? 'opacity-50' : ''}>
            <div className="flex items-baseline gap-2 text-xs">
                <span className={`font-semibold ${post.role === 'instructor' ? 'text-violet-800' : 'text-[var(--ath-text)]'}`}>
                    {post.mine ? 'You' : post.role === 'instructor' ? 'Instructor' : post.author}
                </span>
                <span className="text-[var(--ath-muted)]">{when(post.created)}</span>
                {post.hidden && <span className="rounded-full bg-[var(--ath-panel-muted)] px-1.5 text-[10px] font-semibold text-[var(--ath-muted)]">Hidden from students</span>}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--ath-text)]">{post.body}</p>
            <div className="mt-1 flex gap-3">
                {onReply && (
                    <button type="button" onClick={onReply} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ath-primary)] hover:underline">
                        <Reply className="h-3.5 w-3.5" aria-hidden="true" /> Reply
                    </button>
                )}
                {instructor && (
                    <button type="button" onClick={onHide} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ath-muted)] hover:text-[var(--ath-text)]">
                        {post.hidden ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
                        {post.hidden ? 'Show' : 'Hide'}
                    </button>
                )}
            </div>
        </div>
    )
}

export default function SectionDiscussion({ sectionId, here = 0 }) {
    const [posts, setPosts] = useState(null)
    const [open, setOpen] = useState(false)
    const [unread, setUnread] = useState(false)
    const [anchor, setAnchor] = useState(null)
    const [replyTo, setReplyTo] = useState(null)
    const [text, setText] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const openRef = useRef(false)
    const inputRef = useRef(null)
    const instructor = currentSession()?.role === 'instructor'

    const load = useCallback(async () => {
        try {
            const data = await accountRequest(`/discussion?section=${encodeURIComponent(sectionId)}`)
            setPosts(data.posts || [])
            setError('')
        } catch (e) {
            if (e.message !== 'signed_out') setError('The discussion could not load. It will try again.')
        }
    }, [sectionId])

    const show = useCallback((how) => {
        openRef.current = true
        setOpen(true)
        setUnread(false)
        logEvent('discussion_open', how, {}, sectionId)
        setTimeout(() => inputRef.current?.focus(), 50)
    }, [sectionId])

    const close = useCallback(() => {
        openRef.current = false
        setOpen(false)
        setAnchor(null)
        setReplyTo(null)
    }, [])

    useEffect(() => {
        setPosts(null)
        close()
        setUnread(false)
        load()
    }, [load, close])

    // A classmate posted in this section (live), and the passage shortcut from the selection toolbar.
    useEffect(() => {
        const onPost = (e) => {
            if (e.detail?.section !== sectionId) return
            load()
            if (!openRef.current) setUnread(true)
        }
        const onPassage = (e) => {
            setAnchor(String(e.detail?.quote || '').replace(/\s+/g, ' ').trim().slice(0, 300) || null)
            setReplyTo(null)
            show('passage')
        }
        window.addEventListener('alget-discussion', onPost)
        window.addEventListener('alget-discuss-passage', onPassage)
        return () => {
            window.removeEventListener('alget-discussion', onPost)
            window.removeEventListener('alget-discuss-passage', onPassage)
        }
    }, [sectionId, load, show])

    useEffect(() => {
        if (!open) return undefined
        const timer = setInterval(load, POLL_MS)
        const onKey = (e) => { if (e.key === 'Escape') close() }
        window.addEventListener('keydown', onKey)
        return () => { clearInterval(timer); window.removeEventListener('keydown', onKey) }
    }, [open, load, close])

    const threads = useMemo(() => {
        const list = posts || []
        return list.filter((p) => p.parent_id == null).map((t) => ({ ...t, replies: list.filter((p) => p.parent_id === t.id) }))
    }, [posts])
    const count = threads.filter((t) => !t.hidden).reduce((n, t) => n + 1 + t.replies.filter((r) => !r.hidden).length, 0)

    const submit = async (e) => {
        e.preventDefault()
        const body = text.trim()
        if (!body || busy) return
        setBusy(true)
        try {
            await accountRequest('/discussion', { method: 'POST', body: { section_id: sectionId, body, anchor: replyTo ? null : anchor, parent_id: replyTo?.id ?? null } })
            logEvent('discussion_post', replyTo ? 'reply' : 'thread', { anchored: Boolean(anchor && !replyTo), length: body.length }, sectionId)
            notifyDiscussion(sectionId)
            setText('')
            setAnchor(null)
            setReplyTo(null)
            await load()
        } catch (err) {
            setError(err.message === 'rate_limited' ? 'You are posting quickly. Wait a moment and try again.' : 'Your post was not sent. Try again.')
        } finally {
            setBusy(false)
        }
    }

    const toggleHidden = async (post) => {
        try {
            await accountRequest('/discussion/hide', { method: 'POST', body: { id: post.id, hidden: !post.hidden } })
            logEvent('discussion_hide', String(post.id), { hidden: !post.hidden }, sectionId)
            notifyDiscussion(sectionId)
            await load()
        } catch {
            setError('That change was not saved. Try again.')
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => (open ? close() : show('chip'))}
                aria-expanded={open}
                aria-label={`Section discussion: ${count} post${count === 1 ? '' : 's'}${unread ? ', new posts' : ''}`}
                className="editorial-chip relative inline-flex items-center gap-1.5 hover:text-[var(--ath-text)]"
            >
                <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
                Discuss{posts ? ` · ${count}` : ''}
                {unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-[var(--ath-background)]" aria-hidden="true" />}
            </button>

            {open && createPortal(
                // A div, not an aside: the theme makes every aside translucent, and the reading would show through.
                <div role="complementary" aria-label="Section discussion" className="fixed bottom-0 right-0 top-0 z-[135] flex w-[min(24rem,100vw)] flex-col border-l border-[var(--ath-line)] bg-[var(--ath-panel)] text-[var(--ath-text)] shadow-[var(--ath-shadow)]">
                    <header className="flex items-center gap-2 border-b border-[var(--ath-line)] px-4 py-3">
                        <div className="mr-auto">
                            <h2 className="text-base font-semibold">Section discussion</h2>
                            <p className="text-xs text-[var(--ath-muted)]">{here > 0 ? `${here} classmate${here === 1 ? '' : 's'} reading this section now · ` : ''}posts show your student ID</p>
                        </div>
                        <button type="button" onClick={close} aria-label="Close discussion" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--ath-panel-muted)]">
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </header>

                    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
                        {posts === null && !error && <p className="text-sm text-[var(--ath-muted)]">Loading…</p>}
                        {posts && threads.length === 0 && (
                            <p className="rounded-xl border border-dashed border-[var(--ath-line)] px-3 py-6 text-center text-sm text-[var(--ath-muted)]">
                                No posts yet. Ask a question about this section, or select a sentence and choose “Discuss this passage”.
                            </p>
                        )}
                        {threads.map((t) => (
                            <article key={t.id} className="rounded-xl border border-[var(--ath-line)] bg-white/70 p-3">
                                {t.anchor && (
                                    <button type="button" onClick={() => revealQuote(t.anchor)} title="Show this passage in the reading"
                                        className="mb-2 block w-full border-l-2 border-[var(--ath-primary)] pl-2 text-left text-xs italic leading-5 text-[var(--ath-muted)] hover:text-[var(--ath-text)]">
                                        “{t.anchor}”
                                    </button>
                                )}
                                <Post post={t} instructor={instructor} onReply={() => { setReplyTo(t); setAnchor(null); inputRef.current?.focus() }} onHide={() => toggleHidden(t)} />
                                {t.replies.length > 0 && (
                                    <div className="mt-3 space-y-3 border-l border-[var(--ath-line)] pl-3">
                                        {t.replies.map((r) => <Post key={r.id} post={r} instructor={instructor} onHide={() => toggleHidden(r)} />)}
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>

                    <form onSubmit={submit} className="border-t border-[var(--ath-line)] px-4 py-3">
                        {(anchor || replyTo) && (
                            <div className="mb-2 flex items-start gap-2 rounded-lg bg-[var(--ath-panel-muted)] px-2 py-1.5 text-xs text-[var(--ath-muted)]">
                                <span className="line-clamp-2 flex-1">{replyTo ? `Replying to ${replyTo.mine ? 'your post' : replyTo.role === 'instructor' ? 'the instructor' : replyTo.author}` : `About: “${anchor}”`}</span>
                                <button type="button" onClick={() => { setAnchor(null); setReplyTo(null) }} aria-label="Cancel" className="shrink-0"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
                            </div>
                        )}
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={inputRef}
                                value={text}
                                onChange={(e) => setText(e.target.value.slice(0, 1000))}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e) }}
                                rows={2}
                                placeholder={replyTo ? 'Write a reply' : 'Ask or share something about this section'}
                                aria-label="Your post"
                                className="min-h-[44px] flex-1 resize-none rounded-xl border border-[var(--ath-line)] bg-white px-3 py-2 text-sm leading-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                            />
                            <button type="submit" disabled={!text.trim() || busy} aria-label="Post" className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ath-primary)] text-[var(--ath-background)] disabled:opacity-50">
                                <Send className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                        {error && <p role="alert" className="mt-2 text-xs text-rose-800">{error}</p>}
                        <p className="mt-1.5 text-[11px] text-[var(--ath-muted)]">Visible to your class and instructor. Enter to post, Shift+Enter for a new line.</p>
                    </form>
                </div>,
                document.body,
            )}
        </>
    )
}
