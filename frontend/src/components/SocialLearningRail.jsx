import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, MessageCircle, UsersRound } from 'lucide-react'

const CUE_OPTIONS = [
    ['need_example', 'Need an example'],
    ['stuck_too', 'I am pausing here'],
    ['important', 'Worth revisiting']
]

function Card({ label, children, action, onAction }) {
    return (
        <section className="rounded-2xl border border-[var(--ath-line)] bg-[rgba(253,253,249,0.92)] p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-primary)]">{label}</p>
            {children}
            {action && (
                <button
                    type="button"
                    onClick={onAction}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--ath-primary)] transition-colors hover:text-[var(--ath-text)]"
                >
                    {action} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            )}
        </section>
    )
}

export default function SocialLearningRail({
    connected = false,
    peers = [],
    sameHeadingPeers = [],
    sameConceptPeers = [],
    signalSummary = {},
    liveFeed = [],
    sectionTitle = '',
    onReaction,
    onOpenEvidence,
    onConnect
}) {
    const [cueSent, setCueSent] = useState('')
    const [newSignal, setNewSignal] = useState(false)
    const lastFeedKey = useRef('')
    const topConfusion = signalSummary.topConfusion
    const focusCount = sameHeadingPeers.length || sameConceptPeers.length
    const peerMessage = focusCount > 0
        ? `${focusCount} learner${focusCount === 1 ? '' : 's'} is exploring this passage`
        : peers.length > 0
            ? `${peers.length} learner${peers.length === 1 ? '' : 's'} reading nearby`
            : 'Signals appear as readers join'
    const recentEcho = useMemo(
        () => liveFeed.find((entry) => entry.kind === 'reaction' || entry.kind === 'completion'),
        [liveFeed]
    )

    useEffect(() => {
        const latest = liveFeed[0]
        if (!latest) return
        const key = `${latest.alias || 'peer'}-${latest.kind || 'signal'}-${latest.createdAt || ''}`
        if (!lastFeedKey.current) {
            lastFeedKey.current = key
            return
        }
        if (lastFeedKey.current === key) return
        lastFeedKey.current = key
        const showTimeoutId = window.setTimeout(() => setNewSignal(true), 0)
        const hideTimeoutId = window.setTimeout(() => setNewSignal(false), 4500)
        return () => {
            window.clearTimeout(showTimeoutId)
            window.clearTimeout(hideTimeoutId)
        }
    }, [liveFeed])

    const sendCue = async (cue) => {
        setCueSent(cue)
        await onReaction?.(cue)
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[rgba(255,255,255,0.86)] px-5 py-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-base font-semibold text-[var(--ath-text)]">Social learning</p>
                    <p className="mt-1 text-xs text-[var(--ath-muted)]">Passive signals, optional connection</p>
                </div>
                <span className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} title={connected ? 'Connected' : 'Reconnecting'} />
            </div>

            {newSignal && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[rgba(15,81,103,0.18)] bg-[rgba(200,226,236,0.22)] px-3 py-2 text-xs text-[var(--ath-primary)]" role="status" aria-live="polite">
                    <span className="font-semibold">New peer signal available</span>
                    <button type="button" onClick={() => setNewSignal(false)} className="font-semibold hover:text-[var(--ath-text)]">Dismiss</button>
                </div>
            )}

            <div className="mt-5 space-y-3">
                <Card label="Peer pulse" action="See shared question" onAction={onOpenEvidence}>
                    <p className="mt-2 text-sm font-semibold text-[var(--ath-text)]">
                        {topConfusion ? 'Most readers paused here' : peerMessage}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[var(--ath-muted)]">
                        {topConfusion
                            ? `${topConfusion.count} learner${topConfusion.count === 1 ? '' : 's'} marked this idea as unclear.`
                            : 'Your reading remains private unless you choose to send a cue.'}
                    </p>
                </Card>

                <Card label="Evidence echo" action="Open shared evidence" onAction={onOpenEvidence}>
                    <p className="mt-2 text-sm font-semibold text-[var(--ath-text)]">
                        {recentEcho?.reactionId === 'important' ? '“This deserves another look.”' : 'Connect a claim to evidence'}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[var(--ath-muted)]">
                        {recentEcho ? 'A peer signal was added without exposing their identity.' : 'Short, contextual notes appear beside the passage instead of in a separate forum.'}
                    </p>
                </Card>

                <Card label="Your cue">
                    <p className="mt-2 text-xs leading-5 text-[var(--ath-muted)]">One tap helps the group see where support is useful.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {CUE_OPTIONS.map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => sendCue(id)}
                                className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${cueSent === id
                                    ? 'border-[var(--ath-primary)] bg-[rgba(15,81,103,0.08)] text-[var(--ath-primary)]'
                                    : 'border-[var(--ath-line)] bg-white text-[var(--ath-muted)] hover:border-[var(--ath-primary)] hover:text-[var(--ath-primary)]'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </Card>

                <Card label="Optional connection" action="Invite anonymously" onAction={onConnect}>
                    <div className="mt-2 flex items-start gap-2">
                        <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ath-primary)]" aria-hidden="true" />
                        <p className="text-sm font-semibold text-[var(--ath-text)]">Find a thinking partner</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--ath-muted)]">Invite someone exploring the same question. Nothing opens until both learners opt in.</p>
                </Card>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--ath-muted)]">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{sectionTitle ? `Signals for ${sectionTitle}` : 'Signals stay attached to this reading'}</span>
            </div>
        </div>
    )
}
