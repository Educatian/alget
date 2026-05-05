import { Activity, Flame, HeartHandshake, Radio, Users } from 'lucide-react'
import { SOCIAL_REACTIONS, getAliasInitials } from '../lib/socialService'

function pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`
}

function formatLiveFeedEntry(entry) {
    if (entry.kind === 'reaction') {
        const reaction = SOCIAL_REACTIONS.find((item) => item.id === entry.reactionId)
        return `${entry.alias} reacted: ${reaction?.label || entry.reactionId}`
    }

    if (entry.kind === 'completion') {
        return `${entry.alias} just completed this section`
    }

    if (entry.kind === 'help_open') {
        return `${entry.alias} opened support in this section`
    }

    return `${entry.alias} is active here`
}

export default function SocialPresencePanel({
    connected,
    peers,
    sameHeadingPeers,
    sameConceptPeers,
    signalSummary,
    liveFeed,
    onReaction,
    sectionTitle
}) {
    const livePeerCount = peers.length
    const sameHeadingCount = sameHeadingPeers.length
    const sameConceptCount = sameConceptPeers.length

    return (
        <section className="rounded-3xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-5 shadow-[var(--ath-shadow-soft)] backdrop-blur-xl">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ath-primary)] text-[var(--ath-background)] shadow-lg">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--ath-secondary)]">
                                Social Pulse
                            </p>
                            <h3 className="text-base font-bold text-[var(--ath-text)]">
                                {livePeerCount > 0
                                    ? `${pluralize(livePeerCount, 'peer is', 'peers are')} reading ${sectionTitle || 'this section'} right now.`
                                    : 'Be the first live reader in this section right now.'}
                            </h3>
                        </div>
                        <span className={`ml-auto rounded-full border border-[var(--ath-line)] px-3 py-1 text-xs font-semibold ${connected ? 'bg-[color-mix(in_srgb,var(--ath-primary)_14%,var(--ath-panel))] text-[var(--ath-primary-deep)]' : 'bg-[var(--ath-panel-muted)] text-[var(--ath-muted)]'}`}>
                            {connected ? 'Live Presence On' : 'Live Presence Offline'}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {peers.slice(0, 5).map((peer) => (
                            <div
                                key={peer.key}
                                className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br ${peer.colorToken || 'from-slate-500 to-slate-400'} text-xs font-bold text-white shadow-md`}
                                title={peer.alias}
                            >
                                {getAliasInitials(peer.alias)}
                            </div>
                        ))}
                        {livePeerCount > 5 && (
                            <div className="flex h-10 items-center rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-3 text-xs font-semibold text-[var(--ath-muted)]">
                                +{livePeerCount - 5} more
                            </div>
                        )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] p-4">
                            <div className="mb-2 flex items-center gap-2 text-[var(--ath-secondary)]">
                                <Radio className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-[0.18em]">Same Section</span>
                            </div>
                            <p className="text-2xl font-bold text-[var(--ath-text)]">{livePeerCount}</p>
                            <p className="mt-1 text-sm text-[var(--ath-muted)]">Live peers are active in this section.</p>
                        </div>

                        <div className="rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] p-4">
                            <div className="mb-2 flex items-center gap-2 text-[var(--ath-secondary)]">
                                <Activity className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-[0.18em]">Same Passage</span>
                            </div>
                            <p className="text-2xl font-bold text-[var(--ath-text)]">{sameHeadingCount}</p>
                            <p className="mt-1 text-sm text-[var(--ath-muted)]">Peers are in this same reading zone.</p>
                        </div>

                        <div className="rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] p-4">
                            <div className="mb-2 flex items-center gap-2 text-[var(--ath-secondary)]">
                                <HeartHandshake className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-[0.18em]">Same Concept</span>
                            </div>
                            <p className="text-2xl font-bold text-[var(--ath-text)]">{sameConceptCount}</p>
                            <p className="mt-1 text-sm text-[var(--ath-muted)]">Peers are focused on this concept cluster.</p>
                        </div>
                    </div>
                </div>

                <div className="w-full rounded-3xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] p-4 lg:max-w-sm">
                    <div className="mb-3 flex items-center gap-2">
                        <Flame className="h-4 w-4 text-[var(--ath-primary)]" />
                        <p className="text-sm font-bold text-[var(--ath-text)]">Quick Social Pulse</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-[var(--ath-surface-strong)] p-3 shadow-sm ring-1 ring-[var(--ath-line)]">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Completed Today</p>
                            <p className="mt-2 text-xl font-bold text-[var(--ath-text)]">{signalSummary.completionsToday}</p>
                        </div>
                        <div className="rounded-2xl bg-[var(--ath-surface-strong)] p-3 shadow-sm ring-1 ring-[var(--ath-line)]">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Opened Help Today</p>
                            <p className="mt-2 text-xl font-bold text-[var(--ath-text)]">{signalSummary.helpOpensToday}</p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-2">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">React to This Part</p>
                        {SOCIAL_REACTIONS.map((reaction) => (
                            <button
                                key={reaction.id}
                                type="button"
                                onClick={() => onReaction?.(reaction.id)}
                                className="flex w-full items-center justify-between rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-4 py-3 text-left transition-all hover:border-[var(--ath-line-strong)] hover:bg-[var(--ath-panel)]"
                            >
                                <span className="text-sm font-semibold text-[var(--ath-muted)]">{reaction.label}</span>
                                <span className="rounded-full bg-[var(--ath-panel-muted)] px-2.5 py-1 text-xs font-bold text-[var(--ath-secondary)]">
                                    {signalSummary.reactionCounts?.[reaction.id] || 0}
                                </span>
                            </button>
                        ))}
                    </div>

                    {liveFeed.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Live Feed</p>
                            <ul className="mt-2 space-y-2">
                                {liveFeed.slice(0, 3).map((entry, index) => (
                                    <li key={`${entry.alias}-${entry.kind}-${entry.createdAt || index}`} className="text-sm text-[var(--ath-muted)]">
                                        {formatLiveFeedEntry(entry)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
