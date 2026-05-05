import { Flame, HelpCircle, MessageCircleQuestion, Radio, Sparkles, Users } from 'lucide-react'

function countLabel(count, label) {
    return `${count || 0} ${label}${count === 1 ? '' : 's'}`
}

function getTopReaction(signalSummary = {}) {
    const choices = signalSummary.passageReactionChoices || signalSummary.supportChoices || []
    return choices
        .filter((choice) => choice.count > 0)
        .sort((left, right) => right.count - left.count)[0] || null
}

export default function PeerPulse({
    connected,
    peers = [],
    sameHeadingPeers = [],
    sameConceptPeers = [],
    signalSummary = {},
    activeHeading = '',
    onReaction,
}) {
    const topReaction = getTopReaction(signalSummary)
    const topConfusion = signalSummary.topConfusion
    const livePeerCount = peers.length
    const canReactToPassage = Boolean(activeHeading)

    return (
        <section className="my-8 rounded-[1.8rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.78)] p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <p className="editorial-kicker">Peer Pulse</p>
                    </div>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--ath-text)]">
                        What readers are noticing here
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ath-muted)]">
                        A lightweight class signal, not a chat room. Use it to see where other readers pause,
                        request support, or finish the section.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => onReaction?.('need_example')}
                        disabled={!canReactToPassage}
                        className="editorial-button-secondary px-3 py-2 text-xs"
                    >
                        Need example
                    </button>
                    <button
                        type="button"
                        onClick={() => onReaction?.('stuck_too')}
                        disabled={!canReactToPassage}
                        className="editorial-button-secondary px-3 py-2 text-xs"
                    >
                        Stuck too
                    </button>
                </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                    <div className="flex items-center gap-2 text-[var(--ath-secondary)]">
                        <Users className="h-4 w-4" />
                        <span className="editorial-label">Reading Now</span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-[var(--ath-text)]">{livePeerCount}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">
                        {sameHeadingPeers.length > 0
                            ? `${countLabel(sameHeadingPeers.length, 'reader')} on this passage`
                            : sameConceptPeers.length > 0
                                ? `${countLabel(sameConceptPeers.length, 'reader')} on this concept`
                                : canReactToPassage
                                    ? `You are reading "${activeHeading}"`
                                    : 'Start reading to activate passage signals'}
                    </p>
                </div>

                <div className="rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                    <div className="flex items-center gap-2 text-[var(--ath-secondary)]">
                        <HelpCircle className="h-4 w-4" />
                        <span className="editorial-label">Common Pause</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ath-text)]">
                        {topConfusion
                            ? `${topConfusion.count} reader signal near "${topConfusion.heading}"`
                            : 'No confusion cluster yet'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">
                        Signals come from "Need example" and "Stuck too" reactions.
                    </p>
                </div>

                <div className="rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                    <div className="flex items-center gap-2 text-[var(--ath-secondary)]">
                        <Flame className="h-4 w-4" />
                        <span className="editorial-label">Top Support</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ath-text)]">
                        {topReaction
                            ? `${topReaction.label} (${topReaction.count})`
                            : 'No support pattern yet'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">
                        {signalSummary.helpOpensToday > 0
                            ? `${countLabel(signalSummary.helpOpensToday, 'reader')} opened BigAL support in this section today`
                            : 'Support choices will appear as readers interact'}
                    </p>
                </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--ath-line)] bg-white/70 px-3 py-2 text-xs font-semibold text-[var(--ath-muted)]">
                    <Radio className="h-4 w-4 text-[var(--ath-primary)]" />
                    {countLabel(signalSummary.completionsToday, 'completion')} today
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[var(--ath-line)] bg-white/70 px-3 py-2 text-xs font-semibold text-[var(--ath-muted)]">
                    <MessageCircleQuestion className="h-4 w-4 text-[var(--ath-primary)]" />
                    {countLabel(signalSummary.reactionCounts?.need_example || 0, 'example request')}
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[var(--ath-line)] bg-white/70 px-3 py-2 text-xs font-semibold text-[var(--ath-muted)]">
                    <Sparkles className="h-4 w-4 text-[var(--ath-primary)]" />
                    {countLabel(signalSummary.reactionCounts?.clicked || 0, 'clicked moment')}
                </div>
            </div>
        </section>
    )
}
