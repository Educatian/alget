import { useState } from 'react'
import { Activity, HeartHandshake, Radio, Users } from 'lucide-react'
import { SOCIAL_REACTIONS, getAliasInitials } from '../lib/socialService'

function pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`
}

const COMPACT_REACTION_LABELS = {
    clicked: 'Clicked',
    need_example: 'Example',
    stuck_too: 'Stuck'
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
    peers = [],
    sameHeadingPeers = [],
    sameConceptPeers = [],
    signalSummary = {},
    liveFeed = [],
    onReaction,
    sectionTitle,
    socialDynamics = null,
    onStartRound
}) {
    const [roundStarted, setRoundStarted] = useState(false)
    const livePeerCount = peers.length
    const sameHeadingCount = sameHeadingPeers.length
    const sameConceptCount = sameConceptPeers.length

    return (
        <section className="rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-3 shadow-[var(--ath-shadow-soft)] backdrop-blur-xl">
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--ath-primary)] text-[var(--ath-background)] shadow-sm">
                        <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[var(--ath-text)]">Social Pulse</p>
                        <p className="truncate text-xs text-[var(--ath-muted)]" title={sectionTitle || 'Current section'}>
                            {sectionTitle || 'Current section'}
                        </p>
                    </div>
                    <span className={`flex items-center gap-1 rounded-full border border-[var(--ath-line)] px-2 py-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] ${connected ? 'bg-[color-mix(in_srgb,var(--ath-primary)_13%,var(--ath-panel))] text-[var(--ath-primary-deep)]' : 'bg-[var(--ath-panel-muted)] text-[var(--ath-muted)]'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-[var(--ath-muted)]'}`} />
                        {connected ? 'Live' : 'Offline'}
                    </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                    <PulseMetric icon={<Radio className="h-3.5 w-3.5" />} label="Section" value={livePeerCount} />
                    <PulseMetric icon={<Activity className="h-3.5 w-3.5" />} label="Passage" value={sameHeadingCount} />
                    <PulseMetric icon={<HeartHandshake className="h-3.5 w-3.5" />} label="Concept" value={sameConceptCount} />
                </div>

                {socialDynamics?.prompts?.[0] && (
                    <div className="rounded-xl bg-[color-mix(in_srgb,var(--ath-primary)_8%,var(--ath-panel))] px-3 py-2">
                        <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-[var(--ath-secondary)]">Try with peers</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--ath-text)]">{socialDynamics.prompts[0]}</p>
                    </div>
                )}

                {socialDynamics?.rounds?.[0] && livePeerCount > 0 && (
                    <div className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-3 py-2">
                        <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-[var(--ath-secondary)]">Peer round</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--ath-text)]">{socialDynamics.rounds[0].prompt}</p>
                        <button type="button" onClick={() => { setRoundStarted(true); onStartRound?.(socialDynamics.rounds[0]) }} className="mt-2 rounded-lg bg-[var(--ath-primary)] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                            {roundStarted ? 'Round started' : `Join with ${livePeerCount} peer${livePeerCount === 1 ? '' : 's'}`}
                        </button>
                    </div>
                )}

                {(livePeerCount > 0 || liveFeed.length > 0) && (
                    <div className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] p-2">
                        {livePeerCount > 0 && (
                            <div className="flex items-center gap-1.5">
                                {peers.slice(0, 5).map((peer) => (
                                    <div
                                        key={peer.key}
                                        className={`flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br ${peer.colorToken || 'from-slate-500 to-slate-400'} text-[0.62rem] font-bold text-white shadow-sm`}
                                        title={peer.alias}
                                    >
                                        {getAliasInitials(peer.alias)}
                                    </div>
                                ))}
                                {livePeerCount > 5 && (
                                    <span className="ml-0.5 text-xs font-semibold text-[var(--ath-muted)]">
                                        +{livePeerCount - 5}
                                    </span>
                                )}
                                <span className="ml-auto text-xs font-semibold text-[var(--ath-muted)]">
                                    {pluralize(livePeerCount, 'reader', 'readers')}
                                </span>
                            </div>
                        )}

                        {liveFeed.length > 0 && (
                            <ul className={livePeerCount > 0 ? 'mt-2 space-y-1 border-t border-[var(--ath-line)] pt-2' : 'space-y-1'}>
                                {liveFeed.slice(0, 2).map((entry, index) => (
                                    <li
                                        key={`${entry.alias}-${entry.kind}-${entry.createdAt || index}`}
                                        className="truncate text-xs text-[var(--ath-muted)]"
                                        title={formatLiveFeedEntry(entry)}
                                    >
                                        {formatLiveFeedEntry(entry)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-3 py-2">
                        <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-[var(--ath-secondary)]">Done</p>
                        <p className="text-base font-bold text-[var(--ath-text)]">{signalSummary.completionsToday || 0}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-3 py-2">
                        <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-[var(--ath-secondary)]">Help</p>
                        <p className="text-base font-bold text-[var(--ath-text)]">{signalSummary.helpOpensToday || 0}</p>
                    </div>
                </div>

                <div>
                    <p className="mb-1.5 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-[var(--ath-secondary)]">React</p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {SOCIAL_REACTIONS.map((reaction) => (
                            <button
                                key={reaction.id}
                                type="button"
                                onClick={() => onReaction?.(reaction.id)}
                                className="min-w-0 rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-2 py-2 text-center transition-all hover:border-[var(--ath-line-strong)] hover:bg-[var(--ath-panel)]"
                                title={reaction.label}
                            >
                                <span className="block truncate text-[0.72rem] font-semibold text-[var(--ath-muted)]">
                                    {COMPACT_REACTION_LABELS[reaction.id] || reaction.label}
                                </span>
                                <span className="mt-1 block text-sm font-bold text-[var(--ath-secondary)]">
                                    {signalSummary.reactionCounts?.[reaction.id] || 0}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}

function PulseMetric({ icon, label, value }) {
    return (
        <div className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-2 py-2">
            <div className="mb-1 flex items-center gap-1 text-[var(--ath-secondary)]">
                {icon}
                <span className="truncate text-[0.66rem] font-bold uppercase tracking-[0.1em]">{label}</span>
            </div>
            <p className="text-lg font-bold leading-none text-[var(--ath-text)]">{value}</p>
        </div>
    )
}
