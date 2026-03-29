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
        <section className="mb-8 rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-[#9E1B32] to-[#7A1527] text-white shadow-lg shadow-red-900/20">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                                Social Pulse
                            </p>
                            <h3 className="text-lg font-bold text-slate-900">
                                {livePeerCount > 0
                                    ? `${pluralize(livePeerCount, 'peer is', 'peers are')} reading ${sectionTitle || 'this section'} right now.`
                                    : 'Be the first live reader in this section right now.'}
                            </h3>
                        </div>
                        <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {connected ? 'Live presence on' : 'Live presence offline'}
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
                            <div className="flex h-10 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                                +{livePeerCount - 5} more
                            </div>
                        )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-2 flex items-center gap-2 text-slate-500">
                                <Radio className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-[0.18em]">Same section</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-900">{livePeerCount}</p>
                            <p className="mt-1 text-sm text-slate-600">Live peers are active in this section.</p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-2 flex items-center gap-2 text-slate-500">
                                <Activity className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-[0.18em]">Same part</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-900">{sameHeadingCount}</p>
                            <p className="mt-1 text-sm text-slate-600">Peers are in this same reading zone.</p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-2 flex items-center gap-2 text-slate-500">
                                <HeartHandshake className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-[0.18em]">Same concept</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-900">{sameConceptCount}</p>
                            <p className="mt-1 text-sm text-slate-600">Peers are focused on this concept cluster.</p>
                        </div>
                    </div>
                </div>

                <div className="w-full rounded-3xl border border-slate-200 bg-linear-to-br from-slate-50 to-white p-4 lg:max-w-sm">
                    <div className="mb-3 flex items-center gap-2">
                        <Flame className="h-4 w-4 text-[#9E1B32]" />
                        <p className="text-sm font-bold text-slate-900">Quick social pulse</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Completed today</p>
                            <p className="mt-2 text-xl font-bold text-slate-900">{signalSummary.completionsToday}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Opened help today</p>
                            <p className="mt-2 text-xl font-bold text-slate-900">{signalSummary.helpOpensToday}</p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-2">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">React to this part</p>
                        {SOCIAL_REACTIONS.map((reaction) => (
                            <button
                                key={reaction.id}
                                type="button"
                                onClick={() => onReaction?.(reaction.id)}
                                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-all hover:border-slate-300 hover:bg-slate-50"
                            >
                                <span className="text-sm font-semibold text-slate-700">{reaction.label}</span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                                    {signalSummary.reactionCounts?.[reaction.id] || 0}
                                </span>
                            </button>
                        ))}
                    </div>

                    {liveFeed.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Live feed</p>
                            <ul className="mt-2 space-y-2">
                                {liveFeed.slice(0, 3).map((entry, index) => (
                                    <li key={`${entry.alias}-${entry.kind}-${entry.createdAt || index}`} className="text-sm text-slate-600">
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
