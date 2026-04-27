import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getSocialIdentity } from '../lib/socialService'
import { logEvent } from '../lib/loggingService'
import { useToast } from '../lib/toastContext'
import { SkeletonCard } from './Skeleton'

/**
 * HighlightDiscussion — per-highlight reactions + threaded replies.
 *
 * Renders inside a popover anchored to a highlight. Loads reactions
 * (4 types: insight / question / disagree / same) and replies (depth-2
 * cap). Reactions are toggle-style: click to add, click again to remove.
 *
 * R1 from the annotation/social audit. Plays well with R3 (kindred
 * readers) because every reaction adds a co-thinking signal to the
 * social graph.
 */

const REACTION_TYPES = [
    { id: 'insight', label: 'Insight', emoji: '💡' },
    { id: 'question', label: 'Question', emoji: '❓' },
    { id: 'disagree', label: 'Disagree', emoji: '🤔' },
    { id: 'same', label: 'Same here', emoji: '🤝' },
]

export default function HighlightDiscussion({ highlightId, user, onClose }) {
    const toast = useToast()
    const [reactions, setReactions] = useState([])
    const [replies, setReplies] = useState([])
    const [myReactionTypes, setMyReactionTypes] = useState(new Set())
    const [replyText, setReplyText] = useState('')
    const [parentReplyId, setParentReplyId] = useState(null)
    const [loading, setLoading] = useState(true)
    const replyInputRef = useRef(null)

    const identity = useMemo(() => getSocialIdentity(user), [user])
    const userId = user?.id

    // a11y: focus the reply input when the modal mounts so keyboard users can
    // start typing immediately. Mount-only effect.
    useEffect(() => {
        const timer = setTimeout(() => {
            replyInputRef.current?.focus()
        }, 50)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            try {
                const [reactionRes, replyRes] = await Promise.all([
                    supabase
                        .from('highlight_reactions')
                        .select('id, user_id, reaction_type')
                        .eq('highlight_id', highlightId),
                    supabase
                        .from('highlight_replies')
                        .select('id, user_id, alias, color_token, body, parent_reply_id, created_at')
                        .eq('highlight_id', highlightId)
                        .order('created_at', { ascending: true }),
                ])
                if (cancelled) return
                const allReactions = reactionRes?.data || []
                setReactions(allReactions)
                setMyReactionTypes(
                    new Set(allReactions.filter((r) => r.user_id === userId).map((r) => r.reaction_type))
                )
                setReplies(replyRes?.data || [])
            } catch (err) {
                console.warn('[HighlightDiscussion] load failed:', err)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [highlightId, userId])

    const counts = useMemo(() => {
        const acc = {}
        reactions.forEach((r) => {
            acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1
        })
        return acc
    }, [reactions])

    const toggleReaction = async (reactionType) => {
        if (!userId) return
        // Block reaction toggling while initial load is still resolving so
        // we don't overwrite the load's setReactions with a partial in-flight
        // toggle. Cheaper than a reducer for this surface area.
        if (loading) return
        const has = myReactionTypes.has(reactionType)
        try {
            if (has) {
                await supabase
                    .from('highlight_reactions')
                    .delete()
                    .eq('highlight_id', highlightId)
                    .eq('user_id', userId)
                    .eq('reaction_type', reactionType)
                setReactions((prev) =>
                    prev.filter((r) => !(r.user_id === userId && r.reaction_type === reactionType))
                )
                setMyReactionTypes((prev) => {
                    const next = new Set(prev)
                    next.delete(reactionType)
                    return next
                })
                logEvent('highlight_reaction_remove', null, { highlight_id: highlightId, type: reactionType })
            } else {
                const { data } = await supabase
                    .from('highlight_reactions')
                    .insert({ highlight_id: highlightId, user_id: userId, reaction_type: reactionType })
                    .select('id, user_id, reaction_type')
                    .single()
                if (data) setReactions((prev) => [...prev, data])
                setMyReactionTypes((prev) => new Set(prev).add(reactionType))
                logEvent('highlight_reaction_add', null, { highlight_id: highlightId, type: reactionType })
            }
        } catch (err) {
            console.warn('[HighlightDiscussion] reaction toggle failed:', err)
            toast.error('Could not save reaction. Try again in a moment.')
        }
    }

    const submitReply = async () => {
        const body = replyText.trim()
        if (!body || !userId) return
        try {
            const { data } = await supabase
                .from('highlight_replies')
                .insert({
                    highlight_id: highlightId,
                    user_id: userId,
                    alias: identity.alias,
                    color_token: identity.colorToken,
                    body,
                    parent_reply_id: parentReplyId,
                })
                .select('id, user_id, alias, color_token, body, parent_reply_id, created_at')
                .single()
            if (data) setReplies((prev) => [...prev, data])
            setReplyText('')
            setParentReplyId(null)
            logEvent('highlight_reply_post', null, {
                highlight_id: highlightId,
                length: body.length,
                is_threaded: Boolean(parentReplyId),
            })
        } catch (err) {
            console.warn('[HighlightDiscussion] reply post failed:', err)
            toast.error('Could not post reply. Your text is preserved — try again.')
        }
    }

    const topLevelReplies = replies.filter((r) => !r.parent_reply_id)
    const childrenOf = (id) => replies.filter((r) => r.parent_reply_id === id)

    return (
        <div className="rounded-2xl border border-[var(--ath-line)] bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between">
                <p className="editorial-kicker">Discussion on this highlight</p>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs text-[var(--ath-muted)] underline"
                    >
                        Close
                    </button>
                )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {REACTION_TYPES.map((type) => {
                    const active = myReactionTypes.has(type.id)
                    const count = counts[type.id] || 0
                    return (
                        <button
                            key={type.id}
                            type="button"
                            onClick={() => toggleReaction(type.id)}
                            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-all duration-150 hover:-translate-y-px active:translate-y-0 ${
                                active
                                    ? 'border-[var(--ath-primary)] bg-[var(--ath-primary)] text-white shadow-sm'
                                    : 'border-[var(--ath-line)] bg-white text-[var(--ath-text)] hover:border-[var(--ath-primary)] hover:shadow-sm'
                            }`}
                            title={type.label}
                        >
                            <span>{type.emoji}</span>
                            <span>{type.label}</span>
                            {count > 0 && (
                                <span className={`ml-1 rounded-full px-1.5 ${active ? 'bg-white/30' : 'bg-[var(--ath-panel)]'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            <div className="mt-4 max-h-48 space-y-2 overflow-y-auto sm:max-h-64">
                {loading ? (
                    <div className="space-y-2" aria-busy="true">
                        <SkeletonCard lines={1} />
                        <SkeletonCard lines={2} />
                    </div>
                ) : topLevelReplies.length === 0 ? (
                    <p className="text-xs italic text-[var(--ath-muted)]">No replies yet. Add the first one.</p>
                ) : (
                    topLevelReplies.map((reply) => (
                        <ReplyCard
                            key={reply.id}
                            reply={reply}
                            children={childrenOf(reply.id)}
                            onReplyClick={() => setParentReplyId(reply.id)}
                        />
                    ))
                )}
            </div>

            <div className="mt-3 border-t border-[var(--ath-line)] pt-3">
                {parentReplyId && (
                    <p className="mb-1 text-xs text-[var(--ath-muted)]">
                        Replying to a thread.{' '}
                        <button onClick={() => setParentReplyId(null)} className="underline">cancel</button>
                    </p>
                )}
                <div className="flex gap-2">
                    <input
                        ref={replyInputRef}
                        type="text"
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault()
                                submitReply()
                            }
                        }}
                        placeholder="Write a thoughtful comment..."
                        maxLength={1200}
                        aria-label="Write a reply to this highlight"
                        className="editorial-input flex-1 text-sm"
                    />
                    <button
                        type="button"
                        onClick={submitReply}
                        disabled={!replyText.trim() || !userId}
                        className="editorial-button px-3 py-1 text-xs disabled:opacity-50"
                    >
                        Post
                    </button>
                </div>
            </div>
        </div>
    )
}

function ReplyCard({ reply, children: childReplies, onReplyClick }) {
    return (
        <div className="rounded-xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] p-3">
            <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--ath-text)]">{reply.alias || 'Peer'}</span>
                <span className="text-[var(--ath-muted)]">
                    {new Date(reply.created_at).toLocaleString()}
                </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-[var(--ath-text)]">{reply.body}</p>
            <button
                type="button"
                onClick={onReplyClick}
                className="mt-1 text-xs text-[var(--ath-primary)] underline"
            >
                Reply
            </button>
            {childReplies?.length > 0 && (
                <div className="mt-2 space-y-2 border-l border-[var(--ath-line)] pl-3">
                    {childReplies.map((child) => (
                        <div key={child.id} className="rounded-lg bg-white/70 p-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold">{child.alias || 'Peer'}</span>
                                <span className="text-[var(--ath-muted)]">
                                    {new Date(child.created_at).toLocaleString()}
                                </span>
                            </div>
                            <p className="mt-1 text-sm leading-5">{child.body}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
